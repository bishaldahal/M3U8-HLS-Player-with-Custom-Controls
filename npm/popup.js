/**
 * HLS Video Player - Popup UI
 * Quick access to recent history and settings
 */

// Cross-browser compatibility: Use browser API if available, fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// DOM Elements
let historyList;


/**
 * Load and display recent watch history
 */
async function loadHistoryUI() {
  if (!window.PlayerSettings) return;
  
  const history = await window.PlayerSettings.loadHistory();
  
  historyList.innerHTML = '';
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No recent streams</div>';
    return;
  }
  
  // Show only recent 5 items in popup
  const recent = history.slice(0, 5);
  
  recent.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    item.innerHTML = `
      <div class="history-info">
        <div class="history-title" title="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</div>
        <div class="history-meta">
          ${entry.duration > 0 
            ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
            : `${formatTime(entry.currentTime)} (Live)`
          } • ${formatRelativeTime(entry.timestamp)}
        </div>
      </div>
    `;
    
    // Click to play
    item.addEventListener('click', () => {
      const playerUrl = browserAPI.runtime.getURL('player.html');
      browserAPI.tabs.create({ url: `${playerUrl}#${entry.url}` });
      window.close();
    });
    
    historyList.appendChild(item);
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize popup
 */
function init() {
  historyList = document.getElementById('history-list');
  
  // Open options button
  document.getElementById('open-options').addEventListener('click', () => {
    browserAPI.runtime.openOptionsPage();
    window.close();
  });
  
  // Open shortcuts button
  document.getElementById('open-shortcuts').addEventListener('click', () => {
    const shortcutsUrl = browserAPI.runtime.getURL('shortcuts.html');
    browserAPI.tabs.create({ url: shortcutsUrl });
    window.close();
  });
  
  // Load history
  loadHistoryUI();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
