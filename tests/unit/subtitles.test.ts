import { describe, expect, it } from 'vitest';
import { buildCueCss, getEdgeStyleCSS, hexToRgba } from '../../src/lib/subtitles';

describe('hexToRgba', () => {
  it('converts 6-digit hex', () => {
    expect(hexToRgba('#ff8000', 50)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('expands 3-digit hex', () => {
    expect(hexToRgba('#fff', 100)).toBe('rgba(255, 255, 255, 1)');
  });

  it('falls back to black for invalid input', () => {
    expect(hexToRgba('red', 80)).toBe('rgba(0, 0, 0, 0.8)');
  });
});

describe('getEdgeStyleCSS', () => {
  it('returns none for unknown styles', () => {
    expect(getEdgeStyleCSS('sparkly')).toBe('none');
  });

  it('returns a shadow for outline', () => {
    expect(getEdgeStyleCSS('outline')).toContain('1px 1px 0 #000');
  });
});

describe('buildCueCss', () => {
  it('targets ::cue with the configured styles', () => {
    const css = buildCueCss({
      fontSize: 150,
      fontColor: '#ffff00',
      backgroundColor: '#000000',
      backgroundOpacity: 50,
      fontFamily: 'serif',
      edgeStyle: 'none',
    });
    expect(css).toContain('::cue');
    expect(css).toContain('#ffff00');
    expect(css).toContain('rgba(0, 0, 0, 0.5)');
    expect(css).toContain('serif');
  });

  it('uses defaults for missing fields', () => {
    expect(buildCueCss({})).toContain('#ffffff');
  });
});
