import type { HazardTelemetryModel } from './hazardModel';

export type ProviderHealthLevel = 'green' | 'amber' | 'red';
export type ProviderSourceMode = 'l1-live' | 'kp-fallback' | 'degraded' | 'offline';

export interface ProviderHealth {
  ok: boolean;
  level?: ProviderHealthLevel;
  sourceMode?: ProviderSourceMode;
  lastUpdated?: string;
  latencyMs?: number;
  details?: string;
}

export interface HazardSummary {
  provider: string;
  generatedAt: string;
  summary: string;
  confidence?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface NeuralOracleProvider {
  id: 'transformers-local' | 'surya' | 'jw-flare' | 'custom';
  displayName: string;
  summarize(snapshot: HazardTelemetryModel, question: string): Promise<HazardSummary>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface SpaceWeatherModelProvider {
  id: 'wsa-enlil' | 'mage' | 'ovation-prime' | 'custom';
  displayName: string;
  horizonHours: number;
  pullForecast(): Promise<{
    generatedAt: string;
    modelRun: string;
    forecastWindowHours: number;
    payload: unknown;
  } | null>;
  healthCheck(): Promise<ProviderHealth>;
}

export type ProviderRegistry = {
  oracle: NeuralOracleProvider[];
  spaceWeather: SpaceWeatherModelProvider[];
};

export const providerRoadmapNotes = {
  surya: 'Use Surya image-derived flare probabilities as a short-term feature in the hazard summary pipeline.',
  jwFlare: 'Use JW-Flare multimodal outputs for high-magnitude flare risk scoring and confidence explanations.',
  mage: 'Use MAGE geospace fields for magnetosphere response overlays and timeline playback.',
  wsaEnlil: 'Use WSA-Enlil CME travel-time and solar-wind arrival for 1-4 day warning rails.',
  ovationPrime: 'Use OVATION Prime 30-90 minute auroral footprint forecasts in consumer-friendly overlays.',
} as const;
