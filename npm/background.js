// Background Script - Extension events and message passing

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function isM3U8Url(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.m3u8') || path.includes('.m3u8?') || path.includes('.m3u8#');
  } catch { return false; }
}

function openInPlayer(url, tabId) {
  const playerUrl = browserAPI.runtime.getURL('player.html') + '#' + url;
  if (tabId) {
    browserAPI.tabs.update(tabId, { url: playerUrl }).catch(() => {
      browserAPI.tabs.create({ url: playerUrl });
    });
  } else {
    browserAPI.tabs.create({ url: playerUrl });
  }
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'PLAY_M3U8' && message.url) {
    openInPlayer(message.url, sender.tab?.id);
    sendResponse({ success: true });
    return true;
  }
  return false;
});

try {
  browserAPI.webNavigation.onBeforeNavigate.addListener(
    (details) => {
      if (details.frameId === 0 && isM3U8Url(details.url)) {
        openInPlayer(details.url, details.tabId);
      }
    },
    { url: [{ urlMatches: '.*\\.m3u8.*' }] }
  );
} catch {}

browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browserAPI.runtime.openOptionsPage();
  }
});

chrome?.runtime?.onStartup?.addListener(() => {});
