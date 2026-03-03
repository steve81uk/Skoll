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
import { readFileSync, existsSync }   from 'fs';
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

// ─── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info  : (...a) => LOG_LEVEL !== 'silent' && console.log ('[INFO] ', new Date().toISOString(), ...a),
  debug : (...a) => LOG_LEVEL === 'debug'  && console.log ('[DEBUG]', new Date().toISOString(), ...a),
  warn  : (...a) => LOG_LEVEL !== 'silent' && console.warn('[WARN] ', new Date().toISOString(), ...a),
  error : (...a) =>                           console.error('[ERROR]', new Date().toISOString(), ...a),
};

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
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:       'ok',
      modelLoaded:  model !== null,
      modelError:   modelLoadError,
      uptime:       process.uptime(),
      subscribers:  subscribers.size,
      lastNoaaRead: latestReading.ts,
      tfBackend:    tf.getBackend(),
      tfVersion:    tf.version.tfjs,
      ts:           new Date().toISOString(),
    }));
    return;
  }
  res.writeHead(404);
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
