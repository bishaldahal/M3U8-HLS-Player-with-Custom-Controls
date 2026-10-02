import { isValidHeaderName, isValidHeaderValue } from './site-headers';
import type { StreamType } from './stream';

/** A stream manifest requested by a page's own player, with the headers it was sent with. */
export interface DetectedStream {
  url: string;
  type: StreamType;
  headers: Record<string, string>;
  seenAt: number;
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

/** Adds or refreshes a detection; the newest URL and headers win since tokens expire. */
export function addDetected(list: DetectedStream[], stream: DetectedStream): DetectedStream[] {
  const key = streamKey(stream.url);
  const index = list.findIndex((s) => streamKey(s.url) === key);
  if (index >= 0) {
    const next = [...list];
    next[index] = stream;
    return next;
  }
  return list.length >= MAX_DETECTED_PER_TAB ? list : [...list, stream];
}
