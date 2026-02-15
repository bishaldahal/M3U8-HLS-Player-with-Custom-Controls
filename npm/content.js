/**
 * Content Script - Intercepts HLS/DASH links on web pages
 * Compatible with both Chrome and Firefox
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
 * Handle stream link click
 */
function handleStreamClick(e) {
  const target = e.target.closest('a');
  if (!target || !target.href) return;
  
  const streamType = detectStreamType(target.href);

  if (streamType) {
    e.preventDefault();
    e.stopPropagation();
    
    browserAPI.runtime.sendMessage({ 
      command: 'PLAY_STREAM',
      url: target.href,
      streamType,
    }).catch(error => {
      console.error('Error sending message:', error);
    });
  }
}

// Listen for clicks on stream links
document.addEventListener('click', handleStreamClick, true);

// Also intercept mousedown for Firefox compatibility
document.addEventListener('mousedown', handleStreamClick, true);

// Intercept direct navigation to stream manifests
const directStreamType = detectStreamType(window.location.href);
if (directStreamType) {
  browserAPI.runtime.sendMessage({ 
    command: 'PLAY_STREAM',
    url: window.location.href,
    streamType: directStreamType,
  }).then(() => {
    // Show a message while redirecting - safe static content
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;';
    
    const content = document.createElement('div');
    content.style.textAlign = 'center';
    
    const h2 = document.createElement('h2');
    h2.textContent = `Opening ${directStreamType.toUpperCase()} Stream...`;
    
    const p = document.createElement('p');
    p.textContent = 'Redirecting to Stream Player';
    
    content.appendChild(h2);
    content.appendChild(p);
    container.appendChild(content);
    document.body.appendChild(container);
  }).catch(error => {
    console.error('Error opening stream:', error);
  });
}
