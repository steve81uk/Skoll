import { useMemo } from 'react';
import * as THREE from 'three';

export const EnhancedStarfield = () => {
  const geometry = useMemo(() => {
    const count = 10000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 320 + Math.random() * 120;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const tint = Math.random();
      if (tint < 0.28) {
        colors[i * 3] = 0.72;
        colors[i * 3 + 1] = 0.84;
        colors[i * 3 + 2] = 1;
      } else if (tint < 0.74) {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.95;
        colors[i * 3 + 2] = 0.84;
      } else {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.64;
        colors[i * 3 + 2] = 0.45;
      }
    }

    const created = new THREE.BufferGeometry();
    created.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    created.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return created;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};
