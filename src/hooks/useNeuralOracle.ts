import { useCallback, useEffect, useRef, useState } from 'react';
import type { HazardTelemetryModel } from '../services/hazardModel';

interface OracleReply {
  role: 'user' | 'oracle';
  text: string;
  at: number;
}

interface WorkerReady {
  type: 'READY';
  provider: 'transformers-webgpu' | 'rules-fallback';
}

interface WorkerReply {
  type: 'REPLY';
  text: string;
}

interface WorkerError {
  type: 'ERROR';
  error: string;
}

export interface OracleExplainWeight {
  feature: string;
  weight: number;
  note: string;
}

interface WorkerExplainResult {
  type: 'EXPLAIN_RESULT';
  mode: 'global' | 'local';
  weights: OracleExplainWeight[];
  summary: string;
  at: number;
}

interface OracleExplanation {
  mode: 'global' | 'local';
  weights: OracleExplainWeight[];
  summary: string;
  at: number;
}

export function useNeuralOracle() {
  const workerRef = useRef<Worker | null>(null);
  const initializedRef = useRef(false);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const lowMemoryDevice = deviceMemory < 16;
  const [modelOptIn, setModelOptIn] = useState(false);
  const [provider, setProvider] = useState<'transformers-webgpu' | 'rules-fallback'>('rules-fallback');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleReply[]>([]);
  const [explanation, setExplanation] = useState<OracleExplanation | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = new Worker(new URL('../workers/oracleWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerReady | WorkerReply | WorkerError | WorkerExplainResult>) => {
      const msg = ev.data;
      if (msg.type === 'READY') {
        setProvider(msg.provider);
        setReady(true);
        return;
      }

      if (msg.type === 'REPLY') {
        setLoading(false);
        setMessages((prev) => [...prev, { role: 'oracle', text: msg.text, at: Date.now() }]);
        return;
      }

      if (msg.type === 'EXPLAIN_RESULT') {
        setExplaining(false);
        setExplanation({
          mode: msg.mode,
          weights: msg.weights,
          summary: msg.summary,
          at: msg.at,
        });
        return;
      }

      setLoading(false);
      setExplaining(false);
      setError(msg.error);
    };

    worker.onerror = (ev) => {
      setLoading(false);
      setExplaining(false);
      setError(ev.message);
    };

    return worker;
  }, []);

  const initIfNeeded = useCallback(() => {
    const worker = ensureWorker();
    if (initializedRef.current) {
      return worker;
    }

    initializedRef.current = true;
    worker.postMessage({ type: 'INIT', forceRulesFallback: lowMemoryDevice || !modelOptIn });
    return worker;
  }, [ensureWorker, lowMemoryDevice, modelOptIn]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      workerRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !initializedRef.current) {
      return;
    }
    if (!lowMemoryDevice && modelOptIn && provider === 'rules-fallback') {
      initializedRef.current = false;
      setReady(false);
      initIfNeeded();
    }
  }, [initIfNeeded, lowMemoryDevice, modelOptIn, provider, ready]);

  const ask = useCallback((prompt: string, snapshot: HazardTelemetryModel) => {
    if (!prompt.trim()) return;
    const worker = initIfNeeded();

    setError(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: prompt.trim(), at: Date.now() }]);
    worker.postMessage({ type: 'ASK', prompt: prompt.trim(), snapshot });
  }, [initIfNeeded]);

  const explain = useCallback((mode: 'global' | 'local', snapshot: HazardTelemetryModel, prompt?: string) => {
    const worker = initIfNeeded();

    setError(null);
    setExplaining(true);
    worker.postMessage({ type: 'EXPLAIN', mode, snapshot, prompt });
  }, [initIfNeeded]);

  return {
    provider,
    ready,
    lowMemoryDevice,
    modelOptIn,
    loading,
    explaining,
    error,
    messages,
    explanation,
    ask,
    explain,
    setModelOptIn,
  };
}
