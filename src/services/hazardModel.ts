import type { NOAADONKIState } from '../hooks/useNOAADONKI';
import type { LSTMWorkerState } from '../hooks/useLSTMWorker';
import type { GOESFluxState } from '../hooks/useGOESFlux';
import type { NeuralForecast } from '../ml/types';

export interface HazardTelemetryModel {
  timestamp: Date;
  kpIndex: number;
  solarWindSpeed: number;
  bzGsm: number;
  bt: number;
  density: number;
  flareClass: string;
  noaaFetchAgeSec: number | null;
  lstmLatencyMs: number | null;
  modelStatus: LSTMWorkerState['modelStatus'];
  modelUsed: string;
  apiHealth: 'green' | 'amber' | 'red';
  kesslerCascade: NeuralForecast['kesslerCascade'] | null;
}

function toApiHealth(noaa: NOAADONKIState): HazardTelemetryModel['apiHealth'] {
  if (noaa.error) return 'red';
  if (!noaa.lastFetch) return 'amber';
  const ageSec = (Date.now() - noaa.lastFetch.getTime()) / 1000;
  if (ageSec <= 180) return 'green';
  if (ageSec <= 600) return 'amber';
  return 'red';
}

export function createHazardTelemetryModel(
  noaa: NOAADONKIState,
  lstm: LSTMWorkerState,
  goes: GOESFluxState,
  lstmLatencyMs: number | null,
): HazardTelemetryModel {
  const noaaFetchAgeSec = noaa.lastFetch
    ? Math.max(0, Math.round((Date.now() - noaa.lastFetch.getTime()) / 1000))
    : null;

  return {
    timestamp: new Date(),
    kpIndex: noaa.bundle?.latestKp ?? 2.5,
    solarWindSpeed: noaa.bundle?.speed ?? 450,
    bzGsm: noaa.bundle?.bzGsm ?? -2,
    bt: noaa.bundle?.bt ?? 6,
    density: noaa.bundle?.density ?? 5,
    flareClass: goes.flareClass,
    noaaFetchAgeSec,
    lstmLatencyMs,
    modelStatus: lstm.modelStatus,
    modelUsed: lstm.modelUsed,
    apiHealth: toApiHealth(noaa),
    kesslerCascade: lstm.forecast?.kesslerCascade ?? null,
  };
}
