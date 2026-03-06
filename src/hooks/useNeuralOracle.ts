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
  const [provider, setProvider] = useState<'transformers-webgpu' | 'rules-fallback'>('rules-fallback');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleReply[]>([]);
  const [explanation, setExplanation] = useState<OracleExplanation | null>(null);

  useEffect(() => {
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

    worker.postMessage({ type: 'INIT' });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const ask = useCallback((prompt: string, snapshot: HazardTelemetryModel) => {
    if (!workerRef.current || !prompt.trim()) return;

    setError(null);
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: prompt.trim(), at: Date.now() }]);
    workerRef.current.postMessage({ type: 'ASK', prompt: prompt.trim(), snapshot });
  }, []);

  const explain = useCallback((mode: 'global' | 'local', snapshot: HazardTelemetryModel, prompt?: string) => {
    if (!workerRef.current) return;

    setError(null);
    setExplaining(true);
    workerRef.current.postMessage({ type: 'EXPLAIN', mode, snapshot, prompt });
  }, []);

  return {
    provider,
    ready,
    loading,
    explaining,
    error,
    messages,
    explanation,
    ask,
    explain,
  };
}
