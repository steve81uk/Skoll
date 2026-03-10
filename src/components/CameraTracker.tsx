/**
 * CAMERA TRACKER COMPONENT
 * Continuously tracks a selected planet/moon within the 3D scene
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraTrackerProps {
  targetName: string | null;
  planetRefs: Map<string, THREE.Group>;
  isEnabled: boolean;
}

interface OrbitControlsState {
  enablePan: boolean;
  target: THREE.Vector3;
}

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  targetName,
  planetRefs,
  isEnabled
}) => {
  const { camera, controls } = useThree();
  const smoothTargetPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!orbitControls) return;

    if (isEnabled && targetName) {
      orbitControls.enablePan = false;
      const targetRef = planetRefs.get(targetName);
      if (targetRef) {
        smoothTargetPos.current.copy(targetRef.position);
      }
    } else {
      orbitControls.enablePan = true;
    }
  }, [isEnabled, targetName, controls, camera, planetRefs]);

  useFrame(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!isEnabled || !targetName || !orbitControls) return;

    const targetRef = planetRefs.get(targetName);
    if (!targetRef) return;

    const targetPos = targetRef.position;
    const currentControlsTarget = orbitControls.target;

    // Smooth interpolation of controls target (where we're orbiting around)
    smoothTargetPos.current.lerp(targetPos, 0.08);
    currentControlsTarget.copy(smoothTargetPos.current);

    camera.lookAt(smoothTargetPos.current);
  });

  return null;
};
