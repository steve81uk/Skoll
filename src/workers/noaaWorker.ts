/**
 * SKÖLL-TRACK — NOAA / NASA DONKI FETCH WEB WORKER
 * All NOAA SWPC and NASA DONKI API calls run here, keeping main thread free.
 *
 * Protocol:
 *   Main → Worker:  { type: 'FETCH_ALL' }
 *                   { type: 'FETCH_CME_ANALYSIS' }
 *                   { type: 'FETCH_KP_SERIES' }
 *   Worker → Main:  { type: 'NOAA_DATA',     data: NOAABundle }
 *                   { type: 'CME_DATA',       events: CMEEvent[] }
 *                   { type: 'KP_SERIES',      points: KPPoint[]  }
 *                   { type: 'ERROR',          error: string }
 *
 * NOAA endpoints (all CORS-enabled public JSON):
 *   Planetary K:    https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
 *   3-day KP:       https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
 *   IMF 2h:         https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json
 *   Wind plasma 2h: https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json
 *   OVATION aurora: https://services.swpc.noaa.gov/json/ovation_aurora_latest.json
 *
 * NASA DONKI (api_key=DEMO_KEY for demo; replace with real key):
 *   CME Analysis:   https://api.nasa.gov/DONKI/CMEAnalysis?api_key=DEMO_KEY&speed=0&halfAngle=0&catalog=ALL&keyword=NONE
 */

import { fetchJSONWithPolicy } from './fetchPolicy';
import { estimateCmeArrivalIso } from '../ml/forecastMath';
import { isKPForecastRows, isKPObservedRows, isMagRows, isWindRows } from './noaaSchemas';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface KPPoint {
  time:   string;   // ISO string
  kp:     number;
  source: 'observed' | 'forecast';
}

export interface CMEEvent {
  activityID:       string;
  startTime:        string;
  speed:            number;   // km/s
  halfAngle:        number;   // degrees
  type:             string;   // S=slow, C=complex, R=regular
  note:             string;
  impactProbability: number;  // 0–100 synthesised from speed+halfAngle
  arrivalEstimate:  string | null;
}

export interface NOAABundle {
  timestamp:    string;
  latestKp:     number;
  speed:        number;
  density:      number;
  bt:           number;
  bzGsm:        number;
  kpSeries:     KPPoint[];
  cmeEvents:    CMEEvent[];
  auroraActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SWPC  = 'https://services.swpc.noaa.gov';
const DONKI = 'https://api.nasa.gov/DONKI';
const DEMO  = 'DEMO_KEY';

async function fetchJSON<T>(url: string, validator?: (value: unknown) => value is T): Promise<T | null> {
  return fetchJSONWithPolicy<T>(url, {
    retries: 2,
    timeoutMs: 10_000,
    backoffMs: 300,
    validator,
  });
}

// Synthesise impact probability from speed and half-angle (Gopalswamy method)
function cmeImpactProb(speed: number, halfAngle: number): number {
  if (halfAngle <= 0 || speed <= 0) return 0;
  // Wider + faster → higher probability
  const speedFactor = Math.min(1, speed / 2000);
  const angleFactor = Math.min(1, halfAngle / 60);
  return Math.round(speedFactor * 0.6 * angleFactor * 0.4 * 100 + speedFactor * 35);
}

// ─── Individual fetchers ──────────────────────────────────────────────────────
async function fetchKPSeries(): Promise<KPPoint[]> {
  // Current observed 1-min K-index
  type KPRow = { time_tag: string; kp_index: number };
  const observed = await fetchJSON<KPRow[]>(`${SWPC}/json/planetary_k_index_1m.json`, isKPObservedRows);

  // 3-day forecast grid: [[time, kp], …]
  type KPForecastRow = [string, number];
  const forecast = await fetchJSON<KPForecastRow[]>(`${SWPC}/products/noaa-planetary-k-index.json`, isKPForecastRows);

  const points: KPPoint[] = [];

  if (observed) {
    for (const row of observed.slice(-144)) {  // last 24 h at 1-min resolution → ~144 10-min samples
      points.push({ time: row.time_tag, kp: row.kp_index ?? 0, source: 'observed' });
    }
  }

  if (forecast && Array.isArray(forecast)) {
    for (const row of (forecast as KPForecastRow[]).slice(1)) {  // skip header
      const [time, kp] = row;
      if (time && typeof kp === 'number') {
        points.push({ time, kp, source: 'forecast' });
      }
    }
  }

  return points;
}

async function fetchCMEEvents(): Promise<CMEEvent[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  type DONKICMERow = {
    activityID?: string;
    startTime?: string;
    speed?: number;
    halfAngle?: number;
    type?: string;
    note?: string;
  };
  const raw = await fetchJSON<DONKICMERow[]>(
    `${DONKI}/CMEAnalysis?startDate=${fourteenDaysAgo}&api_key=${DEMO}&speed=0&halfAngle=0&catalog=ALL`,
  );

  if (!raw || !Array.isArray(raw)) return [];

  return raw
    .filter((r) => r.startTime)
    .map((r) => ({
      activityID:        r.activityID ?? 'UNK',
      startTime:         r.startTime ?? '',
      speed:             r.speed ?? 0,
      halfAngle:         r.halfAngle ?? 0,
      type:              r.type ?? 'S',
      note:              r.note ?? '',
      impactProbability: cmeImpactProb(r.speed ?? 0, r.halfAngle ?? 0),
      arrivalEstimate:   estimateCmeArrivalIso(r.startTime ?? '', r.speed ?? 0),
    }))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 20);
}

async function fetchBundle(): Promise<NOAABundle> {
  type MagRow   = [string, string, string, string, string, string];
  type WindRow  = [string, string, string];
  type KPMinRow = { time_tag: string; kp_index: number };

  const [magRaw, windRaw, kpRaw, kpSeries, cmeEvents] = await Promise.all([
    fetchJSON<MagRow[]>(`${SWPC}/products/solar-wind/mag-2-hour.json`, isMagRows),
    fetchJSON<WindRow[]>(`${SWPC}/products/solar-wind/plasma-2-hour.json`, isWindRows),
    fetchJSON<KPMinRow[]>(`${SWPC}/json/planetary_k_index_1m.json`, isKPObservedRows),
    fetchKPSeries(),
    fetchCMEEvents(),
  ]);

  const latestMag  = magRaw  ? (magRaw[magRaw.length - 1]   as MagRow)  : null;
  const latestWind = windRaw ? (windRaw[windRaw.length - 1]  as WindRow) : null;
  const latestKpRow= kpRaw   ? kpRaw[kpRaw.length - 1]                  : null;

  const bt    = latestMag  ? parseFloat(latestMag[3])  || 0 : 6;
  const bzGsm = latestMag  ? parseFloat(latestMag[5])  || 0 : 0;
  const speed = latestWind ? parseFloat(latestWind[1]) || 450 : 450;
  const density=latestWind ? parseFloat(latestWind[2]) || 5   : 5;
  const latestKp = latestKpRow?.kp_index ?? 0;

  const auroraActive = latestKp >= 4 || bzGsm < -8;

  return {
    timestamp:    new Date().toISOString(),
    latestKp,
    speed,
    density,
    bt,
    bzGsm,
    kpSeries,
    cmeEvents,
    auroraActive,
  };
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', async (ev: MessageEvent) => {
  const { type } = ev.data as { type: string };

  if (type === 'FETCH_ALL') {
    try {
      const data = await fetchBundle();
      self.postMessage({ type: 'NOAA_DATA', data });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: String(err) });
    }
  }

  if (type === 'FETCH_CME_ANALYSIS') {
    try {
      const events = await fetchCMEEvents();
      self.postMessage({ type: 'CME_DATA', events });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: String(err) });
    }
  }

  if (type === 'FETCH_KP_SERIES') {
    try {
      const points = await fetchKPSeries();
      self.postMessage({ type: 'KP_SERIES', points });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: String(err) });
    }
  }
});
