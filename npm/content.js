/**
 * Content Script - Intercepts M3U8 links on web pages
 * Compatible with both Chrome and Firefox
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
 * Handle M3U8 link click
 */
function handleM3U8Click(e) {
  const target = e.target.closest('a');
  if (!target || !target.href) return;
  
  if (isM3U8Url(target.href)) {
    e.preventDefault();
    e.stopPropagation();
    
    browserAPI.runtime.sendMessage({ 
      command: 'PLAY_M3U8', 
      url: target.href 
    }).catch(error => {
      console.error('Error sending message:', error);
    });
  }
}

// Listen for clicks on M3U8 links
document.addEventListener('click', handleM3U8Click, true);

// Also intercept mousedown for Firefox compatibility
document.addEventListener('mousedown', handleM3U8Click, true);

// Intercept direct navigation to M3U8 files
if (isM3U8Url(window.location.href)) {
  browserAPI.runtime.sendMessage({ 
    command: 'PLAY_M3U8', 
    url: window.location.href 
  }).then(() => {
    // Show a message while redirecting - safe static content
    document.body.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; background: #1a1a1a; color: white;';
    
    const content = document.createElement('div');
    content.style.textAlign = 'center';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Opening M3U8 Stream...';
    
    const p = document.createElement('p');
    p.textContent = 'Redirecting to HLS Player';
    
    content.appendChild(h2);
    content.appendChild(p);
    container.appendChild(content);
    document.body.appendChild(container);
  }).catch(error => {
    console.error('Error opening M3U8 stream:', error);
  });
}
