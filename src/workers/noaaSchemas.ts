type KPObservedRow = { time_tag: string; kp_index: number };
type KPForecastRow = [string, number];
type MagRow = [string, string, string, string, string, string];
type WindRow = [string, string, string];

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isKPObservedRows(value: unknown): value is KPObservedRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (typeof row !== 'object' || row === null) return false;
    const candidate = row as Record<string, unknown>;
    return isString(candidate.time_tag) && isNumber(candidate.kp_index);
  });
}

export function isKPForecastRows(value: unknown): value is KPForecastRow[] {
  return (
    Array.isArray(value) &&
    value.every((row) =>
      Array.isArray(row) &&
      row.length >= 2 &&
      isString(row[0]) &&
      isNumber(row[1]),
    )
  );
}

export function isMagRows(value: unknown): value is MagRow[] {
  return (
    Array.isArray(value) &&
    value.every((row) =>
      Array.isArray(row) &&
      row.length >= 6 &&
      row.every((cell) => isString(cell)),
    )
  );
}

export function isWindRows(value: unknown): value is WindRow[] {
  return (
    Array.isArray(value) &&
    value.every((row) =>
      Array.isArray(row) &&
      row.length >= 3 &&
      row.every((cell) => isString(cell)),
    )
  );
}
