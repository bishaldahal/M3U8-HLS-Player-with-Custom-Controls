browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (
    details.frameId === 0 &&
    new URL(details.url).pathname.endsWith(".m3u8") &&
    !details.url.startsWith(browser.runtime.getURL(""))
  ) {
    const playerUrl = browser.runtime.getURL("player.html") + "#" + details.url;
    console.log("Before Navigation", playerUrl);
    browser.tabs.update(details.tabId, { url: playerUrl });
  }
});

browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.command == "PLAY_M3U8") {
    var playerUrl = browser.runtime.getURL("player.html") + "#" + request.url;
    console.log("onMessage", playerUrl);
    browser.tabs.create({ url: playerUrl });
  }
});
