import type { HazardTelemetryModel } from '../services/hazardModel';

type Provider = 'transformers-webgpu' | 'rules-fallback';

type InMessage =
  | { type: 'INIT' }
  | { type: 'ASK'; prompt: string; snapshot: HazardTelemetryModel };

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
    `${kessler}`,
    `Operator guidance: ${snapshot.kpIndex >= 5 ? 'prioritize HF comms monitoring and polar-route advisories.' : 'maintain nominal watch cycle.'}`,
    `Query interpreted: "${prompt}".`,
  ].join(' ');
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
    `Telemetry: Kp=${snapshot.kpIndex.toFixed(1)}, Bz=${snapshot.bzGsm.toFixed(1)} nT, wind=${Math.round(snapshot.solarWindSpeed)} km/s, density=${snapshot.density.toFixed(1)}, flare=${snapshot.flareClass}.`,
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
  }
});
