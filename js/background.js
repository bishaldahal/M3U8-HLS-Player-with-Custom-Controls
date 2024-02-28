// chrome.runtime.onInstalled.addListener(() => {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && details.url.endsWith('.m3u8')) {
      const playerUrl = chrome.runtime.getURL('player.html') + '#' + details.url;
      console.log("Before Navigation", playerUrl);
      chrome.tabs.update({ url: playerUrl });
    }
  }, { urls: ["<all_urls>","*://*/*.m3u8"] }, ["blocking"]);
// });

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.command == 'PLAY_M3U8') {
    var playerUrl = chrome.runtime.getURL('player.html') + "#" + request.url;
    console.log("onMessage", playerUrl);
    chrome.tabs.create({ url: playerUrl });
  }
});
