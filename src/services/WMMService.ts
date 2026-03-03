export interface MagneticPoleCoordinates {
  lat: number;
  lon: number;
}

export interface WMMResult {
  source: 'NOAA_WMM' | 'fallback';
  northPole: MagneticPoleCoordinates;
}

const NOAA_WMM_URL =
  'https://www.ngdc.noaa.gov/geomag-web/calculators/calculateModelPole?model=WMM&resultFormat=json';

const ENABLE_REMOTE_WMM = import.meta.env.VITE_ENABLE_REMOTE_WMM === 'true';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cached: WMMResult | null = null;
let cachedAt = 0;
let backoffUntil = 0;

function parsePolePayload(payload: unknown): MagneticPoleCoordinates | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  const northPoleObj = record.northPole as Record<string, unknown> | undefined;
  if (northPoleObj) {
    const lat = Number(northPoleObj.lat);
    const lon = Number(northPoleObj.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  const resultObj = record.result as Record<string, unknown> | undefined;
  if (resultObj) {
    const lat = Number(resultObj.northpolelat ?? resultObj.northPoleLat ?? resultObj.lat);
    const lon = Number(resultObj.northpolelon ?? resultObj.northPoleLon ?? resultObj.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  const dataObj = record.data as Record<string, unknown> | undefined;
  if (dataObj) {
    const lat = Number(dataObj.northPoleLat ?? dataObj.northpolelat ?? dataObj.lat);
    const lon = Number(dataObj.northPoleLon ?? dataObj.northpolelon ?? dataObj.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  return null;
}

export async function fetchNorthMagneticPole(): Promise<WMMResult> {
  const now = Date.now();

  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  if (!ENABLE_REMOTE_WMM || now < backoffUntil) {
    const fallback: WMMResult = {
      source: 'fallback',
      northPole: { lat: 86.6, lon: 171.7 },
    };
    cached = fallback;
    cachedAt = now;
    return fallback;
  }

  try {
    const response = await fetch(NOAA_WMM_URL);
    if (!response.ok) {
      throw new Error(`NOAA WMM fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const pole = parsePolePayload(payload);
    if (!pole) {
      throw new Error('NOAA WMM payload missing north pole coordinates');
    }

    const resolved: WMMResult = {
      source: 'NOAA_WMM',
      northPole: pole,
    };

    cached = resolved;
    cachedAt = now;
    return resolved;
  } catch {
    backoffUntil = now + CACHE_TTL_MS;
    const fallback: WMMResult = {
      source: 'fallback',
      northPole: { lat: 86.6, lon: 171.7 },
    };
    cached = fallback;
    cachedAt = now;
    return fallback;
  }
}

export function calculateMagneticOffset(pole: MagneticPoleCoordinates): number {
  return Math.max(0, 90 - pole.lat);
}
