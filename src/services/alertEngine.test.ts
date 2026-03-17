import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, evaluateAlerts, type AlertRule, type AlertSample } from './alertEngine';

// Calm baseline: all values safely below every DEFAULT_RULES threshold.
const CALM: AlertSample = {
  kp: 1.5,
  bz: 2,          // positive (northward) — no coupling
  solarWind: 380,
  xrayFlux: 1e-8,
  co2: 410,        // below co2-record threshold of 425
  cmeCount: 0,
};

// Helpers — unique rule IDs per test prevent cooldown state leaking between cases.
const kpRule = (id: string, threshold: number, severity: AlertRule['severity']): AlertRule => ({
  id,
  metric: 'kp',
  condition: '>',
  threshold,
  severity,
  message: `Kp > ${threshold} test rule`,
  cooldownMinutes: 0,   // no cooldown → always fires when threshold is crossed
});

describe('evaluateAlerts — storm severity tiers', () => {

  it('raises a WARNING for G1 geomagnetic storm conditions (Kp > 5)', () => {
    const rules = [kpRule('t1-g1-warning', 5, 'warning')];
    const sample: AlertSample = { ...CALM, kp: 5.5 };
    const alerts = evaluateAlerts(sample, rules);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].id).toBe('t1-g1-warning');
  });

  it('raises a CRITICAL alert for G3+ severe storm (Kp > 7), capturing the triggering value', () => {
    const rules = [kpRule('t1-g3-critical', 7, 'critical')];
    // Extreme storm scenario: Kp 8, strongly southward Bz, fast solar wind.
    const sample: AlertSample = { ...CALM, kp: 8.0, bz: -25, solarWind: 900, cmeCount: 1 };
    const alerts = evaluateAlerts(sample, rules);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    // The alert must record the exact Kp value so the ops UI can display it.
    expect(alerts[0].value).toBe(8.0);
    expect(alerts[0].message).toContain('Kp > 7');
  });

  it('fires no alerts during calm space weather (all metrics below every threshold)', () => {
    // Uses DEFAULT_RULES to prove the full production rule set stays silent on a quiet day.
    const alerts = evaluateAlerts(CALM, DEFAULT_RULES);
    expect(alerts).toHaveLength(0);
  });

  it('suppresses a repeated alert within the cooldown window (deduplication)', () => {
    const rules: AlertRule[] = [{
      id: 't1-cooldown-dedupe',
      metric: 'kp',
      condition: '>',
      threshold: 5,
      severity: 'warning',
      message: 'Cooldown deduplication test',
      cooldownMinutes: 60,   // one-hour suppression window
    }];
    const stormSample: AlertSample = { ...CALM, kp: 6.0 };

    const firstBatch  = evaluateAlerts(stormSample, rules);
    const secondBatch = evaluateAlerts(stormSample, rules); // same conditions, milliseconds later

    // First call fires — storm is newly detected.
    expect(firstBatch).toHaveLength(1);
    // Second call is silenced — cooldown prevents alert fatigue for the ops team.
    expect(secondBatch).toHaveLength(0);
  });

});
