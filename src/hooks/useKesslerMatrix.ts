/**
 * SKÖLL-TRACK — KESSLER CASCADE MATRIX HOOK
 *
 * Extends the existing KesslerNet probability model with a full orbital-shell
 * breakdown. Whereas KesslerNet returns aggregate 24h/7d probabilities, this
 * hook resolves risk per altitude band (LEO, MEO, GEO, SSO) and maps it into
 * a 2D matrix suitable for a heatmap visualisation.
 *
 * Architecture (planned):
 *   - Input: debris density per shell, current Kp, solar flux F10.7
 *   - Model: Monte Carlo cascade propagation (N=500 runs per cycle)
 *   - Output: risk[shell][timeHorizon] matrix + top-5 at-risk constellations
 *   - Refresh: every 5 minutes, or immediately after a CME impact event
 *
 * Status: SCAFFOLD — matrix shape and types defined; propagation logic pending.
 */

import { useMemo, useState } from 'react';

export type OrbitalShell = 'LEO_300' | 'LEO_500' | 'LEO_1200' | 'MEO' | 'GEO' | 'SSO';
export type TimeHorizon  = '1h' | '6h' | '24h' | '72h' | '7d';

export interface KesslerShellRisk {
  shell: OrbitalShell;
  altitudeKm: [number, number];         // [min, max]
  riskByHorizon: Record<TimeHorizon, number>;  // 0–1 probability
  debrisObjectCount: number;
  activeSatelliteCount: number;
  riskBand: 'NOMINAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface KesslerMatrixState {
  matrix: KesslerShellRisk[];
  /** Normalised overall risk 0–1 (max across all shells at 24h horizon) */
  overallRisk: number;
  /** Top constellations at risk based on orbital parameters */
  topAtRiskConstellations: string[];
  lastUpdated: Date | null;
  computing: boolean;
}

const SHELL_DEFS: Array<Pick<KesslerShellRisk, 'shell' | 'altitudeKm' | 'activeSatelliteCount' | 'debrisObjectCount'>> = [
  { shell: 'LEO_300',  altitudeKm: [250,  400],  activeSatelliteCount: 420,  debrisObjectCount: 1800 },
  { shell: 'LEO_500',  altitudeKm: [400,  600],  activeSatelliteCount: 6200, debrisObjectCount: 9400 },
  { shell: 'LEO_1200', altitudeKm: [600, 1500],  activeSatelliteCount: 1800, debrisObjectCount: 4200 },
  { shell: 'SSO',      altitudeKm: [500,  900],  activeSatelliteCount: 950,  debrisObjectCount: 3100 },
  { shell: 'MEO',      altitudeKm: [2000, 20200], activeSatelliteCount: 140, debrisObjectCount: 680  },
  { shell: 'GEO',      altitudeKm: [35786, 35786], activeSatelliteCount: 580, debrisObjectCount: 320 },
];

const EMPTY_HORIZONS: Record<TimeHorizon, number> = { '1h': 0, '6h': 0, '24h': 0, '72h': 0, '7d': 0 };

/**
 * useKesslerMatrix — per-shell cascade risk matrix.
 *
 * @param kpIndex         Current Kp index (affects atmospheric drag in LEO)
 * @param cmeImpactActive Whether a CME is currently impacting (elevates all risks)
 * @returns               Shell-resolved risk matrix and aggregate state
 *
 * TODO: Replace stub risk values with Monte Carlo propagation worker
 * TODO: Pull debris counts from live Space-Track.org API
 * TODO: Feed output into a KesslerMatrix heatmap component
 */
export function useKesslerMatrix(kpIndex = 2.5, cmeImpactActive = false): KesslerMatrixState {
  const [lastUpdated] = useState<Date | null>(null);

  const matrix = useMemo<KesslerShellRisk[]>(() => {
    // TODO: replace with real propagation model output
    const baseFactor = Math.min(1, kpIndex / 9) * (cmeImpactActive ? 1.6 : 1.0);
    return SHELL_DEFS.map((def) => ({
      ...def,
      riskByHorizon: { ...EMPTY_HORIZONS },  // placeholder — all zero until worker ready
      riskBand: baseFactor > 0.6 ? 'ELEVATED' : 'NOMINAL',
    }));
  }, [kpIndex, cmeImpactActive]);

  return {
    matrix,
    overallRisk: 0,           // TODO: compute from matrix once propagation is live
    topAtRiskConstellations: ['Starlink v2', 'OneWeb', 'ISS'],   // static placeholder
    lastUpdated,
    computing: false,
  };
}
