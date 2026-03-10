import type { TriggeredAlert } from './alertEngine';

export interface SocialRelayPayload {
  source: 'skoll-track';
  timestamp: string;
  alerts: Array<Pick<TriggeredAlert, 'id' | 'severity' | 'message' | 'ts' | 'value'>>;
}

export async function postAlertsToRelay(alerts: TriggeredAlert[]): Promise<boolean> {
  const relayUrl = import.meta.env.VITE_ALERT_RELAY_URL || '/api/alerts/social-relay';
  if (alerts.length === 0) {
    return false;
  }

  const payload: SocialRelayPayload = {
    source: 'skoll-track',
    timestamp: new Date().toISOString(),
    alerts: alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      message: a.message,
      ts: a.ts,
      value: a.value,
    })),
  };

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}
