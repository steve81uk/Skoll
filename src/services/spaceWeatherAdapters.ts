import type { NOAABundle } from '../workers/noaaWorker';
import type {
  ProviderHealth,
  ProviderHealthLevel,
  ProviderSourceMode,
  SpaceWeatherModelProvider,
} from './telemetryProviderContracts';

export interface SpaceWeatherAdapterContext {
  bundle: NOAABundle | null;
  lastFetch: Date | null;
  error: string | null;
}

export interface OvationPrimePayload {
  acquisitionPoint: 'L1';
  driverMode: 'l1-live' | 'kp-fallback';
  leadTimeMinutes: number;
  latestKp: number;
  l1Telemetry: {
    speed: number;
    density: number;
    bt: number;
    bzGsm: number;
  } | null;
  ovationFrameSummary: {
    rows: number;
    columns: number;
  } | null;
}

export interface WsaEnlilPayload {
  acquisitionPoint: 'L1';
  horizonHours: number;
  source: 'stub-synthesized';
  coneModel: Array<{
    activityId: string;
    startTime: string;
    speedKmS: number;
    halfAngleDeg: number;
    type: string;
    impactProbabilityPct: number;
    arrivalEstimateIso: string | null;
  }>;
  l1Telemetry: {
    speed: number;
    density: number;
    bt: number;
    bzGsm: number;
  } | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getL1Telemetry(bundle: NOAABundle | null) {
  if (!bundle) {
    return null;
  }

  if (
    !isFiniteNumber(bundle.speed)
    || !isFiniteNumber(bundle.density)
    || !isFiniteNumber(bundle.bt)
    || !isFiniteNumber(bundle.bzGsm)
  ) {
    return null;
  }

  return {
    speed: bundle.speed,
    density: bundle.density,
    bt: bundle.bt,
    bzGsm: bundle.bzGsm,
  };
}

function deriveProviderHealth(
  level: ProviderHealthLevel,
  sourceMode: ProviderSourceMode,
  details: string,
  startedAt: number,
): ProviderHealth {
  return {
    ok: level !== 'red',
    level,
    sourceMode,
    details,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    lastUpdated: new Date().toISOString(),
  };
}

function summarizeOvationFrame(raw: unknown): OvationPrimePayload['ovationFrameSummary'] {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as { coordinates?: unknown[] };
  const rows = Array.isArray(candidate.coordinates) ? candidate.coordinates.length : 0;
  if (rows === 0) {
    return null;
  }

  const firstRow = candidate.coordinates?.[0];
  const columns = Array.isArray(firstRow) ? firstRow.length : 0;
  return { rows, columns };
}

export function evaluateOvationHealth(context: SpaceWeatherAdapterContext): ProviderHealth {
  const startedAt = performance.now();
  const l1 = getL1Telemetry(context.bundle);
  const kp = context.bundle?.latestKp;

  if (context.error) {
    return deriveProviderHealth('red', 'offline', `NOAA worker error: ${context.error}`, startedAt);
  }

  if (l1) {
    return deriveProviderHealth('green', 'l1-live', 'OVATION drivers on live L1 solar-wind + IMF telemetry.', startedAt);
  }

  if (isFiniteNumber(kp)) {
    return deriveProviderHealth('amber', 'kp-fallback', 'L1 telemetry unavailable; OVATION fallback driven by current Kp (lead time = 0).', startedAt);
  }

  return deriveProviderHealth('red', 'offline', 'No valid L1 or Kp driver available for OVATION.', startedAt);
}

export function evaluateWsaEnlilHealth(context: SpaceWeatherAdapterContext): ProviderHealth {
  const startedAt = performance.now();
  const l1 = getL1Telemetry(context.bundle);
  const cmeCount = context.bundle?.cmeEvents.length ?? 0;

  if (context.error) {
    return deriveProviderHealth('red', 'offline', `NOAA worker error: ${context.error}`, startedAt);
  }

  if (l1 && cmeCount > 0) {
    return deriveProviderHealth('green', 'l1-live', `L1 telemetry healthy; cone-model stub populated from ${cmeCount} CME events.`, startedAt);
  }

  if (l1) {
    return deriveProviderHealth('amber', 'degraded', 'L1 telemetry healthy but no recent CME analyses available for cone injection.', startedAt);
  }

  return deriveProviderHealth('red', 'offline', 'L1 telemetry unavailable for WSA-Enlil boundary conditions.', startedAt);
}

function getHourModelRunIso(now = new Date()): string {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString();
}

export function createOvationPrimeAdapter(
  getContext: () => SpaceWeatherAdapterContext,
): SpaceWeatherModelProvider {
  return {
    id: 'ovation-prime',
    displayName: 'OVATION Prime (L1 Tactical Nowcast)',
    horizonHours: 1,
    async pullForecast() {
      const context = getContext();
      const health = evaluateOvationHealth(context);
      const driverMode = health.sourceMode === 'kp-fallback' ? 'kp-fallback' : 'l1-live';
      const leadTimeMinutes = driverMode === 'kp-fallback' ? 0 : 60;

      const response = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }).catch(() => null);

      const payloadRaw = response?.ok ? await response.json().catch(() => null) : null;
      const payload: OvationPrimePayload = {
        acquisitionPoint: 'L1',
        driverMode,
        leadTimeMinutes,
        latestKp: context.bundle?.latestKp ?? 0,
        l1Telemetry: getL1Telemetry(context.bundle),
        ovationFrameSummary: summarizeOvationFrame(payloadRaw),
      };

      return {
        generatedAt: new Date().toISOString(),
        modelRun: getHourModelRunIso(),
        forecastWindowHours: 1,
        payload,
      };
    },
    async healthCheck() {
      return evaluateOvationHealth(getContext());
    },
  };
}

export function createWsaEnlilAdapter(
  getContext: () => SpaceWeatherAdapterContext,
): SpaceWeatherModelProvider {
  return {
    id: 'wsa-enlil',
    displayName: 'WSA-Enlil v3 Stub (L1 Strategic Forecast)',
    horizonHours: 96,
    async pullForecast() {
      const context = getContext();
      const coneModel = (context.bundle?.cmeEvents ?? []).slice(0, 5).map((event) => ({
        activityId: event.activityID,
        startTime: event.startTime,
        speedKmS: event.speed,
        halfAngleDeg: event.halfAngle,
        type: event.type,
        impactProbabilityPct: event.impactProbability,
        arrivalEstimateIso: event.arrivalEstimate,
      }));

      const payload: WsaEnlilPayload = {
        acquisitionPoint: 'L1',
        horizonHours: 96,
        source: 'stub-synthesized',
        coneModel,
        l1Telemetry: getL1Telemetry(context.bundle),
      };

      return {
        generatedAt: new Date().toISOString(),
        modelRun: getHourModelRunIso(),
        forecastWindowHours: 96,
        payload,
      };
    },
    async healthCheck() {
      return evaluateWsaEnlilHealth(getContext());
    },
  };
}
