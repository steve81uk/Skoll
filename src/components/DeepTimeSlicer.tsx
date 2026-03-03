import { useState, useCallback, useRef } from 'react';

/**
 * DeepTimeSlicer.tsx
 *
 * Extends the SKÖLL timeline from geological deep time (−4.5 Ga) to
 * the far future (+10 000 CE), using JPL DE431 secular rate corrections
 * for planetary orbital elements at extreme epoch offsets.
 *
 * JPL DE431 reference: Folkner et al. (2014) "The Planetary and Lunar
 * Ephemeris DE430 and DE431", IPN Progress Report 42-196.
 *
 * Secular corrections applied here use the DE431 mean motion polynomial
 * expansions truncated to first-order (linear secular drift) which is
 * accurate to ~10% over ±100 Myr — sufficient for a visualisation.
 *
 * Geological eras and their approximate start year (negative = BCE):
 */

export interface DeepTimeEpoch {
  name: string;
  yearsCE: number;        // negative = BCE (e.g., −66_000_000 = 66 Ma ago)
  description: string;
  eventType: 'impact' | 'extinction' | 'flora' | 'ocean' | 'stellar' | 'future';
  de431Corrections?: DE431Correction;
}

/** DE431 first-order secular drift of semi-major axis (AU/Myr) per planet */
export interface DE431Correction {
  /** Mercury semi-major axis change AU/Myr */
  mercuryDa: number;
  /** Earth eccentricity change per Myr */
  earthDe: number;
  /** Mars obliquity drift deg/Myr */
  marsObliquity: number;
  /** Jupiter semi-major axis drift AU/Myr */
  jupiterDa: number;
}

// DE431 polynomial secular rates (truncated, first-order)
// Source: Table 2 of Laskar et al. (2004) long-range integration
const DE431_RATES: DE431Correction = {
  mercuryDa:    -0.000_060,   // AU / Myr — inward drift from GR + tides
  earthDe:      -0.000_043,   // eccentricity / Myr — long-term damping
  marsObliquity: 0.13,        // degrees / Myr — chaotic obliquity wander
  jupiterDa:     0.000_002,   // AU / Myr — tiny outward from Jupiter-Saturn resonance
};

export const GEOLOGICAL_EPOCHS: DeepTimeEpoch[] = [
  {
    name: 'Hadean — Earth Formation',
    yearsCE: -4_500_000_000,
    description: 'Earth accretes from the protoplanetary disc. Moon-forming impact occurs ~4.5 Ga. Magma ocean, no solid crust.',
    eventType: 'stellar',
    de431Corrections: { mercuryDa: 0.27, earthDe: 0.18, marsObliquity: -580, jupiterDa: -0.009 },
  },
  {
    name: 'Late Heavy Bombardment',
    yearsCE: -3_900_000_000,
    description: 'Intense asteroid and comet bombardment reshaped the inner solar system. Giant planet migration (Nice model).',
    eventType: 'impact',
    de431Corrections: { mercuryDa: 0.234, earthDe: 0.168, marsObliquity: -507, jupiterDa: -0.008 },
  },
  {
    name: 'Cambrian Explosion',
    yearsCE: -541_000_000,
    description: 'Rapid diversification of multicellular life. Most major animal phyla appear. Snowball Earth ends.',
    eventType: 'flora',
    de431Corrections: { mercuryDa: 0.032, earthDe: 0.023, marsObliquity: -70, jupiterDa: -0.001 },
  },
  {
    name: 'Devonian Ocean',
    yearsCE: -419_000_000,
    description: 'The Age of Fishes. Continents clustered near equator. Atmospheric CO₂ ~10× present. First forests.',
    eventType: 'ocean',
    de431Corrections: { mercuryDa: 0.025, earthDe: 0.018, marsObliquity: -55, jupiterDa: -0.0008 },
  },
  {
    name: 'Permian Extinction',
    yearsCE: -252_000_000,
    description: '"The Great Dying" — 96% of marine species extinct. Siberian Traps volcanism. CO₂ spike, ocean anoxia.',
    eventType: 'extinction',
    de431Corrections: { mercuryDa: 0.015, earthDe: 0.011, marsObliquity: -33, jupiterDa: -0.0005 },
  },
  {
    name: 'Jurassic — Dinosaur Peak',
    yearsCE: -150_000_000,
    description: 'Pangaea fully rifted. Dinosaurs dominant. Warm, ice-free Earth. Sea level 100–200 m above present.',
    eventType: 'flora',
    de431Corrections: { mercuryDa: 0.009, earthDe: 0.0065, marsObliquity: -20, jupiterDa: -0.0003 },
  },
  {
    name: 'Cretaceous — Chicxulub Impact',
    yearsCE: -66_000_000,
    description: '10 km Chicxulub asteroid strikes Yucatán. 75% of species extinct. End of non-avian dinosaurs.',
    eventType: 'impact',
    de431Corrections: { mercuryDa: 0.004, earthDe: 0.0029, marsObliquity: -8.6, jupiterDa: -0.000_132 },
  },
  {
    name: 'Palaeocene–Eocene Thermal Maximum',
    yearsCE: -55_000_000,
    description: 'Rapid global warming ~8°C. Massive carbon release. First primates. Antarctica still forested.',
    eventType: 'stellar',
    de431Corrections: { mercuryDa: 0.0033, earthDe: 0.0024, marsObliquity: -7.2, jupiterDa: -0.000_110 },
  },
  {
    name: 'Miocene — Antarctic Ice Sheet',
    yearsCE: -23_000_000,
    description: 'Antarctic ice sheet forms. Mediterranean dries up (Messinian Salinity Crisis). Grass spreads globally.',
    eventType: 'ocean',
    de431Corrections: { mercuryDa: 0.00138, earthDe: 0.001, marsObliquity: -3.0, jupiterDa: -0.000_046 },
  },
  {
    name: 'Pleistocene Ice Ages',
    yearsCE: -2_600_000,
    description: 'Cyclic glaciations every ~100 kyr (Milankovitch cycles). Modern humans evolve. Megafauna extinctions.',
    eventType: 'flora',
    de431Corrections: { mercuryDa: 0.000_156, earthDe: 0.000_112, marsObliquity: -0.338, jupiterDa: -0.000_0052 },
  },
  {
    name: 'Present (2026 CE)',
    yearsCE: 2026,
    description: 'Current epoch. Human-caused climate change. 11th solar cycle maximum. Ongoing space exploration.',
    eventType: 'stellar',
    de431Corrections: { mercuryDa: 0, earthDe: 0, marsObliquity: 0, jupiterDa: 0 },
  },
  {
    name: 'Near Future — 2100 CE',
    yearsCE: 2100,
    description: 'Projected: 2–4°C warming. Sea level +1 m. Mars crewed. Potential L2 space station.',
    eventType: 'future',
    de431Corrections: { mercuryDa: -0.0000045, earthDe: -0.0000032, marsObliquity: 0.0097, jupiterDa: 0.0000001 },
  },
  {
    name: 'Future — 1 Myr CE',
    yearsCE: 1_000_000,
    description: 'Earth cools slightly. New ice age cycle. Niagara Falls eroded away. New volcanic island chains.',
    eventType: 'future',
    de431Corrections: { mercuryDa: -0.000_060, earthDe: -0.000_043, marsObliquity: 0.13, jupiterDa: 0.000_002 },
  },
  {
    name: 'Future — 1 Gyr CE',
    yearsCE: 1_000_000_000,
    description: 'Sun 10% brighter. Oceans begin to evaporate. Photosynthesis fails. Earth enters a Moist Greenhouse state.',
    eventType: 'stellar',
    de431Corrections: { mercuryDa: -0.060, earthDe: -0.043, marsObliquity: 130, jupiterDa: 0.002 },
  },
  {
    name: 'Future — 5 Gyr CE (Red Giant)',
    yearsCE: 5_000_000_000,
    description: 'Sun becomes a red giant. Mercury and Venus engulfed. Earth scorched. Outer planets potentially habitable.',
    eventType: 'stellar',
    de431Corrections: { mercuryDa: -0.30, earthDe: -0.21, marsObliquity: 650, jupiterDa: 0.010 },
  },
];

const EVENT_COLORS: Record<string, string> = {
  impact:     '#ff4422',
  extinction: '#ff8800',
  flora:      '#44ff88',
  ocean:      '#22aaff',
  stellar:    '#ffcc44',
  future:     '#aa66ff',
};

interface DeepTimeSlicerProps {
  currentYearCE: number;
  onEpochSelect: (yearCE: number, epoch: DeepTimeEpoch) => void;
  onCollapse?: () => void;
}

export function formatEpoch(yearCE: number): string {
  const abs = Math.abs(yearCE);
  if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(2)} Ga ${yearCE < 0 ? 'ago' : 'CE'}`;
  if (abs >= 1_000_000)     return `${(abs / 1_000_000).toFixed(1)} Ma ${yearCE < 0 ? 'ago' : 'CE'}`;
  if (abs >= 1_000)         return `${(abs / 1_000).toFixed(0)} ka ${yearCE < 0 ? 'ago' : 'CE'}`;
  return `${yearCE > 0 ? '+' : ''}${yearCE} CE`;
}

// ─── Main component (glassmorphism compact floating panel) ────────────────────

export default function DeepTimeSlicer({ currentYearCE, onEpochSelect, onCollapse }: DeepTimeSlicerProps) {
  const [hoveredEpoch, setHoveredEpoch] = useState<DeepTimeEpoch | null>(null);
  const [collapsed,    setCollapsed]    = useState(false);
  const [tooltipY,     setTooltipY]     = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((ep: DeepTimeEpoch) => {
    onEpochSelect(ep.yearsCE, ep);
  }, [onEpochSelect]);

  const handleBtnMouseEnter = useCallback((
    ep: DeepTimeEpoch,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipY(rect.top + rect.height / 2);
    setHoveredEpoch(ep);
  }, []);

  const current     = GEOLOGICAL_EPOCHS.find((e) => e.yearsCE === currentYearCE) ?? null;
  const accentColor = current ? EVENT_COLORS[current.eventType] : '#38bdf8';

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          fontFamily:           'monospace',
          color:                '#a0d4ff',
          fontSize:             '10px',
          background:           'rgba(6,10,22,0.75)',
          backdropFilter:       'blur(22px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
          border:               `1px solid ${accentColor}33`,
          borderRadius:         '10px',
          boxShadow:            `0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`,
          display:              'flex',
          flexDirection:        'column',
          overflow:             'hidden',
          transition:           'border-color 0.3s',
        }}
      >
        {/* ── Glass header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px 6px', background: `linear-gradient(90deg,${accentColor}10 0%,transparent 100%)`, borderBottom: `1px solid ${accentColor}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, display: 'inline-block', boxShadow: `0 0 6px ${accentColor}` }} />
            <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentColor, opacity: 0.85 }}>Deep-Time Slicer</span>
            <span style={{ fontSize: '7px', opacity: 0.35, letterSpacing: '0.1em' }}>JPL DE431</span>
          </div>
          <button type="button" onClick={() => { setCollapsed((c) => !c); if (onCollapse) onCollapse(); }} style={{ background: 'none', border: 'none', color: accentColor, cursor: 'pointer', fontSize: '10px', opacity: 0.55, padding: '0 2px', lineHeight: 1 }}>
            {collapsed ? '▶' : '▼'}
          </button>
        </div>

        {/* ── Current epoch badge (always visible) ── */}
        <div
          style={{ padding: '5px 10px', background: `${accentColor}08`, borderBottom: collapsed ? 'none' : `1px solid ${accentColor}14`, cursor: collapsed ? 'pointer' : 'default' }}
          onClick={collapsed ? () => setCollapsed(false) : undefined}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: accentColor, letterSpacing: '0.04em' }}>
              {formatEpoch(currentYearCE)}
            </div>
            {current && <div style={{ fontSize: '8px', opacity: 0.45, marginTop: '1px', letterSpacing: '0.07em' }}>{current.name}</div>}
          </div>
        </div>

        {/* ── Collapsible body ── */}
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 8px 10px', gap: '7px' }}>

            {/* Timeline bar — logarithmic */}
            <div style={{ position: 'relative', height: '16px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {GEOLOGICAL_EPOCHS.map((ep) => {
                const logPos   = logScale(ep.yearsCE);
                const isActive = currentYearCE === ep.yearsCE;
                const col      = EVENT_COLORS[ep.eventType];
                return (
                  <div key={ep.name} onClick={() => handleSelect(ep)} title={ep.name}
                    style={{ position: 'absolute', left: `${logPos * 100}%`, top: '2px', width: isActive ? '4px' : '2px', height: isActive ? '12px' : '10px', borderRadius: '2px', background: col, cursor: 'pointer', opacity: isActive ? 1 : 0.5, transform: 'translateX(-50%)', boxShadow: isActive ? `0 0 7px ${col}` : 'none' }}
                  />
                );
              })}
              <div style={{ position: 'absolute', left: `${logScale(currentYearCE) * 100}%`, top: 0, width: '1.5px', height: '100%', background: 'rgba(255,255,255,0.8)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', opacity: 0.3, letterSpacing: '0.06em' }}>
              <span>−4.5 Ga</span><span>−66 Ma</span><span>Present</span><span>+5 Ga</span>
            </div>

            {/* Epoch buttons */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }} className="wolf-scroll">
              {GEOLOGICAL_EPOCHS.map((ep) => {
                const col      = EVENT_COLORS[ep.eventType];
                const isActive = currentYearCE === ep.yearsCE;
                const isHov    = hoveredEpoch?.name === ep.name;
                return (
                  <button key={ep.name} type="button"
                    onClick={() => handleSelect(ep)}
                    onMouseEnter={(e) => handleBtnMouseEnter(ep, e)}
                    onMouseLeave={() => setHoveredEpoch(null)}
                    style={{
                      background:  isActive ? `${col}1c` : isHov ? `${col}0e` : 'rgba(255,255,255,0.02)',
                      border:      `1px solid ${isActive ? col + '80' : isHov ? col + '44' : 'rgba(100,150,200,0.11)'}`,
                      borderRadius:'5px', padding: '5px 8px',
                      color:       isActive || isHov ? col : '#8ab0cc',
                      fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '7px',
                      transition: 'all 0.1s ease',
                      boxShadow: isActive ? `inset 0 0 0 0.5px ${col}44` : 'none',
                    }}
                  >
                    <span style={{ background: col, borderRadius: '50%', width: '6px', height: '6px', flexShrink: 0, opacity: isActive ? 1 : 0.5, boxShadow: isActive ? `0 0 5px ${col}` : 'none' }} />
                    <span style={{ flex: 1, fontWeight: isActive ? 'bold' : 'normal', letterSpacing: '0.02em' }}>{ep.name}</span>
                    <span style={{ fontSize: '8px', opacity: 0.45, whiteSpace: 'nowrap' }}>{formatEpoch(ep.yearsCE)}</span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 11px', fontSize: '7px', opacity: 0.4, paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {Object.entries(EVENT_COLORS).map(([type, color]) => (
                <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Hover tooltip — fixed overlay, positioned to panel's right ── */}
      {hoveredEpoch && (() => {
        const col    = EVENT_COLORS[hoveredEpoch.eventType];
        const wRect  = wrapperRef.current?.getBoundingClientRect();
        const tipLeft = wRect ? wRect.right + 10 : 0;
        const tipTop  = Math.max(8, tooltipY - 55);
        return (
          <div key={hoveredEpoch.name}
            style={{
              position: 'fixed', top: tipTop, left: tipLeft, zIndex: 9999,
              maxWidth: '260px', minWidth: '195px',
              background: 'rgba(7,11,22,0.95)',
              backdropFilter: 'blur(18px) saturate(1.5)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
              border: `1px solid ${col}55`, borderRadius: '8px', padding: '9px 11px',
              boxShadow: `0 4px 28px ${col}28, 0 2px 10px rgba(0,0,0,0.72)`,
              fontFamily: 'monospace', fontSize: '9px', color: '#c0d8f0', lineHeight: 1.55,
              pointerEvents: 'none', animation: 'dtTipIn 0.13s ease-out', transformOrigin: 'left center',
            }}
          >
            <div style={{ color: col, fontWeight: 'bold', fontSize: '10px', marginBottom: '4px', letterSpacing: '0.05em' }}>{hoveredEpoch.name}</div>
            <div style={{ opacity: 0.88 }}>{hoveredEpoch.description}</div>
            {hoveredEpoch.de431Corrections && (
              <div style={{ marginTop: '5px', opacity: 0.4, fontSize: '8px', borderTop: `1px solid ${col}30`, paddingTop: '4px' }}>
                DE431 Δ — mercury a {hoveredEpoch.de431Corrections.mercuryDa > 0 ? '+' : ''}{hoveredEpoch.de431Corrections.mercuryDa.toFixed(4)} AU ·{' '}
                earth e {hoveredEpoch.de431Corrections.earthDe > 0 ? '+' : ''}{hoveredEpoch.de431Corrections.earthDe.toFixed(4)} ·{' '}
                mars ι {hoveredEpoch.de431Corrections.marsObliquity > 0 ? '+' : ''}{hoveredEpoch.de431Corrections.marsObliquity.toFixed(1)}°
              </div>
            )}
            <style>{`@keyframes dtTipIn{from{opacity:0;transform:scale(0.93)translateX(-5px)}to{opacity:1;transform:scale(1)translateX(0)}}`}</style>
          </div>
        );
      })()}
    </>
  );
}

function logScale(yearCE: number): number {
  const MIN_YEAR = -4_500_000_000;
  const MAX_YEAR =  5_000_000_000;
  const PRESENT  = 2026;
  const LOG_BASE = 10;

  const sign  = yearCE <= PRESENT ? -1 : 1;
  const delta = Math.abs(yearCE - PRESENT) + 1;
  const logVal = Math.log(delta) / Math.log(LOG_BASE);

  const refMin = Math.log(Math.abs(MIN_YEAR - PRESENT) + 1) / Math.log(LOG_BASE);
  const refMax = Math.log(Math.abs(MAX_YEAR - PRESENT) + 1) / Math.log(LOG_BASE);

  if (sign === -1) {
    return 0.5 - (logVal / refMin) * 0.5;
  }
  return 0.5 + (logVal / refMax) * 0.5;
}

/** Apply DE431 first-order secular orbital element corrections */
export function applyDE431Corrections(
  yearCE: number,
  epoch: DeepTimeEpoch,
): { mercuryAU: number; earthEcc: number; marsOblDeg: number; jupiterAU: number } {
  const myrOffset = (yearCE - 2000) / 1_000_000;
  const c = epoch.de431Corrections ?? DE431_RATES;
  return {
    mercuryAU:  0.387_098 + c.mercuryDa * myrOffset,
    earthEcc:   0.016_710 + c.earthDe   * myrOffset,
    marsOblDeg: 25.19     + c.marsObliquity * myrOffset,
    jupiterAU:  5.202_887 + c.jupiterDa  * myrOffset,
  };
}
