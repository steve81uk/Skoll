import type { KesslerCascadeForecast } from './types';

export function estimateCmeArrivalIso(startTimeIso: string, speedKms: number): string | null {
  if (!startTimeIso || speedKms <= 0 || !Number.isFinite(speedKms)) {
    return null;
  }

  const start = new Date(startTimeIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const AU_KM = 1.496e8;
  const travelSeconds = AU_KM / speedKms;
  return new Date(start.getTime() + travelSeconds * 1000).toISOString();
}

export function computeKesslerCascade(
  kpCurve: number[],
  solarWindSpeedHistory: number[],
): KesslerCascadeForecast {
  const peakKp = kpCurve.length > 0 ? Math.max(...kpCurve) : 0;
  const meanKp = kpCurve.length > 0 ? kpCurve.reduce((sum, value) => sum + value, 0) / kpCurve.length : 0;
  const meanSpeed =
    solarWindSpeedHistory.length > 0
      ? solarWindSpeedHistory.reduce((sum, value) => sum + value, 0) / solarWindSpeedHistory.length
      : 0;

  const driver =
    Math.max(0, (peakKp - 4) * 0.14) +
    Math.max(0, (meanKp - 3.5) * 0.1) +
    Math.max(0, (meanSpeed - 550) / 2200);

  const next24hProbability = Math.min(0.95, 0.05 + driver * 0.9);
  const next72hProbability = Math.min(0.98, 0.08 + driver * 1.1);
  const next7dProbability = Math.min(0.99, 0.12 + driver * 1.25);

  const riskBand: KesslerCascadeForecast['riskBand'] =
    next7dProbability >= 0.6 ? 'CRITICAL' : next7dProbability >= 0.3 ? 'ELEVATED' : 'NOMINAL';

  return {
    next24hProbability: parseFloat(next24hProbability.toFixed(3)),
    next72hProbability: parseFloat(next72hProbability.toFixed(3)),
    next7dProbability: parseFloat(next7dProbability.toFixed(3)),
    riskBand,
  };
}
