/**
 * Background Script - Handles extension events and message passing
 * Compatible with both Chrome (service_worker) and Firefox (scripts)
 */

// Cross-browser compatibility: Use browser API if available, fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Detect stream type from URL
 * @returns {'hls'|'dash'|null}
 */
function detectStreamType(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    if (pathname.endsWith('.m3u8') || pathname.includes('.m3u8?')) {
      return 'hls';
    }
    if (pathname.endsWith('.mpd') || pathname.includes('.mpd?')) {
      return 'dash';
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Open stream URL in player
 */
function openInPlayer(url, tabId = null, streamType = null) {
  const playerUrl = browserAPI.runtime.getURL('player.html') + '#' + url;
  const detectedType = streamType || detectStreamType(url);
  if (!detectedType) return;
  
  if (tabId) {
    // Update existing tab
    browserAPI.tabs.update(tabId, { url: playerUrl });
  } else {
    // Create new tab
    browserAPI.tabs.create({ url: playerUrl });
  }
}

// Handle messages from content scripts
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'PLAY_STREAM' && message.url) {
    const streamType = message.streamType || detectStreamType(message.url);
    if (!streamType) {
      sendResponse({ success: false, error: 'Unsupported stream type' });
      return true;
    }

    // Open the player with the stream URL
    openInPlayer(message.url, sender.tab ? sender.tab.id : null, streamType);
    sendResponse({ success: true });
    return true;
  }

  // Backward compatibility with previous command name
  if (message.command === 'PLAY_M3U8' && message.url) {
    openInPlayer(message.url, sender.tab ? sender.tab.id : null, 'hls');
    sendResponse({ success: true });
    return true;
  }
});

// Intercept direct navigation to stream manifest URLs (address bar)
browserAPI.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    // Only handle main frame (not iframes) and direct navigation
    const streamType = detectStreamType(details.url);
    if (details.frameId === 0 && streamType) {
      // Redirect to our player
      openInPlayer(details.url, details.tabId, streamType);
    }
  },
  { url: [{ urlMatches: '.*\\.(m3u8|mpd).*' }] }
);

browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    browserAPI.tabs.create({ 
      url: 'https://extension.bishalbabudahal.com.np/docs'
    });
  }
});

// Ensure the extension stays alive (mainly for Chrome's service worker)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
  });
}
