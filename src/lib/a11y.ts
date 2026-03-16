/**
 * a11y.ts — Plain-English value translators
 *
 * Every live metric in SKÖLL-TRACK has a human-readable meaning that
 * experts and first-time visitors alike need to understand.  This module
 * converts raw numbers into accessible labels, ARIA descriptions, and
 * plain-English tooltips used across all panels, charts, and chips.
 *
 * Used by:
 *  - TelemetryRibbon  — aria-label on live value pills
 *  - KesslerTelemetryChip — role="status" description
 *  - GOESFluxChart — canvas aria-label
 *  - OracleModule — input placeholder and description
 *  - PanelDescription — contextual help overlays
 *  - SceneLegend — live badge text
 */

// ─── KP INDEX ───────────────────────────────────────────────────────────────
// Scale: 0–9 (NOAA planetary K-index)

export interface KpLabel {
  /** Short tier name, e.g. "Severe Storm" */
  level: string;
  /** One-sentence plain-English meaning */
  description: string;
  /** Semantic colour name (not a CSS colour — use for aria and badge copy) */
  tone: 'calm' | 'notice' | 'warning' | 'danger' | 'critical';
  /** Tailwind colour token for badge (matches existing app palette) */
  tailwind: string;
}

export function kpLabel(kp: number): KpLabel {
  if (kp >= 8) return { level: 'Extreme Storm (G4–G5)',    description: 'Widespread power grid disruptions possible; aurora visible in tropical latitudes; HF radio blackout across sunlit hemisphere.',       tone: 'critical', tailwind: 'text-red-400' };
  if (kp >= 7) return { level: 'Severe Storm (G3)',         description: 'Satellite drag sharply increases; GPS positioning degraded; aurora visible as low as 50° latitude.',                                     tone: 'danger',   tailwind: 'text-orange-400' };
  if (kp >= 6) return { level: 'Strong Storm (G2)',         description: 'Power systems may have voltage alarms; polar-route HF communications degraded; aurora visible at 55° latitude.',                        tone: 'danger',   tailwind: 'text-orange-300' };
  if (kp >= 5) return { level: 'Moderate Storm (G1)',       description: 'Minor power grid fluctuations; satellite orientation errors possible; aurora visible at 60° latitude.',                                  tone: 'warning',  tailwind: 'text-amber-300' };
  if (kp >= 4) return { level: 'Active',                   description: 'Elevated geomagnetic activity; no infrastructure impacts expected but auroras may be visible at high latitudes.',                       tone: 'notice',   tailwind: 'text-yellow-300' };
  if (kp >= 3) return { level: 'Unsettled',                description: 'Slightly above background; space operations proceed nominally; aurora confined to polar regions.',                                       tone: 'notice',   tailwind: 'text-cyan-300' };
  if (kp >= 1) return { level: 'Quiet',                    description: 'Near-background geomagnetic conditions; all systems nominal.',                                                                           tone: 'calm',     tailwind: 'text-green-400' };
  return               { level: 'Very Quiet',              description: 'Extremely quiet solar-terrestrial environment; all systems nominal.',                                                                    tone: 'calm',     tailwind: 'text-green-300' };
}

/**
 * Returns a compact aria-label for a live Kp reading, e.g.:
 * "Kp index 6.2 — Strong Storm (G2) — satellite orientation errors possible"
 */
export function kpAriaLabel(kp: number): string {
  const { level, description } = kpLabel(kp);
  return `Kp index ${kp.toFixed(1)} — ${level} — ${description}`;
}

// ─── SOLAR FLARE CLASS ────────────────────────────────────────────────────────
// Classes: A < B < C < M < X  (each decade is 10× the previous)

export interface FlareLabel {
  level: string;
  description: string;
  tone: 'calm' | 'notice' | 'warning' | 'danger' | 'critical';
}

export function flareLabel(cls: string): FlareLabel {
  const upper = cls.trim().toUpperCase();
  if (upper.startsWith('X')) return { level: 'X-class (Major)',    description: `X-class flares are the most powerful. ${upper} can cause planet-wide HF radio blackouts on the sunlit side within ~8 minutes. Large X-flares (X10+) can also cause radiation storms.`, tone: 'critical' };
  if (upper.startsWith('M')) return { level: 'M-class (Moderate)', description: `M-class flares cause short HF radio blackouts at the poles. ${upper} may produce minor radiation storms and can launch coronal mass ejections (CMEs).`,                           tone: 'warning' };
  if (upper.startsWith('C')) return { level: 'C-class (Minor)',    description: `C-class flares have few noticeable effects on Earth. ${upper} occasionally causes brief HF disruptions in polar regions.`,                                                         tone: 'notice' };
  if (upper.startsWith('B')) return { level: 'B-class (Weak)',     description: `B-class flares are near-background solar activity with no significant terrestrial impact.`,                                                                                       tone: 'calm' };
  if (upper.startsWith('A')) return { level: 'A-class (Minimal)', description: `A-class flares are the quietest detectable solar events; no terrestrial impact.`,                                                                                                 tone: 'calm' };
  return                            { level: 'Unknown class',      description: `Flare class ${cls} — no classification data available.`,                                                                                                                          tone: 'calm' };
}

export function flareAriaLabel(cls: string): string {
  const { level, description } = flareLabel(cls);
  return `Solar flare class ${cls} — ${level} — ${description}`;
}

// ─── SOLAR WIND SPEED ─────────────────────────────────────────────────────────
// Units: km/s.  Typical: 300–800; extreme: >1000

export interface SolarWindLabel {
  level: string;
  description: string;
  tone: 'calm' | 'notice' | 'warning' | 'danger' | 'critical';
}

export function solarWindLabel(speed: number): SolarWindLabel {
  if (speed >= 1000) return { level: 'Extreme Fast Wind',   description: `${Math.round(speed)} km/s — extreme solar wind; severe magnetospheric compression likely; satellite drag in LEO is significantly elevated.`,   tone: 'critical' };
  if (speed >= 800)  return { level: 'Fast Wind Event',     description: `${Math.round(speed)} km/s — fast solar wind stream, likely from a coronal hole; satellite orbit decay rates increased; elevated storm risk.`,   tone: 'danger' };
  if (speed >= 600)  return { level: 'Enhanced Wind',       description: `${Math.round(speed)} km/s — above-average speed; moderate magnetospheric impact; watch for developing geomagnetic activity.`,                   tone: 'warning' };
  if (speed >= 450)  return { level: 'Nominal / Elevated',  description: `${Math.round(speed)} km/s — solar wind slightly above quiet-time average; nominal space-operations environment.`,                               tone: 'notice' };
  return                    { level: 'Quiet Wind',          description: `${Math.round(speed)} km/s — slow, quiet solar wind; minimal magnetospheric impact; all systems nominal.`,                                       tone: 'calm' };
}

export function solarWindAriaLabel(speed: number): string {
  const { level, description } = solarWindLabel(speed);
  return `Solar wind speed ${Math.round(speed)} km/s — ${level} — ${description}`;
}

// ─── IMF BZ (north–south component) ──────────────────────────────────────────
// Units: nT.  Negative (southward) = energy coupling into magnetosphere

export interface BzLabel {
  level: string;
  description: string;
  tone: 'calm' | 'notice' | 'warning' | 'danger' | 'critical';
}

export function bzLabel(bz: number): BzLabel {
  if (bz <= -20)  return { level: 'Extreme Southward',  description: `Bz ${bz.toFixed(1)} nT — extreme southward IMF; maximum energy injection into the magnetosphere; severe storm conditions likely.`,         tone: 'critical' };
  if (bz <= -10)  return { level: 'Strongly Southward', description: `Bz ${bz.toFixed(1)} nT — strong southward IMF; significant energy entering the magnetosphere; storm development likely.`,                  tone: 'danger' };
  if (bz <= -5)   return { level: 'Moderately Southward',description: `Bz ${bz.toFixed(1)} nT — moderate coupling; elevated substorm activity likely; auroras strengthening.`,                                   tone: 'warning' };
  if (bz <= 0)    return { level: 'Weakly Southward',   description: `Bz ${bz.toFixed(1)} nT — slight southward tilt; low-level energy injection; generally quiet conditions.`,                                  tone: 'notice' };
  return                 { level: 'Northward (Stable)', description: `Bz +${bz.toFixed(1)} nT — northward IMF; magnetosphere is well-shielded; storm development suppressed.`,                                  tone: 'calm' };
}

export function bzAriaLabel(bz: number): string {
  const { level, description } = bzLabel(bz);
  return `IMF Bz ${bz.toFixed(1)} nanotesla — ${level} — ${description}`;
}

// ─── PROBABILITY / RISK ───────────────────────────────────────────────────────

export interface ProbabilityLabel {
  level: string;
  description: string;
  tone: 'calm' | 'notice' | 'warning' | 'danger' | 'critical';
}

export function probabilityLabel(pct: number, context = 'event'): ProbabilityLabel {
  if (pct >= 80) return { level: 'Very High Risk',  description: `${Math.round(pct)}% probability — ${context} is highly likely; immediate operational planning required.`,    tone: 'critical' };
  if (pct >= 60) return { level: 'High Risk',       description: `${Math.round(pct)}% probability — ${context} is likely; escalating monitoring recommended.`,                  tone: 'danger' };
  if (pct >= 40) return { level: 'Elevated Risk',   description: `${Math.round(pct)}% probability — ${context} is possible; enhanced watch posture advised.`,                   tone: 'warning' };
  if (pct >= 20) return { level: 'Low Risk',        description: `${Math.round(pct)}% probability — ${context} is possible but unlikely; standard monitoring continues.`,       tone: 'notice' };
  return                { level: 'Minimal Risk',    description: `${Math.round(pct)}% probability — ${context} is unlikely under current conditions.`,                          tone: 'calm' };
}

// ─── GOES X-RAY FLUX ─────────────────────────────────────────────────────────
// Units: W/m²

export function fluxToFlareClass(fluxWm2: number): string {
  if (fluxWm2 >= 1e-3)  return `X${(fluxWm2 / 1e-4).toFixed(0)}`;
  if (fluxWm2 >= 1e-4)  return `X${(fluxWm2 / 1e-4).toFixed(1)}`;
  if (fluxWm2 >= 1e-5)  return `M${(fluxWm2 / 1e-5).toFixed(1)}`;
  if (fluxWm2 >= 1e-6)  return `C${(fluxWm2 / 1e-6).toFixed(1)}`;
  if (fluxWm2 >= 1e-7)  return `B${(fluxWm2 / 1e-7).toFixed(1)}`;
  return `A${(fluxWm2 / 1e-8).toFixed(1)}`;
}

export function fluxAriaLabel(longFlux: number, shortFlux?: number): string {
  const cls = fluxToFlareClass(longFlux);
  const { level, description } = flareLabel(cls);
  const shortPart = shortFlux != null ? `, short-channel ${shortFlux.toExponential(2)} W/m²` : '';
  return `GOES X-ray flux ${longFlux.toExponential(2)} W/m²${shortPart} — ${cls} class — ${level} — ${description}`;
}

// ─── KESSLER CASCADE RISK ────────────────────────────────────────────────────

export function kesslerAriaLabel(prob24h: number): string {
  const { level, description } = probabilityLabel(prob24h * 100, 'orbital debris cascade');
  return `Kessler cascade 24-hour probability: ${Math.round(prob24h * 100)}% — ${level} — ${description}`;
}

// ─── TONE → ARIA ROLE SUGGESTION ─────────────────────────────────────────────
// Maps our semantic tones to accessible alert roles

export type Tone = 'calm' | 'notice' | 'warning' | 'danger' | 'critical';

export function toneToAriaRole(tone: Tone): 'status' | 'alert' {
  return tone === 'danger' || tone === 'critical' ? 'alert' : 'status';
}

// Colors aligned with existing Tailwind palette (for aria-label text — "cyan" = nominal, "red" = critical)
export const TONE_LABEL: Record<Tone, string> = {
  calm:     'nominal',
  notice:   'watch',
  warning:  'warning',
  danger:   'danger',
  critical: 'critical',
};
