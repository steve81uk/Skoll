import { useMemo } from 'react';

/**
 * ForecastingSlicerPanel.tsx
 *
 * Displays ML confidence decay percentages across 9 forecast horizons
 * (24 h → 1 yr).  Confidence follows an exponential decay model
 * modulated by the current Kp-index (higher Kp ⟹ steeper uncertainty):
 *
 *   conf(h) = max(FLOOR, BASE × exp(−k × h × (1 + kp / 18)))
 *
 * where BASE = 0.88, FLOOR = 0.08, k = 0.000 35 h⁻¹.
 * An optional raw forecast array (one value per horizon) from the LSTM
 * engine overlays a secondary "predicted value" bar.
 */

export interface ForecastingSlicerProps {
  /** Current Kp-index (0–9).  Defaults to 2 (quiet sun). */
  kpIndex?: number;
  /**
   * Optional LSTM output array — one normalised value [0..1] per horizon.
   * When supplied, a secondary bar is drawn below the confidence bar.
   */
  forecast?: number[];
}

// ── Constants ────────────────────────────────────────────────────────────────
const DECAY_HOURS  = [24, 48, 72, 168, 336, 720, 2160, 4320, 8760] as const;
const LABELS       = ['24 h','48 h','72 h','1 week','2 weeks','1 month','3 months','6 months','1 year'] as const;
const BASE  = 0.88;
const FLOOR = 0.08;
const K     = 0.000_35;   // per-hour decay constant

const ACCENT = '#4fc3f7';

/** Confidence decay model. */
function confidence(hours: number, kp: number): number {
  const steepness = 1 + kp / 18;
  return Math.max(FLOOR, BASE * Math.exp(-K * hours * steepness));
}

/** Bar colour gradient: green → yellow → orange → red. */
function confColor(c: number): string {
  if (c >= 0.70) return '#00e87a';
  if (c >= 0.45) return '#ffd166';
  if (c >= 0.25) return '#ff8c42';
  return '#ff4f52';
}

/** Human-readable percentage. */
function pct(c: number): string {
  return `${Math.round(c * 100)} %`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ForecastingSlicerPanel({ kpIndex = 2, forecast }: ForecastingSlicerProps) {
  const kp = Math.max(0, Math.min(9, kpIndex));

  const rows = useMemo(
    () =>
      DECAY_HOURS.map((h, i) => ({
        label:      LABELS[i],
        hours:      h,
        conf:       confidence(h, kp),
        predicted:  forecast ? forecast[i] ?? null : null,
      })),
    [kp, forecast],
  );

  return (
    <div
      style={{
        background:           'rgba(6,10,22,0.76)',
        backdropFilter:       'blur(22px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border:               `1px solid ${ACCENT}28`,
        borderRadius:         '10px',
        overflow:             'hidden',
        width:                '100%',
        fontFamily:           'monospace',
        color:                '#c0d8f0',
        boxShadow:            `0 0 32px ${ACCENT}14, 0 4px 24px rgba(0,0,0,0.68)`,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          padding:       '7px 10px 6px',
          background:    `linear-gradient(90deg,${ACCENT}10 0%,transparent 100%)`,
          borderBottom:  `1px solid ${ACCENT}22`,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, display: 'inline-block', boxShadow: `0 0 6px ${ACCENT}` }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>
          Forecast Confidence
        </span>
        <span style={{ fontSize: '7px', opacity: 0.35, letterSpacing: '0.1em', marginLeft: 'auto' }}>
          Kp {kp.toFixed(1)}
        </span>
      </div>

      {/* ── Horizon rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '8px 10px 10px' }}>
        {rows.map((row) => {
          const col      = confColor(row.conf);
          const barWidth = `${Math.round(row.conf * 100)}%`;

          return (
            <div key={row.label} style={{ marginBottom: '5px' }}>
              {/* Label + percentage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '8px', opacity: 0.65, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {row.label}
                </span>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: col, letterSpacing: '0.05em' }}>
                  {pct(row.conf)}
                </span>
              </div>

              {/* Confidence bar track */}
              <div style={{ position: 'relative', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div
                  style={{
                    position:     'absolute', left: 0, top: 0, height: '100%',
                    width:        barWidth,
                    borderRadius: '3px',
                    background:   `linear-gradient(90deg, ${col}dd 0%, ${col}88 100%)`,
                    boxShadow:    `0 0 6px ${col}66`,
                    transition:   'width 0.4s ease',
                  }}
                />
              </div>

              {/* LSTM predicted-value bar (if provided) */}
              {row.predicted !== null && (
                <div style={{ position: 'relative', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', marginTop: '2px' }}>
                  <div
                    style={{
                      position:     'absolute', left: 0, top: 0, height: '100%',
                      width:        `${Math.round((row.predicted as number) * 100)}%`,
                      borderRadius: '2px',
                      background:   `rgba(79,195,247,0.55)`,
                      transition:   'width 0.4s ease',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          display:       'flex',
          flexWrap:      'wrap',
          gap:           '3px 12px',
          fontSize:      '7px',
          opacity:       0.38,
          padding:       '5px 10px 7px',
          borderTop:     '1px solid rgba(255,255,255,0.06)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {(['≥70% — high', '45–70% — med', '25–45% — low', '<25% — poor'] as const).map((lbl, i) => {
          const colors = ['#00e87a', '#ffd166', '#ff8c42', '#ff4f52'];
          return (
            <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[i], display: 'inline-block' }} />
              {lbl}
            </span>
          );
        })}
        {forecast && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '6px', height: '3px', borderRadius: '1px', background: '#4fc3f7', display: 'inline-block', opacity: 0.6 }} />
            LSTM prediction
          </span>
        )}
      </div>
    </div>
  );
}
