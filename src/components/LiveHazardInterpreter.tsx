import type { ForecastAlert } from '../ml/types';
import type { HazardTelemetryModel } from '../services/hazardModel';
import type { SpaceWeatherDerivedMetrics } from '../services/spaceWeatherDerivedMetrics';

interface LiveHazardInterpreterProps {
  snapshot: HazardTelemetryModel;
  alerts: ForecastAlert[];
  derived: SpaceWeatherDerivedMetrics;
}

function toStormBand(kp: number): string {
  if (kp >= 7) return 'severe geomagnetic storm conditions';
  if (kp >= 5) return 'active storm watch conditions';
  if (kp >= 4) return 'unsettled geomagnetic conditions';
  return 'quiet-to-moderate geomagnetic conditions';
}

function formatAlertMessage(alerts: ForecastAlert[]): string {
  if (alerts.length === 0) {
    return 'No immediate LSTM critical warnings in the active window.';
  }

  const primary = alerts[0];
  const probabilityPct = Math.round(Math.max(0, Math.min(1, primary.probability)) * 100);
  return `${primary.severity}: ${primary.message} (${probabilityPct}% model confidence).`;
}

export default function LiveHazardInterpreter({ snapshot, alerts, derived }: LiveHazardInterpreterProps) {
  const stormBand = toStormBand(snapshot.kpIndex);
  const noaaState = snapshot.apiHealth === 'green'
    ? 'Live NOAA feed is healthy.'
    : snapshot.apiHealth === 'amber'
      ? 'NOAA feed is degraded; confidence is reduced.'
      : 'NOAA feed is stale or unavailable; treat outputs as fallback.';

  const couplingSentence = snapshot.bzGsm <= -10
    ? `Southward IMF Bz ${snapshot.bzGsm.toFixed(1)} nT is strongly coupling into Earth’s magnetosphere.`
    : `IMF coupling is ${derived.couplingClass}, with Bz at ${snapshot.bzGsm.toFixed(1)} nT.`;

  return (
    <div className="min-w-[18rem] max-w-[30rem] w-full rounded-md border border-cyan-500/35 bg-black/55 px-3 py-2 backdrop-blur-md overflow-hidden">
      <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-400/80">Live Hazard Interpreter</div>
      <div className="mt-1 text-[10px] leading-snug text-cyan-100 break-words">
        {`Nowcasting indicates ${stormBand}. Solar wind is ${Math.round(snapshot.solarWindSpeed)} km/s at density ${snapshot.density.toFixed(1)} p/cc. ${couplingSentence}`}
      </div>
      <div className="mt-1 text-[9px] leading-snug text-cyan-300/90 break-words">{formatAlertMessage(alerts)}</div>
      <div className="mt-1 text-[8px] leading-snug text-cyan-500/80 break-words">
        {`Energy budget: Eₖ ${derived.kineticEnergyDensityJm3.toExponential(2)} J/m³ · Eₘ ${derived.magneticEnergyDensityJm3.toExponential(2)} J/m³ · Eₜ ${derived.totalEnergyDensityJm3.toExponential(2)} J/m³ · Helicity proxy ${(derived.helicityProxy * 100).toFixed(0)}%. ${noaaState}`}
      </div>
    </div>
  );
}
