import type { HazardTelemetryModel } from '../services/hazardModel';

type Provider = 'local-webgpu' | 'local-cpu' | 'rules-fallback';
type ExplainMode = 'global' | 'local';

interface ExplanationWeight {
  feature: string;
  weight: number;
  note: string;
}

type InMessage =
  | { type: 'INIT' }
  | { type: 'ASK'; prompt: string; snapshot: HazardTelemetryModel; requestId: string }
  | { type: 'EXPLAIN'; mode: ExplainMode; snapshot: HazardTelemetryModel; prompt?: string };

let provider: Provider = 'rules-fallback';

const HF_MODEL = (import.meta.env.VITE_HF_ANOMALY_MODEL as string | undefined)?.trim() || 'HuggingFaceH4/zephyr-7b-beta';
const ANOMALY_PROXY_URL = 'http://localhost:3000/api/anomaly';
const HF_TIMEOUT_MS = 10_000;

function hasWebGpuRuntime(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  } catch {
    return false;
  }
}

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

function instantHazardAlert(prompt: string, snapshot: HazardTelemetryModel): string {
  const h = classifyHazard(snapshot);
  const hazardScore = Math.min(
    1,
    0.34 * (snapshot.kpIndex / 9) +
      0.23 * (Math.abs(Math.min(snapshot.bzGsm, 0)) / 20) +
      0.2 * (snapshot.solarWindSpeed / 950) +
      0.11 * (snapshot.bt / 24) +
      0.12 * ((snapshot.kesslerCascade?.next24hProbability ?? 0)),
  );
  const severity = hazardScore >= 0.72 ? 'CRITICAL' : hazardScore >= 0.48 ? 'ELEVATED' : 'NOMINAL';
  const commsGuidance = snapshot.kpIndex >= 5 || snapshot.bzGsm <= -8
    ? 'elevate HF comms watch and verify polar-route relay links'
    : 'maintain nominal comms watch';

  return [
    `Instant local alert (${provider}): ${severity} hazard posture (${Math.round(hazardScore * 100)}%).`,
    `Drivers now: geomagnetic ${h.storm}, IMF coupling ${h.coupling}, wind ${h.wind}.`,
    `Action: ${commsGuidance}. Query context: "${prompt}".`,
  ].join(' ');
}

function buildCloudPrompt(prompt: string, snapshot: HazardTelemetryModel): string {
  return [
    'You are an orbital hazard anomaly analyst.',
    'Return exactly three concise sentences: anomaly summary, confidence, and operator action.',
    'Focus on anomaly patterns rather than repeating all telemetry.',
    `User query: ${prompt}`,
    `Telemetry: Kp=${snapshot.kpIndex.toFixed(1)}, Bz=${snapshot.bzGsm.toFixed(1)} nT, Bt=${snapshot.bt.toFixed(1)} nT, wind=${Math.round(snapshot.solarWindSpeed)} km/s, density=${snapshot.density.toFixed(1)}, flare=${snapshot.flareClass}, TOTPOT=${snapshot.totpot.toFixed(1)}, SAVNCPP=${snapshot.savncpp.toFixed(2)}, TOTUSJZ=${snapshot.totusjz.toFixed(1)}.`,
    snapshot.kesslerCascade
      ? `Kessler: 24h=${Math.round(snapshot.kesslerCascade.next24hProbability * 100)}%, 72h=${Math.round(snapshot.kesslerCascade.next72hProbability * 100)}%, 7d=${Math.round(snapshot.kesslerCascade.next7dProbability * 100)}%, band=${snapshot.kesslerCascade.riskBand}.`
      : 'Kessler: unavailable.',
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractHfText(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();

  if (Array.isArray(payload) && payload.length > 0) {
    const head = payload[0];
    if (isRecord(head)) {
      const generated = head.generated_text;
      if (typeof generated === 'string') return generated.trim();
      const summary = head.summary_text;
      if (typeof summary === 'string') return summary.trim();
    }
  }

  if (isRecord(payload)) {
    const generated = payload.generated_text;
    if (typeof generated === 'string') return generated.trim();
    const summary = payload.summary_text;
    if (typeof summary === 'string') return summary.trim();
    const error = payload.error;
    if (typeof error === 'string') throw new Error(error);
  }

  return '';
}

function localAnomalyFallback(prompt: string, snapshot: HazardTelemetryModel): string {
  const tension = Math.max(0, Math.abs(Math.min(snapshot.bzGsm, 0)) - 6);
  const windAnomaly = Math.max(0, snapshot.solarWindSpeed - 620);
  const anomalyScore = Math.min(1, 0.5 * (tension / 18) + 0.3 * (windAnomaly / 420) + 0.2 * (snapshot.kpIndex / 9));
  const label = anomalyScore >= 0.7 ? 'high-confidence anomaly signature' : anomalyScore >= 0.4 ? 'moderate anomaly signature' : 'low anomaly signature';

  return [
    `Asynchronous anomaly analysis (fallback): ${label} (${Math.round(anomalyScore * 100)}%).`,
    `Key deviation pattern: southward Bz stress ${snapshot.bzGsm.toFixed(1)} nT with wind ${Math.round(snapshot.solarWindSpeed)} km/s against current Kp ${snapshot.kpIndex.toFixed(1)}.`,
    `Operator action: ${snapshot.kpIndex >= 6 ? 'prepare contingency comm windows and satellite safe-mode checks.' : 'continue monitored operations and re-check in 15 minutes.'} Query: "${prompt}".`,
  ].join(' ');
}

async function fetchCloudAnomaly(prompt: string, snapshot: HazardTelemetryModel): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(ANOMALY_PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: buildCloudPrompt(prompt, snapshot),
        model: HF_MODEL,
        parameters: {
          max_new_tokens: 140,
          temperature: 0.2,
          return_full_text: false,
        },
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as unknown;
    if (!response.ok) {
      const detail = extractHfText(data);
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const text = extractHfText(data);
    if (!text) {
      throw new Error('No anomaly text returned by Hugging Face endpoint.');
    }

    return `Asynchronous anomaly analysis (Hugging Face): ${text}`;
  } finally {
    clearTimeout(timer);
  }
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
    provider = hasWebGpuRuntime() ? 'local-webgpu' : 'local-cpu';
  } catch {
    provider = 'rules-fallback';
  }
  self.postMessage({ type: 'READY', provider });
}

async function askModel(prompt: string, snapshot: HazardTelemetryModel, requestId: string) {
  const localText = provider === 'rules-fallback'
    ? fallbackReply(prompt, snapshot)
    : instantHazardAlert(prompt, snapshot);

  self.postMessage({ type: 'REPLY', requestId, text: localText });

  try {
    const anomalyText = await fetchCloudAnomaly(prompt, snapshot);
    self.postMessage({ type: 'ANOMALY_RESULT', requestId, text: anomalyText });
  } catch {
    self.postMessage({
      type: 'ANOMALY_RESULT',
      requestId,
      text: localAnomalyFallback(prompt, snapshot),
    });
  }
}

self.addEventListener('message', (ev: MessageEvent<InMessage>) => {
  const msg = ev.data;

  if (msg.type === 'INIT') {
    void initModel();
    return;
  }

  if (msg.type === 'ASK') {
    void askModel(msg.prompt, msg.snapshot, msg.requestId);
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
