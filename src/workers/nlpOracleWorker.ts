/**
 * SKÖLL-TRACK — NLP ORACLE CHAT WORKER
 *
 * Streaming chat inference using @xenova/transformers.
 * Three-tier fallback: WebGPU → WASM CPU → deterministic rules engine.
 *
 * Models:
 *   WebGPU — Xenova/Qwen2-0.5B-Instruct  (~400 MB quantised ONNX q4)
 *   WASM   — Xenova/TinyLlama-1.1B-Chat-v1.0 (~640 MB q4)
 *
 * Message protocol (host → worker):
 *   { type: 'INIT' }
 *   { type: 'ASK'; systemPrompt: string; messages: ChatMessage[] }
 *   { type: 'ABORT' }
 *
 * Message protocol (worker → host):
 *   { type: 'LOAD_PROGRESS'; progress: number }   — 0–1 while weights download
 *   { type: 'READY'; provider: Provider }
 *   { type: 'TOKEN'; token: string }              — one or more chars per call
 *   { type: 'DONE' }                              — generation complete
 *   { type: 'ERROR'; message: string }
 */

type Provider = 'transformers-webgpu' | 'transformers-wasm' | 'rules-fallback';

export interface ChatMessage { role: string; content: string; }

type InMessage =
  | { type: 'INIT' }
  | { type: 'ASK'; systemPrompt: string; messages: ChatMessage[] }
  | { type: 'ABORT' };

// Narrowest useful shape from the pipeline's streaming callback
type StreamBeam = { generated_text: string | ChatMessage[] };
type CallbackFn = (output: StreamBeam[]) => boolean | void;

type ChatPipelineFn = (
  input: ChatMessage[],
  opts?: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | ChatMessage[] }>>;

const MODEL_WEBGPU = 'Xenova/Qwen2-0.5B-Instruct';
const MODEL_CPU    = 'Xenova/TinyLlama-1.1B-Chat-v1.0';

let provider: Provider = 'rules-fallback';
let chatPipe: ChatPipelineFn | null = null;
let abortFlag = false;

// ---------------------------------------------------------------------------
// Progress callback — fires during model weight download / tokenizer load
// ---------------------------------------------------------------------------
function onProgress(ev: { status?: string; progress?: number }) {
  if (ev.status === 'progress' && typeof ev.progress === 'number') {
    self.postMessage({ type: 'LOAD_PROGRESS', progress: ev.progress / 100 });
  }
}

// ---------------------------------------------------------------------------
// Pipeline construction
// ---------------------------------------------------------------------------
async function buildPipeline(device: 'webgpu' | 'cpu'): Promise<ChatPipelineFn> {
  const transformers = await import('@xenova/transformers');
  transformers.env.allowLocalModels = false;

  if (device === 'cpu') {
    // Run ONNX inference directly on the worker thread (no SharedArrayBuffer proxy)
    (transformers.env as Record<string, unknown>).backends = {
      onnx: { wasm: { proxy: false } },
    };
  }

  const model = device === 'webgpu' ? MODEL_WEBGPU : MODEL_CPU;

  const pipe = await (
    transformers.pipeline as unknown as (
      task: string,
      model: string,
      opts?: Record<string, unknown>,
    ) => Promise<ChatPipelineFn>
  )('text-generation', model, { device, progress_callback: onProgress });

  return pipe;
}

// ---------------------------------------------------------------------------
// Initialisation — tries each tier in order
// ---------------------------------------------------------------------------
async function initModel() {
  // Tier 1 — WebGPU (GPU-accelerated, fastest)
  try {
    chatPipe = await buildPipeline('webgpu');
    provider = 'transformers-webgpu';
    self.postMessage({ type: 'READY', provider });
    return;
  } catch {
    // WebGPU unavailable (Intel UHD, no --enable-webgpu flag, CSP, etc.)
  }

  // Tier 2 — WASM CPU (works everywhere with enough RAM)
  try {
    chatPipe = await buildPipeline('cpu');
    provider = 'transformers-wasm';
    self.postMessage({ type: 'READY', provider });
    return;
  } catch {
    // Insufficient memory, WASM disabled, or strict CSP
  }

  // Tier 3 — deterministic rules engine (zero download, instant)
  provider = 'rules-fallback';
  chatPipe = null;
  self.postMessage({ type: 'READY', provider });
}

// ---------------------------------------------------------------------------
// Rules-engine fallback — deterministic reply from last user message
// ---------------------------------------------------------------------------
function rulesReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const q = lastUser?.content ?? '';

  // Extract telemetry context injected by useNLPOracle
  const tlm = q.match(
    /Kp\s+([\d.]+).*?Bz\s+([-\d.]+)\s*nT.*?wind\s+(\d+)\s*km\/s.*?flare\s+(\w+)/i,
  );

  if (tlm) {
    const [, kp, bz, wind, flare] = tlm;
    const kpN = parseFloat(kp);
    const bzN = parseFloat(bz);
    const storm =
      kpN >= 7 ? 'severe geomagnetic storm'
      : kpN >= 5 ? 'moderate storm'
      : kpN >= 3 ? 'minor disturbance'
      : 'quiet conditions';
    const coupling =
      bzN <= -10 ? 'strongly southward (active coupling)'
      : bzN <= -5 ? 'moderately southward'
      : 'weakly coupled or northward';
    const guidance =
      kpN >= 5
        ? 'Recommend HF communications monitoring and polar-route advisories.'
        : 'Maintain nominal watch cycle.';

    return (
      `Current space-weather state: ${storm} (Kp ${kp}). ` +
      `IMF Bz is ${coupling} at ${bz} nT; solar wind ${wind} km/s. ` +
      `Flare activity: class ${flare}. ${guidance}`
    );
  }

  // Generic fallback when no telemetry context is present
  return (
    `[rules-fallback] NLP model unavailable on this device. ` +
    `Query received: "${q.slice(0, 160)}". ` +
    `For full AI responses, a WebGPU-capable GPU or sufficient WASM memory is required.`
  );
}

// ---------------------------------------------------------------------------
// Extract assistant text from a generation output item
// ---------------------------------------------------------------------------
function extractText(item: StreamBeam): string {
  if (typeof item.generated_text === 'string') {
    return item.generated_text;
  }
  if (Array.isArray(item.generated_text)) {
    // Chat-template format — grab the last assistant turn
    const msgs = item.generated_text as ChatMessage[];
    const assistant = [...msgs].reverse().find((m) => m.role === 'assistant');
    return assistant?.content ?? '';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Generation — streams tokens back as they are produced
// ---------------------------------------------------------------------------
async function askModel(systemPrompt: string, messages: ChatMessage[]) {
  abortFlag = false;

  const contextMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Rules fallback — simulate streaming by splitting into word chunks
  if (!chatPipe) {
    const reply = rulesReply(messages);
    const words = reply.split(/(\s+)/);
    for (const chunk of words) {
      if (abortFlag) break;
      if (chunk) self.postMessage({ type: 'TOKEN', token: chunk });
      // Small artificial delay for typewriter effect
      await new Promise<void>((resolve) => setTimeout(resolve, 22));
    }
    self.postMessage({ type: 'DONE' });
    return;
  }

  let prevLength = 0;

  const streamCallback: CallbackFn = (output) => {
    if (abortFlag) return true; // truthy → abort generation

    const first = output[0];
    if (!first) return false;

    const fullText = extractText(first);

    if (fullText.length > prevLength) {
      const newChunk = fullText.slice(prevLength);
      prevLength = fullText.length;
      self.postMessage({ type: 'TOKEN', token: newChunk });
    }

    return false;
  };

  try {
    await chatPipe(contextMessages, {
      max_new_tokens: 256,
      temperature: 0.65,
      repetition_penalty: 1.15,
      do_sample: true,
      callback_function: streamCallback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ERROR', message });
  }

  self.postMessage({ type: 'DONE' });
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
self.addEventListener('message', (ev: MessageEvent<InMessage>) => {
  const msg = ev.data;

  if (msg.type === 'INIT')  { void initModel();                              return; }
  if (msg.type === 'ASK')   { void askModel(msg.systemPrompt, msg.messages); return; }
  if (msg.type === 'ABORT') { abortFlag = true;                              return; }
});
