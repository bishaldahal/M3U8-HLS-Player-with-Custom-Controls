import { ext } from '../lib/browser';
import { detectStreamType, type StreamType } from '../lib/stream';

const WELCOME_URL = 'https://extension.bishalbabudahal.com.np/docs';

interface PlayMessage {
  command?: string;
  url?: string;
  streamType?: StreamType;
}

function openInPlayer(url: string, tabId?: number): void {
  const playerUrl = `${ext.runtime.getURL('player.html')}#${url}`;
  if (tabId !== undefined) {
    void ext.tabs.update(tabId, { url: playerUrl });
  } else {
    void ext.tabs.create({ url: playerUrl });
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
    openInPlayer(message.url, sender.tab?.id);
    sendResponse({ success: true });
    return;
  }

  // Legacy command name kept for compatibility.
  if (message.command === 'PLAY_M3U8') {
    openInPlayer(message.url, sender.tab?.id);
    sendResponse({ success: true });
  }
});

// Intercept direct navigation (address bar) to manifest URLs.
ext.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId === 0 && detectStreamType(details.url)) {
      openInPlayer(details.url, details.tabId);
    }
  },
  { url: [{ urlMatches: '.*\\.(m3u8|mpd).*' }] },
);

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void ext.tabs.create({ url: WELCOME_URL });
  }
});
