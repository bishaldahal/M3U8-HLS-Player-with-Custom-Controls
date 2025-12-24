// Content Script - Intercepts M3U8 links on web pages

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let lastHandledUrl = '';
let lastHandledTime = 0;

function isM3U8Url(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.m3u8') || path.includes('.m3u8?') || path.includes('.m3u8#');
  } catch { return false; }
}

function handleM3U8Click(e) {
  const target = e.target.closest('a');
  if (!target?.href || !isM3U8Url(target.href)) return;
  
  const now = Date.now();
  if (target.href === lastHandledUrl && now - lastHandledTime < 500) {
    e.preventDefault();
    return;
  }
  
  lastHandledUrl = target.href;
  lastHandledTime = now;
  e.preventDefault();
  e.stopPropagation();
  
  browserAPI.runtime.sendMessage({ command: 'PLAY_M3U8', url: target.href }).catch(() => {});
}

document.addEventListener('click', handleM3U8Click, true);

if (isM3U8Url(window.location.href)) {
  browserAPI.runtime.sendMessage({ command: 'PLAY_M3U8', url: window.location.href }).then(() => {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#1a1a1a;color:white;';
    container.innerHTML = '<div style="text-align:center"><h2>Opening M3U8 Stream...</h2><p>Redirecting to HLS Player</p></div>';
    document.body.appendChild(container);
  }).catch(() => {});
}
