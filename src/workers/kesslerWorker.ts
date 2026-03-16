/**
 * SKÖLL-TRACK — KESSLER CASCADE PREDICTION WEB WORKER
 * Runs orbital debris cascade probability maths entirely off the main thread.
 *
 * Protocol:
 *   Main → Worker:  { type: 'INFER',  payload: KesslerInput }
 *                   { type: 'PING' }
 *   Worker → Main:  { type: 'CASCADE_RESULT', result: KesslerCascadeForecast }
 *                   { type: 'PONG' }
 *                   { type: 'ERROR', error: string }
 *
 * Physics model:
 *   Uses the same computeKesslerCascade() math from forecastMath.ts but adds
 *   live-telemetry modifiers for atmospheric-drag-index (solar-flux proxy) and
 *   an estimated LEO debris object count (drives fragment multiplication rate).
 */

import { computeKesslerCascade } from '../ml/forecastMath';
import type { KesslerCascadeForecast } from '../ml/types';

// ─── Input / Output contracts ─────────────────────────────────────────────────

export interface KesslerInput {
  /** Kp index time-series for the past 24 h (one value per 3-h window → 8 pts). */
  kpCurve: number[];
  /** Solar wind speed time-series (km/s) for the past 24 h. */
  solarWindSpeedHistory: number[];
  /**
   * Estimated number of tracked LEO debris objects (>10 cm).
   * NOAA/Space-Fence baseline ≈ 27 000. Higher values amplify cascade risk.
   */
  debrisCountLeo?: number;
  /**
   * Atmospheric drag index (0–1, derived from F10.7 solar flux proxy).
   * High solar activity → denser atmosphere → faster orbital decay of fragments.
   * Counter-intuitively this *reduces* long-term debris density but raises
   * short-term collision probability during enhanced drag episodes.
   */
  atmosphericDragIndex?: number;
}

// ─── Modifier maths ───────────────────────────────────────────────────────────

const BASELINE_DEBRIS_COUNT = 27_000;

/**
 * Debris-count multiplier: scales linearly from 1.0 at baseline to 1.4 at
 * 40 000 objects (observed worst-case estimate by 2030 projections).
 */
function debrisMultiplier(count: number): number {
  const excess = Math.max(0, count - BASELINE_DEBRIS_COUNT) / 13_000;
  return 1 + Math.min(0.4, excess * 0.4);
}

/**
 * Drag modifier: during solar-maximum drag episodes, collision windows
 * are shorter but fragment cloud dispersion is faster.
 * Net effect: +5% 24 h risk per 0.1 drag-index above 0.5.
 */
function dragModifier24h(dragIndex: number): number {
  return 1 + Math.max(0, (dragIndex - 0.5) * 0.5);
}

function applyModifiers(
  base: KesslerCascadeForecast,
  debrisCount: number,
  dragIndex: number,
): KesslerCascadeForecast {
  const dm = debrisMultiplier(debrisCount);
  const drag = dragModifier24h(dragIndex);

  const next24h = Math.min(0.97, base.next24hProbability * dm * drag);
  const next72h = Math.min(0.98, base.next72hProbability * dm);
  const next7d  = Math.min(0.99, base.next7dProbability  * dm);

  const riskBand: KesslerCascadeForecast['riskBand'] =
    next7d >= 0.6 ? 'CRITICAL' : next7d >= 0.3 ? 'ELEVATED' : 'NOMINAL';

  return {
    next24hProbability: parseFloat(next24h.toFixed(3)),
    next72hProbability: parseFloat(next72h.toFixed(3)),
    next7dProbability:  parseFloat(next7d.toFixed(3)),
    riskBand,
  };
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<{ type: string; payload?: KesslerInput }>) => {
  const { type, payload } = event.data;

  if (type === 'PING') {
    self.postMessage({ type: 'PONG' });
    return;
  }

  if (type === 'INFER') {
    if (!payload) {
      self.postMessage({ type: 'ERROR', error: 'No payload provided to INFER.' });
      return;
    }

    try {
      const base = computeKesslerCascade(
        payload.kpCurve,
        payload.solarWindSpeedHistory,
      );

      const result = applyModifiers(
        base,
        payload.debrisCountLeo  ?? BASELINE_DEBRIS_COUNT,
        payload.atmosphericDragIndex ?? 0,
      );

      self.postMessage({ type: 'CASCADE_RESULT', result });
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: String(err) });
    }

    return;
  }

  self.postMessage({ type: 'ERROR', error: `Unknown message type: ${type}` });
};
