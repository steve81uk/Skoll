import type { HazardTelemetryModel } from '../services/hazardModel';

type Provider = 'transformers-webgpu' | 'rules-fallback';
type ExplainMode = 'global' | 'local';

interface ExplanationWeight {
  feature: string;
  weight: number;
  note: string;
}

type InMessage =
  | { type: 'INIT' }
  | { type: 'ASK'; prompt: string; snapshot: HazardTelemetryModel }
  | { type: 'EXPLAIN'; mode: ExplainMode; snapshot: HazardTelemetryModel; prompt?: string };

let provider: Provider = 'rules-fallback';
let generator: ((input: string, opts?: Record<string, unknown>) => Promise<unknown>) | null = null;

function classifyHazard(snapshot: HazardTelemetryModel) {
  const storm = snapshot.kpIndex >= 7 ? 'SEVERE' : snapshot.kpIndex >= 5 ? 'ELEVATED' : 'NOMINAL';
  const coupling = snapshot.bzGsm <= -10 ? 'STRONG' : snapshot.bzGsm <= -5 ? 'MODERATE' : 'WEAK';
  const wind = snapshot.solarWindSpeed >= 800 ? 'FAST' : snapshot.solarWindSpeed >= 600 ? 'ENHANCED' : 'BASELINE';
  return { storm, coupling, wind };
}

function fallbackReply(prompt: string, snapshot: HazardTelemetryModel) {
  const h = classifyHazard(snapshot);
  const kessler = snapshot.kesslerCascade
    ? `Kessler risk: 24h ${Math.round(snapshot.kesslerCascade.next24hProbability * 100)}%, 7d ${Math.round(snapshot.kesslerCascade.next7dProbability * 100)}% (${snapshot.kesslerCascade.riskBand}).`
    : 'Kessler risk: awaiting model output.';

  return [
    `Hazard summary: geomagnetic state is ${h.storm}, IMF coupling ${h.coupling}, solar wind ${h.wind}.`,
    `Live values: Kp ${snapshot.kpIndex.toFixed(1)}, Bz ${snapshot.bzGsm.toFixed(1)} nT, wind ${Math.round(snapshot.solarWindSpeed)} km/s, flare ${snapshot.flareClass}.`,
    `Magnetic drivers: TOTPOT ${snapshot.totpot.toFixed(1)}, SAVNCPP ${snapshot.savncpp.toFixed(2)}, TOTUSJZ ${snapshot.totusjz.toFixed(1)}.`,
    `${kessler}`,
    `Operator guidance: ${snapshot.kpIndex >= 5 ? 'prioritize HF comms monitoring and polar-route advisories.' : 'maintain nominal watch cycle.'}`,
    `Query interpreted: "${prompt}".`,
  ].join(' ');
}

function computeExplainWeights(snapshot: HazardTelemetryModel, mode: ExplainMode): ExplanationWeight[] {
  const speedWeight = Math.min(1, snapshot.solarWindSpeed / 950);
  const bzWeight = Math.min(1, Math.abs(Math.min(snapshot.bzGsm, 0)) / 20);
  const btWeight = Math.min(1, snapshot.bt / 24);
  const densityWeight = Math.min(1, snapshot.density / 22);
  const kpWeight = Math.min(1, snapshot.kpIndex / 9);
  const totpotWeight = Math.min(1, snapshot.totpot / 4000);
  const savncppWeight = Math.min(1, snapshot.savncpp / 10);
  const totusjzWeight = Math.min(1, snapshot.totusjz / 120);

  const baseline: ExplanationWeight[] = [
    {
      feature: 'TOTUSJZ',
      weight: Math.min(1, 0.55 * totusjzWeight + 0.2 * bzWeight + 0.1 * btWeight),
      note: 'Total unsigned vertical current indicates magnetic stress build-up',
    },
    {
      feature: 'TOTPOT',
      weight: Math.min(1, 0.58 * totpotWeight + 0.2 * speedWeight + 0.08 * btWeight),
      note: 'Free magnetic energy density contribution',
    },
    {
      feature: 'SAVNCPP',
      weight: Math.min(1, 0.54 * savncppWeight + 0.18 * bzWeight + 0.1 * densityWeight),
      note: 'Net current per polarity contribution to flare/CME likelihood',
    },
    {
      feature: 'Kp persistence',
      weight: Math.min(1, 0.45 * kpWeight),
      note: 'Current geomagnetic regime persistence signal',
    },
  ];

  if (mode === 'global') {
    return baseline.sort((a, b) => b.weight - a.weight);
  }

  const signedRows: ExplanationWeight[] = [
    {
      feature: 'TOTUSJZ',
      weight: Math.max(-1, Math.min(1, 0.62 * totusjzWeight + 0.16 * bzWeight - 0.3)),
      note: 'Signed local contribution from vertical current loading',
    },
    {
      feature: 'TOTPOT',
      weight: Math.max(-1, Math.min(1, 0.64 * totpotWeight + 0.14 * speedWeight - 0.28)),
      note: 'Signed local contribution from free-energy loading',
    },
    {
      feature: 'SAVNCPP',
      weight: Math.max(-1, Math.min(1, 0.58 * savncppWeight + 0.12 * densityWeight - 0.26)),
      note: 'Signed local contribution from current-imbalance signal',
    },
    {
      feature: 'Kp persistence',
      weight: Math.max(-1, Math.min(1, 0.52 * kpWeight - 0.24)),
      note: 'Signed local contribution from current geomagnetic regime memory',
    },
  ];

  return signedRows.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

function buildExplainSummary(weights: ExplanationWeight[], mode: ExplainMode, snapshot: HazardTelemetryModel, prompt?: string): string {
  const top = (mode === 'local'
    ? [...weights].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    : weights
  ).slice(0, 2);
  const topLine = top
    .map((entry) => `${entry.feature} ${entry.weight >= 0 ? '+' : ''}${Math.round(entry.weight * 100)}%`)
    .join(', ');
  const modeLabel = mode === 'global' ? 'SHAP-style global attribution' : 'LIME-style local attribution';
  const queryText = prompt?.trim() ? `for "${prompt.trim()}"` : 'for current state';
  return `${modeLabel} ${queryText}: ${topLine}. Inputs: Kp ${snapshot.kpIndex.toFixed(1)}, Bz ${snapshot.bzGsm.toFixed(1)} nT, wind ${Math.round(snapshot.solarWindSpeed)} km/s, TOTPOT ${snapshot.totpot.toFixed(1)}, SAVNCPP ${snapshot.savncpp.toFixed(2)}, TOTUSJZ ${snapshot.totusjz.toFixed(1)}.`;
}

async function initModel() {
  try {
    const transformers = await import('@xenova/transformers');
    transformers.env.allowLocalModels = false;

    const pipe = await (transformers.pipeline as unknown as (
      task: string,
      model: string,
      options?: Record<string, unknown>,
    ) => Promise<(input: string, opts?: Record<string, unknown>) => Promise<unknown>>)(
      'text2text-generation',
      'Xenova/flan-t5-small',
      { device: 'webgpu' },
    );

    generator = async (input: string, opts?: Record<string, unknown>) => pipe(input, opts);
    provider = 'transformers-webgpu';
  } catch {
    provider = 'rules-fallback';
    generator = null;
  }

  self.postMessage({ type: 'READY', provider });
}

async function askModel(prompt: string, snapshot: HazardTelemetryModel) {
  const missionPrompt = [
    'You are Neural Oracle for space-weather operations.',
    'Summarize hazards in plain English for an operations lead in 3 short sentences.',
    `User question: ${prompt}`,
    `Telemetry: Kp=${snapshot.kpIndex.toFixed(1)}, Bz=${snapshot.bzGsm.toFixed(1)} nT, wind=${Math.round(snapshot.solarWindSpeed)} km/s, density=${snapshot.density.toFixed(1)}, flare=${snapshot.flareClass}, TOTPOT=${snapshot.totpot.toFixed(1)}, SAVNCPP=${snapshot.savncpp.toFixed(2)}, TOTUSJZ=${snapshot.totusjz.toFixed(1)}.`,
    snapshot.kesslerCascade
      ? `Kessler probabilities: 24h=${Math.round(snapshot.kesslerCascade.next24hProbability * 100)}%, 72h=${Math.round(snapshot.kesslerCascade.next72hProbability * 100)}%, 7d=${Math.round(snapshot.kesslerCascade.next7dProbability * 100)}%.`
      : 'Kessler probabilities unavailable.',
  ].join('\n');

  if (!generator) {
    self.postMessage({ type: 'REPLY', text: fallbackReply(prompt, snapshot) });
    return;
  }

  try {
    const out = await generator(missionPrompt, {
      max_new_tokens: 96,
      temperature: 0.2,
      repetition_penalty: 1.1,
    });

    const first = Array.isArray(out) ? out[0] : out;
    const text =
      typeof first === 'object' && first !== null && 'generated_text' in first
        ? String((first as { generated_text?: string }).generated_text ?? '')
        : fallbackReply(prompt, snapshot);

    self.postMessage({ type: 'REPLY', text: text || fallbackReply(prompt, snapshot) });
  } catch {
    self.postMessage({ type: 'REPLY', text: fallbackReply(prompt, snapshot) });
  }
}

self.addEventListener('message', (ev: MessageEvent<InMessage>) => {
  const msg = ev.data;

  if (msg.type === 'INIT') {
    void initModel();
    return;
  }

  if (msg.type === 'ASK') {
    void askModel(msg.prompt, msg.snapshot);
    return;
  }

  if (msg.type === 'EXPLAIN') {
    const weights = computeExplainWeights(msg.snapshot, msg.mode);
    self.postMessage({
      type: 'EXPLAIN_RESULT',
      mode: msg.mode,
      weights,
      summary: buildExplainSummary(weights, msg.mode, msg.snapshot, msg.prompt),
      at: Date.now(),
    });
  }
});
