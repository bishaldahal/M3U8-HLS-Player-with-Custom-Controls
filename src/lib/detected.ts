import type { PlaylistInfo, Rendition } from './playlist';
import { isValidHeaderName, isValidHeaderValue } from './site-headers';
import type { StreamType } from './stream';

/** A stream manifest requested by a page's own player, with the headers it was sent with. */
export interface DetectedStream {
  url: string;
  type: StreamType;
  headers: Record<string, string>;
  seenAt: number;
  /** What the HLS playlist turned out to be, once fetched. */
  playlist?: PlaylistInfo;
}

/** A full stream with the single-track playlists the page also loaded from it. */
export interface DetectedGroup {
  stream: DetectedStream;
  tracks: { stream: DetectedStream; rendition: Rendition }[];
}

export const MAX_DETECTED_PER_TAB = 20;

/** Optional permission that turns stream detection on. */
export const DETECT_PERMISSIONS: chrome.permissions.Permissions = { permissions: ['webRequest'] };

// Set by the browser per request, or describe the body/range rather than who is asking.
const NOT_REPLAYED =
  /^(?:host|connection|keep-alive|content-length|content-type|accept|accept-encoding|range|if-.*|sec-.*|upgrade-insecure-requests|cache-control|pragma|te|trailer|transfer-encoding|proxy-.*|priority|purpose|x-client-data)$/i;

/** Headers from a site's request that the player should send too (auth, cookies, referer...). */
export function pickReplayHeaders(
  headers: { name: string; value?: string }[] | undefined,
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const { name, value } of headers ?? []) {
    if (value === undefined || NOT_REPLAYED.test(name)) continue;
    if (isValidHeaderName(name) && isValidHeaderValue(value)) picked[name] = value;
  }
  return picked;
}

// Safe to send to the segment CDN and licence servers too; cookies and tokens stay on the host.
const EVERY_HOST = /^(?:referer|origin|user-agent)$/i;

/**
 * Session rules for one player tab: every header on the manifest host, and the identifying
 * ones (Referer, Origin, User-Agent) on every other host the stream uses.
 */
export function buildTabHeaderRules(
  stream: Pick<DetectedStream, 'url' | 'headers'>,
  tabId: number,
  extensionHost: string,
  firstId: number,
): chrome.declarativeNetRequest.Rule[] {
  const host = new URL(stream.url).hostname;
  const toHeaders = (entries: [string, string][]) =>
    entries.map(([header, value]) => ({
      header,
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value,
    }));
  const base = {
    tabIds: [tabId],
    initiatorDomains: [extensionHost],
    resourceTypes: [
      'xmlhttprequest',
      'media',
      'other',
    ] as chrome.declarativeNetRequest.ResourceType[],
  };
  const all = Object.entries(stream.headers);
  const identifying = all.filter(([name]) => EVERY_HOST.test(name));
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  if (all.length) {
    rules.push({
      id: firstId,
      priority: 3,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: toHeaders(all),
      },
      condition: { ...base, requestDomains: [host] },
    });
  }
  if (identifying.length) {
    rules.push({
      id: firstId + 1,
      priority: 2,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        requestHeaders: toHeaders(identifying),
      },
      condition: base,
    });
  }
  return rules;
}

/** Same manifest regardless of rotating query tokens. */
export function streamKey(url: string): string {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname;
  } catch {
    return url;
  }
}

/** Prefers an exact URL, falling back only when token-insensitive matching is unambiguous. */
export function findMatchingStream(
  list: DetectedStream[],
  url: string,
): DetectedStream | undefined {
  const exact = list.find((stream) => stream.url === url);
  if (exact) return exact;
  const matches = list.filter((stream) => streamKey(stream.url) === streamKey(url));
  return matches.length === 1 ? matches[0] : undefined;
}

/** Adds or refreshes a detection; the newest URL and headers win since tokens expire. */
export function addDetected(list: DetectedStream[], stream: DetectedStream): DetectedStream[] {
  const key = streamKey(stream.url);
  let index = list.findIndex((s) => s.url === stream.url);
  if (index < 0) {
    index = list.findIndex((s) => streamKey(s.url) === key && s.playlist !== undefined);
  }
  if (
    index >= 0 &&
    list[index]!.url !== stream.url &&
    list.some((item) => {
      const renditions = renditionsOf(item);
      return (
        renditions.some((rendition) => rendition.key === list[index]!.url) &&
        renditions.some((rendition) => rendition.key === stream.url)
      );
    })
  ) {
    index = -1;
  }
  if (index >= 0) {
    const next = [...list];
    next[index] = { ...stream, playlist: stream.playlist ?? list[index]!.playlist };
    return next;
  }
  return list.length >= MAX_DETECTED_PER_TAB ? list : [...list, stream];
}

const renditionsOf = (stream: DetectedStream) =>
  stream.playlist?.kind === 'master' ? stream.playlist.renditions : [];

/** True when a full stream on the page already lists this playlist as one of its tracks. */
export function isKnownTrack(list: DetectedStream[], url: string): boolean {
  return list.some((stream) => {
    const renditions = renditionsOf(stream);
    if (renditions.some((rendition) => rendition.key === url)) return true;
    const matches = renditions.filter((rendition) => streamKey(rendition.key) === streamKey(url));
    return matches.length === 1;
  });
}

/**
 * Puts the single-track playlists a player loads (one quality, audio only...) under the full
 * stream they came from. Full streams come first, newest first.
 */
export function groupDetected(list: DetectedStream[]): DetectedGroup[] {
  const byUrl = new Map(list.map((stream) => [stream.url, stream]));
  const byKey = new Map<string, DetectedStream[]>();
  for (const stream of list) {
    const key = streamKey(stream.url);
    byKey.set(key, [...(byKey.get(key) ?? []), stream]);
  }
  const claimed = new Set<DetectedStream>();
  const masters: DetectedGroup[] = [];
  for (const stream of list) {
    const renditions = renditionsOf(stream);
    if (!renditions.length) continue;
    const tracks = renditions.flatMap((rendition) => {
      const candidates = byKey.get(streamKey(rendition.key)) ?? [];
      const track =
        byUrl.get(rendition.key) ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!track || track === stream) return [];
      claimed.add(track);
      if (rendition.kind === 'subtitles') return [];
      return [{ stream: track, rendition }];
    });
    masters.push({ stream, tracks });
  }
  const masterSet = new Set(masters.map((g) => g.stream));
  const others = list
    .filter((s) => !masterSet.has(s) && !claimed.has(s))
    .map((stream) => ({ stream, tracks: [] }));
  const newest = (a: DetectedGroup, b: DetectedGroup) => b.stream.seenAt - a.stream.seenAt;
  return [...masters.sort(newest), ...others.sort(newest)];
}
