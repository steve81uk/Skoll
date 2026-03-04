/**
 * KpForecastMatrix.tsx
 *
 * 3-day Kp forecast heat-grid.
 *
 * Layout: 3 rows (Day +1, +2, +3) × 8 columns (3-hour intervals 00–21 UTC)
 * Each cell is colour-coded by predicted Kp:
 *   0–2  G0  →  #22c55e
 *   3–4  G1  →  #84cc16
 *   5    G2  →  #ffd166
 *   6    G3  →  #f97316
 *   7    G4  →  #ef4444
 *   8–9  G5  →  #dc2626
 *
 * Forecast is generated from the 24 h LSTM curve with a sinusoidal decay
 * model for day 2 and day 3.
 */

import { useMemo } from 'react';

export interface KpForecastMatrixProps {
  /** 24-point Kp outlook from LSTM (hourly). */
  kpCurve24h?: number[];
  /** Live Kp to anchor the model. */
  kpNow?: number;
}

// ── Colour scale ──────────────────────────────────────────────────────────────

function kpToColor(kp: number): string {
  if (kp < 3)  return '#22c55e';
  if (kp < 4)  return '#84cc16';
  if (kp < 5)  return '#ffd166';
  if (kp < 6)  return '#f97316';
  if (kp < 7)  return '#ef4444';
  return '#dc2626';
}

function kpToLabel(kp: number): string {
  if (kp < 3) return 'G0';
  if (kp < 4) return 'G1';
  if (kp < 5) return 'G2';
  if (kp < 6) return 'G3';
  if (kp < 7) return 'G4';
  return 'G5';
}

// 3-hour UTC slots
const SLOTS = ['00','03','06','09','12','15','18','21'] as const;

// ── Forecast model ────────────────────────────────────────────────────────────

function buildMatrix(kpCurve24h: number[], kpNow: number): number[][] {
  // Day 1: resample 24h curve into 8 × 3h buckets
  const day1 = SLOTS.map((_, i) => {
    const slice = kpCurve24h.slice(i * 3, i * 3 + 3);
    if (!slice.length) return kpNow;
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });

  // Day 2: attenuated solar rotation persistence (τ ≈ 27 d) + small diurnal wave
  const day2 = SLOTS.map((_, i) => {
    const base = day1[i] * 0.72 + kpNow * 0.18; // persistence decay
    const diurnal = 0.3 * Math.sin((i / 8) * 2 * Math.PI - 0.5);
    return Math.max(0, Math.min(9, base + diurnal));
  });

  // Day 3: further decay toward quiet-sun mean (Kp ≈ 2)
  const day3 = SLOTS.map((_, i) => {
    const base = day2[i] * 0.58 + 2 * 0.32;
    const diurnal = 0.25 * Math.sin((i / 8) * 2 * Math.PI - 0.8);
    return Math.max(0, Math.min(9, base + diurnal));
  });

  return [day1, day2, day3];
}

// ── component ─────────────────────────────────────────────────────────────────

const ACCENT = '#a78bfa';
const DAY_LABELS = ['Day +1', 'Day +2', 'Day +3'];

export default function KpForecastMatrix({ kpCurve24h = [], kpNow = 2 }: KpForecastMatrixProps) {
  const matrix = useMemo(() => {
    const curve = kpCurve24h.length >= 24 ? kpCurve24h : [
      ...kpCurve24h,
      ...Array.from({ length: Math.max(0, 24 - kpCurve24h.length) }, (_, i) =>
        Math.max(0, kpNow * Math.exp(-i * 0.06) + 1.5 * Math.sin(i * 0.5))
      ),
    ];
    return buildMatrix(curve, kpNow);
  }, [kpCurve24h, kpNow]);

  // Max Kp across all 3 days for a summary badge
  const peak = useMemo(() => Math.max(...matrix.flat()), [matrix]);

  return (
    <div style={{
      background: 'rgba(4,9,22,0.72)',
      border: `1px solid ${ACCENT}25`,
      borderRadius: '8px',
      overflow: 'hidden',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBlockEnd: `1px solid ${ACCENT}18`, background: `linear-gradient(90deg,${ACCENT}0c 0%,transparent 100%)` }}>
        <span style={{ inlineSize: 6, blockSize: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>3-Day Kp Forecast Matrix</span>
        <span style={{ marginInlineStart: 'auto', fontSize: '8px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: kpToColor(peak), fontWeight: 'bold' }}>Peak {peak.toFixed(1)}</span>
          <span style={{ padding: '1px 4px', borderRadius: 3, background: `${kpToColor(peak)}22`, border: `1px solid ${kpToColor(peak)}44`, color: kpToColor(peak), fontSize: '7px' }}>{kpToLabel(peak)}</span>
        </span>
      </div>

      {/* Slot headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(8,1fr)', gap: '1px', padding: '4px 8px 2px', background: 'rgba(255,255,255,0.02)' }}>
        <div />  {/* empty corner */}
        {SLOTS.map(s => (
          <div key={s} style={{ fontSize: '7px', textAlign: 'center', opacity: 0.38, letterSpacing: '0.05em', color: '#a0c8e8' }}>{s}Z</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 8px 8px' }}>
        {matrix.map((row, di) => (
          <div key={di} style={{ display: 'grid', gridTemplateColumns: '44px repeat(8,1fr)', gap: '2px', alignItems: 'center' }}>
            {/* Day label */}
            <div style={{ fontSize: '7px', color: '#8aaccc', letterSpacing: '0.05em', opacity: 0.7 }}>{DAY_LABELS[di]}</div>
            {/* Cells */}
            {row.map((kp, si) => {
              const col = kpToColor(kp);
              const label = kpToLabel(kp);
              return (
                <div key={si} style={{
                  blockSize: '30px',
                  borderRadius: '4px',
                  background: `${col}1a`,
                  border: `1px solid ${col}44`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  transition: 'background 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Fill bar from bottom by Kp level */}
                  <div style={{
                    position: 'absolute', insetBlockEnd: 0, insetInlineStart: 0, insetInlineEnd: 0,
                    blockSize: `${(kp / 9) * 100}%`,
                    background: `${col}18`,
                    pointerEvents: 'none',
                  }} />
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: col, lineHeight: 1, zIndex: 1 }}>
                    {kp.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '6px', color: col, opacity: 0.65, lineHeight: 1, zIndex: 1, letterSpacing: '0.04em' }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* G-scale legend */}
      <div style={{ display: 'flex', gap: '4px 10px', flexWrap: 'wrap', padding: '4px 10px 6px', borderBlockStart: '1px solid rgba(255,255,255,0.05)', fontSize: '7px', opacity: 0.38 }}>
        {[
          { label: 'G0  Kp<3', color: '#22c55e' },
          { label: 'G1  Kp 3', color: '#84cc16' },
          { label: 'G2  Kp 4', color: '#ffd166' },
          { label: 'G3  Kp 5', color: '#f97316' },
          { label: 'G4  Kp 6', color: '#ef4444' },
          { label: 'G5  Kp≥7', color: '#dc2626' },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ inlineSize: 6, blockSize: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
