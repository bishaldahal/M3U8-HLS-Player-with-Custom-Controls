import { ext } from '../lib/browser';
import { loadSettings } from '../lib/settings';
import {
  HEADER_RULE_ID_BASE,
  SITE_HEADERS_KEY,
  buildHeaderRules,
  headersFromPage,
  loadSiteHeaders,
  upsertSiteHeaders,
} from '../lib/site-headers';
import { detectStreamType, safeUrlParse, type StreamType } from '../lib/stream';

const WELCOME_URL = 'https://extension.bishalbabudahal.com.np/docs';

interface PlayMessage {
  command?: string;
  url?: string;
  streamType?: StreamType;
  /** Replace the sender tab (the tab itself is the manifest) instead of opening a new one. */
  replaceTab?: boolean;
}

function playerUrlFor(url: string): string {
  return `${ext.runtime.getURL('player.html')}#${url}`;
}

function openInNewTab(url: string, opener?: { id?: number; index?: number }): void {
  void ext.tabs.create({
    url: playerUrlFor(url),
    ...(opener?.id !== undefined && { openerTabId: opener.id }),
    ...(opener?.index !== undefined && { index: opener.index + 1 }),
  });
}

function openInPlayer(message: PlayMessage, tab?: { id?: number; index?: number }): void {
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
    const rules = buildHeaderRules(
      await loadSiteHeaders(),
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
  if (!(await loadSettings()).autoSiteHeaders) return;
  if (await upsertSiteHeaders(host, headers, true)) await syncHeaderRules();
}

async function handlePlay(message: PlayMessage, sender: chrome.runtime.MessageSender) {
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
  if (!message?.url) return;

  if (message.command === 'PLAY_STREAM') {
    const streamType = message.streamType ?? detectStreamType(message.url);
    if (!streamType) {
      sendResponse({ success: false, error: 'Unsupported stream type' });
      return;
    }
    void handlePlay(message, sender).then(() => sendResponse({ success: true }));
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

void syncHeaderRules();
ext.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[SITE_HEADERS_KEY]) void syncHeaderRules();
});

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void ext.tabs.create({ url: WELCOME_URL });
  }
});
