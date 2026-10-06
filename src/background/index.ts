import { ext } from '../lib/browser';
import { buildTabHeaderRules, type DetectedStream } from '../lib/detected';
import { SETTINGS_KEY, loadSettings } from '../lib/settings';
import {
  HEADER_RULE_ID_BASE,
  SITE_HEADERS_KEY,
  buildHeaderRules,
  headersFromPage,
  loadSiteHeaders,
  upsertSiteHeaders,
} from '../lib/site-headers';
import { detectStreamType, safeUrlParse, type StreamType } from '../lib/stream';
import { isFeatureUpdate } from '../lib/version';
import { findDetected, getDetected, startStreamDetection } from './detect';

const WELCOME_URL = 'https://extension.bishalbabudahal.com.np/docs';
const WHATS_NEW_URL = 'https://extension.bishalbabudahal.com.np/#whats-new';

interface PlayMessage {
  command?: string;
  url?: string;
  streamType?: StreamType;
  /** Replace the sender tab (the tab itself is the manifest) instead of opening a new one. */
  replaceTab?: boolean;
  /** Tab the stream was detected in (popup requests). */
  tabId?: number;
}

function playerUrlFor(url: string): string {
  return `${ext.runtime.getURL('player.html')}#${url}`;
}

async function createTabNextTo(
  url: string,
  opener?: { id?: number; index?: number; windowId?: number },
): Promise<chrome.tabs.Tab> {
  const index = opener?.index !== undefined ? { index: opener.index + 1 } : {};
  const target = {
    ...index,
    ...(opener?.windowId !== undefined ? { windowId: opener.windowId } : {}),
  };
  if (opener?.id === undefined) return ext.tabs.create({ url, ...target });
  try {
    return await ext.tabs.create({ url, ...target, openerTabId: opener.id });
  } catch {
    // Firefox for Android's schema marks `openerTabId` unsupported and rejects the call.
    return ext.tabs.create({ url, ...target });
  }
}

function openInNewTab(
  url: string,
  opener?: { id?: number; index?: number; windowId?: number },
): void {
  void createTabNextTo(playerUrlFor(url), opener).catch((error) =>
    console.error('Failed to open the player:', error),
  );
}

function openInPlayer(
  message: PlayMessage,
  tab?: { id?: number; index?: number; windowId?: number },
): void {
  if (message.replaceTab && tab?.id !== undefined) {
    void ext.tabs.update(tab.id, { url: playerUrlFor(message.url!) });
  } else {
    openInNewTab(message.url!, tab);
  }
}

const hasDnr = () =>
  (ext.declarativeNetRequest as typeof ext.declarativeNetRequest | undefined) !== undefined;

let headerSync: Promise<void> = Promise.resolve();

/** Replace the dynamic header rules with the stored site headers. */
function syncHeaderRules(): Promise<void> {
  const run = async () => {
    if (!hasDnr()) return;
    const { rememberLinkSiteHeaders } = await loadSettings();
    const rules = buildHeaderRules(
      (await loadSiteHeaders()).filter((rule) => rememberLinkSiteHeaders || !rule.auto),
      new URL(ext.runtime.getURL('')).hostname,
    );
    const current = await ext.declarativeNetRequest.getDynamicRules();
    await ext.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: current.map((r) => r.id).filter((id) => id >= HEADER_RULE_ID_BASE),
      addRules: rules,
    });
  };
  // Serialise updates so overlapping syncs can't add the same rule id twice.
  headerSync = headerSync.then(run, run).catch((error) => {
    console.error('Failed to update site header rules:', error);
  });
  return headerSync;
}

/** Remember the Referer/Origin of the page a stream link was clicked on (#8). */
async function captureSiteHeaders(streamUrl: string, pageUrl: string | undefined): Promise<void> {
  const host = safeUrlParse(streamUrl)?.hostname;
  const headers = headersFromPage(pageUrl);
  if (!host || !headers) return;
  if (!(await loadSettings()).rememberLinkSiteHeaders) return;
  if (await upsertSiteHeaders(host, headers, true)) await syncHeaderRules();
}

const extensionHost = () => new URL(ext.runtime.getURL('')).hostname;

async function removeTabRules(tabId: number): Promise<void> {
  const rules = await ext.declarativeNetRequest.getSessionRules();
  const ids = rules.filter((r) => r.condition.tabIds?.includes(tabId)).map((r) => r.id);
  if (ids.length) await ext.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
}

/**
 * Opens the player with the headers the site's own player used. They are kept in session rules
 * for that tab only, since they can carry cookies and tokens.
 */
async function playDetected(stream: DetectedStream, opener?: chrome.tabs.Tab): Promise<void> {
  const tab = await createTabNextTo('about:blank', opener);
  try {
    if (hasDnr() && tab.id !== undefined) {
      const existing = await ext.declarativeNetRequest.getSessionRules();
      const firstId = Math.max(0, ...existing.map((r) => r.id)) + 1;
      await ext.declarativeNetRequest.updateSessionRules({
        addRules: buildTabHeaderRules(stream, tab.id, extensionHost(), firstId),
      });
    }
  } catch (error) {
    console.error('Failed to apply the stream headers:', error);
  }
  await ext.tabs.update(tab.id!, { url: playerUrlFor(stream.url) });
}

async function handlePlay(message: PlayMessage, sender: chrome.runtime.MessageSender) {
  const detected = await findDetected(message.tabId ?? sender.tab?.id, message.url!);
  if (detected && !message.replaceTab) {
    const opener = message.tabId !== undefined ? await ext.tabs.get(message.tabId) : sender.tab;
    await playDetected({ ...detected, url: message.url! }, opener);
    return;
  }
  if (!message.replaceTab) {
    // Rules must be in place before the player's first request.
    await captureSiteHeaders(message.url!, sender.url).catch((error) =>
      console.error('Failed to capture site headers:', error),
    );
  }
  openInPlayer(message, sender.tab);
}

ext.runtime.onMessage.addListener((message: PlayMessage, sender, sendResponse) => {
  // Lets a page wait until saved headers are active before reloading the stream.
  if (message?.command === 'SYNC_SITE_HEADERS') {
    void syncHeaderRules().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message?.command === 'GET_DETECTED' && message.tabId !== undefined) {
    void getDetected(message.tabId).then(sendResponse);
    return true;
  }
  if (!message?.url) return;

  if (message.command === 'PLAY_STREAM') {
    const streamType = message.streamType ?? detectStreamType(message.url);
    if (!streamType) {
      sendResponse({ success: false, error: 'Unsupported stream type' });
      return;
    }
    void handlePlay(message, sender).then(
      () => sendResponse({ success: true }),
      (error: unknown) => {
        console.error('Failed to play stream:', error);
        sendResponse({ success: false, error: String(error) });
      },
    );
    return true;
  }

  // Legacy command name kept for compatibility.
  if (message.command === 'PLAY_M3U8') {
    openInPlayer(message, sender.tab);
    sendResponse({ success: true });
  }
});

const MANIFEST_REDIRECT_RULE_ID = 1;

/**
 * Redirect top-level manifest navigations (address bar, site scripts) before the request is sent;
 * reacting in webNavigation is too late and the browser also downloads the file.
 */
async function registerManifestRedirect(): Promise<void> {
  await ext.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [MANIFEST_REDIRECT_RULE_ID],
    addRules: [
      {
        id: MANIFEST_REDIRECT_RULE_ID,
        priority: 1,
        action: {
          type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
          redirect: { regexSubstitution: `${playerUrlFor('')}\\0` },
        },
        condition: {
          regexFilter: '^https?://[^?#]*\\.(?:m3u8|mpd)(?:\\?.*)?$',
          isUrlFilterCaseSensitive: false,
          resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
        },
      },
    ],
  });
}

function redirectViaWebNavigation(): void {
  ext.webNavigation.onBeforeNavigate.addListener(
    (details) => {
      if (details.frameId === 0 && detectStreamType(details.url)) {
        void ext.tabs.update(details.tabId, { url: playerUrlFor(details.url) });
      }
    },
    { url: [{ urlMatches: '.*\\.(m3u8|mpd).*' }] },
  );
}

// Missing when the browser lacks DNR or the permission was not granted.
if (hasDnr()) {
  registerManifestRedirect().catch((error) => {
    console.error('Manifest redirect rule failed; falling back to webNavigation:', error);
    redirectViaWebNavigation();
  });
} else {
  redirectViaWebNavigation();
}

startStreamDetection();
if (hasDnr()) {
  ext.tabs.onRemoved.addListener((tabId) => void removeTabRules(tabId).catch(() => {}));
}

void syncHeaderRules();
ext.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes[SITE_HEADERS_KEY] || changes[SETTINGS_KEY])) {
    void syncHeaderRules();
  }
});

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void ext.tabs.create({ url: WELCOME_URL });
  } else if (
    details.reason === 'update' &&
    isFeatureUpdate(details.previousVersion, ext.runtime.getManifest().version)
  ) {
    void ext.tabs.create({ url: WHATS_NEW_URL });
  }
});
