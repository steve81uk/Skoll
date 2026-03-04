/**
 * MilkyWayBackground.tsx
 *
 * Loads the 2k equirectangular Milky Way panorama and sets it as the
 * Three.js scene background.  The EnhancedStarfield particle system
 * continues to render atop the texture for close-up stars.
 *
 * Image: /textures/2k_stars_milky_way.jpg (2048×1024 equirectangular)
 * Mapping: THREE.EquirectangularReflectionMapping
 */

import { useEffect } from 'react';
import { useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export default function MilkyWayBackground() {
  const { scene } = useThree();
  const texture = useLoader(THREE.TextureLoader, '/textures/2k_stars_milky_way.jpg');

  useEffect(() => {
    const prev = scene.background;
    texture.mapping    = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    // Slightly darken so foreground objects stay readable
    texture.repeat.set(1, 1);
    scene.background = texture;

    return () => {
      // Restore previous (null) background on unmount
      scene.background = prev ?? null;
    };
  }, [scene, texture]);

  return null;
}
