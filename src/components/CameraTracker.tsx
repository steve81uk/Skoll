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
  onManualOverride?: () => void;
}

interface OrbitControlsState {
  enabled: boolean;
  enablePan: boolean;
  target: THREE.Vector3;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  targetName,
  planetRefs,
  isEnabled,
  onManualOverride,
}) => {
  const { controls } = useThree();
  const smoothTargetPos = useRef(new THREE.Vector3());
  const manualOverrideRef = useRef(false);

  useEffect(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!orbitControls) return;

    // New tracking target => re-enable auto tracking until the user manually moves camera.
    manualOverrideRef.current = false;

    if (isEnabled && targetName) {
      orbitControls.enablePan = true;
      const targetRef = planetRefs.get(targetName);
      if (targetRef) {
        smoothTargetPos.current.copy(targetRef.position);
      }
    } else {
      orbitControls.enablePan = true;
    }
  }, [isEnabled, targetName, controls, planetRefs]);

  useEffect(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!orbitControls?.addEventListener || !orbitControls?.removeEventListener) {
      return;
    }

    const handleUserControlStart = () => {
      if (!isEnabled || !targetName || manualOverrideRef.current) {
        return;
      }
      manualOverrideRef.current = true;
      onManualOverride?.();
    };

    orbitControls.addEventListener('start', handleUserControlStart);
    return () => {
      orbitControls.removeEventListener?.('start', handleUserControlStart);
    };
  }, [controls, isEnabled, onManualOverride, targetName]);

  useFrame(() => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!isEnabled || !targetName || !orbitControls || manualOverrideRef.current) return;

    const targetRef = planetRefs.get(targetName);
    if (!targetRef) return;

    const targetPos = targetRef.position;
    const currentControlsTarget = orbitControls.target;

    // Smooth interpolation of controls target (where orbit revolves), without forcing camera lookAt each frame.
    smoothTargetPos.current.lerp(targetPos, 0.06);
    currentControlsTarget.copy(smoothTargetPos.current);
  });

  return null;
};
