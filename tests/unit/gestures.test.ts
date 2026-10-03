import { describe, expect, it } from 'vitest';
import { SEEK_STEP_SECONDS, nextSeekTotal, tapZone } from '../../src/pages/player/gestures';

describe('tapZone', () => {
  it('splits the player into thirds', () => {
    expect(tapZone(10, 300)).toBe('left');
    expect(tapZone(150, 300)).toBe('center');
    expect(tapZone(290, 300)).toBe('right');
  });

  it('treats the exact third boundaries as center', () => {
    expect(tapZone(100, 300)).toBe('center');
    expect(tapZone(200, 300)).toBe('center');
  });
});

describe('nextSeekTotal', () => {
  it('starts at one step', () => {
    expect(nextSeekTotal(null, 'right')).toBe(SEEK_STEP_SECONDS);
  });

  it('adds up repeated taps on the same side', () => {
    expect(nextSeekTotal({ side: 'left', total: 20 }, 'left')).toBe(30);
  });

  it('restarts when switching sides', () => {
    expect(nextSeekTotal({ side: 'left', total: 20 }, 'right')).toBe(SEEK_STEP_SECONDS);
  });
});
