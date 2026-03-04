import { useState, useRef, useEffect } from 'react';

/**
 * DeepTimeSlicer.tsx — CHRONOS-RAIL
 *
 * Sleek horizontal time-track navigator spanning −4.5 Ga to +5 Ga.
 * Epochs are plotted on a horizontal draggable rail; the active epoch
 * glows with a colour-coded beam and an info card slides in beneath.
 *
 * Chronos-Rail v2, March 2026.  All exported types remain unchanged.
 * JPL DE431 reference: Folkner et al. (2014).
 */

export interface DeepTimeEpoch {
  name: string;
  yearsCE: number;
  description: string;
  eventType: 'impact' | 'extinction' | 'flora' | 'ocean' | 'stellar' | 'future';
  de431Corrections?: DE431Correction;
}

export interface DE431Correction {
  mercuryDa:     number;
  earthDe:       number;
  marsObliquity: number;
  jupiterDa:     number;
}

const DE431_RATES: DE431Correction = {
  mercuryDa:    -0.000_060,
  earthDe:      -0.000_043,
  marsObliquity: 0.13,
  jupiterDa:     0.000_002,
};

export const GEOLOGICAL_EPOCHS: DeepTimeEpoch[] = [
  { name:'Hadean — Earth Formation', yearsCE:-4_500_000_000, description:'Earth accretes from the protoplanetary disc. Moon-forming impact ~4.5 Ga. Magma ocean, no solid crust.', eventType:'stellar', de431Corrections:{mercuryDa:0.27,earthDe:0.18,marsObliquity:-580,jupiterDa:-0.009} },
  { name:'Late Heavy Bombardment', yearsCE:-3_900_000_000, description:'Intense asteroid and comet bombardment reshaped the inner solar system. Giant planet migration (Nice model).', eventType:'impact', de431Corrections:{mercuryDa:0.234,earthDe:0.156,marsObliquity:-507,jupiterDa:-0.0078} },
  { name:'First Life — LUCA', yearsCE:-3_500_000_000, description:'Last Universal Common Ancestor. Prokaryotic life in hydrothermal vents. Early atmospheric CO₂ drawdown begins.', eventType:'flora', de431Corrections:{mercuryDa:0.21,earthDe:0.14,marsObliquity:-455,jupiterDa:-0.007} },
  { name:'Great Oxidation Event', yearsCE:-2_400_000_000, description:'Cyanobacteria oxygenate the atmosphere. Banded Iron Formations. First Snowball Earth glaciation.', eventType:'ocean', de431Corrections:{mercuryDa:0.144,earthDe:0.103,marsObliquity:-312,jupiterDa:-0.0048} },
  { name:'Cambrian Explosion', yearsCE:-538_000_000, description:'Rapid diversification of animal phyla over ~20 Myr. Eyes, skeletons, predator-prey arms race all appear suddenly.', eventType:'flora', de431Corrections:{mercuryDa:0.03228,earthDe:0.02313,marsObliquity:-69.94,jupiterDa:-0.001076} },
  { name:'Ordovician Extinction', yearsCE:-445_000_000, description:'Second largest extinction. ~85% of species lost. Triggered by glaciation and sea level fall.', eventType:'extinction', de431Corrections:{mercuryDa:0.0267,earthDe:0.01935,marsObliquity:-57.85,jupiterDa:-0.00089} },
  { name:'Permian–Triassic Extinction', yearsCE:-252_000_000, description:'Great Dying — 96% of marine species, 70% of land vertebrates wiped out. Siberian Traps volcanism.', eventType:'extinction', de431Corrections:{mercuryDa:0.01512,earthDe:0.01084,marsObliquity:-32.76,jupiterDa:-0.000504} },
  { name:'K-Pg Chicxulub Impact', yearsCE:-66_000_000, description:'Chicxulub impactor (diameter ~10 km) obliterates 75% of species including non-avian dinosaurs. Dawn of mammals.', eventType:'impact', de431Corrections:{mercuryDa:0.00396,earthDe:0.002838,marsObliquity:-8.58,jupiterDa:-0.000132} },
  { name:'PETM Thermal Maximum', yearsCE:-55_000_000, description:'Rapid global warming ~8°C. Massive carbon release. First primates. Antarctica still forested.', eventType:'stellar', de431Corrections:{mercuryDa:0.0033,earthDe:0.0024,marsObliquity:-7.2,jupiterDa:-0.00011} },
  { name:'Miocene — Antarctic Ice', yearsCE:-23_000_000, description:'Antarctic ice sheet forms. Mediterranean dries up (Messinian Salinity Crisis). Grass spreads globally.', eventType:'ocean', de431Corrections:{mercuryDa:0.00138,earthDe:0.001,marsObliquity:-3.0,jupiterDa:-0.000046} },
  { name:'Pleistocene Ice Ages', yearsCE:-2_600_000, description:'Cyclic glaciations every ~100 kyr (Milankovitch cycles). Modern humans evolve. Megafauna extinctions.', eventType:'flora', de431Corrections:{mercuryDa:0.000156,earthDe:0.000112,marsObliquity:-0.338,jupiterDa:-0.0000052} },
  { name:'Present (2026 CE)', yearsCE:2026, description:'Current epoch. Human-caused climate change. Solar Cycle 25 maximum. Ongoing space exploration.', eventType:'stellar', de431Corrections:{mercuryDa:0,earthDe:0,marsObliquity:0,jupiterDa:0} },
  { name:'Near Future — 2100 CE', yearsCE:2100, description:'Projected: 2–4°C warming. Sea level +1 m. Mars crewed. Potential L2 space station.', eventType:'future', de431Corrections:{mercuryDa:-0.0000045,earthDe:-0.0000032,marsObliquity:0.0097,jupiterDa:0.0000001} },
  { name:'Future — 1 Myr CE', yearsCE:1_000_000, description:'Earth cools slightly. New ice age cycle. Niagara Falls eroded away. New volcanic island chains.', eventType:'future', de431Corrections:{mercuryDa:-0.00006,earthDe:-0.000043,marsObliquity:0.13,jupiterDa:0.000002} },
  { name:'Future — 1 Gyr CE', yearsCE:1_000_000_000, description:'Sun 10% brighter. Oceans begin to evaporate. Photosynthesis fails. Moist Greenhouse state.', eventType:'stellar', de431Corrections:{mercuryDa:-0.060,earthDe:-0.043,marsObliquity:130,jupiterDa:0.002} },
  { name:'Future — 5 Gyr CE (Red Giant)', yearsCE:5_000_000_000, description:'Sun becomes a red giant. Mercury and Venus engulfed. Earth scorched. Outer planets potentially habitable.', eventType:'stellar', de431Corrections:{mercuryDa:-0.30,earthDe:-0.21,marsObliquity:650,jupiterDa:0.010} },
];

export const EVENT_COLORS: Record<string, string> = {
  impact:     '#ff4422',
  extinction: '#ff8800',
  flora:      '#44ff88',
  ocean:      '#22aaff',
  stellar:    '#ffcc44',
  future:     '#aa66ff',
};

const EVENT_ICONS: Record<string, string> = {
  impact:     '☄',
  extinction: '☠',
  flora:      '✿',
  ocean:      '≋',
  stellar:    '✦',
  future:     '◈',
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

// ─── Chronos-Rail component ───────────────────────────────────────────────────

export default function DeepTimeSlicer({ currentYearCE, onEpochSelect }: DeepTimeSlicerProps) {
  const [hovered, setHovered] = useState<DeepTimeEpoch | null>(null);
  const railRef               = useRef<HTMLDivElement>(null);
  const isDragging            = useRef(false);
  const dragStart             = useRef({ x: 0, scrollLeft: 0 });

  const current = GEOLOGICAL_EPOCHS.find((e) => e.yearsCE === currentYearCE) ?? null;
  const accent  = current ? EVENT_COLORS[current.eventType] : '#38bdf8';
  const display = hovered ?? current;
  const dCol    = display ? EVENT_COLORS[display.eventType] : accent;

  // Auto-scroll active stop into view
  useEffect(() => {
    if (!railRef.current) return;
    const el = railRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentYearCE]);

  const onMD = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, scrollLeft: railRef.current?.scrollLeft ?? 0 };
  };
  const onMM = (e: React.MouseEvent) => {
    if (!isDragging.current || !railRef.current) return;
    railRef.current.scrollLeft = dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
  };
  const onMU = () => { isDragging.current = false; };

  return (
    <div style={{
      fontFamily:'monospace', color:'#c0d8f0',
      background:'rgba(6,10,22,0.84)', backdropFilter:'blur(26px) saturate(1.7)',
      WebkitBackdropFilter:'blur(26px) saturate(1.7)',
      border:`1px solid ${accent}40`, borderRadius:'12px', overflow:'hidden',
      transition:'border-color 0.4s',
      boxShadow:`0 0 40px ${accent}18,0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.06)`,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px 7px', background:`linear-gradient(90deg,${accent}14 0%,transparent 60%)`, borderBlockEnd:`1px solid ${accent}28` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16, lineHeight:1 }}>{current ? EVENT_ICONS[current.eventType] : '⏱'}</span>
          <div>
            <div style={{ fontSize:'9px', letterSpacing:'0.18em', textTransform:'uppercase', color:accent, opacity:0.9, lineHeight:1 }}>Chronos-Rail · JPL DE431</div>
            <div style={{ fontSize:'13px', fontWeight:'bold', color:accent, letterSpacing:'0.04em', lineHeight:1.25, marginBlockStart:1 }}>{formatEpoch(currentYearCE)}</div>
          </div>
        </div>
        <span style={{ fontSize:'7px', opacity:0.35, padding:'2px 6px', background:`${accent}12`, border:`1px solid ${accent}22`, borderRadius:3, maxInlineSize:'140px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {current?.name ?? '—'}
        </span>
      </div>

      {/* Era axis labels */}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px 0', fontSize:'6px', opacity:0.2, letterSpacing:'0.07em', userSelect:'none', pointerEvents:'none' }}>
        <span>4.5 Ga</span><span>500 Ma</span><span>Present</span><span>1 Ga</span><span>5 Ga</span>
      </div>

      {/* Draggable rail */}
      <div ref={railRef} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        style={{ overflowX:'auto', overflowY:'visible', cursor:'grab', padding:'0 12px 2px', scrollbarWidth:'none' }}
        className="wolf-scroll"
      >
        <div style={{ position:'relative', height:'62px', minInlineSize:`${GEOLOGICAL_EPOCHS.length * 72}px` }}>
          {/* Track backbone */}
          <div style={{ position:'absolute', top:'26px', left:0, right:0, height:'2px', background:'linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.09) 20%,rgba(255,255,255,0.09) 80%,rgba(255,255,255,0.03))' }} />

          {GEOLOGICAL_EPOCHS.map((ep, i) => {
            const col      = EVENT_COLORS[ep.eventType];
            const isActive = currentYearCE === ep.yearsCE;
            const isHov    = hovered?.yearsCE === ep.yearsCE;
            const cx       = 36 + i * 72;
            return (
              <div key={ep.yearsCE} data-active={isActive ? 'true' : 'false'}
                onClick={() => onEpochSelect(ep.yearsCE, ep)}
                onMouseEnter={() => setHovered(ep)}
                onMouseLeave={() => setHovered(null)}
                style={{ position:'absolute', left:cx, top:0, width:52, height:62, transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:3 }}
              >
                {/* Active beam behind dot */}
                {isActive && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'1.5px', height:'100%', background:`linear-gradient(180deg,transparent,${col} 30%,${col} 70%,transparent)`, opacity:0.45, pointerEvents:'none' }} />}
                {/* Dot */}
                <div style={{ width:isActive?13:isHov?10:7, height:isActive?13:isHov?10:7, borderRadius:'50%', background:isActive||isHov?col:`${col}55`, boxShadow:isActive?`0 0 0 3px ${col}30,0 0 14px ${col}90`:isHov?`0 0 8px ${col}55`:'none', transition:'all 0.15s', flexShrink:0, zIndex:isActive?3:1 }} />
                {/* Icon */}
                <div style={{ fontSize:isActive?12:isHov?10:8, opacity:isActive?1:isHov?0.85:0.4, lineHeight:1, transition:'all 0.15s' }}>{EVENT_ICONS[ep.eventType]}</div>
                {/* Label */}
                <div style={{ fontSize:'6px', color:isActive||isHov?col:'rgba(170,200,230,0.38)', fontWeight:isActive?'bold':'normal', whiteSpace:'nowrap', overflow:'hidden', maxInlineSize:52, textOverflow:'ellipsis', textAlign:'center', lineHeight:1, transition:'color 0.15s', letterSpacing:'0.02em' }}>
                  {formatEpoch(ep.yearsCE).replace(' ago','').replace(' CE','')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Epoch info card */}
      {display && (
        <div style={{ margin:'0 8px 8px', padding:'8px 10px', background:`${dCol}0d`, border:`1px solid ${dCol}32`, borderRadius:7, transition:'all 0.18s' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>{EVENT_ICONS[display.eventType]}</span>
            <div style={{ flex:1, minInlineSize:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBlockEnd:3 }}>
                <span style={{ fontSize:'10px', fontWeight:'bold', color:dCol, letterSpacing:'0.03em' }}>{display.name}</span>
                <span style={{ fontSize:'7px', color:dCol, opacity:0.55, textTransform:'uppercase', letterSpacing:'0.08em' }}>{display.eventType}</span>
                <span style={{ marginInlineStart:'auto', fontSize:'8px', color:dCol, opacity:0.5, whiteSpace:'nowrap' }}>{formatEpoch(display.yearsCE)}</span>
              </div>
              <div style={{ fontSize:'8.5px', opacity:0.8, lineHeight:1.6, color:'#b8d4ec' }}>{display.description}</div>
              {display.de431Corrections && (
                <div style={{ display:'flex', gap:'5px 12px', flexWrap:'wrap', marginBlockStart:5, fontSize:'7px', opacity:0.35, borderBlockStart:`1px solid ${dCol}20`, paddingTop:4 }}>
                  <span>Hg Δa {display.de431Corrections.mercuryDa>=0?'+':''}{display.de431Corrections.mercuryDa.toFixed(4)} AU</span>
                  <span>Earth e {display.de431Corrections.earthDe>=0?'+':''}{display.de431Corrections.earthDe.toFixed(4)}</span>
                  <span>Mars ι {display.de431Corrections.marsObliquity>=0?'+':''}{display.de431Corrections.marsObliquity.toFixed(1)}°</span>
                  <span>Jup Δa {display.de431Corrections.jupiterDa>=0?'+':''}{display.de431Corrections.jupiterDa.toFixed(5)} AU</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:'4px 12px', flexWrap:'wrap', padding:'5px 10px 7px', borderBlockStart:'1px solid rgba(255,255,255,0.05)', fontSize:'7px', opacity:0.32, textTransform:'uppercase', letterSpacing:'0.07em' }}>
        {Object.entries(EVENT_COLORS).map(([t,c]) => (
          <span key={t} style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span>{EVENT_ICONS[t]}</span>
            <span style={{ width:5, height:5, borderRadius:'50%', background:c, display:'inline-block' }} />
            {t}
          </span>
        ))}
        <span style={{ marginInlineStart:'auto', opacity:0.2 }}>drag · click</span>
      </div>
      <style>{'  .wolf-scroll::-webkit-scrollbar{display:none}'}</style>
    </div>
  );
}
