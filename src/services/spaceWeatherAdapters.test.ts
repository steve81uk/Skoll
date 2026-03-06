import { describe, expect, it } from 'vitest';
import { evaluateOvationHealth, evaluateWsaEnlilHealth, type SpaceWeatherAdapterContext } from './spaceWeatherAdapters';

function makeContext(overrides: Partial<SpaceWeatherAdapterContext> = {}): SpaceWeatherAdapterContext {
  return {
    bundle: {
      timestamp: new Date().toISOString(),
      latestKp: 4.5,
      speed: 520,
      density: 8,
      bt: 6,
      bzGsm: -5,
      kpSeries: [],
      cmeEvents: [
        {
          activityID: 'TEST-CME',
          startTime: new Date().toISOString(),
          speed: 1100,
          halfAngle: 35,
          type: 'R',
          note: 'stub',
          impactProbability: 72,
          arrivalEstimate: new Date(Date.now() + 36 * 3600_000).toISOString(),
        },
      ],
      auroraActive: true,
    },
    lastFetch: new Date(),
    error: null,
    ...overrides,
  };
}

describe('spaceWeatherAdapters health semantics', () => {
  it('marks OVATION green when L1 telemetry is present', () => {
    const health = evaluateOvationHealth(makeContext());
    expect(health.level).toBe('green');
    expect(health.sourceMode).toBe('l1-live');
    expect(health.ok).toBe(true);
  });

  it('marks OVATION amber with kp-fallback when L1 is missing', () => {
    const context = makeContext({
      bundle: {
        ...makeContext().bundle!,
        speed: Number.NaN,
      },
    });
    const health = evaluateOvationHealth(context);
    expect(health.level).toBe('amber');
    expect(health.sourceMode).toBe('kp-fallback');
    expect(health.ok).toBe(true);
  });

  it('marks WSA-Enlil amber if L1 exists but CME cone inputs are missing', () => {
    const context = makeContext({
      bundle: {
        ...makeContext().bundle!,
        cmeEvents: [],
      },
    });
    const health = evaluateWsaEnlilHealth(context);
    expect(health.level).toBe('amber');
    expect(health.sourceMode).toBe('degraded');
    expect(health.ok).toBe(true);
  });
});
