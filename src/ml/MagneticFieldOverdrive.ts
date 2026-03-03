/**
 * SKÖLL-TRACK MAGNETIC FIELD OVERDRIVE v2.0
 * Calculates kinetic distortion of orbital paths during CME events [cite: 2025-12-11]
 */

import { Vector3 } from 'three';

export interface OverdriveState {
  isCarringtonActive: boolean;
  compressionFactor: number; // 1.0 = Nominal, < 1.0 = Compressed
}

/**
 * Applies magnetospheric compression to a 3D orbital point
 * @param originalPoint The static orbital coordinate
 * @param standoff The current magnetopause distance in Re
 * @param solarDirection Vector pointing from the Sun to the Planet
 */
export const calculateOrbitalDistortion = (
  originalPoint: Vector3,
  standoff: number,
  solarDirection: Vector3 = new Vector3(1, 0, 0)
): Vector3 => {
  // 1. Calculate the 'Day Side' compression [cite: 2025-12-11]
  // Objects on the sun-facing side are pushed closer to the planet
  const alignment = originalPoint.clone().normalize().dot(solarDirection);
  
  // 2. Determine compression intensity [cite: 2025-12-11]
  // If standoff < 6.5, satellites are exposed to raw solar plasma [cite: 2025-12-11]
  const intensity = Math.max(0, (6.5 - standoff) / 6.5);
  
  // 3. Apply the shift (The Overdrive) [cite: 2025-11-03, 2025-12-11]
  const distortedPoint = originalPoint.clone();
  if (alignment > 0) {
    // Push the point inward based on solar wind pressure [cite: 2025-12-11]
    distortedPoint.multiplyScalar(1 - (intensity * 0.15 * alignment));
  } else {
    // Tail-side stretching (Magnetotail effect) [cite: 2025-12-11]
    distortedPoint.multiplyScalar(1 + (intensity * 0.05 * Math.abs(alignment)));
  }

  return distortedPoint;
}; 