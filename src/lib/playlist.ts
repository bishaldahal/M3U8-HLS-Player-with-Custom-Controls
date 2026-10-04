export type MediaKind = 'audio' | 'video' | 'combined' | 'unknown';
export type RenditionKind = Exclude<MediaKind, 'unknown'> | 'subtitles';

/** A single-track playlist listed in an HLS master playlist. */
export interface Rendition {
  /** Fully resolved playlist URL; query parameters may select a language or quality. */
  key: string;
  kind: RenditionKind;
  label: string;
  height?: number;
}

export type PlaylistInfo =
  { kind: 'master'; renditions: Rendition[] } | { kind: 'media'; mediaKind: MediaKind };

const ATTRIBUTE = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
const AUDIO_CODEC = /^(?:mp4a|ac-3|ec-3|ac-4|opus|flac|alac|mp3)\b/i;
const VIDEO_CODEC = /^(?:avc1|avc3|hev1|hvc1|vp0?9|av01|theora)\b/i;
const AUDIO_SEGMENT = /\.(?:aac|ac3|ec3|mp3|m4a|opus|ogg)(?:$|[?#])/i;
const VIDEO_SEGMENT = /\.(?:m4v|h26[45])(?:$|[?#])/i;
const KIND_ORDER: Record<RenditionKind, number> = {
  combined: 0,
  video: 1,
  audio: 2,
  subtitles: 3,
};

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [, name, value] of line.slice(line.indexOf(':') + 1).matchAll(ATTRIBUTE)) {
    attrs[name!] = value!.replace(/^"|"$/g, '');
  }
  return attrs;
}

function variantRendition(
  key: string,
  attrs: Record<string, string>,
  audioGroups: Set<string>,
): Rendition {
  const height = Number(attrs.RESOLUTION?.split('x')[1]) || undefined;
  const kbps = Math.round(Number(attrs['AVERAGE-BANDWIDTH'] ?? attrs.BANDWIDTH) / 1000);
  const codecs = attrs.CODECS?.split(',').map((c) => c.trim()) ?? [];
  const hasAudio = codecs.some((c) => AUDIO_CODEC.test(c));
  const hasVideo = height !== undefined || codecs.some((c) => VIDEO_CODEC.test(c));
  const separateAudio = attrs.AUDIO !== undefined && audioGroups.has(attrs.AUDIO);
  if (!hasVideo && hasAudio) {
    return { key, kind: 'audio', label: kbps ? `${kbps} kbps` : '' };
  }
  const kind: RenditionKind =
    separateAudio || (hasVideo && codecs.length > 0 && !hasAudio) ? 'video' : 'combined';
  return {
    key,
    kind,
    label: height ? `${height}p` : kbps ? `${kbps} kbps` : 'Video',
    height,
  };
}

function mediaKind(lines: string[]): MediaKind {
  const segments = lines.filter((line) => line && !line.startsWith('#'));
  if (segments.some((line) => AUDIO_SEGMENT.test(line))) return 'audio';
  if (segments.some((line) => VIDEO_SEGMENT.test(line))) return 'video';
  return 'unknown';
}

/** Tells an HLS master playlist (a full stream) from a media playlist (one track). */
export function parsePlaylist(text: string, baseUrl: string): PlaylistInfo | null {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim());
  if (lines[0] !== '#EXTM3U') return null;

  const resolve = (uri: string) => {
    try {
      return new URL(uri, baseUrl).href;
    } catch {
      return null;
    }
  };
  const media: Rendition[] = [];
  const variants: { key: string; attrs: Record<string, string> }[] = [];
  const audioGroups = new Set<string>();
  let isMaster = false;
  let pending: Record<string, string> | null = null;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      isMaster = true;
      pending = parseAttributes(line);
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      isMaster = true;
      const attrs = parseAttributes(line);
      const kind =
        attrs.TYPE === 'AUDIO' ? 'audio' : attrs.TYPE === 'SUBTITLES' ? 'subtitles' : null;
      const key = attrs.URI ? resolve(attrs.URI) : null;
      if (!kind || !key) continue;
      if (kind === 'audio' && attrs['GROUP-ID']) audioGroups.add(attrs['GROUP-ID']);
      const name = attrs.NAME || attrs.LANGUAGE;
      media.push({ key, kind, label: name ?? '' });
    } else if (pending && line && !line.startsWith('#')) {
      const key = resolve(line);
      if (key) variants.push({ key, attrs: pending });
      pending = null;
    }
  }

  if (!isMaster) {
    const isMedia = lines.some(
      (l) => l.startsWith('#EXTINF') || l.startsWith('#EXT-X-TARGETDURATION'),
    );
    return isMedia ? { kind: 'media', mediaKind: mediaKind(lines) } : null;
  }
  const byKey = new Map<string, Rendition>();
  for (const { key, attrs } of variants) {
    if (!byKey.has(key)) byKey.set(key, variantRendition(key, attrs, audioGroups));
  }
  for (const rendition of media) if (!byKey.has(rendition.key)) byKey.set(rendition.key, rendition);
  const renditions = [...byKey.values()].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (b.height ?? 0) - (a.height ?? 0),
  );
  return { kind: 'master', renditions };
}
