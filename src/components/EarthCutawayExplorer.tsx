import { useMemo } from 'react';
import * as THREE from 'three';

interface EarthCutawayExplorerProps {
  earthPos: THREE.Vector3;
  visible?: boolean;
  sliceEnabled?: boolean;
  sliceDepth?: number;
  showCrust?: boolean;
  showMantle?: boolean;
  showOuterCore?: boolean;
  showInnerCore?: boolean;
}

export default function EarthCutawayExplorer({
  earthPos,
  visible = false,
  sliceEnabled = true,
  sliceDepth = 0,
  showCrust = true,
  showMantle = true,
  showOuterCore = true,
  showInnerCore = true,
}: EarthCutawayExplorerProps) {
  const clippingPlane = useMemo(() => {
    const p = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    p.constant = -sliceDepth;
    return p;
  }, [sliceDepth]);

  if (!visible) return null;

  const clip = sliceEnabled ? [clippingPlane] : undefined;

  return (
    <group position={earthPos} renderOrder={12}>
      {showCrust && (
        <mesh>
          <sphereGeometry args={[2.22, 72, 48]} />
          <meshStandardMaterial
            color="#65c6ff"
            transparent
            opacity={0.15}
            emissive="#44c4ff"
            emissiveIntensity={0.35}
            depthWrite={false}
            clippingPlanes={clip}
          />
        </mesh>
      )}
      {showMantle && (
        <mesh>
          <sphereGeometry args={[1.9, 64, 40]} />
          <meshStandardMaterial
            color="#ff9f66"
            transparent
            opacity={0.35}
            emissive="#ff7e47"
            emissiveIntensity={0.22}
            clippingPlanes={clip}
          />
        </mesh>
      )}
      {showOuterCore && (
        <mesh>
          <sphereGeometry args={[1.2, 56, 36]} />
          <meshStandardMaterial
            color="#ff5f26"
            transparent
            opacity={0.5}
            emissive="#ff4d18"
            emissiveIntensity={0.35}
            clippingPlanes={clip}
          />
        </mesh>
      )}
      {showInnerCore && (
        <mesh>
          <sphereGeometry args={[0.64, 48, 32]} />
          <meshStandardMaterial
            color="#ffd58f"
            emissive="#ffd58f"
            emissiveIntensity={0.35}
            clippingPlanes={clip}
          />
        </mesh>
      )}
    </group>
  );
}
