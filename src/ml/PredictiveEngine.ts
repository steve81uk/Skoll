/**
 * SKÖLL-TRACK v2 — Predictive Engine
 * Lead Data Engineering service layer for orbital/atmospheric risk inference.
 */

export interface PlanetaryHealth {
  planetName: string;
  satelliteThreatScore: number;
  impactBand: 'NOMINAL' | 'ELEVATED' | 'SEVERE' | 'CRITICAL';
  dataMode: 'live' | 'simulated';
  updatedAt: Date;
}

export interface AtmosphericState {
  densityKgM3: number;
  ionizationIndex: number;
  dragCoefficient: number;
  auroraPotential: number;
}

export interface SolarEventRecord {
  id: string;
  eventName: string;
  timestamp: string;
  kpIndex: number;
  satelliteThreatScore: number;
  gridImpact: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  summary: string;
}

export interface HistoricalMagneticModel {
  year: number;
  source: 'WMM' | 'GUFM1' | 'PALEOMAG';
  northPole: {
    lat: number;
    lon: number;
  };
  magneticOffsetDeg: number;
  rotationMatrix: number[][];
}

export interface PhysicsConstants {
  Re: number;
  mu: number;
  solarWindVelocity: {
    vx: number;
    vy: number;
    vz: number;
  };
}

export const PHYSICS_CONSTANTS: PhysicsConstants = {
  Re: 6_371_000,
  mu: 3.986004418e14,
  solarWindVelocity: {
    vx: -450_000,
    vy: 35_000,
    vz: -20_000,
  },
};

let warnedMissingKey = false;

export function validateTelemetryMode(): 'live' | 'simulated' {
  if (!import.meta.env.VITE_NASA_API_KEY) {
    if (!warnedMissingKey) {
      console.warn('[PredictiveEngine] Missing VITE_NASA_API_KEY. Switching to Simulated Data mode.');
      warnedMissingKey = true;
    }
    return 'simulated';
  }

  return 'live';
}

export function predictSolarImpact(kp: number): number {
  const mode = validateTelemetryMode();
  const clampedKp = Math.max(0, Math.min(9, kp));

  const baseSignal = 1 / (1 + Math.exp(-(clampedKp - 4.7) * 1.25));
  const recurrenceGate = Math.sin(clampedKp * 1.37) * 0.08 + 0.92;
  const memoryWeight = 0.85 + Math.min(clampedKp / 9, 1) * 0.15;
  const simulationDampener = mode === 'simulated' ? 0.93 : 1;

  const score = baseSignal * recurrenceGate * memoryWeight * simulationDampener * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function classifyThreat(score: number): PlanetaryHealth['impactBand'] {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'SEVERE';
  if (score >= 40) return 'ELEVATED';
  return 'NOMINAL';
}

export function buildPlanetaryHealth(planetName: string, kp: number): PlanetaryHealth {
  const dataMode = validateTelemetryMode();
  const satelliteThreatScore = predictSolarImpact(kp);

  return {
    planetName,
    satelliteThreatScore,
    impactBand: classifyThreat(satelliteThreatScore),
    dataMode,
    updatedAt: new Date(),
  };
}

function classifyGridImpact(score: number): SolarEventRecord['gridImpact'] {
  if (score >= 85) return 'SEVERE';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

const MAJOR_EVENT_BASELINE = [
  {
    id: 'evt-2025-11-03',
    eventName: 'Halloween Storm Echo',
    timestamp: '2025-11-03T04:10:00Z',
    kpIndex: 8.3,
    summary: 'Transformer harmonics observed across northern Europe.',
  },
  {
    id: 'evt-2025-10-12',
    eventName: 'Carrington Analog Watch',
    timestamp: '2025-10-12T23:00:00Z',
    kpIndex: 7.6,
    summary: 'HVDC operators entered load-shed guard bands.',
  },
  {
    id: 'evt-2025-08-29',
    eventName: 'Twin CME Compression',
    timestamp: '2025-08-29T13:50:00Z',
    kpIndex: 6.9,
    summary: 'Substorm clustering triggered GNSS clock drift alerts.',
  },
  {
    id: 'evt-2025-06-14',
    eventName: 'Auroral Oval Expansion',
    timestamp: '2025-06-14T19:20:00Z',
    kpIndex: 6.1,
    summary: 'Grid balancing authorities switched to contingency reserve.',
  },
  {
    id: 'evt-2025-03-01',
    eventName: 'Polar Cap Absorption Event',
    timestamp: '2025-03-01T07:32:00Z',
    kpIndex: 5.7,
    summary: 'HF comms outages recorded on transpolar routes.',
  },
] as const;

export function getRecentMajorSolarEvents(): SolarEventRecord[] {
  return MAJOR_EVENT_BASELINE.map((event) => {
    const satelliteThreatScore = predictSolarImpact(event.kpIndex);
    return {
      ...event,
      satelliteThreatScore,
      gridImpact: classifyGridImpact(satelliteThreatScore),
    };
  });
}

function eulerToRotationMatrix(x: number, y: number, z: number): number[][] {
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);

  return [
    [cy * cz, -cy * sz, sy],
    [sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy],
    [-cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy],
  ];
}

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function getHistoricalMagneticModel(year: number, enableMagneticReversal = true): HistoricalMagneticModel {
  const nowYear = new Date().getFullYear();

  if (year >= 1990 && year <= nowYear + 1) {
    const driftYears = year - 2026;
    const lat = 86.5 + driftYears * 0.05;
    const lon = 172 + driftYears * 0.42;
    const magneticOffsetDeg = Math.max(0.3, Math.abs(90 - lat));
    const rotationMatrix = eulerToRotationMatrix(
      (lat - 90) * 0.01,
      THREE_DEG_TO_RAD(lon * 0.08),
      0,
    );

    return {
      year,
      source: 'WMM',
      northPole: { lat, lon },
      magneticOffsetDeg,
      rotationMatrix,
    };
  }

  if (year >= 1590 && year < 1990) {
    const norm = (year - 1590) / (1990 - 1590);
    const lat = 73 + Math.sin(norm * Math.PI * 1.8) * 7.5;
    const lon = -40 + norm * 220;
    const magneticOffsetDeg = Math.max(1.5, Math.abs(90 - lat));
    const rotationMatrix = eulerToRotationMatrix(
      (lat - 90) * 0.009,
      THREE_DEG_TO_RAD(lon * 0.05),
      0,
    );

    return {
      year,
      source: 'GUFM1',
      northPole: { lat, lon },
      magneticOffsetDeg,
      rotationMatrix,
    };
  }

  const reversalChance = enableMagneticReversal ? pseudoRandom01(year * 0.0001) : 0;
  const reversed = reversalChance > 0.74;
  const lat = reversed ? -82 : 82;
  const lon = reversed ? 160 : -20;
  const magneticOffsetDeg = reversed ? 178 : 38;
  const rotationMatrix = eulerToRotationMatrix(
    THREE_DEG_TO_RAD((lat - 90) * 0.6),
    THREE_DEG_TO_RAD(lon * 0.12),
    reversed ? Math.PI : 0,
  );

  return {
    year,
    source: 'PALEOMAG',
    northPole: { lat, lon },
    magneticOffsetDeg,
    rotationMatrix,
  };
}

function THREE_DEG_TO_RAD(value: number): number {
  return (value * Math.PI) / 180;
}
