import { describe, expect, it } from 'vitest';
import { nextPlaybackRate } from '../../src/lib/shortcuts';
import {
  buildNetworkFailureMessage,
  createPlaybackErrorTracker,
  getMediaErrorMessage,
  isRecoverableEngineError,
  normalizeErrorMessage,
  truncateText,
} from '../../src/pages/player/errors';
import { getDrmErrorText, isLikelyDrmError, sanitizeDrmConfig } from '../../src/pages/player/drm';
import { rewriteImports } from '../../scripts/vendor.config';

describe('nextPlaybackRate', () => {
  it.each([
    [1, '>', 1.1],
    [1, '<', 0.9],
    [1, '+', 1.5],
    [1, '-', 0.5],
    [0.1, '+', 0.5],
    [0.1, '<', 0.1],
    [9.8, '+', 10],
  ])('%s with %s → %s', (rate, key, expected) => {
    expect(nextPlaybackRate(rate, key)).toBe(expected);
  });
});

describe('error helpers', () => {
  it('truncates long text', () => {
    expect(truncateText('abcdef', 3)).toBe('abc…');
    expect(truncateText('abc', 3)).toBe('abc');
  });

  it('maps MediaError codes', () => {
    expect(getMediaErrorMessage({ code: 4 } as MediaError)).toMatch(/not supported/);
    expect(getMediaErrorMessage(null)).toBe('Unknown media error');
  });

  it('normalizes hls.js-style payloads', () => {
    expect(
      normalizeErrorMessage({
        type: 'networkError',
        details: 'manifestLoadError',
        response: { code: 403 },
      }),
    ).toBe('networkError: manifestLoadError | HTTP 403');
    expect(normalizeErrorMessage('plain')).toBe('plain');
    expect(normalizeErrorMessage(null)).toBe('Unknown playback error');
  });

  it('only reports network failures for the stream host', () => {
    const toFailure = buildNetworkFailureMessage('HLS', 'cdn.test');
    const base = { status: 404, statusText: 'Not Found', responseText: '' };
    expect(toFailure({ ...base, url: 'https://other.test/x.ts' })).toBeNull();
    expect(toFailure({ ...base, url: 'https://cdn.test/x.ts' })?.message).toContain('HTTP 404');
  });

  it('tracks concrete vs. generic errors', () => {
    const shown: string[] = [];
    const tracker = createPlaybackErrorTracker((title) => shown.push(title));
    tracker.show('Generic', 'timeout', false);
    expect(tracker.hasConcreteError()).toBe(false);
    tracker.show('Real', 'HTTP 403');
    expect(tracker.getConcreteError()).toEqual({ title: 'Real', message: 'HTTP 403' });
    expect(shown).toEqual(['Generic', 'Real']);
  });

  it('records errors without showing them', () => {
    const shown: string[] = [];
    const tracker = createPlaybackErrorTracker((title) => shown.push(title));
    tracker.record('Network', 'HTTP 404');
    expect(shown).toEqual([]);
    expect(tracker.getConcreteError()).toEqual({ title: 'Network', message: 'HTTP 404' });
  });

  it('treats non-fatal engine errors as recoverable', () => {
    expect(isRecoverableEngineError({ fatal: false, details: 'bufferStalledError' })).toBe(true);
    expect(isRecoverableEngineError({ detail: {}, data: { fatal: false } })).toBe(true);
    expect(isRecoverableEngineError({ fatal: true })).toBe(false);
    expect(isRecoverableEngineError({ error: { message: 'dash failure' } })).toBe(false);
  });
});

describe('DRM helpers', () => {
  it('detects DRM-related errors', () => {
    expect(isLikelyDrmError({ error: { message: 'Widevine license request failed' } })).toBe(true);
    expect(isLikelyDrmError({ message: 'segment 404' })).toBe(false);
  });

  it('does not treat codec or decoder failures as DRM errors', () => {
    expect(
      isLikelyDrmError({
        error: { code: 0, message: 'audio decoder: kUnsupportedConfig' },
      }),
    ).toBe(false);
    expect(isLikelyDrmError({ message: 'MEDIA_ERR_SRC_NOT_SUPPORTED in media element' })).toBe(
      false,
    );
  });

  it('detects dash.js protection error codes', () => {
    expect(isLikelyDrmError({ error: { code: 111, message: 'x' } })).toBe(true);
    expect(isLikelyDrmError({ error: { code: 27, message: 'x' } })).toBe(false);
  });

  it('serializes error payloads to lowercase text', () => {
    expect(getDrmErrorText({ message: 'EME Failure' })).toContain('eme failure');
  });

  it('sanitizes stored configs', () => {
    expect(sanitizeDrmConfig(null)).toBeNull();
    expect(sanitizeDrmConfig({ widevineLicenseUrl: 1, headers: ['x'] })).toEqual({
      widevineLicenseUrl: '',
      headers: null,
      robustness: undefined,
    });
  });
});

describe('rewriteImports', () => {
  it('rewrites jsDelivr and bare specifiers to /vendor', () => {
    const src =
      'import{a}from"/npm/custom-media-element@1.4.5/+esm";import b from"hls.js";const d=import("/npm/dashjs@5.1.1/+esm")';
    expect(rewriteImports(src)).toBe(
      'import{a}from"/vendor/custom-media-element.js";import b from"/vendor/hls.js";const d=import("/vendor/dashjs.js")',
    );
  });

  it('does not rewrite similarly-named packages', () => {
    const src = 'import x from"/npm/hls-video-element@1.5.10/+esm"';
    expect(rewriteImports(src)).toBe('import x from"/vendor/hls-video-element.js"');
  });
});
