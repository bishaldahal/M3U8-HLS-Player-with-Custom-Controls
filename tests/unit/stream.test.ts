import { describe, expect, it } from 'vitest';
import { detectStreamType, getUrlKey, parseStreamUrl, safeUrlParse } from '../../src/lib/stream';

describe('detectStreamType', () => {
  it.each([
    ['https://cdn.example.com/live/index.m3u8', 'hls'],
    ['https://cdn.example.com/live/INDEX.M3U8', 'hls'],
    ['https://cdn.example.com/live/index.m3u8?token=abc', 'hls'],
    ['https://cdn.example.com/vod/manifest.mpd', 'dash'],
    ['https://cdn.example.com/vod/manifest.mpd#t=10', 'dash'],
  ])('detects %s as %s', (url, expected) => {
    expect(detectStreamType(url)).toBe(expected);
  });

  it.each([
    'https://example.com/video.mp4',
    'https://example.com/?file=index.m3u8',
    'https://example.com/index.m3u8/page',
    'not a url',
    '',
    null,
    undefined,
  ])('returns null for %s', (url) => {
    expect(detectStreamType(url)).toBeNull();
  });
});

describe('parseStreamUrl', () => {
  it('extracts and strips the extTitle param', () => {
    const { streamUrl, title } = parseStreamUrl(
      'https://cdn.example.com/a.m3u8?token=1&extTitle=My%20Show',
    );
    expect(title).toBe('My Show');
    expect(streamUrl).toBe('https://cdn.example.com/a.m3u8?token=1');
  });

  it('returns a null title when absent', () => {
    expect(parseStreamUrl('https://cdn.example.com/a.m3u8').title).toBeNull();
  });

  it('throws for invalid URLs', () => {
    expect(() => parseStreamUrl('nope')).toThrow();
  });
});

describe('getUrlKey', () => {
  it('ignores extTitle so renamed links share history', () => {
    expect(getUrlKey('https://x.test/a.m3u8?extTitle=A')).toBe(getUrlKey('https://x.test/a.m3u8'));
  });

  it('falls back to the raw input for invalid URLs', () => {
    expect(getUrlKey('nope')).toBe('nope');
  });
});

describe('safeUrlParse', () => {
  it('returns null instead of throwing', () => {
    expect(safeUrlParse('::')).toBeNull();
    expect(safeUrlParse('https://x.test')?.host).toBe('x.test');
  });
});
