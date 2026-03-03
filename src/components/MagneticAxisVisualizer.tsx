import type { FC } from 'react';
import * as THREE from 'three';

interface AxisProps {
  radius: number;
  tilt: number;
  color: string;
}

export const MagneticAxisVisualizer: FC<AxisProps> = ({ radius, tilt, color }) => {
  const poleHeight = radius * 2.8;
  const tiltRad = THREE.MathUtils.degToRad(tilt);

  return (
    <group rotation={[0, 0, tiltRad]}>
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, poleHeight, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
      </mesh>

      <mesh position={[0, poleHeight / 2, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, -poleHeight / 2, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ff3333" toneMapped={false} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.3, 0.005, 16, 100]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} toneMapped={false} />
      </mesh>
    </group>
  );
};
