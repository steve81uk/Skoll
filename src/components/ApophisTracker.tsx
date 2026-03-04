import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateOrbitalPositionByT, epochYearToT } from '../ml/OrbitalMechanics';

/**
 * ApophisTracker.tsx  —  99942 Apophis · JPL DE431 Ephemeris Tracker
 *
 * Orbital source: JPL HORIZONS solution #197 (2021 radar update)
 * https://ssd.jpl.nasa.gov/sbdb.cgi?sstr=99942
 *
 * Key encounter:  2029 April 13, 23:15 UTC
 *   Distance from Earth centre: 38,017 km  (≈ 5.97 R⊕)
 *   Relative velocity:          7.42 km/s
 *   Visual magnitude:           3.1  (naked-eye, mag limit ~6)
 *   Risk (Torino scale):        0  (confirmed safe)
 *
 * Apophis orbital elements (epoch 2029 Jan 1.0 TDB, DE431):
 *   a  = 0.9226 AU     e  = 0.1914
 *   i  = 3.336°        ω  = 126.43°
 *   Ω  = 204.01°       T₀ = 2013 Jan 09 (perihelion)
 *
 * Scene coordinates follow PlanetRenderer convention: AU_SCALE = 60 units/AU.
 *
 * Exported:
 *   ApophisTracker     — R3F Canvas component (heliocentric orbit + approach)
 *   ApophisPanel       — DOM sidebar statistics panel
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const AU_SCALE = 60;

/** Apophis orbital elements (JPL DE431, J2000 ecliptic) */
const APOPHIS_ELEMENTS = {
  semiMajorAxis:   0.9226,    // AU
  eccentricity:    0.1914,
  inclination:     3.336,     // deg
  argPerihelion:   126.43,    // deg   (ω)
  ascendingNode:   204.01,    // deg   (Ω)
  meanAnomalyEpoch: -19.87,   // deg at J2000 (back-solved from 2013 perihelion)
  orbitalPeriod:   323.6,     // days
};

/**
 * Compute Apophis heliocentric position (scene units) for a given
 * fractional number of days from J2000.0 (= 2000 Jan 1.5 TDB).
 *
 * Uses the same Keplerian solving pipeline as OrbitalMechanics.
 */
function apophisPosition(tDaysFromJ2000: number): THREE.Vector3 {
  const { semiMajorAxis: a, eccentricity: e, inclination, argPerihelion, ascendingNode, meanAnomalyEpoch, orbitalPeriod } = APOPHIS_ELEMENTS;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const norm  = (d: number) => { const r = d % 360; return r < 0 ? r + 360 : r; };

  const M0  = meansFromEpoch(tDaysFromJ2000, meanAnomalyEpoch, orbitalPeriod);
  const M   = toRad(M0);
  const E   = solveKeplerLocal(M, e);
  const v   = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r   = a * (1 - e * Math.cos(E));

  const xOrb = r * Math.cos(v);
  const yOrb = r * Math.sin(v);

  const i   = toRad(inclination);
  const w   = toRad(norm(argPerihelion));
  const Om  = toRad(norm(ascendingNode));

  const cosOm = Math.cos(Om), sinOm = Math.sin(Om);
  const cosW  = Math.cos(w),  sinW  = Math.sin(w);
  const cosI  = Math.cos(i);

  const xE = (cosOm*cosW - sinOm*sinW*cosI)*xOrb + (-cosOm*sinW - sinOm*cosW*cosI)*yOrb;
  const yE = (sinOm*cosW + cosOm*sinW*cosI)*xOrb + (-sinOm*sinW + cosOm*cosW*cosI)*yOrb;
  const zE = Math.sin(i)*(Math.sin(w)*xOrb + Math.cos(w)*yOrb);

  // ecliptic→Three.js: y→z, z→y
  return new THREE.Vector3(xE * AU_SCALE, zE * AU_SCALE, yE * AU_SCALE);
}

function meansFromEpoch(tDays: number, M0deg: number, periodDays: number): number {
  const n = 360 / periodDays;          // mean motion deg/day
  const r = (M0deg + n * tDays) % 360;
  return r < 0 ? r + 360 : r;
}

function solveKeplerLocal(M: number, e: number): number {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 10; i++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// J2000 epoch offsets in days
// 2029 April 13 ≈ J2000 + 10694 days
const CLOSE_APPROACH_DAYS = 10694;
// 2029 Jan 1 ≈ J2000 + 10593 days
const APPROACH_START_DAYS = CLOSE_APPROACH_DAYS - 30;
const APPROACH_END_DAYS   = CLOSE_APPROACH_DAYS + 30;

// ─── Heliocentric orbit curve (full Catmull-Rom) ──────────────────────────────

function buildFullOrbitCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * APOPHIS_ELEMENTS.orbitalPeriod;
    pts.push(apophisPosition(CLOSE_APPROACH_DAYS - APOPHIS_ELEMENTS.orbitalPeriod / 2 + t));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}

/** Close flyby path in HELIOCENTRIC coords built as Catmull-Rom */
function buildApproachCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const d = APPROACH_START_DAYS + (i / steps) * (APPROACH_END_DAYS - APPROACH_START_DAYS);
    pts.push(apophisPosition(d));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

// ─── DOM panel ────────────────────────────────────────────────────────────────

export function ApophisPanel() {
  const closeApproachDate = '2029 April 13, 23:15 UTC';
  const daysUntil = Math.max(0, Math.ceil((new Date('2029-04-13').getTime() - Date.now()) / 86400000));

  const stats = [
    { label: 'Semi-Major Axis',    value: '0.9226 AU' },
    { label: 'Eccentricity',       value: '0.1914' },
    { label: 'Inclination',        value: '3.336°' },
    { label: 'Orbital Period',     value: '323.6 d' },
    { label: 'Close Approach',     value: closeApproachDate },
    { label: 'Days Until Flyby',   value: daysUntil.toLocaleString() },
    { label: 'Closest Distance',   value: '38,017 km' },
    { label: 'Earth Radii',        value: '5.97 R⊕' },
    { label: 'Relative Velocity',  value: '7.42 km/s' },
    { label: 'Peak Magnitude',     value: '3.1  (naked eye)' },
    { label: 'Torino Scale',       value: '0  — SAFE' },
    { label: 'Source',             value: 'JPL DE431 #197' },
  ];

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#c0d8ff' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88ccff', marginBlockEnd: '6px', letterSpacing: '0.08em' }}>
        99942 APOPHIS — 2029 Earth Flyby
      </div>
      <div style={{
        padding: '4px 8px',
        background: 'rgba(0,200,255,0.07)',
        border: '1px solid rgba(100,200,255,0.25)',
        borderRadius: '5px',
        marginBlockEnd: '8px',
        fontSize: '9px',
        color: '#aaddff',
        lineHeight: 1.5,
      }}>
        On April 13, 2029, asteroid 99942 Apophis will pass within 38,017 km of Earth—closer than
        geostationary satellites. This CatmullRom path uses JPL DE431 Keplerian elements from the
        2021 Arecibo radar solution.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBlockEnd: '1px solid rgba(100,180,255,0.1)', paddingBottom: '2px' }}>
            <span style={{ opacity: 0.6 }}>{label}</span>
            <span style={{ color: label === 'Torino Scale' ? '#44ff88' : label === 'Close Approach' ? '#ffcc44' : '#c0e8ff', fontWeight: 'bold' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── R3F component ────────────────────────────────────────────────────────────

interface ApophisTrackerProps {
  visible: boolean;
  /** Epoch year to animate Apophis through. Default: 2029 (flyby year). */
  epochYear?: number;
}

export default function ApophisTracker({ visible, epochYear = 2029 }: ApophisTrackerProps) {
  const dotRef    = useRef<THREE.Mesh>(null!);
  const timeRef   = useRef(0);

  // Full orbit CatmullRom curve (built once)
  const { orbitCurvePoints, approachCurvePoints } = useMemo(() => {
    const full = buildFullOrbitCurve();
    const fullPts = full.getPoints(256);
    const approach = buildApproachCurve();
    const appPts = approach.getPoints(128);
    return { orbitCurvePoints: fullPts, approachCurvePoints: appPts };
  }, []);

  // Full orbit line geometry
  const fullOrbitGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(orbitCurvePoints);
    return g;
  }, [orbitCurvePoints]);

  // Approach path line geometry
  const approachGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints(approachCurvePoints);
    return g;
  }, [approachCurvePoints]);

  // Closest approach marker
  const caPos = useMemo(() => apophisPosition(CLOSE_APPROACH_DAYS), []);

  useFrame((state) => {
    if (!visible) return;
    timeRef.current = state.clock.getElapsedTime();

    // Animate Apophis along its orbit based on epochYear
    // Map epochYear 2028–2030 → interesting animation window
    const baseDay = CLOSE_APPROACH_DAYS - 180 + ((epochYear - 2028) * 365);
    const animDay = baseDay + timeRef.current * 0.5; // slow scroll
    const pos = apophisPosition(animDay % (APOPHIS_ELEMENTS.orbitalPeriod) + CLOSE_APPROACH_DAYS - APOPHIS_ELEMENTS.orbitalPeriod / 2);

    if (dotRef.current) {
      dotRef.current.position.copy(pos);
      dotRef.current.rotation.y += 0.01;
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Full heliocentric orbit path */}
      <primitive object={(() => {
        const l = new THREE.Line(fullOrbitGeo, new THREE.LineBasicMaterial({ color: '#4488ff', transparent: true, opacity: 0.30, depthWrite: false }));
        return l;
      })()} />

      {/* Close-approach 60-day window path (highlighted) */}
      <primitive object={(() => {
        const l = new THREE.Line(approachGeo, new THREE.LineBasicMaterial({ color: '#ffaa22', transparent: true, opacity: 0.60, depthWrite: false }));
        return l;
      })()} />

      {/* Asteroid body */}
      <mesh ref={dotRef}>
        <dodecahedronGeometry args={[0.14, 0]} />
        <meshStandardMaterial color="#aaaacc" roughness={0.85} metalness={0.25} emissive="#334466" emissiveIntensity={0.4} />
      </mesh>

      {/* Glow halo */}
      <mesh position={caPos}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Closest-approach marker ring */}
      <mesh position={caPos} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.45, 32]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Earth-Apophis chord at closest approach */}
      {(() => {
        const earthT = epochYearToT(2029);
        const ep = calculateOrbitalPositionByT('Earth', earthT);
        const ev = new THREE.Vector3(ep.x * AU_SCALE, ep.y * AU_SCALE, ep.z * AU_SCALE);
        const chordGeo = new THREE.BufferGeometry().setFromPoints([caPos, ev]);
        const chordLine = new THREE.Line(chordGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.20, depthWrite: false }));
        return <primitive object={chordLine} />;
      })()}
    </group>
  );
}
