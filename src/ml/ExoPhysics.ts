/**
 * SKÖLL-TRACK EXO-PHYSICS v2.1: THE OMNI-REACH UPDATE
 * Full System Scaling: Mercury to Pluto + Major Moons
 * @author steve81uk / Neural Commander
 */

export interface ExoplanetTelemetry {
  distanceAU: number;
  solarWindDensity: number;
  solarWindSpeed: number;
  magneticFieldBt: number;
  dominantGas: string;
  auroraColour: string;
  standoffDistance: number; 
  expansionLatitude: number;
}

export const SYSTEM_CONSTANTS = {
  // Inner Planets [cite: 2025-12-11]
  Mercury: { distanceAU: 0.39, magneticMoment: 0.0007, gas: 'Sodium / Helium',    colour: '#FFFFE0', tiltDegrees: 0.03 },
  Venus:   { distanceAU: 0.72, magneticMoment: 0.0001, gas: 'CO2 / Nitrogen',     colour: '#FFD700', tiltDegrees: 177.4 },
  Earth:   { distanceAU: 1.00, magneticMoment: 1.0,    gas: 'Nitrogen / Oxygen',  colour: '#00f3ff', tiltDegrees: 23.44 },
  Moon:    { distanceAU: 1.00, magneticMoment: 0.0000, gas: 'Exosphere',          colour: '#FFFFFF', tiltDegrees: 6.68 },
  Mars:    { distanceAU: 1.52, magneticMoment: 0.0001, gas: 'CO2 / Oxygen',       colour: '#4169E1', tiltDegrees: 25.19 },

  // Gas & Ice Giants [cite: 2025-12-11]
  Jupiter: { distanceAU: 5.20, magneticMoment: 18000.0,gas: 'Hydrogen / Helium',  colour: '#FF00FF', tiltDegrees: 3.13 },
  Io:      { distanceAU: 5.20, magneticMoment: 0.01,   gas: 'Sulphur Dioxide',    colour: '#FFEE00', tiltDegrees: 0.04 },
  Europa:  { distanceAU: 5.20, magneticMoment: 0.01,   gas: 'Oxygen',             colour: '#E0FFFF', tiltDegrees: 0.10 },
  Saturn:  { distanceAU: 9.58, magneticMoment: 580.0,  gas: 'Hydrogen',           colour: '#DA70D6', tiltDegrees: 26.73 },
  Titan:   { distanceAU: 9.58, magneticMoment: 0.00,   gas: 'Nitrogen / Methane', colour: '#FFA500', tiltDegrees: 0.30 },
  Uranus:  { distanceAU: 19.2, magneticMoment: 50.0,   gas: 'Hydrogen / Methane', colour: '#E0B0FF', tiltDegrees: 97.77 },
  Neptune: { distanceAU: 30.1, magneticMoment: 25.0,   gas: 'Hydrogen / Helium',  colour: '#0077ff', tiltDegrees: 28.32 },

  // The Demoted King [cite: 2025-12-11]
  Pluto:   { distanceAU: 39.5, magneticMoment: 0.0001, gas: 'Nitrogen / Methane', colour: '#B0C4DE', tiltDegrees: 122.53 }
} as const;

/**
 * Calculates local space weather and magnetospheric response across the full system
 */
export function calculateExoTelemetry(
  bodyName: keyof typeof SYSTEM_CONSTANTS,
  earthDensity: number,
  earthSpeed: number,
  earthBt: number,
  kpIndex: number,
  currentDate: Date = new Date()
): ExoplanetTelemetry {
  const body = SYSTEM_CONSTANTS[bodyName];
  const r = body.distanceAU;

  // Young Sun Paradox mode (Cretaceous / deep-time simulation)
  const isCretaceousMode = currentDate.getFullYear() < 0;
  const ancientDensityMultiplier = isCretaceousMode ? 1.8 : 1;
  const ancientWindMultiplier = isCretaceousMode ? 3 : 1;
  const adjustedEarthDensity = earthDensity * ancientDensityMultiplier;
  const adjustedEarthSpeed = earthSpeed * ancientWindMultiplier;

  // 1. Solar Wind Scaling (Inverse Square Law) [cite: 2025-12-11]
  const localDensity = adjustedEarthDensity * (1 / Math.pow(r, 2));
  const localSpeed = adjustedEarthSpeed;
  const localBt = earthBt * Math.sqrt(Math.pow(1/(r*r), 2) + Math.pow(1/r, 2));

  // 2. Dynamic Pressure (P = n * m * v^2) [cite: 2025-12-11]
  const pressure = localDensity * Math.pow(localSpeed, 2) * 1e-6;

  // 3. Magnetopause Standoff Distance (Chapman-Ferraro) [cite: 2025-12-11]
  const standoff = Math.pow((Math.pow(body.magneticMoment, 2) / Math.max(pressure, 1e-9)), 1/6);

  // 4. Auroral Expansion Latitude [cite: 2025-11-03, 2025-12-11]
  const baseLat = 75;
  const expansion = kpIndex * (2.5 / Math.max(standoff, 0.05));
  const localLatitude = Math.max(0, baseLat - expansion);

  return {
    distanceAU: r,
    solarWindDensity: localDensity,
    solarWindSpeed: localSpeed,
    magneticFieldBt: localBt,
    dominantGas: body.gas,
    auroraColour: body.colour,
    standoffDistance: parseFloat(standoff.toFixed(3)),
    expansionLatitude: parseFloat(localLatitude.toFixed(1))
  };
}