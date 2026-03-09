export interface AlertRule {
  id: string;
  metric: 'kp' | 'bz' | 'solarWind' | 'xrayFlux' | 'co2' | 'cmeCount';
  condition: '>' | '<' | '=';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cooldownMinutes: number;
}

export interface AlertSample {
  kp: number;
  bz: number;
  solarWind: number;
  xrayFlux: number;
  co2: number;
  cmeCount: number;
}

export interface TriggeredAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  ts: number;
  value: number;
}

export const DEFAULT_RULES: AlertRule[] = [
  { id: 'g1-storm', metric: 'kp', condition: '>', threshold: 5, severity: 'warning', message: 'G1 geomagnetic storm in progress', cooldownMinutes: 120 },
  { id: 'g3-storm', metric: 'kp', condition: '>', threshold: 7, severity: 'critical', message: 'G3+ severe geomagnetic storm', cooldownMinutes: 60 },
  { id: 'bz-south', metric: 'bz', condition: '<', threshold: -10, severity: 'warning', message: 'IMF Bz strongly southward', cooldownMinutes: 60 },
  { id: 'cme-detected', metric: 'cmeCount', condition: '>', threshold: 0, severity: 'info', message: 'Earth-directed CME detected', cooldownMinutes: 360 },
  { id: 'co2-record', metric: 'co2', condition: '>', threshold: 425, severity: 'info', message: 'CO2 concentration above 425 ppm', cooldownMinutes: 1440 }
];

const lastTriggered = new Map<string, number>();

function compare(value: number, condition: AlertRule['condition'], threshold: number) {
  if (condition === '>') return value > threshold;
  if (condition === '<') return value < threshold;
  return value === threshold;
}

export function evaluateAlerts(sample: AlertSample, rules: AlertRule[] = DEFAULT_RULES): TriggeredAlert[] {
  const now = Date.now();
  const output: TriggeredAlert[] = [];

  for (const rule of rules) {
    const value = sample[rule.metric];
    if (!compare(value, rule.condition, rule.threshold)) {
      continue;
    }

    const last = lastTriggered.get(rule.id) ?? 0;
    const elapsed = (now - last) / 60000;
    if (elapsed < rule.cooldownMinutes) {
      continue;
    }

    lastTriggered.set(rule.id, now);
    output.push({
      id: rule.id,
      severity: rule.severity,
      message: rule.message,
      ts: now,
      value,
    });
  }

  return output;
}
