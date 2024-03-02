// browser.runtime.onInstalled.addListener(() => {
  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && details.url.endsWith('.m3u8')) {
      const playerUrl = browser.runtime.getURL('player.html') + '#' + details.url;
      console.log("Before Navigation", playerUrl);
      browser.tabs.update({ url: playerUrl });
    }
  }, { urls: ["<all_urls>","*://*/*.m3u8"] }, ["blocking"]);
// });

browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.command == 'PLAY_M3U8') {
    var playerUrl = browser.runtime.getURL('player.html') + "#" + request.url;
    console.log("onMessage", playerUrl);
    browser.tabs.create({ url: playerUrl });
  }
});