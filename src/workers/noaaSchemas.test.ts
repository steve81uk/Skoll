import { describe, expect, it } from 'vitest';
import { isKPForecastRows, isKPObservedRows, isMagRows, isWindRows } from './noaaSchemas';

describe('noaaSchemas payload drift guards', () => {
  it('accepts valid KP observed payload', () => {
    const payload = [
      { time_tag: '2026-03-05T10:00:00Z', kp_index: 3.33 },
      { time_tag: '2026-03-05T10:01:00Z', kp_index: 3.67 },
    ];
    expect(isKPObservedRows(payload)).toBe(true);
  });

  it('rejects malformed KP observed payload', () => {
    const payload = [{ time_tag: 123, kp_index: '3.3' }];
    expect(isKPObservedRows(payload)).toBe(false);
  });

  it('accepts valid KP forecast payload rows', () => {
    const payload = [
      ['time_tag', 0],
      ['2026-03-05T12:00:00Z', 4],
    ];
    expect(isKPForecastRows(payload)).toBe(true);
  });

  it('rejects malformed KP forecast payload rows', () => {
    const payload = [['2026-03-05T12:00:00Z', '4']];
    expect(isKPForecastRows(payload)).toBe(false);
  });

  it('accepts valid magnetic rows', () => {
    const payload = [
      ['time', 'bx', 'by', 'bt', 'lat', 'bz'],
      ['2026-03-05T10:00:00Z', '2.1', '1.4', '5.8', '0.0', '-4.6'],
    ];
    expect(isMagRows(payload)).toBe(true);
  });

  it('rejects malformed magnetic rows', () => {
    const payload = [['2026-03-05T10:00:00Z', 2.1, 1.4, 5.8, 0.0, -4.6]];
    expect(isMagRows(payload)).toBe(false);
  });

  it('accepts valid wind rows', () => {
    const payload = [
      ['time', 'speed', 'density'],
      ['2026-03-05T10:00:00Z', '620', '8.2'],
    ];
    expect(isWindRows(payload)).toBe(true);
  });

  it('rejects malformed wind rows', () => {
    const payload = [['2026-03-05T10:00:00Z', 620, '8.2']];
    expect(isWindRows(payload)).toBe(false);
  });
});
