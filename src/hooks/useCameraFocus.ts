import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { Vector3 } from 'three';

// Maximum scene-unit radius we allow a focus target to be at.
// Satellite orbitalNodes for ISS/Hubble/etc are ~4-12 units; Voyager is ~30.
// Anything beyond this is clamped so the camera never flies to infinity.
const MAX_FOCUS_RADIUS = 80;
// Maximum camera offset so the view is never zoomed completely out.
const MAX_CAMERA_OFFSET = 28;

interface OrbitControlsState {
  enabled: boolean;
  target: Vector3;
}

export const useCameraFocus = () => {
  const { camera, controls } = useThree();

  const focusOnPlanet = (
    planetPosition: Vector3,
    radiusScale: number,
    onFocusComplete?: () => void,
  ) => {
    const orbitControls = controls as unknown as OrbitControlsState | null;
    if (!orbitControls) return;

    // Kill any in-progress camera tween to prevent jump / stutter glitch.
    gsap.killTweensOf(camera.position);

    // Clamp the target to a safe radius so satellites with extreme orbitalNode
    // values (e.g. Voyager 1 at 30 units) don't teleport the camera to deep space.
    const safeTarget = planetPosition.clone();
    const dist = safeTarget.length();
    if (dist > MAX_FOCUS_RADIUS) {
      safeTarget.multiplyScalar(MAX_FOCUS_RADIUS / dist);
    }

    // 1. Immobilise Controls for the transition
    orbitControls.enabled = false;

    const tl = gsap.timeline({
      onComplete: () => {
        orbitControls.enabled = true;
        orbitControls.target.copy(safeTarget); // Anchor orbit around clamped target
        onFocusComplete?.();
      }
    });

    // 2. Vaulting Interpolation: cap offset so zooming in/out stays reasonable.
    const offset = Math.min(radiusScale * 8, MAX_CAMERA_OFFSET);
    tl.to(camera.position, {
      x: safeTarget.x + offset,
      y: safeTarget.y + offset * 0.6,
      z: safeTarget.z + offset,
      duration: 1.8,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(safeTarget),
    });

    return tl;
  };

  return { focusOnPlanet };
};