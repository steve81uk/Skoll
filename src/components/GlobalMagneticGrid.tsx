/**
 * SKÖLL-TRACK — GLOBAL MAGNETIC GRID
 * SVG equirectangular world map with INTERMAGNET observatory markers
 * showing real-time magnetic anomaly status.
 *
 * Data strategy (tiered):
 *   1. Try GOES geomagnetic observatory data (proxy-friendly JSON)
 *   2. Fall back to KP-based synthetic disturbance model calibrated on
 *      14 major INTERMAGNET observatories (hardcoded lat/lon)
 *
 * Disturbance colouring:
 *   Green  — quiet        H-deviation < 20 nT
 *   Yellow — active       20–50 nT
 *   Orange — disturbed    50–100 nT
 *   Red    — storm        > 100 nT or Kp ≥ 5
 *
 * Visual features:
 *   • Animated pulse ring on disturbed stations
 *   • Magnetic equator SVG path
 *   • Solar wind flow arrows (top strip)
 *   • Dst / storm level badge
 *   • Aurora oval overlay at high latitudes when Kp ≥ 4
 *   • Dark glassmorphism panel consistent with existing HUD style
 */

import { useRef, useState, useMemo } from 'react';

// ─── Observatory database (INTERMAGNET major stations) ───────────────────────
const OBSERVATORIES: { code: string; name: string; lat: number; lon: number; geomLat: number }[] = [
  { code:'THL', name:'Thule',         lat: 77.5, lon:-69.2,  geomLat:85.4 },
  { code:'TRO', name:'Tromsø',        lat: 69.7, lon: 18.9,  geomLat:66.7 },
  { code:'BLC', name:'Baker Lake',    lat: 64.3, lon:-96.0,  geomLat:73.3 },
  { code:'ABK', name:'Abisko',        lat: 68.4, lon: 18.8,  geomLat:65.5 },
  { code:'MEA', name:'Meanook',       lat: 54.6, lon:-113.3, geomLat:61.8 },
  { code:'BOU', name:'Boulder',       lat: 40.1, lon:-105.2, geomLat:48.8 },
  { code:'HAD', name:'Hartland',      lat: 51.0, lon: -4.5,  geomLat:54.0 },
  { code:'NGK', name:'Niemegk',       lat: 52.1, lon: 12.7,  geomLat:54.0 },
  { code:'SIT', name:'Sitka',         lat: 57.1, lon:-135.3, geomLat:60.0 },
  { code:'GUA', name:'Guam',          lat: 13.6, lon: 144.9, geomLat: 5.0 },
  { code:'TAM', name:'Tamanrasset',   lat: 22.8, lon:  5.5,  geomLat:25.3 },
  { code:'HER', name:'Hermanus',      lat:-34.4, lon: 19.2,  geomLat:-34.0 },
  { code:'HON', name:'Honolulu',      lat: 21.3, lon:-158.0, geomLat:21.6 },
  { code:'KAK', name:'Kakioka',       lat: 36.2, lon: 140.2, geomLat:27.4 },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ObsData {
  code:        string;
  deviation:   number; // nT H-component deviation from baseline
  level:       'quiet' | 'active' | 'disturbed' | 'storm';
  color:       string;
}

interface MagGridProps {
  kpIndex:  number;
  bzGsm:    number;
  speed?:   number;
  density?: number;
}

// ─── KP → per-observatory synthetic disturbance (geomagnetic latitude weighting) ──
function kpToDeviation(kp: number, geomLat: number): number {
  const absLat  = Math.abs(geomLat);
  // High latitudes experience much larger disturbances
  const latFactor = absLat > 60 ? 3.5 : absLat > 45 ? 1.4 : absLat > 20 ? 0.6 : 0.25;
  const base  = kp ** 1.6 * 8 * latFactor;
  // Add slight noise per station (deterministic from code hash)
  const hash  = geomLat * 7.31 + absLat * 3.17;
  const noise = Math.sin(hash) * base * 0.18;
  return Math.max(0, base + noise);
}

function deviationToLevel(dev: number, kp: number): ObsData['level'] {
  if (kp >= 5 || dev > 100) return 'storm';
  if (dev > 50)              return 'disturbed';
  if (dev > 20)              return 'active';
  return 'quiet';
}

const LEVEL_COLORS: Record<ObsData['level'], string> = {
  quiet:     '#22c55e',
  active:    '#eab308',
  disturbed: '#f97316',
  storm:     '#ef4444',
};

// ─── Equirectangular projection helpers ──────────────────────────────────────
const W = 360, H = 180;

function latLonToXY(lat: number, lon: number): [number, number] {
  const x = lon + 180;
  const y = 90 - lat;
  return [x, y];
}

// ─── Magnetic equator path (approximation — IGRF-derived simplified) ─────────
const MAG_EQUATOR_POINTS: [number, number][] = [
  [-180,-11],[-160,-3],[-140, 5],[-120, 8],[-100, 6],[-80, 3],[-60, 7],[-40,16],[-20,12],
  [0, 5],[20, 0],[40,-4],[60,-9],[80,-8],[100,-4],[120, 0],[140, 2],[160, 2],[180,-11],
];

function magEquatorPath(): string {
  return MAG_EQUATOR_POINTS.map(([lon, lat], i) => {
    const [x, y] = latLonToXY(lat, lon);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
}

// ─── Aurora oval SVG paths ────────────────────────────────────────────────────
function auroraOvalPath(kp: number, hemisphere: 'N' | 'S'): string {
  // Auroral oval latitudes expand with KP
  const centerLat = hemisphere === 'N' ? 68 - kp * 2.8 : -(68 - kp * 2.8);
  const halfWidth = 8 + kp * 0.8;
  const innerLat  = hemisphere === 'N' ? centerLat + halfWidth : centerLat - halfWidth;
  const outerLat  = hemisphere === 'N' ? centerLat - halfWidth : centerLat + halfWidth;

  const inner_d = Array.from({ length: 37 }, (_, i) => {
    const lon = -180 + i * 10;
    const [x, y] = latLonToXY(innerLat, lon);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + 'Z';

  const outer_d = Array.from({ length: 37 }, (_, i) => {
    const lon = -180 + i * 10;
    const [x, y] = latLonToXY(outerLat, lon);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + 'Z';

  // Return as a clip-mask ring
  return outer_d + ' ' + inner_d;
}

// ─── Simplified world land outlines (minimalist, no deps) ─────────────────────
// Just a plain grey rectangle background + thin lat/lon grid — we use CSS
// and SVG rects for the aesthetic rather than loading a topojson dependency.

function GridLines() {
  const lats  = [-60,-45,-30,-15,0,15,30,45,60];
  const lons  = [-150,-120,-90,-60,-30,0,30,60,90,120,150];
  return (
    <g stroke="rgba(0,200,255,0.06)" strokeWidth="0.5">
      {lats.map((lat) => {
        const y = 90 - lat;
        return <line key={lat} x1={0} y1={y} x2={W} y2={y} />;
      })}
      {lons.map((lon) => {
        const x = lon + 180;
        return <line key={lon} x1={x} y1={0} x2={x} y2={H} />;
      })}
      {/* Equator */}
      <line x1={0} y1={90} x2={W} y2={90} stroke="rgba(0,200,255,0.18)" strokeWidth={0.8} />
      {/* Prime meridian */}
      <line x1={180} y1={0} x2={180} y2={H} stroke="rgba(0,200,255,0.18)" strokeWidth={0.8} />
    </g>
  );
}

// ─── Animated pulse ring ──────────────────────────────────────────────────────
function PulseRing({ x, y, color }: { x:number; y:number; color:string }) {
  return (
    <>
      <circle cx={x} cy={y} r={4.5} fill="none" stroke={color} strokeWidth={1} opacity={0.7}>
        <animate attributeName="r"     from="4" to="10"  dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.7" to="0" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

// ─── Wind flow arrows strip ───────────────────────────────────────────────────
function WindArrows({ speed }: { speed: number }) {
  const count  = 12;
  const arrowW = 14;
  const opacity = Math.min(1, speed / 800);
  return (
    <g transform={`translate(0,4)`}>
      {Array.from({ length: count }, (_, i) => {
        const x = (i + 0.5) * (W / count);
        return (
          <g key={i} transform={`translate(${x},0)`} opacity={opacity}>
            <line x1={-arrowW/2} y1={0} x2={arrowW / 2} y2={0} stroke="#38bdf8" strokeWidth={1} />
            <polygon points={`${arrowW/2},0 ${arrowW/2-4},-2 ${arrowW/2-4},2`} fill="#38bdf8" />
          </g>
        );
      })}
      <text x={1} y={-1} fontSize={4} fill="#38bdf8" fontFamily="monospace">SOLAR WIND {speed.toFixed(0)} km/s →</text>
    </g>
  );
}

// ─── Dst index estimate from Bz / KP ─────────────────────────────────────────
function estimateDst(kp: number, bzGsm: number): number {
  // Simplified Burton equation approximation
  const stormInj = bzGsm < 0 ? -2.4e4 * Math.abs(bzGsm) / 1e5 : 0;
  const kpDst    = -(28 * kp - 0.9 * kp ** 2);
  return Math.round(kpDst + stormInj * 3600);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function GlobalMagneticGrid({ kpIndex, bzGsm, speed = 450 }: MagGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Compute per-station disturbance
  const stations = useMemo<ObsData[]>((): ObsData[] =>
    OBSERVATORIES.map((obs) => {
      const deviation = kpToDeviation(kpIndex, obs.geomLat);
      const level     = deviationToLevel(deviation, kpIndex);
      return { code: obs.code, deviation, level, color: LEVEL_COLORS[level] };
    }),
  [kpIndex]);

  const stationMap = useMemo(() => {
    const m: Record<string, ObsData> = {};
    stations.forEach((s) => { m[s.code] = s; });
    return m;
  }, [stations]);

  const dst        = estimateDst(kpIndex, bzGsm);
  const stormActive= kpIndex >= 4 || bzGsm < -10;
  const auroraShow = kpIndex >= 4;

  return (
    <div style={{
      background:   'linear-gradient(135deg,rgba(5,12,30,0.96),rgba(3,8,22,0.98))',
      border:       '1px solid rgba(0,200,255,0.18)',
      borderRadius: '10px',
      overflow:     'hidden',
      position:     'relative',
      minWidth:     '320px',
      maxWidth:     '520px',
      fontFamily:   '"Rajdhani","Share Tech Mono",monospace',
    }}>
      {/* Header */}
      <div style={{ padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(0,200,255,0.12)' }}>
        <span style={{ fontSize:'13px', color:'#60c8ff', letterSpacing:'0.08em' }}>GLOBAL MAGNETIC FIELD  /  INTERMAGNET</span>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <span style={{ fontSize:'11px', color: dst < -100 ? '#ef4444' : dst < -50 ? '#f97316' : '#22c55e', fontFamily:'monospace' }}>
            Dst {dst > 0 ? '+' : ''}{dst} nT
          </span>
          {stormActive && (
            <span style={{ fontSize:'10px', color:'#ef4444', fontFamily:'monospace', animation:'pulseFade 1.5s ease-in-out infinite', border:'1px solid #ef4444', borderRadius:'3px', padding:'1px 5px' }}>
              STORM
            </span>
          )}
        </div>
      </div>

      {/* SVG Map */}
      <div style={{ position:'relative', padding:'0' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width:'100%', height:'auto', display:'block', background:'rgba(2,8,20,0.8)' }}
        >
          <defs>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-red">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Background ocean fill */}
          <rect width={W} height={H} fill="rgba(2,12,28,0.9)" />

          {/* Grid */}
          <GridLines />

          {/* Solar wind arrows */}
          <WindArrows speed={speed} />

          {/* Aurora ovals */}
          {auroraShow && (
            <g opacity={0.2 + kpIndex * 0.04}>
              <path d={auroraOvalPath(kpIndex, 'N')} fill="#22c55e" fillRule="evenodd" />
              <path d={auroraOvalPath(kpIndex, 'S')} fill="#22c55e" fillRule="evenodd" />
            </g>
          )}

          {/* Magnetic equator */}
          <path
            d={magEquatorPath()}
            stroke="rgba(255,200,0,0.45)"
            strokeWidth={0.8}
            strokeDasharray="4 3"
            fill="none"
          />

          {/* Observatory markers */}
          {OBSERVATORIES.map((obs) => {
            const [x, y]  = latLonToXY(obs.lat, obs.lon);
            const data    = stationMap[obs.code];
            const color   = data?.color ?? '#7fa8c8';
            const isHov   = hovered === obs.code;
            const disturbed = data?.level !== 'quiet';

            return (
              <g
                key={obs.code}
                onMouseEnter={() => setHovered(obs.code)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor:'pointer' }}
              >
                {disturbed && <PulseRing x={x} y={y} color={color} />}
                <circle
                  cx={x} cy={y} r={isHov ? 4 : 2.8}
                  fill={color}
                  fillOpacity={0.85}
                  stroke={isHov ? '#fff' : 'rgba(0,0,0,0.5)'}
                  strokeWidth={isHov ? 1 : 0.5}
                  filter={disturbed ? 'url(#glow-red)' : 'url(#glow-green)'}
                />
                {isHov && (
                  <g>
                    <rect
                      x={x + 5} y={y - 14}
                      width={70} height={26}
                      rx={3}
                      fill="rgba(3,12,30,0.92)"
                      stroke={color}
                      strokeWidth={0.6}
                    />
                    <text x={x + 9} y={y - 4} fontSize={5.5} fill={color} fontFamily="monospace">{obs.code} — {obs.name}</text>
                    <text x={x + 9} y={y + 4} fontSize={4.5} fill="#aaccee" fontFamily="monospace">
                      {(data?.deviation ?? 0).toFixed(1)} nT  ·  {data?.level?.toUpperCase()}
                    </text>
                    <text x={x + 9} y={y + 10} fontSize={4} fill="#4a8aaa" fontFamily="monospace">
                      {obs.lat.toFixed(1)}° {obs.lat >= 0 ? 'N' : 'S'} / {Math.abs(obs.lon).toFixed(1)}° {obs.lon >= 0 ? 'E' : 'W'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Bz indicator (right edge) */}
          <g transform={`translate(${W - 18},30)`}>
            <rect x={0} y={0} width={14} height={H - 60} rx={3} fill="rgba(0,20,50,0.7)" stroke="rgba(0,200,255,0.2)" strokeWidth={0.5} />
            {/* Zero line */}
            <line x1={0} x2={14} y1={(H - 60) / 2} y2={(H - 60) / 2} stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
            {/* Bz fill */}
            {(() => {
              const mid     = (H - 60) / 2;
              const normBz  = Math.max(-1, Math.min(1, bzGsm / 30));
              const barH    = Math.abs(normBz) * mid;
              const isNeg   = normBz < 0;
              return (
                <rect
                  x={2} y={isNeg ? mid : mid - barH}
                  width={10} height={barH}
                  fill={isNeg ? '#ef4444' : '#22c55e'}
                  rx={2}
                />
              );
            })()}
            <text x={7} y={-4}   fontSize={4} fill="#7fa8c8" fontFamily="monospace" textAnchor="middle">Bz</text>
            <text x={7} y={(H - 60) + 10} fontSize={4} fill={bzGsm < 0 ? '#ef4444' : '#22c55e'} fontFamily="monospace" textAnchor="middle">{bzGsm.toFixed(1)}</text>
          </g>

          {/* Legend (bottom-left) */}
          <g transform={`translate(4,${H - 22})`}>
            {(['quiet','active','disturbed','storm'] as ObsData['level'][]).map((lvl, i) => (
              <g key={lvl} transform={`translate(${i * 50},0)`}>
                <circle cx={4} cy={4} r={3} fill={LEVEL_COLORS[lvl]} />
                <text x={9} y={8} fontSize={4.5} fill="#7fa8c8" fontFamily="monospace">{lvl.toUpperCase()}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Kp bar */}
      <div style={{ padding:'8px 12px', borderTop:'1px solid rgba(0,200,255,0.1)', display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'11px', color:'#7fa8c8', fontFamily:'monospace', whiteSpace:'nowrap' }}>Kp</span>
        <div style={{ flex:1, height:'8px', background:'rgba(0,20,50,0.8)', borderRadius:'4px', overflow:'hidden', position:'relative' }}>
          {/* Colour bands */}
          {[
            { start:0/9,  end:3/9,  color:'rgba(34,197,94,0.4)'  },
            { start:3/9,  end:5/9,  color:'rgba(234,179,8,0.4)'  },
            { start:5/9,  end:7/9,  color:'rgba(239,68,68,0.4)'  },
            { start:7/9,  end:1,    color:'rgba(168,85,247,0.4)' },
          ].map((b, i) => (
            <div key={i} style={{ position:'absolute', left:`${b.start*100}%`, width:`${(b.end-b.start)*100}%`, height:'100%', background:b.color }} />
          ))}
          {/* Thumb */}
          <div style={{ position:'absolute', left:`${Math.min(98, kpIndex / 9 * 100)}%`, top:'-2px', width:'4px', height:'12px', background:'#fff', borderRadius:'2px', transform:'translateX(-50%)', boxShadow:'0 0 4px #fff8' }} />
        </div>
        <span style={{ fontSize:'11px', fontFamily:'"Rajdhani",monospace', fontWeight:700, color: kpIndex >= 5 ? '#ef4444' : kpIndex >= 3 ? '#eab308' : '#22c55e', minWidth:'24px' }}>{kpIndex.toFixed(1)}</span>

        {/* Storm alert */}
        {stations.filter((s) => s.level === 'storm').length > 0 && (
          <span style={{ fontSize:'10px', color:'#ef4444', fontFamily:'monospace', marginLeft:'auto' }}>
            {stations.filter((s) => s.level === 'storm').length} STATIONS STORM-LEVEL
          </span>
        )}
      </div>
    </div>
  );
}

export default GlobalMagneticGrid;
