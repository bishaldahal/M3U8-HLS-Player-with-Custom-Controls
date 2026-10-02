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

// Intercept direct navigation (address bar) to manifest URLs.
ext.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId === 0 && detectStreamType(details.url)) {
      void ext.tabs.update(details.tabId, { url: playerUrlFor(details.url) });
    }
  },
  { url: [{ urlMatches: '.*\\.(m3u8|mpd).*' }] },
);

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void ext.tabs.create({ url: WELCOME_URL });
  }
});
