/**
 * SKÖLL-TRACK — ORBITAL DRIFT PREDICTION HOOK
 *
 * Predicts cumulative orbital drift for tracked objects caused by heightened
 * geomagnetic activity. During Kp storms, increased atmospheric drag in LEO
 * causes satellites to decay faster than nominal TLE predictions suggest.
 *
 * Architecture (planned):
 *   - Input: current Kp, F10.7 solar flux, satellite altitude (km), ballistic coefficient
 *   - Model: NRLMSISE-00 atmospheric density approximation + drag equation
 *   - Output: predicted altitude loss (km/day), time-to-reentry estimate, drift vector
 *   - Batch mode: computes for all ACTIVE_OBJECTS simultaneously
 *
 * Status: SCAFFOLD — physics types and hook signature defined; density model pending.
 */

import { useMemo } from 'react';

export interface OrbitalObject {
  id: string;
  name: string;
  altitudeKm: number;
  /** Ballistic coefficient B* (1/m²) — lower = more drag */
  ballisticCoefficient: number;
  inclinationDeg: number;
}

export interface DriftPrediction {
  objectId: string;
  objectName: string;
  /** Predicted altitude loss in km per day under current space-weather conditions */
  altitudeLossKmPerDay: number;
  /** Altitude loss in km per day under nominal (quiet) conditions — for comparison */
  nominalAltitudeLossKmPerDay: number;
  /** Ratio: storm/nominal — > 1 means storm is accelerating decay */
  stormAmplificationFactor: number;
  /** Rough estimate of days until reentry (highly uncertain beyond 90 days) */
  estimatedDaysToReentry: number | null;
  /** Predicted semi-major axis delta in metres over next 24h */
  semiMajorAxisDelta24hM: number;
}

export interface OrbitalDriftState {
  predictions: DriftPrediction[];
  /** Total objects currently above decay threshold */
  criticalDecayCount: number;
  /** Worst-case amplification factor across all tracked objects */
  maxAmplification: number;
}

// Earth constants
const R_EARTH_KM = 6371;
const MU = 3.986004418e14;   // m³/s²

function nominalDragKmPerDay(altitudeKm: number): number {
  // Rough empirical: ~0.05 km/day at ISS altitude (420 km), scales with density
  const h = altitudeKm;
  if (h > 2000) return 0;   // MEO and above — negligible drag
  if (h > 800)  return 0.001 + (800 - h) * 0.0001;
  if (h > 500)  return 0.01  + (500 - h) * 0.001;
  return 0.05 + Math.max(0, 420 - h) * 0.005;
}

/**
 * useOrbitalDrift — space-weather-aware orbital decay prediction.
 *
 * @param objects  Array of orbital objects to analyse
 * @param kpIndex  Current Kp index (drives storm amplification factor)
 * @param f107     F10.7 solar flux proxy (SFU); defaults to 150 SFU
 * @returns        Per-object drift predictions and aggregate state
 *
 * TODO: Replace amplification heuristic with NRLMSISE-00 density lookup
 * TODO: Add J2 perturbation for inclination-dependent drift
 * TODO: Batch compute in a Web Worker for large constellations
 */
export function useOrbitalDrift(
  objects: OrbitalObject[],
  kpIndex = 2.5,
  f107 = 150,
): OrbitalDriftState {
  const predictions = useMemo<DriftPrediction[]>(() => {
    // Heuristic storm amplification: Kp ≥ 5 starts significantly raising drag
    const stormFactor = 1 + Math.max(0, kpIndex - 3) * 0.22 + Math.max(0, f107 - 120) * 0.004;

    return objects.map((obj) => {
      const nominalKpd = nominalDragKmPerDay(obj.altitudeKm);
      const stormKpd   = nominalKpd * stormFactor * (1 / Math.max(0.1, obj.ballisticCoefficient * 10));
      const a          = (R_EARTH_KM + obj.altitudeKm) * 1000;  // semi-major axis in metres
      const T          = 2 * Math.PI * Math.sqrt(a ** 3 / MU);  // orbital period in seconds
      const daysToReentry = stormKpd > 0.001
        ? Math.round(obj.altitudeKm / stormKpd)
        : null;

      // Semi-major axis change: da = -2π * B* * ρ * a² (simplified)
      // TODO: replace with proper Gauss variational equations
      const smaD24h = -(stormKpd * 1000);   // metres per day (stub)
      void T;                               // suppress unused var until proper use

      return {
        objectId: obj.id,
        objectName: obj.name,
        altitudeLossKmPerDay: stormKpd,
        nominalAltitudeLossKmPerDay: nominalKpd,
        stormAmplificationFactor: stormFactor,
        estimatedDaysToReentry: daysToReentry,
        semiMajorAxisDelta24hM: smaD24h,
      };
    });
  }, [objects, kpIndex, f107]);

  const criticalDecayCount = predictions.filter(
    (p) => p.estimatedDaysToReentry !== null && p.estimatedDaysToReentry < 180,
  ).length;

  const maxAmplification = predictions.reduce(
    (m, p) => Math.max(m, p.stormAmplificationFactor),
    1,
  );

  return { predictions, criticalDecayCount, maxAmplification };
}
