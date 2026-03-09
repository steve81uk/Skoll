import { useMemo } from 'react';
import * as THREE from 'three';
import {
  calculateOrbitalPosition,
  calculateOrbitalPositionByT,
  epochYearToT,
  getOrbitalPeriod,
} from '../ml/OrbitalMechanics';

interface OrbitalTrailProps {
  bodyName: string;
  auScale: number;
  currentDate: Date;
  epochYear?: number;
  color?: string;
  opacity?: number;
  segments?: number;
}

export const OrbitalTrail = ({ 
  bodyName,
  auScale,
  currentDate,
  epochYear,
  color = '#00ffff',
  opacity = 0.15,
  segments = 128 
}: OrbitalTrailProps) => {
  
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    const periodDays = getOrbitalPeriod(bodyName);
    const safePeriod = Math.max(2, periodDays);
    const hasEpochOverride = epochYear !== undefined;

    for (let i = 0; i <= segments; i++) {
      const alpha = i / segments;
      let x = 0;
      let y = 0;
      let z = 0;

      if (hasEpochOverride) {
        // Deep-time mode: sample one orbital period around the selected epoch.
        const baseT = epochYearToT(epochYear);
        const deltaDays = (alpha - 0.5) * safePeriod;
        const sampleT = baseT + deltaDays / 36525.0;
        const pos = calculateOrbitalPositionByT(bodyName, sampleT);
        x = pos.x;
        y = pos.y;
        z = pos.z;
      } else {
        // Date mode: sample one orbital period centered on current timeline date.
        const deltaDays = (alpha - 0.5) * safePeriod;
        const sampleDate = new Date(currentDate.getTime() + deltaDays * 86_400_000);
        const pos = calculateOrbitalPosition(bodyName, sampleDate);
        x = pos.x;
        y = pos.y;
        z = pos.z;
      }

      points.push(
        new THREE.Vector3(
          x * auScale,
          y * auScale,
          z * auScale,
        )
      );
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [auScale, bodyName, currentDate, epochYear, segments]);

  const material = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [color, opacity]);

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return <primitive object={lineObject} />;
};
