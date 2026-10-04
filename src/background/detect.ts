import { ext } from '../lib/browser';
import {
  addDetected,
  findMatchingStream,
  isKnownTrack,
  pickReplayHeaders,
  streamKey,
  type DetectedStream,
} from '../lib/detected';
import { parsePlaylist } from '../lib/playlist';
import { SETTINGS_KEY, loadSettings, type PlayerSettings } from '../lib/settings';
import { detectStreamType } from '../lib/stream';

const sessionKey = (tabId: number) => `detected:${tabId}`;
const ownOrigin = ext.runtime.getURL('').replace(/\/$/, '');

// Session storage survives the MV3 service worker being stopped; serialise writes per tab.
const writes = new Map<number, Promise<void>>();

function updateTab(
  tabId: number,
  change: (list: DetectedStream[]) => DetectedStream[] | null | undefined,
): Promise<void> {
  const run = async () => {
    const key = sessionKey(tabId);
    const list = ((await ext.storage.session.get(key))[key] as DetectedStream[] | undefined) ?? [];
    const next = change(list);
    if (next === undefined) return;
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
  return findMatchingStream(await getDetected(tabId), url);
}

const PROBE_TIMEOUT_MS = 5000;
const attemptedProbes = new Set<string>();
let detectionGeneration = 0;
const tabGenerations = new Map<number, number>();

const getTabGeneration = (tabId: number) => tabGenerations.get(tabId) ?? 0;
const isCurrent = (tabId: number, detection: number, navigation: number) =>
  detection === detectionGeneration && navigation === getTabGeneration(tabId);

/** Reads an HLS playlist to tell a full stream from a single quality or audio track. */
async function probePlaylist(
  tabId: number,
  stream: DetectedStream,
  detection: number,
  navigation: number,
): Promise<void> {
  const probeKey = `${tabId}:${stream.url}`;
  if (attemptedProbes.has(probeKey)) return;
  attemptedProbes.add(probeKey);
  try {
    // Cookie and Referer are forbidden fetch headers; the browser drops them and sends its own.
    const res = await fetch(stream.url, {
      headers: stream.headers,
      credentials: 'include',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const playlist = parsePlaylist(await res.text(), res.url || stream.url);
    if (!playlist) return;
    await updateTab(tabId, (list) => {
      if (!isCurrent(tabId, detection, navigation)) return undefined;
      const match = findMatchingStream(list, stream.url);
      return match ? list.map((item) => (item === match ? { ...item, playlist } : item)) : list;
    });
  } catch {
    // Unreachable without the page's cookies or tokens; it is listed without track details.
  }
}

function clearProbeAttempts(tabId?: number): void {
  if (tabId === undefined) attemptedProbes.clear();
  else {
    const prefix = `${tabId}:`;
    for (const key of attemptedProbes) if (key.startsWith(prefix)) attemptedProbes.delete(key);
  }
}

type DetectionSettings = Pick<PlayerSettings, 'detectStreams' | 'inspectHlsPlaylists'>;

let detectionSettings: Promise<DetectionSettings> | undefined;
let clearingDetected = Promise.resolve();
const getDetectionSettings = () =>
  (detectionSettings ??= loadSettings().then(({ detectStreams, inspectHlsPlaylists }) => ({
    detectStreams,
    inspectHlsPlaylists,
  })));

function onRequest(details: chrome.webRequest.OnBeforeSendHeadersDetails): undefined {
  if (details.tabId < 0) return;
  // Firefox reports the requesting page as originUrl instead of initiator.
  const initiator = details.initiator ?? (details as { originUrl?: string }).originUrl;
  if (initiator?.startsWith(ownOrigin)) return;
  const type = detectStreamType(details.url);
  if (!type) return;
  const { tabId } = details;
  const stream: DetectedStream = {
    url: details.url,
    type,
    headers: pickReplayHeaders(details.requestHeaders),
    seenAt: Date.now(),
  };
  const detection = detectionGeneration;
  const navigation = getTabGeneration(tabId);
  void getDetectionSettings().then(async ({ detectStreams, inspectHlsPlaylists }) => {
    await clearingDetected;
    if (!detectStreams || !isCurrent(tabId, detection, navigation)) return;
    let needsProbe = false;
    await updateTab(tabId, (list) => {
      if (!isCurrent(tabId, detection, navigation)) return undefined;
      const known = list.find((s) => streamKey(s.url) === streamKey(stream.url));
      needsProbe =
        inspectHlsPlaylists &&
        type === 'hls' &&
        !known?.playlist &&
        !isKnownTrack(list, stream.url);
      return addDetected(list, stream);
    });
    if (needsProbe && isCurrent(tabId, detection, navigation)) {
      await probePlaylist(tabId, stream, detection, navigation);
    }
  });
}

function listen(): void {
  const api = ext.webRequest as typeof ext.webRequest | undefined;
  if (!api || api.onBeforeSendHeaders.hasListener(onRequest)) return;
  // Chrome hides Referer, Cookie and Origin unless 'extraHeaders' is requested; Firefox rejects it.
  const extra = api.OnBeforeSendHeadersOptions?.EXTRA_HEADERS;
  api.onBeforeSendHeaders.addListener(
    onRequest,
    {
      urls: ['<all_urls>'],
      types: ['xmlhttprequest', 'media', 'other'] as chrome.webRequest.ResourceType[],
    },
    ['requestHeaders', ...(extra ? [extra] : [])] as chrome.webRequest.OnBeforeSendHeadersOptions[],
  );
}

async function forgetAll(): Promise<void> {
  const keys = Object.keys(await ext.storage.session.get(null)).filter((k) =>
    k.startsWith('detected:'),
  );
  const tabIds = new Set([
    ...writes.keys(),
    ...keys.map((key) => Number(key.slice('detected:'.length))),
  ]);
  await Promise.all([...tabIds].map((tabId) => updateTab(tabId, () => null)));
}

export function startStreamDetection(): void {
  if (!ext.storage.session) return;
  ext.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});

  // Synchronous on startup so requests can wake the service worker; the setting is checked per hit.
  listen();
  ext.storage.onChanged.addListener((changes, areaName) => {
    const change = changes[SETTINGS_KEY];
    if (areaName !== 'local' || !change) return;
    const next = change.newValue as PlayerSettings | undefined;
    const on = next?.detectStreams ?? true;
    detectionGeneration++;
    clearProbeAttempts();
    detectionSettings = Promise.resolve({
      detectStreams: on,
      inspectHlsPlaylists: next?.inspectHlsPlaylists ?? false,
    });
    if (!on) clearingDetected = clearingDetected.then(forgetAll).catch(() => {});
  });

  ext.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    tabGenerations.set(details.tabId, getTabGeneration(details.tabId) + 1);
    clearProbeAttempts(details.tabId);
    void updateTab(details.tabId, () => null);
  });
  ext.tabs.onRemoved.addListener((tabId) => {
    const generation = getTabGeneration(tabId) + 1;
    tabGenerations.set(tabId, generation);
    clearProbeAttempts(tabId);
    const removal = updateTab(tabId, () => null);
    void removal.finally(() => {
      if (writes.get(tabId) !== removal) return;
      writes.delete(tabId);
      if (getTabGeneration(tabId) === generation) tabGenerations.delete(tabId);
    });
  });
}
