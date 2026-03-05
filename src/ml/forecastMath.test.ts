import { describe, expect, it } from 'vitest';
import { computeKesslerCascade, estimateCmeArrivalIso } from './forecastMath';

describe('estimateCmeArrivalIso', () => {
  it('computes deterministic arrival time for valid input', () => {
    const start = '2026-03-01T00:00:00.000Z';
    const iso = estimateCmeArrivalIso(start, 1000);
    expect(iso).toBe('2026-03-02T17:33:20.000Z');
  });

  it('returns null for invalid inputs', () => {
    expect(estimateCmeArrivalIso('', 1000)).toBeNull();
    expect(estimateCmeArrivalIso('bad-date', 1000)).toBeNull();
    expect(estimateCmeArrivalIso('2026-03-01T00:00:00.000Z', 0)).toBeNull();
  });
});

describe('computeKesslerCascade', () => {
  it('returns nominal risk for low KP / low wind', () => {
    const result = computeKesslerCascade([1.5, 2.0, 2.2, 2.1], [400, 420, 430, 410]);
    expect(result.riskBand).toBe('NOMINAL');
    expect(result.next7dProbability).toBeLessThan(0.3);
  });

  it('returns elevated/critical risk for storm-like conditions', () => {
    const result = computeKesslerCascade([5.5, 6.2, 7.1, 6.8, 6.5], [780, 820, 850, 810, 790]);
    expect(['ELEVATED', 'CRITICAL']).toContain(result.riskBand);
    expect(result.next24hProbability).toBeGreaterThan(0.25);
    expect(result.next72hProbability).toBeGreaterThanOrEqual(result.next24hProbability);
    expect(result.next7dProbability).toBeGreaterThanOrEqual(result.next72hProbability);
  });

  it('bounds probabilities to contract limits', () => {
    const result = computeKesslerCascade([9, 9, 9, 9], [2000, 2000, 2000, 2000]);
    expect(result.next24hProbability).toBeLessThanOrEqual(0.95);
    expect(result.next72hProbability).toBeLessThanOrEqual(0.98);
    expect(result.next7dProbability).toBeLessThanOrEqual(0.99);
  });
});
