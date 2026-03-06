import type { HazardTelemetryModel } from './hazardModel';

export interface SpaceWeatherDerivedMetrics {
  kineticEnergyDensityJm3: number;
  magneticEnergyDensityJm3: number;
  totalEnergyDensityJm3: number;
  helicityProxy: number;
  couplingClass: 'low' | 'moderate' | 'high' | 'severe';
}

const MU_0 = 4e-7 * Math.PI;
const PROTON_MASS_KG = 1.6726219e-27;

function couplingClassFromScore(score: number): SpaceWeatherDerivedMetrics['couplingClass'] {
  if (score >= 0.75) return 'severe';
  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'moderate';
  return 'low';
}

export function computeSpaceWeatherDerivedMetrics(snapshot: HazardTelemetryModel): SpaceWeatherDerivedMetrics {
  const speedMs = Math.max(0, snapshot.solarWindSpeed) * 1_000;
  const densityM3 = Math.max(0, snapshot.density) * 1_000_000;
  const magneticTesla = Math.max(0, snapshot.bt) * 1e-9;

  const rho = densityM3 * PROTON_MASS_KG;
  const kineticEnergyDensityJm3 = 0.5 * rho * speedMs * speedMs;
  const magneticEnergyDensityJm3 = (magneticTesla * magneticTesla) / (2 * MU_0);
  const totalEnergyDensityJm3 = kineticEnergyDensityJm3 + magneticEnergyDensityJm3;

  const bzFactor = Math.min(1, Math.max(0, Math.abs(Math.min(0, snapshot.bzGsm)) / 20));
  const speedFactor = Math.min(1, snapshot.solarWindSpeed / 1000);
  const fieldFactor = Math.min(1, snapshot.bt / 25);
  const helicityProxy = Math.min(1, 0.45 * bzFactor + 0.35 * speedFactor + 0.2 * fieldFactor);

  return {
    kineticEnergyDensityJm3,
    magneticEnergyDensityJm3,
    totalEnergyDensityJm3,
    helicityProxy,
    couplingClass: couplingClassFromScore(helicityProxy),
  };
}
