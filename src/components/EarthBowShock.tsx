import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Earth's magnetopause / bow-shock visualised as a parametric teardrop mesh.
 *
 * Nose standoff:  ~8 scene units sunward of earthPos
 * Magnetotail:   ~45 scene units anti-sunward
 * Compresses + turns amber/red when a CME is active (solar wind pressure spike).
 *
 * Solar wind ram pressure: P = 1.67e-21 * n * v²  (nPa)
 * Standoff distance scales as ~ P^(-1/6)   (Chapman-Ferraro)
 * Normal solar wind: n≈5, v≈450 → P≈1.7 nPa → compression=1.0
 * Storm/CME:         n≈50, v≈1500 → P≈188 nPa → compression≈0.52
 */

interface EarthBowShockProps {
  earthPos: THREE.Vector3;
  /** Unit vector pointing FROM sun TO earth (defaults to +x) */
  sunDirection?: THREE.Vector3;
  cmeActive?: boolean;
  kpIndex?: number;
  /** Live solar wind proton density in particles/cm³ (from NOAA/ACE) */
  solarWindDensity?: number;
  /** Live solar wind speed km/s */
  solarWindSpeed?: number;
}

// ---------- Build teardrop geometry ----------
function buildBowShockGeometry(compression: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const STACKS = 24;
  const SLICES = 32;

  const positions: number[] = [];
  const indices: number[] = [];

  // Parametric teardrop: x along sunward axis
  // For t in [0, π]:  r(t) = sin(t)^1.3 (rounded nose, tapered tail)
  // x maps from +nose to −tail
  const NOSE = 8 * compression;         // sunward standoff (compressed under CME)
  const TAIL = 45;                       // anti-sunward tail, fixed

  for (let j = 0; j <= STACKS; j++) {
    const t = (j / STACKS) * Math.PI;
    // x: NOSE at t=0, 0 at t=π/2, -TAIL at t=π
    const cosT = Math.cos(t);
    const x = cosT > 0 ? cosT * NOSE : -Math.abs(cosT) * TAIL;

    // Cross-section radius (yz plane) — widest near the equator
    const rBase = Math.sin(t);
    // Slightly flatten the tail (give it elliptical cross-section)
    const yScale = 12 * compression;
    const zScale = 10 * compression;

    for (let i = 0; i <= SLICES; i++) {
      const phi = (i / SLICES) * Math.PI * 2;
      positions.push(x, Math.cos(phi) * rBase * yScale, Math.sin(phi) * rBase * zScale);
    }
  }

  for (let j = 0; j < STACKS; j++) {
    for (let i = 0; i < SLICES; i++) {
      const a = j * (SLICES + 1) + i;
      const b = a + (SLICES + 1);
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export default function EarthBowShock({
  earthPos,
  sunDirection,
  cmeActive = false,
  kpIndex = 0,
  solarWindDensity = 5,
  solarWindSpeed = 450,
}: EarthBowShockProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null!);

  /**
   * Chapman-Ferraro dynamic compression.
   * Ram pressure P ∝ n·v²  →  standoff ∝ P^(-1/6)
   * Baseline: n=5, v=450 → P0=1.0 (normalised)
   * compression = (P0/P)^(1/6)  clamped [0.45, 1.15]
   */
  const targetCompressionRef = useRef(1.0);
  const currentCompressionRef = useRef(1.0);

  // Recompute target compression when live data changes
  useMemo(() => {
    const n = solarWindDensity;
    const v = solarWindSpeed;
    const P0 = 5 * 450 * 450;           // baseline ram pressure (un-normalised)
    const P  = n * v * v;
    let c = Math.pow(P0 / P, 1 / 6);
    if (cmeActive) c = Math.min(c, 0.60); // hard-crush during CME
    targetCompressionRef.current = Math.max(0.42, Math.min(1.18, c));
  }, [solarWindDensity, solarWindSpeed, cmeActive]);

  // Build geometry from current (smoothed) compression each frame
  const geoRef = useRef<THREE.BufferGeometry>(buildBowShockGeometry(1.0));

  // Sun direction defaults to +X (sun at origin, earth at positive)
  const sunDir = useMemo(() => {
    if (!sunDirection) return new THREE.Vector3(1, 0, 0);
    return sunDirection.clone().normalize();
  }, [sunDirection]);

  // Colour: cyan nominal → amber elevated KP → red CME
  const baseColour = useMemo(() => {
    if (cmeActive) return new THREE.Color('#ff4400');
    if (kpIndex >= 7)  return new THREE.Color('#ff8800');
    if (kpIndex >= 5)  return new THREE.Color('#ffcc44');
    // Colour also shifts blue→yellow as density rises
    const dNorm = Math.min(1, (solarWindDensity - 5) / 45); // 0 at 5, 1 at 50
    return new THREE.Color().lerpColors(new THREE.Color('#22ddff'), new THREE.Color('#aadd44'), dNorm * 0.5);
  }, [cmeActive, kpIndex, solarWindDensity]);

  // Smooth lerp toward target compression; rebuild geometry periodically
  const lastRebuildCompression = useRef(1.0);
  useFrame(({ clock }) => {
    if (!matRef.current || !meshRef.current) return;

    // Lerp compression
    const target = targetCompressionRef.current;
    const lerpSpeed = 0.015;
    currentCompressionRef.current += (target - currentCompressionRef.current) * lerpSpeed;
    const c = currentCompressionRef.current;

    // Rebuild geometry when compression drifts >0.01 from last rebuild
    if (Math.abs(c - lastRebuildCompression.current) > 0.012) {
      const newGeo = buildBowShockGeometry(c);
      meshRef.current.geometry.dispose();
      meshRef.current.geometry = newGeo;
      lastRebuildCompression.current = c;
    }

    // Base opacity: higher when shield is compressed (storm)
    const baseOpacity = cmeActive ? 0.24 : 0.08 + (1 - c) * 0.18;
    matRef.current.opacity = baseOpacity + Math.sin(clock.elapsedTime * 2.4) * (cmeActive ? 0.07 : 0.02);
    matRef.current.color = baseColour;
  });

  // Orient so that mesh +X aligns with sunDir (nose points sunward)
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sunDir);
    return q;
  }, [sunDir]);

  return (
    <mesh
      ref={meshRef}
      geometry={geoRef.current}
      position={earthPos}
      quaternion={quaternion}
      renderOrder={1}
    >
      <meshBasicMaterial
        ref={matRef}
        color={baseColour}
        transparent
        opacity={0.10}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
