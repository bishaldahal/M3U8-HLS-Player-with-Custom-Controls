document.addEventListener('click', function (e) {
  if (e.target.href && e.target.href.split('?')[0].endsWith("m3u8")) {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ command: 'PLAY_M3U8', url: e.target.href }, function (response) {
    });
  }
});
