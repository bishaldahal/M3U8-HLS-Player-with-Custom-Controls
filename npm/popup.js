/**
 * HLS Video Player - Popup UI
 * Quick access to recent history and settings
 */

// DOM Elements
let historyList;

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

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
        <div class="history-title" title="${entry.url}">${entry.title}</div>
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
      const playerUrl = chrome.runtime.getURL('player.html');
      chrome.tabs.create({ url: `${playerUrl}#${entry.url}` });
      window.close();
    });
    
    historyList.appendChild(item);
  });
}

/**
 * Initialize popup
 */
function init() {
  historyList = document.getElementById('history-list');
  
  // Open options button
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
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
