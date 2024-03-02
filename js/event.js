var enabled = true;

browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.command == 'PLAY_M3U8') {
        var playerUrl = browser.runtime.getURL('player.html') + "#" + request.url
        browser.tabs.create({url: playerUrl});
    }
});

browser.webRequest.onBeforeRequest.addListener(
    function (info) {
        if (enabled && info.type == "main_frame" && info.url.split("?")[0].split("#")[0].endsWith("m3u8")) {
            var playerUrl = browser.runtime.getURL('player.html') + "#" + info.url
            return {redirectUrl: playerUrl}
        }
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
);