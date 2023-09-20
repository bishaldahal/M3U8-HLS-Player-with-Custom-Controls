chrome.runtime.onInstalled.addListener(() => {
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
        if (details.frameId === 0 && details.url.endsWith('.m3u8')) {
          const playerUrl = chrome.runtime.getURL('player.html') + '#' + details.url;
          chrome.tabs.update({ url: playerUrl });
        }
      }),
      { urls: ["<all_urls>"] },
      ["blocking"]  
  });
  