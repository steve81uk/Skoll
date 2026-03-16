/**
 * SKÖLL-TRACK — ANOMALY DETECTION HOOK
 *
 * Monitors real-time telemetry streams for statistically unusual events using
 * a sliding Z-score window. Designed to accept LSTM forecast residuals and raw
 * sensor values and emit high-confidence anomaly signals to the HUD.
 *
 * Architecture (planned):
 *   - Isolation Forest or Z-score sliding window on LSTM residuals
 *   - Multi-variate input: Kp, Bz, solar wind speed, density, flare class
 *   - Runs in a Web Worker to keep main thread free
 *   - Emits `AnomalyEvent` objects with severity, confidence, and affected metrics
 *
 * Status: SCAFFOLD — hook signature and types defined; detection logic pending.
 */

import { useState } from 'react';

export type AnomalySeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface AnomalyEvent {
  /** ISO timestamp when the anomaly was first detected */
  detectedAt: string;
  /** Which telemetry channel triggered the anomaly */
  channel: 'kp' | 'bz' | 'solarWindSpeed' | 'density' | 'flareClass' | 'totpot';
  /** Z-score magnitude of the deviation */
  zScore: number;
  /** Normalised confidence 0–1 */
  confidence: number;
  severity: AnomalySeverity;
  /** Human-readable summary */
  message: string;
}

export interface AnomalyDetectionState {
  /** Active anomalies detected in the current window */
  anomalies: AnomalyEvent[];
  /** Whether the detection engine is running */
  active: boolean;
  /** Rolling window size (samples) used for baseline statistics */
  windowSize: number;
  /** Timestamp of the last check cycle */
  lastCheckedAt: Date | null;
}

/**
 * useAnomalyDetection — statistical outlier detection over live telemetry.
 *
 * @param windowSize  Number of samples to maintain for rolling baseline (default 60)
 * @returns           Anomaly detection state and control handles
 *
 * TODO: Wire to LSTM residuals from useLSTMWorker
 * TODO: Add Isolation Forest worker backend
 * TODO: Emit anomalies to the global alert engine
 */
export function useAnomalyDetection(_windowSize = 60): AnomalyDetectionState & {
  clearAnomalies: () => void;
} {
  const [anomalies] = useState<AnomalyEvent[]>([]);
  const [lastCheckedAt] = useState<Date | null>(null);

  // TODO: implement sliding-window Z-score over incoming telemetry snapshots
  // TODO: spawn AnomalyWorker and subscribe to its output stream

  return {
    anomalies,
    active: false,         // becomes true once worker is initialised
    windowSize: _windowSize,
    lastCheckedAt,
    clearAnomalies: () => {
      // TODO: dispatch CLEAR command to worker
    },
  };
}
