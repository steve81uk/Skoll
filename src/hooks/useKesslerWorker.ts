/**
 * SKÖLL-TRACK — KESSLER CASCADE WORKER HOOK
 *
 * Manages the full lifecycle of kesslerWorker.ts: spawn → INFER → CASCADE_RESULT → terminate.
 * Feeds live NOAA bundle data into the worker and returns the cascade forecast.
 *
 * Worker lifecycle:
 *   - Spawned once on mount; terminated on unmount (strict cleanup → no zombie threads)
 *   - Sends a new INFER payload whenever the NOAA bundle reference updates (new fetch cycle)
 *   - Polls every 5 minutes as a safety net (catches quiet periods with no bundle change)
 *
 * @param bundle              Latest NOAABundle from useNOAADONKI (null while loading)
 * @param atmosphericDragIndex  F10.7 solar-flux proxy 0–1 (high = increased atmospheric drag)
 */

import { useEffect, useRef, useState } from 'react';
import type { KesslerCascadeForecast } from '../ml/types';
import type { NOAABundle } from '../workers/noaaWorker';
import type { KesslerInput } from '../workers/kesslerWorker';

export interface KesslerWorkerState {
  forecast: KesslerCascadeForecast | null;
  computing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const INITIAL_STATE: KesslerWorkerState = {
  forecast: null,
  computing: false,
  error: null,
  lastUpdated: null,
};

const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

// ─── Derive kpCurve from kpSeries (last 8 × 3-h windows) ─────────────────────
function buildKpCurve(bundle: NOAABundle): number[] {
  const series = bundle.kpSeries;
  if (!series || series.length === 0) return [bundle.latestKp];
  return series.slice(-8).map((p) => p.kp);
}

// ─── Rough solar-wind speed history (best-effort from bundle) ─────────────────
function buildSpeedHistory(bundle: NOAABundle, len: number): number[] {
  // NOAA bundle carries latest speed but not a full speed time-series.
  // Fill all points with the current snapshot value — acceptable for short-horizon Kessler math.
  const speed = bundle.speed ?? 450;
  return Array.from({ length: len }, () => speed);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useKesslerWorker({
  bundle,
  atmosphericDragIndex = 0,
}: {
  bundle: NOAABundle | null;
  atmosphericDragIndex?: number;
}): KesslerWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<KesslerWorkerState>(INITIAL_STATE);

  // ── Spawn worker once & wire message handler ─────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/kesslerWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<{ type: string; result?: KesslerCascadeForecast; error?: string }>) => {
      const { type, result, error } = ev.data;
      if (type === 'CASCADE_RESULT' && result) {
        setState({ forecast: result, computing: false, error: null, lastUpdated: new Date() });
      } else if (type === 'ERROR') {
        setState((prev) => ({ ...prev, computing: false, error: error ?? 'Unknown worker error' }));
      }
      // PONG — health check response; no state change needed
    };

    worker.onerror = (err) => {
      setState((prev) => ({ ...prev, computing: false, error: err.message }));
    };

    // Health check
    worker.postMessage({ type: 'PING' });

    return () => {
      // Critical: terminate to prevent zombie threads consuming RAM on hot-reload / strict-mode double-mount
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── Dispatch INFER whenever the NOAA bundle updates ───────────────────────────
  useEffect(() => {
    if (!workerRef.current || !bundle) return;

    const kpCurve = buildKpCurve(bundle);
    const solarWindSpeedHistory = buildSpeedHistory(bundle, kpCurve.length);

    const payload: KesslerInput = {
      kpCurve,
      solarWindSpeedHistory,
      debrisCountLeo: undefined,        // uses worker default (27 000)
      atmosphericDragIndex,
    };

    setState((prev) => ({ ...prev, computing: true }));
    workerRef.current.postMessage({ type: 'INFER', payload });
  }, [bundle, atmosphericDragIndex]);

  // ── 5-minute polling heartbeat ────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!workerRef.current || !bundle) return;
      const kpCurve = buildKpCurve(bundle);
      const solarWindSpeedHistory = buildSpeedHistory(bundle, kpCurve.length);
      setState((prev) => ({ ...prev, computing: true }));
      workerRef.current.postMessage({
        type: 'INFER',
        payload: { kpCurve, solarWindSpeedHistory, atmosphericDragIndex } satisfies KesslerInput,
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [bundle, atmosphericDragIndex]);

  return state;
}
