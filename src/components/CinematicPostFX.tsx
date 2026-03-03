import { useMemo } from 'react';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';

type FXQuality = 'LOW' | 'HIGH';

export const CinematicPostFX = ({
  quality,
  boost,
  burstActive,
}: {
  quality: FXQuality;
  boost: number;
  burstActive: boolean;
}) => {
  const high = quality === 'HIGH';

  const bloomIntensity = (high ? 0.85 : 0.4) + boost * (high ? 1.0 : 0.55) + (burstActive ? (high ? 0.65 : 0.35) : 0);
  const bloomRadius = high ? 0.68 : 0.36;
  const threshold = high ? 0.16 : 0.24;

  const aberrationOffset = useMemo(() => {
    if (burstActive) {
      return new THREE.Vector2(high ? 0.0022 : 0.0011, high ? 0.0014 : 0.0007);
    }

    return new THREE.Vector2(high ? 0.00022 : 0.00008, high ? 0.00012 : 0.00005);
  }, [burstActive, high]);

  return (
    <EffectComposer multisampling={high ? 2 : 0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={bloomIntensity}
        luminanceThreshold={threshold}
        luminanceSmoothing={0.32}
        radius={bloomRadius}
      />
      <ChromaticAberration offset={aberrationOffset} />
    </EffectComposer>
  );
};
