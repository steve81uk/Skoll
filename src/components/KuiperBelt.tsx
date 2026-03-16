import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** AU_SCALE from App.tsx — 60 scene units per AU */
const AU = 60;
/** Kuiper belt spans ~30–50 AU */
const INNER_R = 30 * AU;  // 1800
const OUTER_R = 50 * AU;  // 3000
const COUNT = 900;

interface KuiperBeltProps {
  visible?: boolean;
}

export default function KuiperBelt({ visible = true }: KuiperBeltProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // The instanced mesh itself never moves — disable per-frame world-matrix recompute.
  useEffect(() => {
    if (meshRef.current) meshRef.current.matrixAutoUpdate = false;
  }, []);

  /** Generate belt particle positions once */
  const { dummy, driftSpeeds } = useMemo(() => {
    const d = new THREE.Object3D();
    const speeds: number[] = [];

    for (let i = 0; i < COUNT; i++) {
      // Radial distance with slight inner-edge concentration
      const r = INNER_R + Math.pow(Math.random(), 0.7) * (OUTER_R - INNER_R);
      const theta = Math.random() * Math.PI * 2;
      // Inclination scatter ±15°
      const inclinationRad = (Math.random() - 0.5) * (30 * (Math.PI / 180));
      const y = r * Math.sin(inclinationRad);
      const horizR = r * Math.cos(inclinationRad);

      d.position.set(
        horizR * Math.cos(theta),
        y,
        horizR * Math.sin(theta),
      );
      // Random scale 1–3
      const s = 1 + Math.random() * 2;
      d.scale.setScalar(s);
      d.updateMatrix();

      // Store drift speed (proportional to 1/√r — Kepler)
      speeds.push(0.00003 / Math.sqrt(r / AU));
    }
    return { dummy: d, driftSpeeds: speeds };
  }, []);

  /** Set initial matrices */
  useMemo(() => {
    const tempDummy = new THREE.Object3D();
    if (!meshRef.current) return;
    for (let i = 0; i < COUNT; i++) {
      const r = INNER_R + Math.pow(Math.random(), 0.7) * (OUTER_R - INNER_R);
      const theta = Math.random() * Math.PI * 2;
      const inclinationRad = (Math.random() - 0.5) * (30 * (Math.PI / 180));
      const y = r * Math.sin(inclinationRad);
      const horizR = r * Math.cos(inclinationRad);
      tempDummy.position.set(horizR * Math.cos(theta), y, horizR * Math.sin(theta));
      const s = 1 + Math.random() * 2;
      tempDummy.scale.setScalar(s);
      tempDummy.updateMatrix();
      meshRef.current.setMatrixAt(i, tempDummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
   
  }, []);

  // Differential orbital drift — very subtle
  const angles = useMemo(() => {
    const arr = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) arr[i] = Math.random() * Math.PI * 2;
    return arr;
  }, []);

  const radii = useMemo(() => {
    const arr = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      arr[i] = INNER_R + Math.pow(Math.random(), 0.7) * (OUTER_R - INNER_R);
    }
    return arr;
  }, []);

  const inclinations = useMemo(() => {
    const arr = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      arr[i] = (Math.random() - 0.5) * (30 * (Math.PI / 180));
    }
    return arr;
  }, []);

  useFrame((_state, delta) => {
    if (!meshRef.current || !visible) return;
    for (let i = 0; i < COUNT; i++) {
      angles[i] += driftSpeeds[i] * delta * 60;
      const r = radii[i];
      const inc = inclinations[i];
      const horizR = r * Math.cos(inc);
      dummy.position.set(
        horizR * Math.cos(angles[i]),
        r * Math.sin(inc),
        horizR * Math.sin(angles[i]),
      );
      const s = 1 + (i % 3) * 0.8;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} renderOrder={0}>
      <icosahedronGeometry args={[1.5, 0]} />
      <meshBasicMaterial
        color="#8ab4d4"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
