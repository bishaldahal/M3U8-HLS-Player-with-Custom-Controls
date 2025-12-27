/**
 * Background Script - Handles extension events and message passing
 * Compatible with both Chrome (service_worker) and Firefox (scripts)
 */

// Cross-browser compatibility: Use browser API if available, fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Check if a URL is an M3U8 file
 */
function isM3U8Url(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return pathname.endsWith('.m3u8') || pathname.includes('.m3u8?');
  } catch (e) {
    return false;
  }
}

/**
 * Open M3U8 URL in player
 */
function openInPlayer(url, tabId = null) {
  const playerUrl = browserAPI.runtime.getURL('player.html') + '#' + url;
  
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
  if (message.command === 'PLAY_M3U8' && message.url) {
    // Open the player with the M3U8 URL
    openInPlayer(message.url, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }
});

// Intercept direct navigation to M3U8 URLs (address bar)
browserAPI.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    // Only handle main frame (not iframes) and direct navigation
    if (details.frameId === 0 && isM3U8Url(details.url)) {
      // Redirect to our player
      openInPlayer(details.url, details.tabId);
    }
  },
  { url: [{ urlMatches: '.*\\.m3u8.*' }] }
);

// Handle extension installation or update
browserAPI.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open documentation page on first install
    browserAPI.tabs.create({ 
      url: 'https://extension.bishalbabudahal.com.np/docs'
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', browserAPI.runtime.getManifest().version);
    // Open options page on update to see new features
    browserAPI.runtime.openOptionsPage();
  }
});

// Ensure the extension stays alive (mainly for Chrome's service worker)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
  });
}
