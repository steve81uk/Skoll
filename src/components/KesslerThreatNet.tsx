import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { KesslerCascadeForecast } from '../ml/types';

interface KesslerThreatNetProps {
  earthRadius: number;
  cascade?: KesslerCascadeForecast | null;
  visible?: boolean;
  nodeCount?: number;
}

type DebrisNode = {
  theta: number;
  phi0: number;
  radius: number;
  speed: number;
  size: number;
};

const TMP = new THREE.Object3D();
const WHITE = new THREE.Color('#ffffff');
const RED = new THREE.Color('#ff3b30');

export default function KesslerThreatNet({
  earthRadius,
  cascade,
  visible = true,
  nodeCount = 5000,
}: KesslerThreatNetProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const nodes = useMemo<DebrisNode[]>(() => {
    const inner = earthRadius * 2.15;
    const outer = earthRadius * 3.35;

    return Array.from({ length: nodeCount }, () => {
      const theta = Math.acos(THREE.MathUtils.randFloatSpread(2));
      return {
        theta,
        phi0: Math.random() * Math.PI * 2,
        radius: THREE.MathUtils.randFloat(inner, outer),
        speed: THREE.MathUtils.randFloat(0.16, 0.55),
        size: THREE.MathUtils.randFloat(0.0045, 0.0115),
      };
    });
  }, [earthRadius, nodeCount]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current || !visible) {
      return;
    }

    // Frame loop stays allocation-light and avoids React setState calls entirely.
    // All per-instance updates are direct Three.js mutations for stable 60 FPS behavior.

    const t = clock.getElapsedTime();
    const risk = cascade?.next7dProbability ?? 0;
    const immediate = cascade?.next24hProbability ?? risk;

    // Escalate orbital angular velocity as cascade probability rises.
    const angularScale = 0.65 + risk * 3.25;

    // Color ramp: quiet white -> storm red, with slight opacity lift at high risk.
    materialRef.current.color.copy(WHITE).lerp(RED, THREE.MathUtils.clamp(risk * 1.25, 0, 1));
    materialRef.current.opacity = 0.5 + immediate * 0.35;

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      const phi = n.phi0 + t * angularScale * n.speed;
      const sinTheta = Math.sin(n.theta);

      TMP.position.set(
        n.radius * sinTheta * Math.cos(phi),
        n.radius * Math.cos(n.theta),
        n.radius * sinTheta * Math.sin(phi),
      );

      const scale = n.size * (1 + risk * 0.45);
      TMP.scale.setScalar(scale);
      TMP.updateMatrix();
      meshRef.current.setMatrixAt(i, TMP.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodeCount]} frustumCulled={false} renderOrder={7}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#ffffff"
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
