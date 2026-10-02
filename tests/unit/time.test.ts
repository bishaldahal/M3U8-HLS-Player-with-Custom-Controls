import { describe, expect, it } from 'vitest';
import { formatProgress, formatRelativeTime, formatTime } from '../../src/lib/time';

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [-5, '0:00'],
    [Number.NaN, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [3600, '1:00:00'],
    [3725.9, '1:02:05'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });
});

describe('formatRelativeTime', () => {
  const now = 1_700_000_000_000;

  it.each([
    [now - 10_000, 'Just now'],
    [now - 5 * 60_000, '5m ago'],
    [now - 3 * 3_600_000, '3h ago'],
    [now - 2 * 86_400_000, '2d ago'],
  ])('formats %s', (ts, expected) => {
    expect(formatRelativeTime(ts, now)).toBe(expected);
  });

  it('falls back to a date after a week', () => {
    const ts = now - 10 * 86_400_000;
    expect(formatRelativeTime(ts, now)).toBe(new Date(ts).toLocaleDateString());
  });
});

describe('formatProgress', () => {
  it('shows position / duration for VOD', () => {
    expect(formatProgress(30, 90)).toBe('0:30 / 1:30');
  });

  it('marks live streams', () => {
    expect(formatProgress(30, 0)).toBe('0:30 (Live)');
  });
});
