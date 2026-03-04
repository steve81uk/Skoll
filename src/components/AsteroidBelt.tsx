/**
 * SKÖLL-TRACK — ASTEROID BELT
 * InstancedMesh rendering of the Main Belt between Mars (1.52 AU) and Jupiter (5.20 AU).
 * ~2 200 asteroids laid out in a realistic toroidal distribution with Keplerian animation.
 *
 * AU_SCALE = 60 units/AU  →  belt inner edge ≈ 132 units, outer ≈ 198 units
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
const AU_SCALE      = 60;
const BELT_INNER_AU = 2.15;   // just outside Mars
const BELT_OUTER_AU = 3.30;   // just inside Jupiter's resonance gap
const BELT_HEIGHT   = 0.18;   // AU off-ecliptic (± half-value)
const ASTEROID_COUNT = 2200;

// Keplerian mean-motion: normalized so Earth (1 AU) completes 1 rev per 60 s of animation
// Outer asteroids orbit slower: ω ∝ r^(-3/2)
const EARTH_ANIM_OMEGA = 0.004; // rad/s at 1 AU

// ─── Deterministic mulberry32 PRNG ───────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Kirkwood gap names (informational) ─────────────────────────────────────
const GAP_NAMES: Array<{ au: number; name: string }> = [
  { au: 2.50, name: '3:1 Kirkwood Gap' },
  { au: 2.82, name: '5:2 Kirkwood Gap' },
  { au: 2.95, name: '7:3 Kirkwood Gap' },
];

function nearestGap(rAU: number): string {
  const closest = GAP_NAMES.reduce((a, b) => Math.abs(b.au - rAU) < Math.abs(a.au - rAU) ? b : a);
  return Math.abs(closest.au - rAU) < 0.25 ? closest.name : 'Main Belt';
}

// ─── Component ────────────────────────────────────────────────────────────────
export const AsteroidBelt = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);
  const [htmlPosition, setHtmlPosition]   = useState<THREE.Vector3 | null>(null);
  const matrixScratch = useMemo(() => new THREE.Matrix4(), []);
  const posScratch    = useMemo(() => new THREE.Vector3(), []);

  // When selection changes, pull world position of that instance
  useEffect(() => {
    if (selectedIdx === null || !meshRef.current) {
      setHtmlPosition(null);
      return;
    }
    meshRef.current.getMatrixAt(selectedIdx, matrixScratch);
    posScratch.setFromMatrixPosition(matrixScratch);
    setHtmlPosition(posScratch.clone());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx]);

  // Pre-compute per-asteroid layout data: radius, initialAngle, inclination, scale
  const asteroidData = useMemo(() => {
    const rng = mkRng(0xdeadbeef);
    const data: Array<{
      radius: number;   // orbital radius in THREE units
      theta0: number;   // initial angle (rad)
      incline: number;  // inclination wobble (rad)
      omega: number;    // angular velocity (rad/frame)
      scale: number;    // size
    }> = [];

    for (let i = 0; i < ASTEROID_COUNT; i++) {
      // Non-uniform radial distribution — denser in 2.5–3.0 AU band
      const u = rng();
      const rAU = BELT_INNER_AU + u * (BELT_OUTER_AU - BELT_INNER_AU);
      // Kirkwood-style gap rejection (~2.5 AU, ~2.82 AU, ~2.95 AU) — thin the density there
      const inGap =
        (Math.abs(rAU - 2.50) < 0.04) ||
        (Math.abs(rAU - 2.82) < 0.05) ||
        (Math.abs(rAU - 2.95) < 0.04);
      if (inGap && rng() < 0.75) {
        // Skip ~75 % of asteroids in gap zones
        i--;
        continue;
      }

      const radius = rAU * AU_SCALE;
      const theta0 = rng() * Math.PI * 2;
      const incline = (rng() - 0.5) * 2 * BELT_HEIGHT * AU_SCALE; // off-ecliptic offset
      const omega = EARTH_ANIM_OMEGA * Math.pow(1 / rAU, 1.5);     // Kepler 3rd law
      const scale = 0.06 + rng() * 0.28;                           // 0.06–0.34 units

      data.push({ radius, theta0, incline, omega, scale });
    }

    return data;
  }, []);

  // Geometry: rough icosahedron (looks like a rock, cheap)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);

  // Material: dark rocky, no emissive, additive-friendly
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#5a5048'),
        roughness: 0.95,
        metalness: 0.05,
      }),
    [],
  );

  // Build dummy object for matrix computation
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initial placement (also sets count)
  useMemo(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    asteroidData.forEach((a, i) => {
      const x = Math.cos(a.theta0) * a.radius;
      const z = Math.sin(a.theta0) * a.radius;
      dummy.position.set(x, a.incline, z);
      dummy.scale.setScalar(a.scale);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asteroidData, dummy]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    asteroidData.forEach((a, i) => {
      const theta = a.theta0 + _state.clock.elapsedTime * a.omega;
      const x = Math.cos(theta) * a.radius;
      const z = Math.sin(theta) * a.radius;
      dummy.position.set(x, a.incline, z);
      dummy.scale.setScalar(a.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    void delta;
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Click handler — R3F provides instanceId on the event for InstancedMesh
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const idx = e.instanceId ?? null;
    setSelectedIdx((prev) => (prev === idx ? null : idx)); // toggle
  };

  // Selected asteroid info
  const selectedData      = selectedIdx !== null ? asteroidData[selectedIdx] : null;
  const selectedAU        = selectedData ? (selectedData.radius / AU_SCALE).toFixed(2) : '';
  const selectedRegion    = selectedData ? nearestGap(selectedData.radius / AU_SCALE) : '';
  const selectedOrbPeriod = selectedData
    ? (Math.pow(selectedData.radius / AU_SCALE, 1.5)).toFixed(2)
    : '';

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, ASTEROID_COUNT]}
        frustumCulled={false}
        onClick={handleClick}
      />

      {/* HTML tooltip overlay for selected asteroid */}
      {selectedIdx !== null && htmlPosition && (
        <Html position={htmlPosition.toArray() as [number, number, number]} distanceFactor={120}>
          <div
            className="pointer-events-none select-none"
            style={{
              background: 'rgba(0,0,0,0.82)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(34,211,238,0.28)',
              borderRadius: '10px',
              padding: '8px 12px',
              minInlineSize: '160px',
              fontFamily: "'Courier New', monospace",
              fontSize: '10px',
              color: '#94d8f8',
            }}
          >
            <div style={{ color: '#22d3ee', fontWeight: 700, letterSpacing: '0.12em', marginBlockEnd: 4, textTransform: 'uppercase' }}>
              AST-{String(selectedIdx).padStart(4, '0')}
            </div>
            <div style={{ color: 'rgba(148,216,248,0.7)', marginBlockEnd: 2 }}>
              Region: <span style={{ color: '#fff' }}>{selectedRegion}</span>
            </div>
            <div style={{ color: 'rgba(148,216,248,0.7)', marginBlockEnd: 2 }}>
              Orbit: <span style={{ color: '#a78bfa' }}>{selectedAU} AU</span>
            </div>
            <div style={{ color: 'rgba(148,216,248,0.7)', marginBlockEnd: 2 }}>
              Period: <span style={{ color: '#f97316' }}>{selectedOrbPeriod} yr</span>
            </div>
            <div style={{ color: 'rgba(148,216,248,0.7)' }}>
              Scale: <span style={{ color: '#22d3ee' }}>{(selectedData?.scale ?? 0).toFixed(2)}</span>
            </div>
            <button
              className="pointer-events-auto"
              onClick={() => setSelectedIdx(null)}
              style={{
                marginBlockStart: 6,
                background: 'rgba(34,211,238,0.15)',
                border: '1px solid rgba(34,211,238,0.3)',
                borderRadius: 4,
                color: '#94d8f8',
                fontSize: 9,
                padding: '2px 8px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Dismiss
            </button>
          </div>
        </Html>
      )}
    </group>
  );
};
