import { ext } from '../lib/browser';
import { addDetected, pickReplayHeaders, streamKey, type DetectedStream } from '../lib/detected';
import { detectStreamType } from '../lib/stream';

const sessionKey = (tabId: number) => `detected:${tabId}`;
const ownOrigin = ext.runtime.getURL('').replace(/\/$/, '');

// Session storage survives the MV3 service worker being stopped; serialise writes per tab.
const writes = new Map<number, Promise<void>>();

function updateTab(
  tabId: number,
  change: (list: DetectedStream[]) => DetectedStream[] | null,
): Promise<void> {
  const run = async () => {
    const key = sessionKey(tabId);
    const list = ((await ext.storage.session.get(key))[key] as DetectedStream[] | undefined) ?? [];
    const next = change(list);
    if (next === null) await ext.storage.session.remove(key);
    else await ext.storage.session.set({ [key]: next });
    const count = next?.length ?? 0;
    await ext.action.setBadgeText({ tabId, text: count ? String(count) : '' });
  };
  const done = (writes.get(tabId) ?? Promise.resolve()).then(run).catch(() => {
    // The tab can close mid-update; the badge call then fails harmlessly.
  });
  writes.set(tabId, done);
  return done;
}

export async function getDetected(tabId: number): Promise<DetectedStream[]> {
  await writes.get(tabId);
  const key = sessionKey(tabId);
  return ((await ext.storage.session.get(key))[key] as DetectedStream[] | undefined) ?? [];
}

export async function findDetected(
  tabId: number | undefined,
  url: string,
): Promise<DetectedStream | undefined> {
  if (tabId === undefined) return undefined;
  const key = streamKey(url);
  return (await getDetected(tabId)).find((s) => streamKey(s.url) === key);
}

function onRequest(details: chrome.webRequest.OnBeforeSendHeadersDetails): undefined {
  if (details.tabId < 0) return;
  // Firefox reports the requesting page as originUrl instead of initiator.
  const initiator = details.initiator ?? (details as { originUrl?: string }).originUrl;
  if (initiator?.startsWith(ownOrigin)) return;
  const type = detectStreamType(details.url);
  if (!type) return;
  const stream: DetectedStream = {
    url: details.url,
    type,
    headers: pickReplayHeaders(details.requestHeaders),
    seenAt: Date.now(),
  };
  void updateTab(details.tabId, (list) => addDetected(list, stream));
}

export function startStreamDetection(): void {
  if (!ext.webRequest || !ext.storage.session) return;
  ext.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

  // Chrome hides Referer, Cookie and Origin unless 'extraHeaders' is requested; Firefox rejects it.
  const extra = ext.webRequest.OnBeforeSendHeadersOptions?.EXTRA_HEADERS;
  ext.webRequest.onBeforeSendHeaders.addListener(
    onRequest,
    {
      urls: ['<all_urls>'],
      types: ['xmlhttprequest', 'media', 'other'] as chrome.webRequest.ResourceType[],
    },
    ['requestHeaders', ...(extra ? [extra] : [])] as chrome.webRequest.OnBeforeSendHeadersOptions[],
  );

  ext.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) void updateTab(details.tabId, () => null);
  });
  ext.tabs.onRemoved.addListener((tabId) => {
    void ext.storage.session.remove(sessionKey(tabId));
    writes.delete(tabId);
  });
}
