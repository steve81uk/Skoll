/**
 * SKÖLL-TRACK — LSTM WORKER HOOK
 * React hook that communicates with lstmWorker.ts via postMessage.
 * Inference runs off main thread; results are delivered async.
 *
 * Returns a stable dispatch function and a streaming results object.
 * The hook guarantees 60 FPS: the worker response is committed via
 * startTransition so React can defer the state update if needed.
 */

import { useEffect, useRef, useState, useCallback, useTransition } from 'react';
import type { FeatureVector, NeuralForecast } from '../ml/types';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LSTMWorkerState {
  forecast:    NeuralForecast | null;
  kpCurve24h:  number[];          // Full 24-h KP projection
  modelStatus: 'loading' | 'loaded' | 'simulated' | 'error';
  modelUsed:   string;
  inferring:   boolean;
  lastUpdated: Date | null;
  error:       string | null;
}

interface WorkerMessage {
  type:        'FORECAST' | 'MODEL_READY' | 'ERROR';
  result?:     NeuralForecast;
  kpCurve24h?: number[];
  modelUsed?:  string;
  status?:     'loaded' | 'simulated';
  error?:      string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLSTMWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [, startTransition] = useTransition();
  const [state, setState] = useState<LSTMWorkerState>({
    forecast:    null,
    kpCurve24h:  [],
    modelStatus: 'loading',
    modelUsed:   'Initialising…',
    inferring:   false,
    lastUpdated: null,
    error:       null,
  });

  // ─── Spin up worker once ────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/lstmWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
      const msg = ev.data;

      if (msg.type === 'MODEL_READY') {
        startTransition(() =>
          setState((prev) => ({
            ...prev,
            modelStatus: msg.status ?? 'simulated',
            modelUsed:   msg.status === 'loaded' ? 'TensorFlow.js LSTM v1' : 'Physics Simulation',
          })),
        );
      }

      if (msg.type === 'FORECAST') {
        startTransition(() =>
          setState((prev) => ({
            ...prev,
            forecast:    msg.result ?? prev.forecast,
            kpCurve24h:  msg.kpCurve24h ?? prev.kpCurve24h,
            modelUsed:   msg.modelUsed  ?? prev.modelUsed,
            inferring:   false,
            lastUpdated: new Date(),
            error:       null,
          })),
        );
      }

      if (msg.type === 'ERROR') {
        startTransition(() =>
          setState((prev) => ({
            ...prev,
            inferring:   false,
            modelStatus: 'error',
            error:       msg.error ?? 'Unknown worker error',
          })),
        );
      }
    };

    worker.onerror = (err) => {
      startTransition(() =>
        setState((prev) => ({ ...prev, inferring: false, modelStatus: 'error', error: err.message })),
      );
    };

    return () => { worker.terminate(); workerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Stable dispatch ────────────────────────────────────────────────────
  const infer = useCallback((features: FeatureVector) => {
    if (!workerRef.current) return;
    setState((prev) => ({ ...prev, inferring: true, error: null }));
    workerRef.current.postMessage({ type: 'INFER', payload: features });
  }, []);

  return { ...state, infer };
}
