import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NOAADONKIState } from './useNOAADONKI';
import type { ProviderHealth, SpaceWeatherModelProvider } from '../services/telemetryProviderContracts';
import {
  createOvationPrimeAdapter,
  createWsaEnlilAdapter,
  type SpaceWeatherAdapterContext,
} from '../services/spaceWeatherAdapters';

const HEALTH_POLL_MS = 60_000;

export interface ProviderHealthSnapshot {
  id: SpaceWeatherModelProvider['id'];
  label: string;
  health: ProviderHealth;
  lastForecastAt: string | null;
}

export interface SpaceWeatherProviderState {
  byId: {
    'ovation-prime': ProviderHealthSnapshot;
    'wsa-enlil': ProviderHealthSnapshot;
  };
  refresh: () => Promise<void>;
}

const INITIAL_HEALTH: ProviderHealth = {
  ok: false,
  level: 'amber',
  sourceMode: 'degraded',
  details: 'Provider status pending first poll.',
};

function toInitialSnapshot(id: 'ovation-prime' | 'wsa-enlil', label: string): ProviderHealthSnapshot {
  return {
    id,
    label,
    health: INITIAL_HEALTH,
    lastForecastAt: null,
  };
}

export function useSpaceWeatherProviders(noaaState: Pick<NOAADONKIState, 'bundle' | 'lastFetch' | 'error'>): SpaceWeatherProviderState {
  const contextRef = useRef<SpaceWeatherAdapterContext>({
    bundle: noaaState.bundle,
    lastFetch: noaaState.lastFetch,
    error: noaaState.error,
  });

  const [byId, setById] = useState<SpaceWeatherProviderState['byId']>({
    'ovation-prime': toInitialSnapshot('ovation-prime', 'OVATION Prime'),
    'wsa-enlil': toInitialSnapshot('wsa-enlil', 'WSA-Enlil'),
  });

  useEffect(() => {
    contextRef.current = {
      bundle: noaaState.bundle,
      lastFetch: noaaState.lastFetch,
      error: noaaState.error,
    };
  }, [noaaState.bundle, noaaState.error, noaaState.lastFetch]);

  const providers = useMemo(
    () => ({
      ovation: createOvationPrimeAdapter(() => contextRef.current),
      enlil: createWsaEnlilAdapter(() => contextRef.current),
    }),
    [],
  );

  const refresh = useCallback(async () => {
    const [ovationHealth, enlilHealth, ovationForecast, enlilForecast] = await Promise.all([
      providers.ovation.healthCheck(),
      providers.enlil.healthCheck(),
      providers.ovation.pullForecast(),
      providers.enlil.pullForecast(),
    ]);

    setById({
      'ovation-prime': {
        id: 'ovation-prime',
        label: 'OVATION Prime',
        health: ovationHealth,
        lastForecastAt: ovationForecast?.generatedAt ?? null,
      },
      'wsa-enlil': {
        id: 'wsa-enlil',
        label: 'WSA-Enlil',
        health: enlilHealth,
        lastForecastAt: enlilForecast?.generatedAt ?? null,
      },
    });
  }, [providers.enlil, providers.ovation]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, HEALTH_POLL_MS);

    return () => window.clearInterval(interval);
  }, [refresh]);

  return { byId, refresh };
}
