import { ext } from '../lib/browser';
import { detectStreamType, type StreamType } from '../lib/stream';

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

ext.runtime.onMessage.addListener((message: PlayMessage, sender, sendResponse) => {
  if (!message?.url) return;

  if (message.command === 'PLAY_STREAM') {
    const streamType = message.streamType ?? detectStreamType(message.url);
    if (!streamType) {
      sendResponse({ success: false, error: 'Unsupported stream type' });
      return;
    }
    openInPlayer(message, sender.tab);
    sendResponse({ success: true });
    return;
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
if ((ext.declarativeNetRequest as typeof ext.declarativeNetRequest | undefined) !== undefined) {
  registerManifestRedirect().catch((error) => {
    console.error('Manifest redirect rule failed; falling back to webNavigation:', error);
    redirectViaWebNavigation();
  });
} else {
  redirectViaWebNavigation();
}

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void ext.tabs.create({ url: WELCOME_URL });
  }
});
