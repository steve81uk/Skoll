import { useMemo } from 'react';
import {
  alignAurorEyeFramesToTelemetry,
  normalizeAurorEyeFrame,
  type AurorEyeFrameInput,
  type TelemetryTimelinePoint,
} from '../services/aurorEyeSync';

export interface UseAurorEyeTimelineSyncOptions {
  frames: AurorEyeFrameInput[];
  telemetryTimeline: TelemetryTimelinePoint[];
  maxSkewMs?: number;
}

export function useAurorEyeTimelineSync(options: UseAurorEyeTimelineSyncOptions) {
  const maxSkewMs = options.maxSkewMs ?? 1_500;

  const normalizedFrames = useMemo(
    () => options.frames
      .map((frame) => normalizeAurorEyeFrame(frame))
      .filter((frame): frame is NonNullable<typeof frame> => frame != null),
    [options.frames],
  );

  const syncedFrames = useMemo(
    () => alignAurorEyeFramesToTelemetry(normalizedFrames, options.telemetryTimeline, maxSkewMs),
    [maxSkewMs, normalizedFrames, options.telemetryTimeline],
  );

  const summary = useMemo(() => {
    const total = syncedFrames.length;
    const alignedCount = syncedFrames.filter((frame) => frame.aligned).length;
    const alignmentRatio = total > 0 ? alignedCount / total : 0;
    const meanSkewMs = total > 0
      ? syncedFrames.reduce((sum, frame) => sum + (Number.isFinite(frame.deltaMs) ? frame.deltaMs : 0), 0) / total
      : null;

    return {
      total,
      alignedCount,
      alignmentRatio,
      meanSkewMs,
      maxSkewMs,
      ready: total > 0,
    };
  }, [maxSkewMs, syncedFrames]);

  return {
    normalizedFrames,
    syncedFrames,
    summary,
  };
}
