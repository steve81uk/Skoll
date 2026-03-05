/**
 * SKÖLL-TRACK — ORBITAL CAMERA TRACKING
 * Continuously follows a selected planet/moon as it orbits the Sun
 * @cite 2025-12-11
 */

import { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

interface TrackingTarget {
  position: Vector3;
  radius: number;
  name: string;
}

interface OrbitControlsState {
  enabled: boolean;
  enablePan: boolean;
  target: Vector3;
}

export const usePlanetTracking = (
  trackedTarget: TrackingTarget | null,
  isEnabled: boolean
) => {
  const { camera, controls } = useThree();

  useEffect(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!orbitControls) return;

    // Enable/disable orbit controls based on tracking state
    if (isEnabled && trackedTarget) {
      orbitControls.enabled = true;
      orbitControls.enablePan = false; // Lock panning while tracking
    } else {
      orbitControls.enablePan = true;
    }
  }, [isEnabled, trackedTarget, controls]);

  useFrame(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!isEnabled || !trackedTarget || !orbitControls) return;

    const targetPos = trackedTarget.position;
    const currentTarget = orbitControls.target;

    // Smoothly interpolate the orbit controls target to the planet's current position
    currentTarget.lerp(targetPos, 0.05); // 5% interpolation per frame = smooth following

    // Optionally: keep camera at a fixed offset distance from the target
    const offset = trackedTarget.radius * 5;
    const desiredCameraPos = new Vector3(
      targetPos.x + offset,
      targetPos.y + offset * 0.5,
      targetPos.z + offset
    );

    // Smoothly move camera to maintain offset
    camera.position.lerp(desiredCameraPos, 0.03);
    camera.lookAt(targetPos);
  });

  return null;
};
