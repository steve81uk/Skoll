import { useCallback, useEffect, useRef, useState } from 'react';
import type { HazardTelemetryModel } from '../services/hazardModel';

interface OracleReply {
  role: 'user' | 'oracle';
  text: string;
  at: number;
  lane?: 'instant' | 'anomaly';
}

interface WorkerReady {
  type: 'READY';
  provider: 'local-webgpu' | 'local-cpu' | 'rules-fallback';
}

interface WorkerReply {
  type: 'REPLY';
  requestId: string;
  text: string;
}

interface WorkerAnomalyResult {
  type: 'ANOMALY_RESULT';
  requestId: string;
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
  const requestSeqRef = useRef(0);
  const activeRequestRef = useRef<string | null>(null);
  const [provider, setProvider] = useState<'local-webgpu' | 'local-cpu' | 'rules-fallback'>('rules-fallback');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleReply[]>([]);
  const [explanation, setExplanation] = useState<OracleExplanation | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/oracleWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerReady | WorkerReply | WorkerAnomalyResult | WorkerError | WorkerExplainResult>) => {
      const msg = ev.data;
      if (msg.type === 'READY') {
        setProvider(msg.provider);
        setReady(true);
        return;
      }

      if (msg.type === 'REPLY') {
        if (activeRequestRef.current !== msg.requestId) {
          return;
        }
        setLoading(false);
        setMessages((prev) => [...prev, { role: 'oracle', text: msg.text, at: Date.now(), lane: 'instant' }]);
        return;
      }

      if (msg.type === 'ANOMALY_RESULT') {
        if (activeRequestRef.current !== msg.requestId) {
          return;
        }
        setAnomalyLoading(false);
        setMessages((prev) => [...prev, { role: 'oracle', text: msg.text, at: Date.now(), lane: 'anomaly' }]);
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
      setAnomalyLoading(false);
      setExplaining(false);
      setError(msg.error);
    };

    worker.onerror = (ev) => {
      setLoading(false);
      setAnomalyLoading(false);
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

    const requestId = `${Date.now()}-${requestSeqRef.current++}`;
    activeRequestRef.current = requestId;
    setError(null);
    setLoading(true);
    setAnomalyLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: prompt.trim(), at: Date.now() }]);
    workerRef.current.postMessage({ type: 'ASK', prompt: prompt.trim(), snapshot, requestId });
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
    anomalyLoading,
    explaining,
    error,
    messages,
    explanation,
    ask,
    explain,
  };
}
