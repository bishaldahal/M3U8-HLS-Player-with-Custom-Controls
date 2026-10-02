export type StreamType = 'hls' | 'dash';

export const TITLE_PARAM = 'extTitle';

export function detectStreamType(url: string | null | undefined): StreamType | null {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) return 'hls';
    if (pathname.endsWith('.mpd')) return 'dash';
    return null;
  } catch {
    return null;
  }
}

/** Splits the optional `extTitle` query param off a stream URL. */
export function parseStreamUrl(url: string): { streamUrl: string; title: string | null } {
  const parsed = new URL(url);
  const title = parsed.searchParams.get(TITLE_PARAM);
  parsed.searchParams.delete(TITLE_PARAM);
  return { streamUrl: parsed.href, title };
}

/** Stable key for history lookups (ignores `extTitle`). */
export function getUrlKey(url: string): string {
  try {
    return parseStreamUrl(url).streamUrl;
  } catch {
    return url;
  }
}

export function safeUrlParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
