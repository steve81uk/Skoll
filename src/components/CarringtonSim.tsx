import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * CarringtonSim.tsx  —  1859 Carrington Super-Storm Visualiser
 *
 * Historical context (Carrington, 1859):
 *  • Kp equivalent: ~9+ (off-scale)
 *  • Dst:          −1760 nT   (most intense ever recorded)
 *  • Bz:          ~−800 nT
 *  • Solar wind:  >2000 km/s
 *  • Global telegraph networks shorted; aurora visible at 20° latitude
 *
 * This component renders:
 *  1. Distorted magnetic field lines around Earth (R3F 3D scene)
 *  2. A DOM panel overlay with the event statistics + infrastructure impact table
 *
 * Pass `earthPos` to anchor it to the current Earth scene position.
 * Pass `active` to control visibility; the simulation auto-animates.
 */

// ─── DOM statistics panel ─────────────────────────────────────────────────────

const GRID_SECTORS = [
  { sector: 'North American Grid',   status: 'CATASTROPHIC', pct: 96, color: '#ff2200' },
  { sector: 'European ENTSO-E',      status: 'CATASTROPHIC', pct: 94, color: '#ff2200' },
  { sector: 'China State Grid',       status: 'CRITICAL',     pct: 81, color: '#ff7700' },
  { sector: 'India PGCIL',            status: 'CRITICAL',     pct: 78, color: '#ff7700' },
  { sector: 'Brazilian ANEEL',        status: 'SEVERE',       pct: 65, color: '#ffaa00' },
  { sector: 'Australian AEMO',        status: 'SEVERE',       pct: 62, color: '#ffaa00' },
  { sector: 'Japan TEPCO/KEPCO',      status: 'MAJOR',        pct: 54, color: '#ffcc00' },
  { sector: 'South Africa Eskom',     status: 'MAJOR',        pct: 51, color: '#ffcc00' },
];

interface CarringtonPanelProps {
  simulationTimeS: number;  // seconds elapsed in simulation
}

export function CarringtonPanel({ simulationTimeS }: CarringtonPanelProps) {
  const dstNow    = Math.max(-1760, -simulationTimeS * 18);
  const bzNow     = Math.min(-800,  -simulationTimeS * 8);
  const kpNow     = Math.min(9.5, simulationTimeS * 0.09);
  const speedKms  = Math.min(2100, 450 + simulationTimeS * 16);

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffaa44',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ff5500', letterSpacing: '0.1em' }}>
          ☀ CARRINGTON EVENT — 1-2 SEP 1859
        </span>
        <span style={{
          background: '#ff2200',
          color: '#fff',
          padding: '1px 6px',
          borderRadius: '3px',
          fontSize: '8px',
          letterSpacing: '0.14em',
          animation: 'pulse 0.8s infinite',
        }}>
          EXTREME STORM
        </span>
      </div>

      {/* Live metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {[
          { label: 'Kp Index',      value: kpNow.toFixed(1),              unit: '',       warn: kpNow > 7 },
          { label: 'Dst',           value: Math.round(dstNow).toLocaleString(), unit: ' nT',  warn: true },
          { label: 'Bz (GSM)',      value: Math.round(bzNow).toLocaleString(),  unit: ' nT',  warn: true },
          { label: 'Solar Wind',    value: Math.round(speedKms).toLocaleString(), unit: ' km/s', warn: speedKms > 800 },
          { label: 'Auroral Oval',  value: '20°',                         unit: ' lat',   warn: true },
          { label: 'Telegraph fail', value: '100',                         unit: '%',      warn: true },
        ].map(({ label, value, unit, warn }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBlockEnd: '1px solid rgba(255,100,0,0.15)', paddingBottom: '2px' }}>
            <span style={{ opacity: 0.65 }}>{label}</span>
            <span style={{ color: warn ? '#ff5500' : '#ffcc88', fontWeight: 'bold' }}>{value}{unit}</span>
          </div>
        ))}
      </div>

      {/* Infrastructure grid */}
      <div>
        <div style={{ fontSize: '8px', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.16em', marginBlockEnd: '4px' }}>
          Grid Infrastructure Impact (Modern Scenario)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '120px', overflowY: 'auto' }}>
          {GRID_SECTORS.map(({ sector, status, pct, color }) => (
            <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ flex: 1, fontSize: '9px', opacity: 0.85 }}>{sector}</div>
              <div style={{
                width: `${pct * 0.7}px`,
                height: '6px',
                background: color,
                borderRadius: '2px',
                minInlineSize: '4px',
                boxShadow: `0 0 4px ${color}88`,
              }} />
              <span style={{ color, fontSize: '8px', width: '24px', textAlign: 'right' }}>{pct}%</span>
              <span style={{ color, fontSize: '7px', minInlineSize: '70px', opacity: 0.8 }}>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Historical note */}
      <div style={{ borderBlockStart: '1px solid rgba(255,100,0,0.2)', paddingTop: '6px', fontSize: '9px', opacity: 0.55, lineHeight: 1.5 }}>
        Sep 1, 1859: Carrington observed white-light solar flare. Telegraphs in US & Europe operated
        without batteries from induced currents. Aurora visible at 20°N latitude tropical regions.
        Modern equivalent: $2–20 trillion economic damage; 40M without power for months.
      </div>
    </div>
  );
}

// ─── R3F 3D component ─────────────────────────────────────────────────────────

interface CarringtonSimProps {
  earthPos: [number, number, number];
  active: boolean;
}

/** One jittering field line */
const FieldLine = ({
  radius,
  thetaDeg,
  phiDeg,
  phase,
  intensity,
}: {
  radius: number;
  thetaDeg: number;
  phiDeg: number;
  phase: number;
  intensity: number;
}) => {
  const lineRef  = useRef<THREE.Line | null>(null);
  const matRef   = useRef<THREE.LineBasicMaterial | null>(null);
  const timeRef  = useRef(phase);

  // Build initial dipole arc geometry
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const baseInclination = THREE.MathUtils.degToRad(phiDeg);
    for (let t = 0; t <= 1; t += 0.025) {
      const angle = (t - 0.5) * Math.PI * 1.4;
      const r = radius * (1 + 1.2 * Math.cos(angle) ** 2);
      const theta = THREE.MathUtils.degToRad(thetaDeg);
      pts.push(new THREE.Vector3(
        r * Math.sin(angle + baseInclination) * Math.cos(theta),
        r * Math.cos(angle + baseInclination),
        r * Math.sin(angle + baseInclination) * Math.sin(theta),
      ));
    }
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(pts);
    return geo;
  }, [radius, thetaDeg, phiDeg]);

  useFrame((state) => {
    timeRef.current = state.clock.getElapsedTime() + phase;
    const t = timeRef.current;

    // Shake / distort field lines — increases with intensity
    const shake = intensity * 0.08;
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i]     += (Math.random() - 0.5) * shake * Math.sin(t * 3.7 + i);
      positions[i + 1] += (Math.random() - 0.5) * shake * Math.cos(t * 2.1 + i);
      positions[i + 2] += (Math.random() - 0.5) * shake * Math.sin(t * 4.3 + i);
    }
    geometry.attributes.position.needsUpdate = true;

    // Colour pulsing: green → red as storm intensifies
    if (matRef.current) {
      const r = Math.min(1, 0.2 + intensity * 0.8);
      const g = Math.max(0, 0.9 - intensity * 0.9);
      matRef.current.color.setRGB(r, g, 0.1);
      matRef.current.opacity = 0.3 + intensity * 0.5 + 0.12 * Math.sin(t * 2.8 + phase);
    }
  });

  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#44ff66', transparent: true, opacity: 0.55, depthWrite: false }), []);
  const lineObj = useMemo(() => {
    const l = new THREE.Line(geometry, lineMat);
    lineRef.current = l;
    matRef.current  = lineMat;
    return l;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <primitive object={lineObj} />;
};

/** Sparking particle burst at a random surface point (telegraph arcs) */
const SparkBurst = ({ radius, intensity }: { radius: number; intensity: number }) => {
  const meshRef = useRef<THREE.Points>(null!);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = radius * (1 + Math.random() * 0.25);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [radius]);

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.PointsMaterial;
      mat.size    = 0.04 + intensity * 0.06 * (0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * 12));
      mat.opacity = intensity * 0.8;
    }
  });

  return (
    <points ref={meshRef} geometry={geo}>
      <pointsMaterial color="#ffdd44" size={0.05} transparent opacity={0.6} depthWrite={false} sizeAttenuation />
    </points>
  );
};

export default function CarringtonSim({ earthPos, active }: CarringtonSimProps) {
  const groupRef  = useRef<THREE.Group>(null!);
  const intensity = useRef(0);
  const EARTH_R = 2.2;
  const fieldLines = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      thetaDeg: (i / 24) * 360,
      phiDeg:   30 + ((i * 13) % 60),
      phase:    i * 0.42,
    })),
  []);

  useFrame((state) => {
    if (!active || !groupRef.current) return;
    groupRef.current.position.set(...earthPos);
    // Ramp intensity 0→1 over ~10 s
    intensity.current = Math.min(1, state.clock.getElapsedTime() / 10);
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {fieldLines.map((fl, i) => (
        <FieldLine
          key={i}
          radius={EARTH_R * (1.8 + (i % 4) * 0.35)}
          thetaDeg={fl.thetaDeg}
          phiDeg={fl.phiDeg}
          phase={fl.phase}
          intensity={Math.min(1, intensity.current + 0.1)}
        />
      ))}
      <SparkBurst radius={EARTH_R} intensity={Math.min(1, intensity.current + 0.1)} />
      {/* Outer shockwave bubble */}
      <mesh>
        <sphereGeometry args={[EARTH_R * 3.2, 24, 24]} />
        <meshBasicMaterial
          color="#ff3300"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
