/**
 * server.js — SKÖLL-TRACK Persistent ML Backend  [ESM REWRITE]
 * ================================================
 * Pure ES6 import syntax. Uses @tensorflow/tfjs CPU backend (pure JS —
 * NO node-gyp, NO C++ native addon, NO Windows build tools required).
 * Exposes the LSTM forecaster via WebSocket; clients receive live
 * space-weather predictions without burning browser GPU.
 *
 * ── Quick-start ────────────────────────────────────────────────────────────
 *   npm install ws dotenv          # tfjs already in package.json deps
 *   node server.js                   # once-off
 *   pm2 start ecosystem.config.js    # persistent (recommended)
 *
 * ── WebSocket message protocol ─────────────────────────────────────────────
 *
 *  CLIENT → SERVER
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │ { type: 'predict',     features: number[] }   one-shot inference    │
 *  │ { type: 'subscribe',   interval?: number  }   continuous stream     │
 *  │ { type: 'unsubscribe'                    }   stop stream             │
 *  │ { type: 'status'                         }   model health / uptime  │
 *  │ { type: 'ping'                           }   keep-alive             │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  SERVER → CLIENT
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │ { type: 'prediction',  data: PredictionPayload, ts: ISO string   }  │
 *  │ { type: 'status',      data: StatusPayload,    ts: ISO string   }   │
 *  │ { type: 'error',       message: string,        ts: ISO string   }   │
 *  │ { type: 'pong'                                                  }   │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Environment variables (.env or PM2 env) ─────────────────────────────────
 *   PORT          WebSocket server port            (default: 8080)
 *   MODEL_PATH    Path to model.json               (default: ./public/models/skoll-lstm-v1/model.json)
 *   NOAA_API      NOAA real-time solar wind URL    (default: built-in 1-min ACE URL)
 *   FETCH_INTERVAL_MS  How often to pull NOAA data (default: 60000 = 1 min)
 *   LOG_LEVEL     'info' | 'debug' | 'silent'      (default: 'info')
 */

// ─── Imports (pure ES6 — no require) ─────────────────────────────────────────
import { createServer }               from 'http';
import { readFileSync, existsSync, appendFileSync, mkdirSync }   from 'fs';
import { fileURLToPath }              from 'url';
import { dirname, join }              from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import * as tf                        from '@tensorflow/tfjs';

// ─── dotenv (optional — swallowed if not installed) ───────────────────────────
try {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
} catch { /* env vars must be set externally if dotenv is absent */ }

// ─── __dirname shim (ESM has no __dirname) ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Configuration ────────────────────────────────────────────────────────────
const PORT           = parseInt(process.env.PORT            ?? '8080', 10);
const MODEL_PATH     = process.env.MODEL_PATH
  ?? join(__dirname, 'public', 'models', 'skoll-lstm-v1', 'model.json');
const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL_MS ?? '60000', 10);
const LOG_LEVEL      = (process.env.LOG_LEVEL ?? 'info').toLowerCase();

const NOAA_PLASMA_URL = process.env.NOAA_API
  ?? 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
const NOAA_MAG_URL =
  'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json';
const EPHEMERIS_ARCHIVE_DIR = join(__dirname, 'data', 'ephemeris');
const EPHEMERIS_ARCHIVE_FILE = join(EPHEMERIS_ARCHIVE_DIR, 'archive.jsonl');

const HORIZONS_BODY_IDS = {
  Mercury: '199',
  Venus: '299',
  Earth: '399',
  Moon: '301',
  Mars: '499',
  Jupiter: '599',
  Io: '501',
  Europa: '502',
  Saturn: '699',
  Titan: '606',
  Uranus: '799',
  Neptune: '899',
  Pluto: '999',
};

const BODY_ROTATION_HOURS = {
  Mercury: 1407.6,
  Venus: -5832.5,
  Earth: 23.9345,
  Moon: 655.728,
  Mars: 24.6229,
  Jupiter: 9.925,
  Io: 42.46,
  Europa: 85.23,
  Saturn: 10.656,
  Titan: 382.68,
  Uranus: -17.24,
  Neptune: 16.11,
  Pluto: -153.2928,
};

// ─── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info  : (...a) => LOG_LEVEL !== 'silent' && console.log ('[INFO] ', new Date().toISOString(), ...a),
  debug : (...a) => LOG_LEVEL === 'debug'  && console.log ('[DEBUG]', new Date().toISOString(), ...a),
  warn  : (...a) => LOG_LEVEL !== 'silent' && console.warn('[WARN] ', new Date().toISOString(), ...a),
  error : (...a) =>                           console.error('[ERROR]', new Date().toISOString(), ...a),
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function parseHorizonsVectorResult(resultText) {
  const parseNumeric = (raw) => Number.parseFloat(String(raw).replace(/[dD]/g, 'E'));
  const NUM_RE = '([+-]?\\d+(?:\\.\\d+)?(?:[DE][+-]?\\d+)?)';
  const vectorBlockMatch = resultText.match(/\$\$SOE([\s\S]*?)\$\$EOE/i);
  const source = vectorBlockMatch ? vectorBlockMatch[1] : resultText;

  const xMatch = source.match(new RegExp(`\\bX\\s*=\\s*${NUM_RE}`, 'i'));
  const yMatch = source.match(new RegExp(`\\bY\\s*=\\s*${NUM_RE}`, 'i'));
  const zMatch = source.match(new RegExp(`\\bZ\\s*=\\s*${NUM_RE}`, 'i'));
  const vxMatch = source.match(new RegExp(`\\bVX\\s*=\\s*${NUM_RE}`, 'i'));
  const vyMatch = source.match(new RegExp(`\\bVY\\s*=\\s*${NUM_RE}`, 'i'));
  const vzMatch = source.match(new RegExp(`\\bVZ\\s*=\\s*${NUM_RE}`, 'i'));
  if (!xMatch || !yMatch || !zMatch) {
    // Fallback: parse the first line containing at least 3 numeric values.
    const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
    const sciRe = /[+-]?\d+(?:\.\d+)?(?:[DE][+-]?\d+)?/gi;
    for (const line of lines) {
      const nums = (line.match(sciRe) ?? []).filter((token) => /\d/.test(token));
      if (nums.length >= 3) {
        return {
          x: parseNumeric(nums[0]),
          y: parseNumeric(nums[1]),
          z: parseNumeric(nums[2]),
          vx: nums.length >= 6 ? parseNumeric(nums[3]) : null,
          vy: nums.length >= 6 ? parseNumeric(nums[4]) : null,
          vz: nums.length >= 6 ? parseNumeric(nums[5]) : null,
        };
      }
    }
    return null;
  }

  return {
    x: parseNumeric(xMatch[1]),
    y: parseNumeric(yMatch[1]),
    z: parseNumeric(zMatch[1]),
    vx: vxMatch ? parseNumeric(vxMatch[1]) : null,
    vy: vyMatch ? parseNumeric(vyMatch[1]) : null,
    vz: vzMatch ? parseNumeric(vzMatch[1]) : null,
  };
}

async function fetchHorizonsVector(bodyName, isoDate) {
  const command = HORIZONS_BODY_IDS[bodyName];
  if (!command) {
    throw new Error(`Unsupported body for Horizons query: ${bodyName}`);
  }

  const start = new Date(isoDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  const stop = new Date(start.getTime() + 60_000);

  const fmt = (d) => d.toISOString().slice(0, 16);
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: command,
    EPHEM_TYPE: 'VECTORS',
    CENTER: '500@0',
    START_TIME: fmt(start),
    STOP_TIME: fmt(stop),
    STEP_SIZE: '1m',
    OUT_UNITS: 'AU-D',
    VEC_TABLE: '2',
    CSV_FORMAT: 'NO',
  });

  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Horizons HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(`Horizons returned error: ${payload.error}`);
  }
  if (!payload?.result) {
    throw new Error('Horizons response missing result payload');
  }

  const parsed = parseHorizonsVectorResult(payload.result);
  if (!parsed) {
    const preview = payload.result.slice(0, 240).replace(/\s+/g, ' ');
    throw new Error(`Unable to parse Horizons vector payload: ${preview}`);
  }

  return {
    provider: 'jpl-horizons',
    body: bodyName,
    date: start.toISOString(),
    ...parsed,
    ...computeSpinState(bodyName, start),
  };
}

function computeSpinState(bodyName, date) {
  const periodHours = BODY_ROTATION_HOURS[bodyName];
  if (!periodHours || !Number.isFinite(periodHours)) {
    return { spinPhase01: null, rotationPeriodHours: null };
  }

  const j2000Ms = Date.UTC(2000, 0, 1, 12, 0, 0, 0);
  const elapsedHours = (date.getTime() - j2000Ms) / 3_600_000;
  const rawTurns = elapsedHours / periodHours;
  const phase = ((rawTurns % 1) + 1) % 1;
  return {
    spinPhase01: phase,
    rotationPeriodHours: periodHours,
  };
}

async function harvestDailyEphemerisSnapshot() {
  const now = new Date();
  const bodies = Object.keys(HORIZONS_BODY_IDS);
  log.info(`Daily ephemeris harvest starting for ${bodies.length} bodies.`);
  const vectors = [];
  for (const body of bodies) {
    try {
      const vector = await fetchHorizonsVector(body, now.toISOString());
      vectors.push(vector);
    } catch (err) {
      vectors.push({ body, error: String(err) });
    }
  }

  mkdirSync(EPHEMERIS_ARCHIVE_DIR, { recursive: true });
  const envelope = {
    ts: new Date().toISOString(),
    schemaVersion: 1,
    source: 'daily-horizons-harvest',
    date: now.toISOString(),
    vectors,
  };
  appendFileSync(EPHEMERIS_ARCHIVE_FILE, `${JSON.stringify(envelope)}\n`, 'utf-8');
  log.info(`Daily ephemeris harvest appended to ${EPHEMERIS_ARCHIVE_FILE}`);
}

// ─── TensorFlow CPU backend (pure JS — zero native compilation) ───────────────
log.info('Registering TensorFlow.js CPU backend…');
await tf.setBackend('cpu');
await tf.ready();
log.info(`TF ready — backend: ${tf.getBackend()}, version: ${tf.version.tfjs}`);

// ─── Model singleton ──────────────────────────────────────────────────────────
/** @type {import('@tensorflow/tfjs').LayersModel | null} */
let model          = null;
let modelLoadError = null;

/**
 * Load model.json + weight bins from disk using tf.io.fromMemory().
 * This is the correct approach for @tensorflow/tfjs (no tfjs-node file handler).
 */
async function loadModel() {
  if (!existsSync(MODEL_PATH)) {
    modelLoadError = `Model file not found: ${MODEL_PATH}`;
    log.warn(modelLoadError);
    log.warn('Running in heuristic-fallback mode until a model.json is placed at the path above.');
    return;
  }
  try {
    log.info(`Loading model from: ${MODEL_PATH}`);
    const modelJson     = JSON.parse(readFileSync(MODEL_PATH, 'utf-8'));
    const modelDir      = dirname(MODEL_PATH);
    const weightBuffers = [];

    if (Array.isArray(modelJson.weightsManifest)) {
      for (const group of modelJson.weightsManifest) {
        for (const weightFile of group.paths) {
          const weightPath = join(modelDir, weightFile);
          if (!existsSync(weightPath)) throw new Error(`Weight file missing: ${weightPath}`);
          const buf = readFileSync(weightPath);
          // Slice to detach from Node Buffer's backing ArrayBuffer
          weightBuffers.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        }
      }
    }

    model = await tf.loadLayersModel(tf.io.fromMemory(modelJson, weightBuffers));
    log.info(`✓ LSTM model loaded. Input: ${JSON.stringify(model.inputs[0].shape)}`);
  } catch (err) {
    modelLoadError = String(err);
    log.error('Model load failed:', err);
    model = null;
  }
}

// ─── Normalisation params (must mirror LSTMForecaster.ts exactly) ─────────────
const NORM = {
  solarWindSpeed:   { mean: 450,  std: 120  },
  solarWindDensity: { mean: 7,    std: 5    },
  magneticFieldBz:  { mean: 0,    std: 5    },
  magneticFieldBt:  { mean: 6,    std: 3    },
  newellCoupling:   { mean: 5000, std: 8000 },
  alfvenVelocity:   { mean: 50,   std: 30   },
  kpIndex:          { mean: 2.5,  std: 1.8  },
};
const stdNorm   = (v, k) => (v - NORM[k].mean) / NORM[k].std;
const stdDenorm = (v, k) =>  v * NORM[k].std   + NORM[k].mean;

/** Build shape [1, 24, 7] input tensor — flat snapshot repeated 24 steps */
function buildInputTensor(raw) {
  const { speed, density, bz, bt, kp } = raw;
  const va = bt / Math.max(1, Math.sqrt(density));
  const nc = Math.abs(Math.min(0, bz)) * speed;
  const step = [
    stdNorm(speed,   'solarWindSpeed'),
    stdNorm(density, 'solarWindDensity'),
    stdNorm(bz,      'magneticFieldBz'),
    stdNorm(bt,      'magneticFieldBt'),
    stdNorm(nc,      'newellCoupling'),
    stdNorm(va,      'alfvenVelocity'),
    stdNorm(kp,      'kpIndex'),
  ];
  return tf.tensor3d([Array.from({ length: 24 }, () => [...step])]);
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────
function heuristicForecast(raw) {
  const { speed, bz, kp } = raw;
  const storm = bz < -10 && speed > 500;
  const kpEst = Math.min(9, Math.max(0, kp + (storm ? 2.5 : -0.5)));
  const bzEst = bz * 0.85;
  const psi   = (kpEst ** 2 / 81) * 100;
  return {
    sixHour:        { kp: +kpEst.toFixed(2),           bz: +bzEst.toFixed(1),           psi: +psi.toFixed(1)          },
    twelveHour:     { kp: +(kpEst * 0.90).toFixed(2),  bz: +(bzEst * 0.90).toFixed(1),  psi: +(psi * 0.80).toFixed(1) },
    twentyFourHour: { kp: +(kpEst * 0.75).toFixed(2),  bz: +(bzEst * 0.75).toFixed(1),  psi: +(psi * 0.60).toFixed(1) },
    source:         'heuristic',
    confidence:     0.52,
    modelLoadError,
  };
}

// ─── LSTM inference ───────────────────────────────────────────────────────────
async function runInference(raw) {
  if (!model) return heuristicForecast(raw);
  const input = buildInputTensor(raw);
  try {
    const out    = model.predict(input);
    const tensor = Array.isArray(out) ? out[0] : out;
    const vals   = await tensor.data();
    input.dispose(); tensor.dispose();
    const [k6, b6, p6, k12, b12, p12, k24, b24, p24] = vals;
    return {
      sixHour:        { kp: +stdDenorm(k6,  'kpIndex').toFixed(2), bz: +stdDenorm(b6,  'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p6  * 100)).toFixed(1) },
      twelveHour:     { kp: +stdDenorm(k12, 'kpIndex').toFixed(2), bz: +stdDenorm(b12, 'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p12 * 100)).toFixed(1) },
      twentyFourHour: { kp: +stdDenorm(k24, 'kpIndex').toFixed(2), bz: +stdDenorm(b24, 'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p24 * 100)).toFixed(1) },
      source:         'lstm_v1',
      confidence:     0.87,
    };
  } catch (err) {
    log.error('Inference error:', err);
    input.dispose();
    return heuristicForecast(raw);
  }
}

// ─── NOAA real-time data (Node 18+ global fetch — no node-fetch needed) ───────
let latestReading = { speed: 450, density: 7, bz: 0, bt: 6, kp: 2, ts: null };

async function fetchNOAAData() {
  try {
    const [plasmaRes, magRes] = await Promise.all([
      fetch(NOAA_PLASMA_URL, { signal: AbortSignal.timeout(8000) }),
      fetch(NOAA_MAG_URL,    { signal: AbortSignal.timeout(8000) }),
    ]);
    if (!plasmaRes.ok || !magRes.ok) throw new Error(`NOAA HTTP ${plasmaRes.status}/${magRes.status}`);
    const plasma = await plasmaRes.json();
    const mag    = await magRes.json();
    const p = plasma.at(-1);   // [time, density, speed, temp]
    const m = mag.at(-1);      // [time, bx, by, bz, bt, lat, lon]
    latestReading = {
      speed:   parseFloat(p[2]) || 450,
      density: parseFloat(p[1]) || 7,
      bz:      parseFloat(m[3]) || 0,
      bt:      parseFloat(m[4]) || 6,
      kp:      latestReading.kp,
      ts:      new Date().toISOString(),
    };
    log.debug('NOAA ok →', latestReading);
  } catch (err) {
    log.warn('NOAA fetch failed — retaining last reading:', err.message);
  }
}

// ─── Subscriber management ────────────────────────────────────────────────────
/** @type {Map<import('ws').WebSocket, ReturnType<typeof setInterval>>} */
const subscribers = new Map();

function startSubscription(ws, intervalMs = FETCH_INTERVAL) {
  if (subscribers.has(ws)) stopSubscription(ws);
  const send = async () => {
    if (ws.readyState !== WebSocket.OPEN) { stopSubscription(ws); return; }
    try {
      const prediction = await runInference(latestReading);
      ws.send(JSON.stringify({ type: 'prediction', data: { ...prediction, reading: latestReading }, ts: new Date().toISOString() }));
    } catch (err) { log.error('Subscription send error:', err); }
  };
  send();
  subscribers.set(ws, setInterval(send, Math.max(5000, intervalMs)));
  log.info(`Subscribed (${intervalMs}ms). Total: ${subscribers.size}`);
}

function stopSubscription(ws) {
  const timer = subscribers.get(ws);
  if (timer !== undefined) { clearInterval(timer); subscribers.delete(ws); }
}

// ─── HTTP server (health endpoint + WS upgrade) ───────────────────────────────
const httpServer = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      status:       'ok',
      modelLoaded:  model !== null,
      modelError:   modelLoadError,
      uptime:       process.uptime(),
      subscribers:  subscribers.size,
      lastNoaaRead: latestReading.ts,
      tfBackend:    tf.getBackend(),
      tfVersion:    tf.version.tfjs,
      ts:           new Date().toISOString(),
    });
    return;
  }

  const baseUrl = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && baseUrl.pathname === '/api/ephemeris/horizons') {
    try {
      const body = baseUrl.searchParams.get('body') ?? '';
      const date = baseUrl.searchParams.get('date') ?? new Date().toISOString();
      const vector = await fetchHorizonsVector(body, date);
      sendJson(res, 200, { ok: true, vector });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/ephemeris/archive') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      const payload = JSON.parse(raw || '{}');
      mkdirSync(EPHEMERIS_ARCHIVE_DIR, { recursive: true });
      const envelope = {
        ts: new Date().toISOString(),
        schemaVersion: 1,
        ...payload,
      };
      appendFileSync(EPHEMERIS_ARCHIVE_FILE, `${JSON.stringify(envelope)}\n`, 'utf-8');
      sendJson(res, 200, { ok: true, file: EPHEMERIS_ARCHIVE_FILE });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/ephemeris/spice-ingest') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      const payload = JSON.parse(raw || '{}');
      mkdirSync(EPHEMERIS_ARCHIVE_DIR, { recursive: true });
      const envelope = {
        ts: new Date().toISOString(),
        schemaVersion: 1,
        source: 'spice-ingest',
        ...payload,
      };
      appendFileSync(EPHEMERIS_ARCHIVE_FILE, `${JSON.stringify(envelope)}\n`, 'utf-8');
      sendJson(res, 200, { ok: true, file: EPHEMERIS_ARCHIVE_FILE });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'GET' && baseUrl.pathname === '/api/ephemeris/archive') {
    try {
      const limit = Math.max(1, Math.min(1000, Number(baseUrl.searchParams.get('limit') ?? 50)));
      if (!existsSync(EPHEMERIS_ARCHIVE_FILE)) {
        sendJson(res, 200, { ok: true, rows: [], file: EPHEMERIS_ARCHIVE_FILE });
        return;
      }
      const lines = readFileSync(EPHEMERIS_ARCHIVE_FILE, 'utf-8')
        .split('\n')
        .filter((line) => line.trim().length > 0);
      const rows = lines.slice(-limit).map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { parseError: true, raw: line };
        }
      });
      sendJson(res, 200, { ok: true, rows, file: EPHEMERIS_ARCHIVE_FILE });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return;
  }

  res.writeHead(404, {
    'Access-Control-Allow-Origin': '*',
  });
  res.end('Connect via WebSocket or GET /health');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;
  log.info('WS connected:', ip);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON', ts: new Date().toISOString() })); return; }
    log.debug('← msg:', msg.type);

    switch (msg.type) {
      case 'predict': {
        if (!Array.isArray(msg.features)) {
          ws.send(JSON.stringify({ type: 'error', message: 'predict requires features: number[]', ts: new Date().toISOString() }));
          return;
        }
        const [speed = 450, density = 7, bz = 0, bt = 6, kp = 2] = msg.features;
        const prediction = await runInference({ speed, density, bz, bt, kp });
        ws.send(JSON.stringify({ type: 'prediction', data: prediction, ts: new Date().toISOString() }));
        break;
      }
      case 'subscribe': {
        const intervalMs = typeof msg.interval === 'number' ? msg.interval : FETCH_INTERVAL;
        startSubscription(ws, intervalMs);
        ws.send(JSON.stringify({ type: 'subscribed', interval: intervalMs, ts: new Date().toISOString() }));
        break;
      }
      case 'unsubscribe':
        stopSubscription(ws);
        ws.send(JSON.stringify({ type: 'unsubscribed', ts: new Date().toISOString() }));
        break;
      case 'status':
        ws.send(JSON.stringify({
          type: 'status',
          data: {
            modelLoaded:  model !== null,
            modelError:   modelLoadError,
            uptime:       process.uptime(),
            subscribers:  subscribers.size,
            lastNoaaRead: latestReading.ts,
            tfBackend:    tf.getBackend(),
            tfVersion:    tf.version.tfjs,
            nodeVersion:  process.version,
          },
          ts: new Date().toISOString(),
        }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: new Date().toISOString() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg.type}`, ts: new Date().toISOString() }));
    }
  });

  ws.on('close', () => { stopSubscription(ws); log.info('WS disconnected:', ip, `remaining: ${subscribers.size}`); });
  ws.on('error', (err) => { log.error('WS error:', ip, err.message); stopSubscription(ws); });

  ws.send(JSON.stringify({
    type:    'connected',
    message: 'SKÖLL-TRACK ML Backend ready. Send { type: "subscribe" } to begin.',
    model:   model ? 'lstm_v1' : 'heuristic_fallback',
    ts:      new Date().toISOString(),
  }));
});

// ─── Boot sequence (top-level await — valid in ESM) ───────────────────────────
await loadModel();
await fetchNOAAData();
setInterval(fetchNOAAData, FETCH_INTERVAL);
// Harvest one snapshot immediately, then every 24h.
harvestDailyEphemerisSnapshot().catch((err) => log.warn('Initial ephemeris harvest failed:', String(err)));
setInterval(() => {
  harvestDailyEphemerisSnapshot().catch((err) => log.warn('Scheduled ephemeris harvest failed:', String(err)));
}, 24 * 60 * 60 * 1000);

await new Promise((resolve) => httpServer.listen(PORT, resolve));
log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log.info(`SKÖLL-TRACK ML Backend  ●  port ${PORT}`);
log.info(`WebSocket  →  ws://localhost:${PORT}`);
log.info(`Health     →  http://localhost:${PORT}/health`);
log.info(`Model      →  ${model ? '✓ LSTM v1' : '⚠ heuristic fallback'}`);
log.info(`TF backend →  ${tf.getBackend()} (pure JS \u2014 no native addons)`);
log.info(`NOAA poll  →  every ${FETCH_INTERVAL / 1000}s`);
log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  log.info(`${signal} received \u2014 shutting down\u2026`);
  for (const ws of subscribers.keys()) { stopSubscription(ws); ws.close(); }
  await new Promise((resolve) => wss.close(resolve));
  await new Promise((resolve) => httpServer.close(resolve));
  log.info('Clean exit.');
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
