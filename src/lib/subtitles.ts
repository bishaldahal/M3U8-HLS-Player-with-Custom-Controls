import type { SubtitleSettings } from './settings';

export type EdgeStyle = 'none' | 'shadow' | 'raised' | 'depressed' | 'outline';

const EDGE_STYLES: Record<EdgeStyle, string> = {
  shadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
  raised: '1px 1px 0 #000, 2px 2px 0 #333',
  depressed: '-1px -1px 0 #000, -2px -2px 0 #333',
  outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
  none: 'none',
};

export function hexToRgba(hex: string, opacity: number): string {
  let value = hex;
  if (value.length === 4) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  if (!/^#[0-9A-F]{6}$/i.test(value)) {
    value = '#000000';
  }
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

export function getEdgeStyleCSS(edgeStyle: string): string {
  return EDGE_STYLES[edgeStyle as EdgeStyle] ?? EDGE_STYLES.none;
}

export function buildCueCss(settings: Partial<SubtitleSettings>): string {
  const {
    fontSize = 100,
    fontColor = '#ffffff',
    backgroundColor = '#000000',
    backgroundOpacity = 80,
    fontFamily = 'sans-serif',
    edgeStyle = 'none',
  } = settings;

  const em = fontSize / 100;
  return `
    video::cue {
      font-size: ${em}em;
      color: ${fontColor};
      background-color: ${hexToRgba(backgroundColor, backgroundOpacity)};
      font-family: ${fontFamily};
      text-shadow: ${getEdgeStyleCSS(edgeStyle)};
      outline: none;
      -webkit-font-smoothing: antialiased;
    }
    video::-webkit-media-text-track-display {
      font-size: ${em}em !important;
    }
    video::-webkit-media-text-track-container {
      font-size: ${fontSize}% !important;
    }
  `;
}
