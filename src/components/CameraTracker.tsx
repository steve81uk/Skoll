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

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  targetName,
  planetRefs,
  isEnabled
}) => {
  const { camera, controls } = useThree();
  const smoothTargetPos = useRef(new THREE.Vector3());
  const smoothCameraPos = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!controls) return;

    if (isEnabled && targetName) {
      (controls as any).enablePan = false;
      const targetRef = planetRefs.get(targetName);
      if (targetRef) {
        smoothTargetPos.current.copy(targetRef.position);
        smoothCameraPos.current.copy(camera.position);
      }
    } else {
      (controls as any).enablePan = true;
    }
  }, [isEnabled, targetName, controls, camera, planetRefs]);

  useFrame(() => {
    if (!isEnabled || !targetName || !controls) return;

    const targetRef = planetRefs.get(targetName);
    if (!targetRef) return;

    const targetPos = targetRef.position;
    const currentControlsTarget = (controls as any).target;

    // Smooth interpolation of controls target (where we're orbiting around)
    smoothTargetPos.current.lerp(targetPos, 0.08);
    currentControlsTarget.copy(smoothTargetPos.current);

    // Keep camera at a reasonable distance
    const distance = camera.position.distanceTo(targetPos);
    const desiredDistance = 40; // Increased for better zoom-out

    if (distance < desiredDistance * 0.4 || distance > desiredDistance * 2.5) {
      // Reposition camera if too close or too far
      const direction = new THREE.Vector3()
        .subVectors(camera.position, targetPos)
        .normalize();
      
      const desiredCameraPos = new THREE.Vector3()
        .copy(targetPos)
        .add(direction.multiplyScalar(desiredDistance));

      smoothCameraPos.current.lerp(desiredCameraPos, 0.05);
      camera.position.copy(smoothCameraPos.current);
    }

    camera.lookAt(smoothTargetPos.current);
  });

  return null;
};
