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
const SOCIAL_RELAY_WEBHOOK = process.env.SOCIAL_RELAY_WEBHOOK ?? '';
const X_RELAY_ENABLED = (process.env.X_RELAY_ENABLED ?? 'false').toLowerCase() === 'true';
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN ?? '';
const X_RELAY_DEFAULT_TAGS = process.env.X_RELAY_DEFAULT_TAGS ?? '#SpaceWeather #SkollTrack';
const NOAA_CO2_DAILY_URL =
  'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv';
const SIDC_SUNSPOT_URL =
  'https://www.sidc.be/SILSO/INFO/snmtotcsv.php';
const LASP_TSI_URL =
  'https://lasp.colorado.edu/data/tsis/tsi-4.0_daily_data.txt';
const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_MARINE_URL =
  'https://marine-api.open-meteo.com/v1/marine';
const DATA_HUB_TTL_MS = 3 * 60_000;
const AUTO_RELAY_ENABLED = (process.env.AUTO_RELAY_ENABLED ?? 'false').toLowerCase() === 'true';
const DATA_HUB_SCHEMA_VERSION = 1;
const EPHEMERIS_ARCHIVE_DIR = join(__dirname, 'data', 'ephemeris');
const EPHEMERIS_ARCHIVE_FILE = join(EPHEMERIS_ARCHIVE_DIR, 'archive.jsonl');
const DATA_HUB_ARCHIVE_DIR = join(__dirname, 'data', 'data-hub');
const DATA_HUB_ARCHIVE_FILE = join(DATA_HUB_ARCHIVE_DIR, `archive.v${DATA_HUB_SCHEMA_VERSION}.jsonl`);

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

const dataHubCache = {
  ts: 0,
  payload: null,
};

const relayCooldowns = new Map();
const SERVER_ALERT_RULES = [
  { id: 'kp-g1', check: (r) => r.kp >= 5, severity: 'warning', cooldownMin: 120, message: (r) => `Geomagnetic storm active (Kp ${r.kp.toFixed(1)})` },
  { id: 'kp-g3', check: (r) => r.kp >= 7, severity: 'critical', cooldownMin: 60, message: (r) => `Severe geomagnetic storm (Kp ${r.kp.toFixed(1)})` },
  { id: 'bz-south', check: (r) => r.bz <= -10, severity: 'warning', cooldownMin: 60, message: (r) => `Strong southward IMF Bz (${r.bz.toFixed(1)} nT)` },
  { id: 'wind-fast', check: (r) => r.speed >= 700, severity: 'warning', cooldownMin: 90, message: (r) => `Fast solar wind (${Math.round(r.speed)} km/s)` },
];

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(raw || '{}');
}

function appendDataHubArchive(record) {
  mkdirSync(DATA_HUB_ARCHIVE_DIR, { recursive: true });
  const envelope = {
    ts: new Date().toISOString(),
    schemaVersion: DATA_HUB_SCHEMA_VERSION,
    ...record,
  };
  appendFileSync(DATA_HUB_ARCHIVE_FILE, `${JSON.stringify(envelope)}\n`, 'utf-8');
  return envelope;
}

function readDataHubArchive(limit = 200) {
  if (!existsSync(DATA_HUB_ARCHIVE_FILE)) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(5000, Number(limit) || 200));
  const lines = readFileSync(DATA_HUB_ARCHIVE_FILE, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  return lines.slice(-safeLimit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { parseError: true, raw: line };
    }
  });
}

async function forwardToSocialRelay(payload) {
  if (!SOCIAL_RELAY_WEBHOOK) {
    throw new Error('SOCIAL_RELAY_WEBHOOK is not configured');
  }

  const response = await fetch(SOCIAL_RELAY_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Relay webhook HTTP ${response.status}`);
  }
}

function buildXRelayText(payload) {
  if (typeof payload?.text === 'string' && payload.text.trim().length > 0) {
    return payload.text.trim().slice(0, 280);
  }

  const reading = payload?.reading ?? {};
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const primary = alerts[0];
  const message = typeof primary?.message === 'string' ? primary.message : 'Telemetry broadcast';
  const kp = Number.isFinite(reading.kp) ? Number(reading.kp).toFixed(1) : 'n/a';
  const bz = Number.isFinite(reading.bz) ? Number(reading.bz).toFixed(1) : 'n/a';
  const speed = Number.isFinite(reading.speed) ? Math.round(Number(reading.speed)).toString() : 'n/a';
  const raw = `SKOLL ALERT | ${message} | Kp ${kp} | Bz ${bz} nT | Vsw ${speed} km/s ${X_RELAY_DEFAULT_TAGS}`;
  return raw.slice(0, 280);
}

async function forwardToXRelay(payload) {
  if (!X_RELAY_ENABLED) {
    throw new Error('X relay disabled (set X_RELAY_ENABLED=true)');
  }
  if (!X_BEARER_TOKEN) {
    throw new Error('X_BEARER_TOKEN is not configured');
  }

  const text = buildXRelayText(payload);
  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${X_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(12000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`X relay HTTP ${response.status}: ${responseText.slice(0, 300)}`);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = { raw: responseText };
  }

  return { text, result: parsed };
}

async function evaluateServerAlertsAndRelay(reading) {
  if (!AUTO_RELAY_ENABLED || !SOCIAL_RELAY_WEBHOOK) {
    return;
  }

  const now = Date.now();
  const alerts = [];

  for (const rule of SERVER_ALERT_RULES) {
    if (!rule.check(reading)) {
      continue;
    }
    const last = relayCooldowns.get(rule.id) ?? 0;
    const elapsedMin = (now - last) / 60000;
    if (elapsedMin < rule.cooldownMin) {
      continue;
    }

    relayCooldowns.set(rule.id, now);
    alerts.push({
      id: rule.id,
      severity: rule.severity,
      message: rule.message(reading),
      ts: now,
      value: reading.kp,
    });
  }

  if (alerts.length === 0) {
    return;
  }

  try {
    await forwardToSocialRelay({
      source: 'skoll-track-backend',
      timestamp: new Date(now).toISOString(),
      mode: 'headless-auto-relay',
      reading,
      alerts,
    });
    log.info(`Auto-relay sent ${alerts.length} alert(s) to configured webhook.`);
  } catch (err) {
    log.warn('Auto-relay failed:', String(err));
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchTextWithTimeout(url, timeoutMs = 10000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function parseLatestCo2Ppm(text) {
  const row = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && /\d/.test(line))
    .map((line) => line.split(','))
    .filter((parts) => parts.length > 3)
    .at(-1);

  if (!row) return null;
  const ppm = Number(row[3]);
  return Number.isFinite(ppm) ? ppm : null;
}

function parseLatestSunspot(text) {
  const row = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .at(-1);
  if (!row) return null;
  const parts = row.split(';').map((part) => part.trim());
  const value = Number(parts[3]);
  return Number.isFinite(value) ? value : null;
}

function parseLatestTsi(text) {
  const vals = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(';'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => Number(parts[1]))
    .filter((value) => Number.isFinite(value));
  return vals.length > 0 ? vals.at(-1) : null;
}

async function buildUnifiedDataHub(lat, lon) {
  const [
    forecastRes,
    weatherRes,
    marineRes,
    co2Res,
    sunspotRes,
    tsiRes,
  ] = await Promise.allSettled([
    runInference(latestReading),
    fetchJsonWithTimeout(`${OPEN_METEO_URL}?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,wind_speed_10m,cloud_cover,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=UTC`, 10000),
    fetchJsonWithTimeout(`${OPEN_METEO_MARINE_URL}?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&daily=sea_surface_temperature,wave_height_max&timezone=UTC`, 10000),
    fetchTextWithTimeout(NOAA_CO2_DAILY_URL, 12000),
    fetchTextWithTimeout(SIDC_SUNSPOT_URL, 12000),
    fetchTextWithTimeout(LASP_TSI_URL, 12000),
  ]);

  const sourceErrors = {
    forecast: forecastRes.status === 'rejected' ? String(forecastRes.reason) : null,
    weather: weatherRes.status === 'rejected' ? String(weatherRes.reason) : null,
    marine: marineRes.status === 'rejected' ? String(marineRes.reason) : null,
    co2: co2Res.status === 'rejected' ? String(co2Res.reason) : null,
    sunspot: sunspotRes.status === 'rejected' ? String(sunspotRes.reason) : null,
    tsi: tsiRes.status === 'rejected' ? String(tsiRes.reason) : null,
  };

  const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value : heuristicForecast(latestReading);
  const weatherNow = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const marineNow = marineRes.status === 'fulfilled' ? marineRes.value : null;
  const co2Ppm = co2Res.status === 'fulfilled' ? parseLatestCo2Ppm(co2Res.value) : null;
  const sunspot = sunspotRes.status === 'fulfilled' ? parseLatestSunspot(sunspotRes.value) : null;
  const tsi = tsiRes.status === 'fulfilled' ? parseLatestTsi(tsiRes.value) : null;
  const oceanPhProxy = Number.isFinite(co2Ppm) ? 8.2 - (co2Ppm - 280) * 0.002 : null;

  return {
    ok: true,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    location: { lat, lon },
    sources: {
      space: ['NOAA SWPC Plasma/Mag', 'Internal LSTM model'],
      earth: ['Open-Meteo'],
      weather: ['Open-Meteo'],
      sea: ['Open-Meteo Marine'],
      climate: ['NOAA GML CO2', 'SIDC SILSO', 'LASP TSIS'],
    },
    space: {
      live: latestReading,
      forecast,
    },
    earth: {
      weatherCurrent: weatherNow?.current ?? null,
      weatherDaily: weatherNow?.daily ?? null,
    },
    sea: {
      marineDaily: marineNow?.daily ?? null,
      oceanPhProxy,
    },
    climate: {
      co2Ppm,
      sunspot,
      tsi,
      forcingProxyWm2: Number.isFinite(co2Ppm) ? 5.35 * Math.log(co2Ppm / 278) : null,
    },
    sourceErrors,
  };
}

async function getUnifiedDataHub(lat, lon, forceRefresh = false) {
  const cacheValid = Date.now() - dataHubCache.ts < DATA_HUB_TTL_MS;
  if (!forceRefresh && cacheValid && dataHubCache.payload) {
    return { ...dataHubCache.payload, cache: 'hit' };
  }

  const payload = await buildUnifiedDataHub(lat, lon);
  dataHubCache.ts = Date.now();
  dataHubCache.payload = payload;
  return { ...payload, cache: 'miss' };
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
let modelFeatureCount = 7;

function readModelArtifacts(modelJson, modelDir) {
  const weightSpecs = [];
  const chunks = [];

  if (Array.isArray(modelJson.weightsManifest)) {
    for (const group of modelJson.weightsManifest) {
      if (Array.isArray(group.weights)) {
        weightSpecs.push(...group.weights);
      }
      for (const weightFile of group.paths ?? []) {
        const weightPath = join(modelDir, weightFile);
        if (!existsSync(weightPath)) {
          throw new Error(`Weight file missing: ${weightPath}`);
        }
        const buf = readFileSync(weightPath);
        chunks.push(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
      }
    }
  }

  const totalBytes = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const weightData = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    weightData.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    modelTopology: modelJson.modelTopology,
    weightSpecs,
    weightData: weightData.buffer,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
  };
}

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
    const artifacts = readModelArtifacts(modelJson, modelDir);
    model = await tf.loadLayersModel(tf.io.fromMemory(artifacts));
    const featureDim = model.inputs?.[0]?.shape?.[2];
    modelFeatureCount = Number.isFinite(featureDim) ? Number(featureDim) : 7;
    log.info(`✓ LSTM model loaded. Input: ${JSON.stringify(model.inputs[0].shape)} | features=${modelFeatureCount}`);
  } catch (err) {
    modelLoadError = String(err);
    log.error('Model load failed:', err);
    model = null;
    modelFeatureCount = 7;
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
  const allFeatures = [
    stdNorm(speed,   'solarWindSpeed'),
    stdNorm(density, 'solarWindDensity'),
    stdNorm(bz,      'magneticFieldBz'),
    stdNorm(bt,      'magneticFieldBt'),
    stdNorm(nc,      'newellCoupling'),
    stdNorm(va,      'alfvenVelocity'),
    stdNorm(kp,      'kpIndex'),
  ];
  const step = allFeatures.slice(0, Math.max(1, Math.min(allFeatures.length, modelFeatureCount)));
  return tf.tensor3d([Array.from({ length: 24 }, () => [...step])]);
}

function decodeModelForecast(vals, raw) {
  // Legacy 9-output model: [k6, b6, p6, k12, b12, p12, k24, b24, p24]
  if (vals.length >= 9) {
    const [k6, b6, p6, k12, b12, p12, k24, b24, p24] = vals;
    return {
      sixHour:        { kp: +stdDenorm(k6,  'kpIndex').toFixed(2), bz: +stdDenorm(b6,  'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p6  * 100)).toFixed(1) },
      twelveHour:     { kp: +stdDenorm(k12, 'kpIndex').toFixed(2), bz: +stdDenorm(b12, 'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p12 * 100)).toFixed(1) },
      twentyFourHour: { kp: +stdDenorm(k24, 'kpIndex').toFixed(2), bz: +stdDenorm(b24, 'magneticFieldBz').toFixed(1), psi: +Math.max(0, Math.min(100, p24 * 100)).toFixed(1) },
      source:         'lstm_v1',
      confidence:     0.87,
    };
  }

  // Common compact variants.
  if (vals.length >= 3) {
    const [k6, k12, k24] = vals;
    const bzBase = raw.bz * 0.85;
    return {
      sixHour:        { kp: +stdDenorm(k6, 'kpIndex').toFixed(2), bz: +bzBase.toFixed(1), psi: +Math.max(0, Math.min(100, stdDenorm(k6, 'kpIndex') ** 2 / 81 * 100)).toFixed(1) },
      twelveHour:     { kp: +stdDenorm(k12, 'kpIndex').toFixed(2), bz: +(bzBase * 0.92).toFixed(1), psi: +Math.max(0, Math.min(100, stdDenorm(k12, 'kpIndex') ** 2 / 81 * 100)).toFixed(1) },
      twentyFourHour: { kp: +stdDenorm(k24, 'kpIndex').toFixed(2), bz: +(bzBase * 0.84).toFixed(1), psi: +Math.max(0, Math.min(100, stdDenorm(k24, 'kpIndex') ** 2 / 81 * 100)).toFixed(1) },
      source:         'lstm_compact',
      confidence:     0.81,
    };
  }

  if (vals.length >= 1) {
    const baseKp = +stdDenorm(vals[0], 'kpIndex').toFixed(2);
    const bzBase = raw.bz * 0.85;
    return {
      sixHour:        { kp: baseKp, bz: +bzBase.toFixed(1), psi: +Math.max(0, Math.min(100, baseKp ** 2 / 81 * 100)).toFixed(1) },
      twelveHour:     { kp: +(baseKp * 0.93).toFixed(2), bz: +(bzBase * 0.92).toFixed(1), psi: +Math.max(0, Math.min(100, (baseKp * 0.93) ** 2 / 81 * 100)).toFixed(1) },
      twentyFourHour: { kp: +(baseKp * 0.84).toFixed(2), bz: +(bzBase * 0.84).toFixed(1), psi: +Math.max(0, Math.min(100, (baseKp * 0.84) ** 2 / 81 * 100)).toFixed(1) },
      source:         'lstm_scalar',
      confidence:     0.76,
    };
  }

  return heuristicForecast(raw);
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
    return decodeModelForecast(vals, raw);
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
    await evaluateServerAlertsAndRelay(latestReading);
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

  if (req.method === 'GET' && baseUrl.pathname === '/api/data-hub/snapshot') {
    try {
      const lat = Number(baseUrl.searchParams.get('lat') ?? '52.2');
      const lon = Number(baseUrl.searchParams.get('lon') ?? '0.12');
      const forceRefresh = baseUrl.searchParams.get('refresh') === '1';
      const shouldArchive = baseUrl.searchParams.get('archive') === '1';

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        sendJson(res, 400, { ok: false, error: 'Invalid lat/lon query params' });
        return;
      }

      const payload = await getUnifiedDataHub(lat, lon, forceRefresh);
      if (shouldArchive) {
        appendDataHubArchive({ source: 'snapshot-query', snapshot: payload });
      }
      sendJson(res, 200, payload);
    } catch (err) {
      sendJson(res, 502, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'GET' && baseUrl.pathname === '/api/data-hub/archive') {
    try {
      const limit = Number(baseUrl.searchParams.get('limit') ?? 200);
      const rows = readDataHubArchive(limit);
      sendJson(res, 200, {
        ok: true,
        schemaVersion: DATA_HUB_SCHEMA_VERSION,
        count: rows.length,
        file: DATA_HUB_ARCHIVE_FILE,
        rows,
      });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/data-hub/archive') {
    try {
      const payload = await readJsonBody(req);
      const lat = Number(payload?.lat ?? 52.2);
      const lon = Number(payload?.lon ?? 0.12);
      const snapshot = payload?.snapshot ?? await getUnifiedDataHub(lat, lon, payload?.refresh === true);
      const tags = Array.isArray(payload?.tags) ? payload.tags.slice(0, 16) : [];
      const row = appendDataHubArchive({
        source: payload?.source ?? 'manual',
        tags,
        snapshot,
      });
      sendJson(res, 200, { ok: true, row, file: DATA_HUB_ARCHIVE_FILE });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'GET' && baseUrl.pathname === '/api/data-hub/sources') {
    sendJson(res, 200, {
      ok: true,
      schemaVersion: DATA_HUB_SCHEMA_VERSION,
      sources: {
        space: [NOAA_PLASMA_URL, NOAA_MAG_URL],
        climate: [NOAA_CO2_DAILY_URL, SIDC_SUNSPOT_URL, LASP_TSI_URL],
        weather: [OPEN_METEO_URL],
        sea: [OPEN_METEO_MARINE_URL],
      },
      notes: 'Use /api/data-hub/snapshot?lat=<..>&lon=<..>&refresh=1&archive=1 for a merged payload, or POST /api/data-hub/archive to append JSONL rows.',
    });
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/ephemeris/archive') {
    try {
      const payload = await readJsonBody(req);
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
      const payload = await readJsonBody(req);
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

  if (req.method === 'POST' && baseUrl.pathname === '/api/alerts/social-relay') {
    try {
      const payload = await readJsonBody(req);
      await forwardToSocialRelay(payload);
      sendJson(res, 200, { ok: true, relayed: true });
    } catch (err) {
      sendJson(res, 502, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/alerts/x-relay') {
    try {
      const payload = await readJsonBody(req);
      const result = await forwardToXRelay(payload);
      sendJson(res, 200, { ok: true, posted: true, ...result });
    } catch (err) {
      sendJson(res, 502, { ok: false, error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && baseUrl.pathname === '/api/alerts/x-relay/test') {
    try {
      const payload = await readJsonBody(req);
      const syntheticPayload = {
        source: 'skoll-track-backend',
        timestamp: new Date().toISOString(),
        reading: latestReading,
        alerts: payload?.alerts ?? [
          {
            id: 'x-relay-test',
            severity: 'warning',
            message: payload?.message ?? 'X relay test packet from SKOLL backend',
            ts: Date.now(),
            value: latestReading.kp,
          },
        ],
      };
      const result = await forwardToXRelay(syntheticPayload);
      sendJson(res, 200, { ok: true, posted: true, syntheticPayload, ...result });
    } catch (err) {
      sendJson(res, 502, { ok: false, error: String(err) });
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
