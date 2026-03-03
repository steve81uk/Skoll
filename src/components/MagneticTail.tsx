import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface TailProps {
  planetPosition: THREE.Vector3;
  color: string;
  standoffDistance: number;
}

export const MagneticTailVisualizer = ({ planetPosition, color, standoffDistance }: TailProps) => {
  const meshRef = React.useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!meshRef.current) return;
    // The tail always points away from the Sun (0,0,0) [cite: 2025-12-11]
    const direction = new THREE.Vector3().copy(planetPosition).normalize();
    const targetPos = new THREE.Vector3().copy(planetPosition).add(direction.multiplyScalar(standoffDistance * 0.5));
    
    meshRef.current.position.copy(targetPos);
    meshRef.current.lookAt(planetPosition);
    
    // Pulse based on compression [cite: 2025-11-03]
    const scale = 1 + (10 / standoffDistance) * 0.2;
    meshRef.current.scale.set(scale, scale, standoffDistance * 2);
  });

  return (
    <mesh ref={meshRef}>
      <coneGeometry args={[1, 5, 32]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={0.15} 
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};