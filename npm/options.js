/**
 * HLS Video Player - Options Page
 * Handles settings UI and watch history management
 */

// DOM Elements
let volumeInput, saveBtn, resetBtn;
let historyList, clearHistoryBtn, saveHistoryToggle;
let speedPresets, speedDisplay, currentSpeed;
let speedIncreaseBtn, speedDecreaseBtn, speedResetBtn;


/**
 * Load and display current settings
 */
async function loadSettingsUI() {
  if (!window.PlayerSettings) {
    console.error('PlayerSettings not loaded');
    showToast('Error: Settings module not loaded', true);
    return;
  }
  
  try {
    const settings = await window.PlayerSettings.loadSettings();
    console.log('Loaded settings:', settings);
    
    volumeInput.value = settings.volume || 1.0;
    currentSpeed = settings.playbackRate || 1.0;
    saveHistoryToggle.checked = settings.saveHistory !== false;
    
    updateVolumeLabel();
    updateSpeedDisplay();
    updateSpeedPresets();
  } catch (error) {
    console.error('Error loading settings:', error);
    showToast('Failed to load settings', true);
  }
}

/**
 * Update volume label display
 */
function updateVolumeLabel() {
  const label = document.getElementById('volume-label');
  if (label) {
    label.textContent = `${Math.round(volumeInput.value * 100)}%`;
  }
}

/**
 * Update speed display
 */
function updateSpeedDisplay() {
  if (speedDisplay) {
    speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
  }
}

/**
 * Update speed preset buttons
 */
function updateSpeedPresets() {
  speedPresets.forEach(btn => {
    const speed = parseFloat(btn.dataset.speed);
    if (Math.abs(speed - currentSpeed) < 0.01) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Change playback speed
 */
function changeSpeed(delta) {
  currentSpeed = Math.max(0.1, Math.min(10.0, currentSpeed + delta));
  currentSpeed = Math.round(currentSpeed * 100) / 100;
  updateSpeedDisplay();
  updateSpeedPresets();
}

/**
 * Reset speed to default
 */
function resetSpeed() {
  currentSpeed = 1.0;
  updateSpeedDisplay();
  updateSpeedPresets();
}

/**
 * Save settings from UI
 */
async function saveSettingsUI() {
  if (!window.PlayerSettings) {
    showToast('Error: Settings module not loaded', true);
    return;
  }
  
  try {
    const newSettings = {
      volume: parseFloat(volumeInput.value),
      playbackRate: currentSpeed,
      saveHistory: saveHistoryToggle.checked,
    };
    console.log('Saving settings:', newSettings);
    
    await window.PlayerSettings.saveSettings(newSettings);
    
    showToast('✓ Settings saved successfully!');
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Failed to save settings', true);
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettingsUI() {
  if (!confirm('Reset all settings to default values?')) return;
  
  if (!window.PlayerSettings) {
    showToast('Error: Settings module not loaded', true);
    return;
  }
  
  try {
    await window.PlayerSettings.resetSettings();
    await loadSettingsUI();
    showToast('✓ Settings reset to defaults');
  } catch (error) {
    console.error('Error resetting settings:', error);
    showToast('Failed to reset settings', true);
  }
}

/**
 * Load and display watch history
 */
async function loadHistoryUI() {
  if (!window.PlayerSettings) {
    console.error('PlayerSettings not loaded');
    historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
    return;
  }
  
  try {
    const history = await window.PlayerSettings.loadHistory();
    console.log('Loaded history:', history.length, 'items');
    
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">📺 No watch history yet<br><small>Start watching streams to see them here</small></div>';
      return;
    }
    
    history.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const progress = entry.duration > 0 
        ? Math.min(100, (entry.currentTime / entry.duration) * 100)
        : 0;
      
      item.innerHTML = `
        <div class="history-info">
          <div class="history-title">${escapeHtml(entry.title)}</div>
          <div class="history-url" title="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</div>
          <div class="history-meta">
            ${entry.duration > 0 
              ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
              : `${formatTime(entry.currentTime)} (Live)`
            }
            <span class="history-time">${formatRelativeTime(entry.timestamp)}</span>
          </div>
          ${entry.duration > 0 ? `<div class="history-progress"><div class="history-progress-bar" style="width: ${progress}%"></div></div>` : ''}
        </div>
        <div class="history-actions">
          <button class="btn-play" title="Play">▶</button>
          <button class="btn-delete" title="Delete">✕</button>
        </div>
      `;
      
      // Play button
      item.querySelector('.btn-play').addEventListener('click', () => {
        const playerUrl = chrome.runtime.getURL('player.html');
        chrome.tabs.create({ url: `${playerUrl}#${entry.url}` });
      });
      
      // Delete button
      item.querySelector('.btn-delete').addEventListener('click', async () => {
        await window.PlayerSettings.deleteHistoryEntry(entry.url);
        await loadHistoryUI();
        showToast('✓ Entry deleted');
      });
      
      historyList.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading history:', error);
    historyList.innerHTML = '<div class="history-empty">Error loading history</div>';
  }
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
 * Clear all history
 */
async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all watch history?\n\nThis action cannot be undone.')) return;
  
  if (!window.PlayerSettings) {
    showToast('Error: Settings module not loaded', true);
    return;
  }
  
  try {
    await window.PlayerSettings.clearHistory();
    await loadHistoryUI();
    showToast('✓ All history cleared');
  } catch (error) {
    console.error('Error clearing history:', error);
    showToast('Failed to clear history', true);
  }
}

/**
 * Show a toast notification
 */
function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  if (isError) {
    toast.style.background = '#da3633';
    toast.style.borderColor = '#f85149';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

/**
 * Set playback speed from preset
 */
function setSpeedPreset(speed) {
  currentSpeed = speed;
  updateSpeedDisplay();
  updateSpeedPresets();
}

/**
 * Initialize options page
 */
function init() {
  // Get DOM elements
  volumeInput = document.getElementById('volume');
  saveBtn = document.getElementById('save-settings');
  resetBtn = document.getElementById('reset-settings');
  historyList = document.getElementById('history-list');
  clearHistoryBtn = document.getElementById('clear-history');
  saveHistoryToggle = document.getElementById('save-history');
  speedPresets = document.querySelectorAll('.speed-preset');
  speedDisplay = document.getElementById('speed-display');
  speedIncreaseBtn = document.getElementById('speed-increase');
  speedDecreaseBtn = document.getElementById('speed-decrease');
  speedResetBtn = document.getElementById('speed-reset');
  
  // Initialize speed
  currentSpeed = 1.0;
  
  // Load initial data
  loadSettingsUI();
  loadHistoryUI();
  
  // Event listeners
  volumeInput.addEventListener('input', updateVolumeLabel);
  saveBtn.addEventListener('click', saveSettingsUI);
  resetBtn.addEventListener('click', resetSettingsUI);
  clearHistoryBtn.addEventListener('click', clearAllHistory);
  
  // Speed controls
  speedIncreaseBtn.addEventListener('click', () => changeSpeed(0.1));
  speedDecreaseBtn.addEventListener('click', () => changeSpeed(-0.1));
  speedResetBtn.addEventListener('click', resetSpeed);
  
  // Speed preset buttons
  speedPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      setSpeedPreset(parseFloat(btn.dataset.speed));
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
