import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { calculateOrbitalDistortion } from '../ml/MagneticFieldOverdrive';

interface SatelliteOrbitalTrackerProps {
  planetPosition: THREE.Vector3;
  planetRadius: number;
  standoffDistance: number;
}

export const SatelliteOrbitalTracker = ({
  planetPosition,
  planetRadius,
  standoffDistance,
}: SatelliteOrbitalTrackerProps) => {
  const baseOrbitPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * (planetRadius * 1.8),
        Math.sin(angle) * (planetRadius * 0.4),
        Math.sin(angle) * (planetRadius * 1.8),
      ));
    }
    return points;
  }, [planetRadius]);

  const [linePoints, setLinePoints] = useState<THREE.Vector3[]>(() => {
    const curve = new THREE.CatmullRomCurve3(baseOrbitPoints);
    return curve.getPoints(100);
  });
  const [lineOpacity, setLineOpacity] = useState(0.2);

  const lineColor = useMemo(() => {
    const compression = Math.max(0, Math.min(1, (6.5 - standoffDistance) / 6.5));
    const color = new THREE.Color('#00f3ff');
    color.lerp(new THREE.Color('#ff3300'), compression);
    return `#${color.getHexString()}`;
  }, [standoffDistance]);

  useFrame(() => {
    const distorted = baseOrbitPoints.map((point) =>
      calculateOrbitalDistortion(point, standoffDistance, new THREE.Vector3(1, 0, 0)),
    );
    const curve = new THREE.CatmullRomCurve3(distorted);
    setLinePoints(curve.getPoints(100));

    if (standoffDistance < 6.0) {
      const jitter = Math.random() * 0.25;
      setLineOpacity(Math.max(0.05, 0.22 - jitter));
    } else {
      setLineOpacity(0.2);
    }
  });

  return (
    <group position={planetPosition}>
      <Line points={linePoints} color={lineColor} transparent opacity={lineOpacity} lineWidth={1} />

      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};