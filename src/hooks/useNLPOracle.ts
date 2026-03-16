/**
 * SKÖLL-TRACK — WEBGPU NLP CHAT HOOK
 *
 * Streaming chat oracle backed by nlpOracleWorker.ts.
 * Three-tier inference: WebGPU → WASM CPU → rules-fallback.
 *
 * Models:
 *   WebGPU — Xenova/Qwen2-0.5B-Instruct
 *   WASM   — Xenova/TinyLlama-1.1B-Chat-v1.0
 *
 * Session memory: retains last `maxHistoryTurns` conversation turns
 * so the model has rolling context without unbounded token growth.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HazardTelemetryModel } from '../services/hazardModel';

export type NLPProvider = 'transformers-webgpu' | 'transformers-wasm' | 'rules-fallback';
export type NLPRole = 'system' | 'user' | 'assistant';

export interface NLPMessage {
  role: NLPRole;
  content: string;
  at: number;
  /** True while the model is still streaming this message */
  streaming?: boolean;
}

export interface NLPOracleState {
  provider: NLPProvider;
  ready: boolean;
  /** Model is currently generating a response */
  generating: boolean;
  /** Progress 0–1 while the model weights are loading */
  loadProgress: number;
  messages: NLPMessage[];
  /** Partial token buffer for the in-progress streamed response */
  streamBuffer: string;
  error: string | null;
}

export interface NLPOracleControls {
  /** Send a user query with optional live telemetry context injected into system prompt */
  ask: (prompt: string, snapshot?: HazardTelemetryModel) => void;
  /** Clear conversation history but keep model loaded */
  clearHistory: () => void;
  /** Abort the current generation mid-stream */
  abort: () => void;
}

const SYSTEM_PROMPT = [
  'You are Neural Oracle, an expert AI assistant embedded in SKÖLL-TRACK, a real-time',
  'space-weather operations platform. You have access to live solar wind, geomagnetic,',
  'and orbital debris telemetry. Answer concisely and technically in 2–3 sentences.',
  'When telemetry data is provided in the context, reference specific values.',
].join(' ');

// Worker messages (worker → hook)
type WorkerMessage =
  | { type: 'LOAD_PROGRESS'; progress: number }
  | { type: 'READY'; provider: NLPProvider }
  | { type: 'TOKEN'; token: string }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string };

/**
 * useNLPOracle — streaming WebGPU/WASM chat oracle with session memory.
 *
 * @param maxHistoryTurns  How many conversation turns to keep in context (default 6)
 * @returns                Oracle state and control handles
 */
export function useNLPOracle(maxHistoryTurns = 6): NLPOracleState & NLPOracleControls {
  const workerRef   = useRef<Worker | null>(null);
  // Mirror of state.messages for synchronous access inside callbacks
  const messagesRef = useRef<NLPMessage[]>([]);

  const [state, setState] = useState<NLPOracleState>({
    provider:     'rules-fallback',
    ready:        false,
    generating:   false,
    loadProgress: 0,
    messages:     [],
    streamBuffer: '',
    error:        null,
  });

  // ---------------------------------------------------------------------------
  // Worker lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/nlpOracleWorker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current = worker;

    worker.addEventListener('message', (ev: MessageEvent<WorkerMessage>) => {
      const msg = ev.data;

      if (msg.type === 'LOAD_PROGRESS') {
        setState((prev) => ({ ...prev, loadProgress: msg.progress }));
        return;
      }

      if (msg.type === 'READY') {
        setState((prev) => ({
          ...prev,
          provider:     msg.provider,
          ready:        true,
          loadProgress: 1,
        }));
        return;
      }

      if (msg.type === 'TOKEN') {
        setState((prev) => {
          // Append token to the streaming assistant message (last in list)
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            messages[messages.length - 1] = {
              ...last,
              content: last.content + msg.token,
            };
            messagesRef.current = messages;
          }
          return { ...prev, messages, streamBuffer: prev.streamBuffer + msg.token };
        });
        return;
      }

      if (msg.type === 'DONE') {
        setState((prev) => {
          // Mark the streaming assistant message as complete
          const messages = prev.messages.map((m) =>
            m.streaming ? { ...m, streaming: false } : m,
          );
          messagesRef.current = messages;
          return { ...prev, messages, generating: false, streamBuffer: '' };
        });
        return;
      }

      if (msg.type === 'ERROR') {
        setState((prev) => ({
          ...prev,
          generating:   false,
          streamBuffer: '',
          error:        msg.message,
        }));
      }
    });

    worker.postMessage({ type: 'INIT' });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // ask — add user message and kick off generation
  // ---------------------------------------------------------------------------
  const ask = useCallback(
    (prompt: string, snapshot?: HazardTelemetryModel) => {
      if (!prompt.trim()) return;

      const contextLine = snapshot
        ? `[Live telemetry: Kp ${snapshot.kpIndex.toFixed(1)}, Bz ${snapshot.bzGsm.toFixed(1)} nT, wind ${Math.round(snapshot.solarWindSpeed)} km/s, flare ${snapshot.flareClass}]`
        : '';

      const userMessage: NLPMessage = {
        role:    'user',
        content: contextLine ? `${prompt}\n${contextLine}` : prompt,
        at:      Date.now(),
      };

      const assistantPlaceholder: NLPMessage = {
        role:      'assistant',
        content:   '',
        at:        Date.now(),
        streaming: true,
      };

      setState((prev) => {
        const messages = [...prev.messages, userMessage, assistantPlaceholder];
        messagesRef.current = messages;
        return {
          ...prev,
          generating:   true,
          streamBuffer: '',
          error:        null,
          messages,
        };
      });

      // Build rolling context capped at maxHistoryTurns (each turn = user + assistant)
      const history = messagesRef.current
        .filter((m) => !m.streaming)                          // exclude the empty placeholder
        .filter((m) => m.role !== 'system')
        .slice(-(maxHistoryTurns * 2));

      // Include the new user message at the end
      const contextMessages = [
        ...history.filter((m) => m !== userMessage),
        { role: userMessage.role, content: userMessage.content },
      ].map(({ role, content }) => ({ role, content }));

      workerRef.current?.postMessage({
        type:         'ASK',
        systemPrompt: SYSTEM_PROMPT,
        messages:     contextMessages,
      });
    },
    [maxHistoryTurns],
  );

  // ---------------------------------------------------------------------------
  // clearHistory / abort
  // ---------------------------------------------------------------------------
  const clearHistory = useCallback(() => {
    messagesRef.current = [];
    setState((prev) => ({ ...prev, messages: [], streamBuffer: '' }));
  }, []);

  const abort = useCallback(() => {
    workerRef.current?.postMessage({ type: 'ABORT' });
    setState((prev) => ({
      ...prev,
      generating:   false,
      streamBuffer: '',
      messages: prev.messages.map((m) =>
        m.streaming ? { ...m, streaming: false, content: m.content || '[aborted]' } : m,
      ),
    }));
  }, []);

  return { ...state, ask, clearHistory, abort };
}
