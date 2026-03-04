import { useState, useMemo, useEffect, useRef } from 'react';

/**
 * GridFailureSim.tsx
 *
 * Simulates cascading power-grid failures triggered by an X-class solar
 * flare D-region / GIC (geomagnetically induced current) event.
 *
 * Physics model (simplified):
 *   • D-RAP radio blackout disables HF communication → SCADA/EMS systems
 *     on the sunlit hemisphere lose real-time grid telemetry.
 *   • GIC from the Dst perturbation saturates transformer cores on long
 *     transmission lines (> 500 km), causing protective relay trips.
 *   • Cascade propagates along interconnects when anchor nodes trip.
 *
 * Solar zenith angle (SZA) determines which nodes are sunlit:
 *   cos(SZA) = sin φ sin δ + cos φ cos δ cos H
 *   where δ ≈ 0°, φ = geographic latitude, H = solar hour angle.
 *   SZA < 90°  → sunlit (D-RAP affected)
 *   SZA > 100° → night side (GIC risk only for M4+ storms)
 *
 * The sub-solar longitude at UTC hour h: lon_ss = −(h − 12) × 15°
 *
 * Node vulnerability = f(flux, SZA, lineLength, isolation)
 */

export interface GridNode {
  id:         string;
  name:       string;
  region:     string;
  lat:        number;
  lon:        number;
  capacityGW: number;
  /** Transmission line length to nearest major hub (km) — long lines → GIC risk */
  lineKm:     number;
  /** Highlighted as user's location */
  highlight?: boolean;
}

// ── 19 global power grid hubs ──────────────────────────────────────────────
const GRID_NODES: GridNode[] = [
  { id: 'cambridge',      name: 'Cambridge Grid ★', region: 'UK',        lat:  52.2,  lon:   0.12, capacityGW:  12, lineKm:  90,  highlight: true },
  { id: 'london',         name: 'National Grid UK',  region: 'UK',        lat:  51.5,  lon:  -0.13, capacityGW:  45, lineKm: 340 },
  { id: 'paris',          name: 'RTE France',        region: 'W Europe',  lat:  48.9,  lon:   2.3,  capacityGW:  75, lineKm: 450 },
  { id: 'berlin',         name: '50Hertz Germany',   region: 'C Europe',  lat:  52.5,  lon:  13.4,  capacityGW:  65, lineKm: 520 },
  { id: 'madrid',         name: 'REE Spain',         region: 'S Europe',  lat:  40.4,  lon:  -3.7,  capacityGW:  40, lineKm: 380 },
  { id: 'stockholm',      name: 'Svenska Kraftnät',  region: 'Scandinavia', lat: 59.3, lon:  18.1,  capacityGW:  26, lineKm: 700 },
  { id: 'moscow',         name: 'FGC UES Russia',    region: 'Russia',    lat:  55.8,  lon:  37.6,  capacityGW: 160, lineKm: 1200 },
  { id: 'cairo',          name: 'EETC Egypt',        region: 'N Africa',  lat:  30.1,  lon:  31.2,  capacityGW:  28, lineKm: 480 },
  { id: 'johannesburg',   name: 'Eskom South Africa',region: 'S Africa',  lat: -26.2,  lon:  28.0,  capacityGW:  40, lineKm: 950 },
  { id: 'nyc',            name: 'PJM Eastern USA',   region: 'NE USA',    lat:  40.7,  lon: -74.0,  capacityGW:  75, lineKm: 800 },
  { id: 'chicago',        name: 'MISO Midwest USA',  region: 'C USA',     lat:  41.8,  lon: -87.6,  capacityGW:  55, lineKm: 650 },
  { id: 'houston',        name: 'ERCOT Texas',       region: 'S USA',     lat:  29.8,  lon: -95.4,  capacityGW:  80, lineKm: 550 },
  { id: 'la',             name: 'CAISO California',  region: 'W USA',     lat:  34.0,  lon:-118.2,  capacityGW:  65, lineKm: 480 },
  { id: 'toronto',        name: 'IESO Canada',       region: 'Canada',    lat:  43.7,  lon: -79.4,  capacityGW:  30, lineKm: 900 },
  { id: 'tokyo',          name: 'TEPCO Japan',       region: 'Japan',     lat:  35.7,  lon: 139.7,  capacityGW:  60, lineKm: 420 },
  { id: 'beijing',        name: 'State Grid China',  region: 'China',     lat:  39.9,  lon: 116.4,  capacityGW: 300, lineKm: 1800 },
  { id: 'mumbai',         name: 'PGCIL India',       region: 'India',     lat:  19.1,  lon:  72.9,  capacityGW: 200, lineKm: 1400 },
  { id: 'sydney',         name: 'AEMO Australia',    region: 'Australia', lat: -33.9,  lon: 151.2,  capacityGW:  50, lineKm: 680 },
  { id: 'saopaulo',       name: 'ONS Brazil',        region: 'Brazil',    lat: -23.5,  lon: -46.6,  capacityGW:  90, lineKm: 1100 },
];

// ── Cascade interconnects (which nodes share grid segments) ─────────────────
const INTERCONNECTS: [string, string][] = [
  ['cambridge', 'london'],
  ['london', 'paris'],
  ['paris', 'berlin'],
  ['paris', 'madrid'],
  ['berlin', 'stockholm'],
  ['berlin', 'moscow'],
  ['moscow', 'stockholm'],
  ['nyc', 'toronto'],
  ['nyc', 'chicago'],
  ['chicago', 'houston'],
  ['la', 'houston'],
  ['la', 'chicago'],
  ['tokyo', 'beijing'],
  ['beijing', 'mumbai'],
  ['sydney', 'tokyo'],
  ['johannesburg', 'cairo'],
  ['cairo', 'madrid'],
];

// ── Types ────────────────────────────────────────────────────────────────────
type NodeStatus = 'online' | 'watch' | 'warning' | 'offline';

interface NodeState extends GridNode {
  status:     NodeStatus;
  sza:        number;   // solar zenith angle degrees
  sunlit:     boolean;
  gicRisk:    number;   // 0–1
  powerLost:  number;   // GW offline
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;

/** Solar zenith angle (degrees) for lat/lon at current UTC. */
function solarZenithAngle(lat: number, lon: number): number {
  const h   = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  // Sub-solar longitude at this UTC hour
  const lonSS   = -(h - 12) * 15;
  const hourAngle = (lon - lonSS) * DEG;
  const decl      = 0; // near vernal equinox March 2026 ≈ 0°
  const phi       = lat * DEG;
  const cosZen    = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);
  return Math.acos(Math.max(-1, Math.min(1, cosZen))) / DEG;
}

/** GIC risk: long lines on sunlit side during magnetic storms. */
function gicRisk(node: GridNode, fluxWm2: number, sza: number): number {
  const flareRisk = Math.max(0, (Math.log10(Math.max(1e-10, fluxWm2)) + 5) / 4);
  const lineFactor = Math.min(1, node.lineKm / 1200);
  const szaFactor  = sza < 100 ? 1 : sza < 130 ? 0.5 : 0.25;
  return Math.min(1, flareRisk * lineFactor * szaFactor);
}

/** Determine initial status from flux and sza. */
function baseStatus(fluxWm2: number, sza: number, lineKm: number): NodeStatus {
  const sunlit = sza < 90;
  const night  = sza > 100;
  if (fluxWm2 < 1e-6) return 'online';
  if (fluxWm2 < 1e-5) return sunlit ? 'watch' : 'online';
  if (fluxWm2 < 1e-4) return sunlit ? 'warning' : (lineKm > 600 ? 'watch' : 'online');
  // X-class
  const xMult = fluxWm2 / 1e-4;
  if (sunlit) return xMult > 5 ? 'offline' : xMult > 2 ? 'warning' : 'warning';
  if (!night && lineKm > 800) return xMult > 3 ? 'warning' : 'watch';
  return 'online';
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  online:  '#22ff88',
  watch:   '#ffd166',
  warning: '#ff8c42',
  offline: '#ff4f52',
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  online:  'Online',
  watch:   'Watch',
  warning: 'Warning',
  offline: 'Offline',
};

function fluxLabel(f: number): string {
  if (f <= 0) return 'A';
  if (f < 1e-7) return 'A';
  if (f < 1e-6) return 'B';
  if (f < 1e-5) return 'C';
  if (f < 1e-4) return 'M';
  return `X${(f / 1e-4).toFixed(1)}`;
}

const ACCENT = '#ff8c42';

// ─────────────────────────────────────────────────────────────────────────────
export interface GridFailureSimProps {
  /** Live GOES 1–8 Å flux in W/m² */
  goesFluxWm2?: number;
  /** Show cascade animation automatically when X-class detected */
  autoSimulate?: boolean;
}

export default function GridFailureSim({ goesFluxWm2 = 1e-8, autoSimulate = false }: GridFailureSimProps) {
  const [simActive, setSimActive] = useState(false);
  const [cascadeStep, setCascadeStep] = useState(0);
  const cascadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute base node states from live flux
  const nodeStates: NodeState[] = useMemo(() => {
    return GRID_NODES.map((n) => {
      const sza   = solarZenithAngle(n.lat, n.lon);
      const sunlit = sza < 90;
      const risk  = gicRisk(n, goesFluxWm2, sza);
      const status = baseStatus(goesFluxWm2, sza, n.lineKm);
      return { ...n, sza, sunlit, gicRisk: risk, powerLost: status === 'offline' ? n.capacityGW : 0, status };
    });
  }, [goesFluxWm2]);

  // Cascade simulation
  const cascadeStates: NodeState[] = useMemo(() => {
    if (!simActive || cascadeStep === 0) return nodeStates;

    const idToStatus = new Map<string, NodeStatus>(nodeStates.map((n) => [n.id, n.status]));

    // Build adjacency for cascade propagation
    for (let step = 0; step < cascadeStep; step++) {
      for (const [a, b] of INTERCONNECTS) {
        const sa = idToStatus.get(a);
        const sb = idToStatus.get(b);
        if (sa === 'offline' && sb !== 'offline' && sb !== 'online') {
          idToStatus.set(b, 'offline');
        } else if (sb === 'offline' && sa !== 'offline' && sa !== 'online') {
          idToStatus.set(a, 'offline');
        }
        // Warning → escalate
        if (sa === 'offline' && sb === 'watch')   idToStatus.set(b, 'warning');
        if (sb === 'offline' && sa === 'watch')   idToStatus.set(a, 'warning');
      }
    }

    return nodeStates.map((n) => ({
      ...n,
      status:    idToStatus.get(n.id) ?? n.status,
      powerLost: (idToStatus.get(n.id) === 'offline') ? n.capacityGW : n.powerLost,
    }));
  }, [nodeStates, simActive, cascadeStep]);

  // Auto-trigger on X-class detection
  useEffect(() => {
    if (autoSimulate && goesFluxWm2 >= 1e-4 && !simActive) {
      setSimActive(true);
      setCascadeStep(0);
    }
  }, [autoSimulate, goesFluxWm2, simActive]);

  // Cascade timer
  useEffect(() => {
    if (!simActive) {
      if (cascadeRef.current) clearInterval(cascadeRef.current);
      return;
    }
    cascadeRef.current = setInterval(() => {
      setCascadeStep((s) => {
        if (s >= 6) {
          clearInterval(cascadeRef.current!);
          return s;
        }
        return s + 1;
      });
    }, 1200);
    return () => { if (cascadeRef.current) clearInterval(cascadeRef.current); };
  }, [simActive]);

  const totalOffline  = cascadeStates.filter((n) => n.status === 'offline').reduce((s, n) => s + n.capacityGW, 0);
  const totalWarning  = cascadeStates.filter((n) => n.status === 'warning').length;
  const totalAffected = cascadeStates.filter((n) => n.status !== 'online').length;
  const flareStr      = fluxLabel(goesFluxWm2);
  const flareCol      = goesFluxWm2 >= 1e-4 ? '#ff4f52' : goesFluxWm2 >= 1e-5 ? '#ff8c42' : goesFluxWm2 >= 1e-6 ? '#ffd166' : '#22ff88';

  const stopSim = () => {
    setSimActive(false);
    setCascadeStep(0);
    if (cascadeRef.current) clearInterval(cascadeRef.current);
  };

  return (
    <div
      style={{
        background:           'rgba(6,10,22,0.78)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px 6px', background: `linear-gradient(90deg,${ACCENT}10 0%,transparent 100%)`, borderBlockEnd: `1px solid ${ACCENT}22` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: flareCol, display: 'inline-block', boxShadow: `0 0 6px ${flareCol}` }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>Grid Failure Sim</span>
        <span style={{ marginInlineStart: 'auto', fontSize: '8px', color: flareCol, fontWeight: 'bold', letterSpacing: '0.08em' }}>{flareStr}-class</span>
      </div>

      {/* ── Summary bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.04)', borderBlockEnd: `1px solid ${ACCENT}18` }}>
        {[
          { label: 'Affected',  val: totalAffected,           unit: ' nodes' },
          { label: 'Warning',   val: totalWarning,            unit: ' nodes' },
          { label: 'Offline',   val: `${totalOffline.toFixed(0)}`, unit: ' GW' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '5px 8px', textAlign: 'center', background: 'rgba(6,10,22,0.5)' }}>
            <div style={{ fontSize: '7px', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: ACCENT }}>{s.val}<span style={{ fontSize: '7px', opacity: 0.5 }}>{s.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ── Cascade controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBlockEnd: `1px solid rgba(255,255,255,0.06)` }}>
        {!simActive ? (
          <button
            onClick={() => { setSimActive(true); setCascadeStep(0); }}
            style={{ background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.45)', borderRadius: '5px', padding: '4px 10px', color: ACCENT, cursor: 'pointer', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            ▶ Run Cascade Sim
          </button>
        ) : (
          <>
            <button
              onClick={stopSim}
              style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.4)', borderRadius: '5px', padding: '4px 10px', color: '#ff5555', cursor: 'pointer', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              ⬛ Stop
            </button>
            <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(cascadeStep / 6) * 100}%`, background: `linear-gradient(90deg,${ACCENT},#ff4f52)`, transition: 'width 0.8s ease' }} />
            </div>
            <span style={{ fontSize: '7px', opacity: 0.5 }}>T+{cascadeStep * 1.2}min</span>
          </>
        )}
      </div>

      {/* ── Node list ── */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '6px 8px 8px' }} className="wolf-scroll">
        {cascadeStates.map((node) => {
          const col   = STATUS_COLORS[node.status];
          const isHL  = node.highlight;
          return (
            <div
              key={node.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 6px', marginBlockEnd: '2px', borderRadius: '5px',
                background: isHL ? `${col}15` : node.status !== 'online' ? `${col}0a` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isHL ? col + '60' : node.status !== 'online' ? col + '35' : 'rgba(100,150,200,0.10)'}`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: node.status !== 'online' ? `0 0 5px ${col}` : 'none',
                animation: node.status === 'offline' ? 'gridPulse 0.9s ease-in-out infinite' : 'none' }} />
              <div style={{ flex: 1, minInlineSize: 0 }}>
                <div style={{ fontSize: '8px', fontWeight: isHL ? 'bold' : 'normal', color: isHL ? col : '#c0d8f0', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </div>
                <div style={{ fontSize: '7px', opacity: 0.4, letterSpacing: '0.06em' }}>{node.region} · {node.capacityGW} GW</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '7px', fontWeight: 'bold', color: col, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{STATUS_LABELS[node.status]}</div>
                <div style={{ fontSize: '6px', opacity: 0.35 }}>SZA {node.sza.toFixed(0)}°</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: '8px 14px', flexWrap: 'wrap', padding: '5px 10px 7px', borderBlockStart: '1px solid rgba(255,255,255,0.06)', fontSize: '7px', opacity: 0.38, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {(Object.entries(STATUS_COLORS) as [NodeStatus, string][]).map(([s, c]) => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {s}
          </span>
        ))}
        <span style={{ opacity: 0.28 }}>SZA = Solar Zenith Angle</span>
      </div>

      <style>{`@keyframes gridPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
