import { describe, expect, it } from 'vitest';
import { officeDayRange, officeTime } from '../src/utils/time';

describe('office timezone helpers (Asia/Kolkata, UTC+5:30)', () => {
  it('maps an office day to its UTC range', () => {
    const { start, end } = officeDayRange('2026-11-27');
    expect(start.toISOString()).toBe('2026-11-26T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-27T18:30:00.000Z');
  });

  it('handles month and year boundaries', () => {
    const { end } = officeDayRange('2026-12-31');
    expect(end.toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });

  it('converts an office wall-clock time to UTC', () => {
    expect(officeTime('2026-11-27', '10:00').toISOString()).toBe('2026-11-27T04:30:00.000Z');
  });
});
