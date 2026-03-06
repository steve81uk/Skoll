import { useMemo } from 'react';
import * as THREE from 'three';

interface OrbitalTrailProps {
  orbitRadius: number;
  color?: string;
  opacity?: number;
  segments?: number;
}

const lineMaterialCache = new Map<string, THREE.LineBasicMaterial>();

export const OrbitalTrail = ({ 
  orbitRadius, 
  color = '#00ffff',
  opacity = 0.15,
  segments = 96 
}: OrbitalTrailProps) => {
  
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * orbitRadius,
          0,
          Math.sin(angle) * orbitRadius
        )
      );
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitRadius, segments]);

  const material = useMemo(() => {
    const cacheKey = `${color}-${opacity.toFixed(2)}`;
    const cached = lineMaterialCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const created = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    lineMaterialCache.set(cacheKey, created);
    return created;
  }, [color, opacity]);

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  return <primitive object={lineObject} />;
};
