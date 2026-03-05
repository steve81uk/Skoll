/**
 * SKÖLL-TRACK — NOAA / DONKI WORKER HOOK
 * React hook that manages the noaaWorker lifecycle and exposes live
 * space-weather data to components.
 *
 * Auto-polls every 5 minutes. Data is delivered via startTransition
 * to guarantee no main-thread jank.
 */

import { useEffect, useRef, useState, useTransition, useCallback } from 'react';
import type { NOAABundle, KPPoint, CMEEvent } from '../workers/noaaWorker';

export type { NOAABundle, KPPoint, CMEEvent };

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NOAADONKIState {
  bundle:          NOAABundle | null;
  loading:         boolean;
  lastFetch:       Date | null;
  error:           string | null;
  consecutiveErrors: number;
}

interface WorkerOut {
  type:    'NOAA_DATA' | 'CME_DATA' | 'KP_SERIES' | 'ERROR';
  data?:   NOAABundle;
  events?: CMEEvent[];
  points?: KPPoint[];
  error?:  string;
}

const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNOAADONKI() {
  const workerRef  = useRef<Worker | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [, startTransition] = useTransition();

  const [state, setState] = useState<NOAADONKIState>({
    bundle:           null,
    loading:          true,
    lastFetch:        null,
    error:            null,
    consecutiveErrors:0,
  });

  // ─── Bootstrap worker ────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/noaaWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const msg = ev.data;
      if (msg.type === 'NOAA_DATA' && msg.data) {
        startTransition(() =>
          setState({
            bundle:           msg.data!,
            loading:          false,
            lastFetch:        new Date(),
            error:            null,
            consecutiveErrors:0,
          }),
        );
      }
      if (msg.type === 'ERROR') {
        startTransition(() =>
          setState((prev) => ({
            ...prev,
            loading:          false,
            error:            msg.error ?? 'Fetch error',
            consecutiveErrors:prev.consecutiveErrors + 1,
          })),
        );
      }
    };

    worker.onerror = (err) => {
      startTransition(() =>
        setState((prev) => ({
          ...prev,
          loading:          false,
          error:            err.message,
          consecutiveErrors:prev.consecutiveErrors + 1,
        })),
      );
    };

    // Initial fetch
    worker.postMessage({ type: 'FETCH_ALL' });

    // Poll
    timerRef.current = setInterval(() => {
      worker.postMessage({ type: 'FETCH_ALL' });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timerRef.current);
      worker.terminate();
      workerRef.current = null;
    };
   
  }, []);

  // ─── Manual refresh ──────────────────────────────────────────────────
  const refresh = useCallback(() => {
    if (!workerRef.current) return;
    setState((prev) => ({ ...prev, loading: true }));
    workerRef.current.postMessage({ type: 'FETCH_ALL' });
  }, []);

  return { ...state, refresh };
}
