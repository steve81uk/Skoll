export interface AurorEyeExifLike {
  DateTimeOriginal?: string;
  DateTimeDigitized?: string;
  CreateDate?: string;
  SubSecTimeOriginal?: string | number;
  GPSLatitude?: string | number;
  GPSLongitude?: string | number;
  GPSLatitudeRef?: 'N' | 'S' | string;
  GPSLongitudeRef?: 'E' | 'W' | string;
  GPSAltitude?: string | number;
}

export interface AurorEyeFrameInput {
  id: string;
  sourceUrl?: string;
  exif: AurorEyeExifLike;
  capturedAtIso?: string;
}

export interface AurorEyeFrame {
  id: string;
  sourceUrl?: string;
  timestamp: number;
  lat: number;
  lon: number;
  altitudeM?: number;
}

export interface TelemetryTimelinePoint {
  timestamp: number;
  kpIndex?: number;
  bzGsm?: number;
  solarWindSpeed?: number;
}

export interface SyncedAurorEyeFrame extends AurorEyeFrame {
  deltaMs: number;
  aligned: boolean;
  telemetry: TelemetryTimelinePoint | null;
}

function parseExifDate(raw?: string): number | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  const ms = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function applySubSecond(ms: number, raw?: string | number): number {
  if (raw == null) return ms;
  const value = String(raw).trim();
  if (!value) return ms;
  const digits = value.replace(/[^0-9]/g, '').slice(0, 3);
  if (!digits) return ms;
  return ms + Number(digits.padEnd(3, '0'));
}

function parseCoordinate(raw?: string | number): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  const text = String(raw).trim();
  if (!text) return null;
  const decimal = Number.parseFloat(text);
  if (Number.isFinite(decimal) && /^-?\d+(\.\d+)?$/.test(text)) {
    return decimal;
  }

  const parts = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (parts.length === 0) return null;
  const deg = parts[0] ?? 0;
  const min = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  const sign = deg < 0 ? -1 : 1;
  const abs = Math.abs(deg) + min / 60 + sec / 3600;
  return abs * sign;
}

function applyHemisphere(value: number, ref?: string, positive?: string, negative?: string): number {
  if (!ref) return value;
  const token = ref.trim().toUpperCase();
  if (positive && token === positive) return Math.abs(value);
  if (negative && token === negative) return -Math.abs(value);
  return value;
}

export function normalizeAurorEyeFrame(input: AurorEyeFrameInput): AurorEyeFrame | null {
  const timestampBase =
    parseExifDate(input.exif.DateTimeOriginal)
    ?? parseExifDate(input.exif.DateTimeDigitized)
    ?? parseExifDate(input.exif.CreateDate)
    ?? (input.capturedAtIso ? Date.parse(input.capturedAtIso) : null);

  if (timestampBase == null || !Number.isFinite(timestampBase)) return null;

  const timestamp = applySubSecond(timestampBase, input.exif.SubSecTimeOriginal);

  const latRaw = parseCoordinate(input.exif.GPSLatitude);
  const lonRaw = parseCoordinate(input.exif.GPSLongitude);
  if (latRaw == null || lonRaw == null) return null;

  const lat = applyHemisphere(latRaw, input.exif.GPSLatitudeRef, 'N', 'S');
  const lon = applyHemisphere(lonRaw, input.exif.GPSLongitudeRef, 'E', 'W');

  const altitudeParsed = input.exif.GPSAltitude == null ? Number.NaN : Number.parseFloat(String(input.exif.GPSAltitude));
  const altitudeM = Number.isFinite(altitudeParsed) ? altitudeParsed : undefined;

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return {
    id: input.id,
    sourceUrl: input.sourceUrl,
    timestamp,
    lat,
    lon,
    altitudeM,
  };
}

function nearestTelemetry(sampleAt: number, timeline: TelemetryTimelinePoint[]): { point: TelemetryTimelinePoint | null; deltaMs: number } {
  if (timeline.length === 0) return { point: null, deltaMs: Number.POSITIVE_INFINITY };

  let nearest: TelemetryTimelinePoint | null = null;
  let best = Number.POSITIVE_INFINITY;

  for (const point of timeline) {
    const delta = Math.abs(point.timestamp - sampleAt);
    if (delta < best) {
      best = delta;
      nearest = point;
    }
  }

  return { point: nearest, deltaMs: best };
}

export function alignAurorEyeFramesToTelemetry(
  frames: AurorEyeFrame[],
  timeline: TelemetryTimelinePoint[],
  maxSkewMs = 1_500,
): SyncedAurorEyeFrame[] {
  if (frames.length === 0) return [];

  const sortedTimeline = [...timeline]
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  return frames
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((frame) => {
      const { point, deltaMs } = nearestTelemetry(frame.timestamp, sortedTimeline);
      const aligned = Number.isFinite(deltaMs) && deltaMs <= maxSkewMs;
      return {
        ...frame,
        telemetry: point,
        deltaMs,
        aligned,
      };
    });
}
