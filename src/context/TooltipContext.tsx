/**
 * TooltipContext.tsx — Global CosmicTooltip provider
 *
 * Holds a single floating tooltip that any component in the tree can
 * trigger by calling showTooltip() / hideTooltip() from useCosmicTooltip().
 * Works with both DOM hover events AND R3F onPointerOver/Out (3D planets).
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TooltipMetric {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;           // plain-English explanation of the metric
}

export interface TooltipContent {
  title: string;                  // e.g. "Jupiter"
  emoji?: string;                 // e.g. "🪐"
  tagline?: string;               // short punchy line — family friendly
  description: string;            // 2-3 sentence explanation for all ages
  funFact?: string;               // bonus "Did you know?" for kids
  metrics?: TooltipMetric[];      // optional live data rows
  accentColor?: string;           // e.g. "#e8a040" — planet brand colour
}

interface TooltipState {
  content: TooltipContent;
  x: number;
  y: number;
  visible: boolean;
}

interface TooltipContextValue {
  showTooltip: (content: TooltipContent, x: number, y: number) => void;
  hideTooltip: () => void;
  updatePosition: (x: number, y: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function useCosmicTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('useCosmicTooltip must be used inside <TooltipProvider>');
  return ctx;
}

// ─── Provider + rendered overlay ─────────────────────────────────────────────

const EMPTY: TooltipContent = { title: '', description: '' };

const TOOLTIP_W = 270; // px — fixed max-width for layout math

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TooltipState>({
    content: EMPTY,
    x: 0,
    y: 0,
    visible: false,
  });

  // hideTimeout lets us debounce hide so moving mouse between children
  // doesn't flicker the tooltip off.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((content: TooltipContent, x: number, y: number) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    setState({ content, x, y, visible: true });
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimer.current = setTimeout(() =>
      setState((prev) => ({ ...prev, visible: false })),
    120);
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setState((prev) => ({ ...prev, x, y }));
  }, []);

  // Clamp position so tooltip never escapes viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const cx = Math.min(state.x + 14, vw - TOOLTIP_W - 12);
  const cy = state.y + 20 > vh - 200 ? state.y - 200 : state.y + 20;

  const accent = state.content.accentColor ?? '#38bdf8';

  return (
    <TooltipContext.Provider value={{ showTooltip, hideTooltip, updatePosition }}>
      {children}

      {/* ── Floating overlay (portals into root via absolute pos) ── */}
      {state.visible && (
        <div
          role="tooltip"
          style={{
            position:     'fixed',
            left:         `${cx}px`,
            top:          `${cy}px`,
            width:        `${TOOLTIP_W}px`,
            zIndex:       99999,
            pointerEvents:'none',
            fontFamily:   '"JetBrains Mono", "Courier New", monospace',
            fontSize:     '11px',
            color:        '#e2f0ff',
            background:   'rgba(4,14,30,0.93)',
            border:       `1px solid ${accent}55`,
            borderRadius: '8px',
            boxShadow:    `0 4px 32px rgba(0,0,0,0.7), 0 0 12px ${accent}22`,
            backdropFilter: 'blur(12px)',
            overflow:     'hidden',
            animation:    'cosmicTooltipIn 0.13s ease',
          }}
        >
          {/* Accent bar */}
          <div style={{ height: '3px', background: `linear-gradient(90deg, ${accent}, ${accent}55, transparent)` }} />

          <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {state.content.emoji && (
                <span style={{ fontSize: '22px', lineHeight: 1 }}>{state.content.emoji}</span>
              )}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: accent, letterSpacing: '0.06em' }}>
                  {state.content.title}
                </div>
                {state.content.tagline && (
                  <div style={{ fontSize: '9px', color: '#94b8d0', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {state.content.tagline}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div style={{ fontSize: '10px', lineHeight: 1.6, color: '#c8dce8', borderTop: `1px solid ${accent}22`, paddingTop: '6px' }}>
              {state.content.description}
            </div>

            {/* Live metrics (optional) */}
            {state.content.metrics && state.content.metrics.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: `1px solid ${accent}22`, paddingTop: '5px' }}>
                {state.content.metrics.map((m) => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', gap: '6px' }}>
                    <span style={{ color: '#6a8ea0', flexShrink: 0 }}>{m.label}</span>
                    <span style={{ color: accent, fontWeight: 600 }}>
                      {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                      {m.unit ? <span style={{ color: '#5a7a8a', fontWeight: 400 }}> {m.unit}</span> : null}
                    </span>
                    {m.description && (
                      <span style={{ color: '#4a6070', fontSize: '8px', flexShrink: 0, maxWidth: '90px', textAlign: 'right' }}>
                        {m.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fun fact */}
            {state.content.funFact && (
              <div style={{
                background: `${accent}12`,
                border:     `1px solid ${accent}25`,
                borderRadius: '4px',
                padding:    '5px 8px',
                fontSize:   '9px',
                color:      '#a8ccdc',
                lineHeight: 1.5,
              }}>
                <span style={{ color: accent, fontWeight: 700 }}>★ Did you know? </span>
                {state.content.funFact}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes cosmicTooltipIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </TooltipContext.Provider>
  );
}
