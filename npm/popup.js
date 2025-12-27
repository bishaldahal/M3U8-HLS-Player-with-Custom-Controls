/**
 * HLS Video Player - Popup UI
 * Quick access to recent history and settings
 */

// Cross-browser compatibility: Use browser API if available, fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// DOM Elements
let historyList;
let subtitleSizeSlider;
let subtitleSizeValue;

/**
 * Load subtitle size setting and update UI
 */
async function loadSubtitleSize() {
  if (!window.PlayerSettings) return;
  
  const settings = await window.PlayerSettings.loadSettings();
  const fontSize = settings.subtitleSettings?.fontSize || 100;
  
  if (subtitleSizeSlider && subtitleSizeValue) {
    subtitleSizeSlider.value = fontSize;
    subtitleSizeValue.textContent = `${fontSize}%`;
  }
}

/**
 * Save subtitle size setting
 */
async function saveSubtitleSize(fontSize) {
  if (!window.PlayerSettings) return;
  
  try {
    const settings = await window.PlayerSettings.loadSettings();
    const newSettings = {
      ...settings,
      subtitleSettings: {
        ...settings.subtitleSettings,
        fontSize: parseInt(fontSize)
      }
    };
    
    await window.PlayerSettings.saveSettings(newSettings);
  } catch (error) {
    console.error('Error saving subtitle size:', error);
  }
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
  subtitleSizeSlider = document.getElementById('subtitle-size');
  subtitleSizeValue = document.getElementById('subtitle-size-value');
  
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
  
  // Subtitle size controls
  if (subtitleSizeSlider && subtitleSizeValue) {
    subtitleSizeSlider.addEventListener('input', () => {
      const fontSize = subtitleSizeSlider.value;
      subtitleSizeValue.textContent = `${fontSize}%`;
      saveSubtitleSize(fontSize);
    });
    
    // Load current subtitle size
    loadSubtitleSize();
  }
  
  // Load history
  loadHistoryUI();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
