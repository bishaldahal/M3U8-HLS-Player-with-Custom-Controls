/**
 * HLS Video Player - Options Page
 * Handles settings UI and watch history management
 */

// Cross-browser compatibility: Use browser API if available, fall back to chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// DOM Elements
let volumeInput, saveBtn, resetBtn;
let historyList, clearHistoryBtn, saveHistoryToggle;
let speedPresets, speedDisplay, currentSpeed;
let speedIncreaseBtn, speedDecreaseBtn, speedResetBtn;

// Subtitle setting elements
let subtitleFontSize, subtitleFontSizeNumber, subtitleFontColor, subtitleBgColor, subtitleBgOpacity, subtitleBgOpacityNumber;
let subtitleFontFamily, subtitleEdgeStyle, subtitlePreview, resetSubtitleBtn;
let toggleAdvancedSubtitlesBtn, advancedSubtitleSettings;


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
    
    // Load subtitle settings
    const subtitleSettings = settings.subtitleSettings || window.PlayerSettings.DEFAULT_SETTINGS.subtitleSettings;
    loadSubtitleSettingsUI(subtitleSettings);
    
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
      subtitleSettings: getSubtitleSettingsFromUI(),
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
        const playerUrl = browserAPI.runtime.getURL('player.html');
        browserAPI.tabs.create({ url: `${playerUrl}#${entry.url}` });
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
 * Load subtitle settings into UI controls
 */
function loadSubtitleSettingsUI(subtitleSettings) {
  subtitleFontSize.value = subtitleSettings.fontSize || 100;
  if (subtitleFontSizeNumber) {
    subtitleFontSizeNumber.value = subtitleFontSize.value;
  }
  subtitleFontColor.value = subtitleSettings.fontColor || '#ffffff';
  subtitleBgColor.value = subtitleSettings.backgroundColor || '#000000';
  subtitleBgOpacity.value = subtitleSettings.backgroundOpacity || 80;
  if (subtitleBgOpacityNumber) {
    subtitleBgOpacityNumber.value = subtitleBgOpacity.value;
  }
  subtitleFontFamily.value = subtitleSettings.fontFamily || 'sans-serif';
  subtitleEdgeStyle.value = subtitleSettings.edgeStyle || 'none';
  
  updateSubtitleLabels();
  updateSubtitlePreview();
}

/**
 * Update subtitle setting labels
 */
function updateSubtitleLabels() {
  document.getElementById('subtitle-font-size-label').textContent = `${subtitleFontSize.value}%`;
  document.getElementById('subtitle-font-color-label').textContent = subtitleFontColor.value;
  document.getElementById('subtitle-bg-color-label').textContent = subtitleBgColor.value;
  document.getElementById('subtitle-bg-opacity-label').textContent = `${subtitleBgOpacity.value}%`;
}

/**
 * Get current subtitle settings from UI
 */
function getSubtitleSettingsFromUI() {
  return {
    fontSize: parseInt(subtitleFontSize.value),
    fontColor: subtitleFontColor.value,
    backgroundColor: subtitleBgColor.value,
    backgroundOpacity: parseInt(subtitleBgOpacity.value),
    fontFamily: subtitleFontFamily.value,
    edgeStyle: subtitleEdgeStyle.value,
  };
}



/**
 * Update subtitle preview element
 */
function updateSubtitlePreview() {
  if (!window.SubtitleUtils) {
    console.error('SubtitleUtils not loaded');
    return;
  }
  
  const settings = getSubtitleSettingsFromUI();
  const subtitleText = subtitlePreview.querySelector('.subtitle-text');
  
  if (!subtitleText) return;
  
  const baseFontSize = window.PlayerSettings?.SUBTITLE_BASE_FONT_SIZE_PX || 24;
  
  // Apply font size
  subtitleText.style.fontSize = `${baseFontSize * settings.fontSize / 100}px`;
  
  // Apply font color
  subtitleText.style.color = settings.fontColor;
  
  // Apply background with opacity
  subtitleText.style.backgroundColor = window.SubtitleUtils.hexToRgba(settings.backgroundColor, settings.backgroundOpacity);
  
  // Apply font family
  subtitleText.style.fontFamily = settings.fontFamily;
  
  // Apply edge style
  subtitleText.style.textShadow = window.SubtitleUtils.getEdgeStyleCSS(settings.edgeStyle);
}

// Debounce timer for subtitle auto-save
let subtitleSaveDebounceTimer = null;

/**
 * Save subtitle settings with debouncing to prevent excessive writes
 */
function debouncedSaveSubtitleSettings() {
  const debounceMs = window.PlayerSettings?.SUBTITLE_AUTO_SAVE_DEBOUNCE_MS || 300;
  
  clearTimeout(subtitleSaveDebounceTimer);
  subtitleSaveDebounceTimer = setTimeout(async () => {
    if (!window.PlayerSettings) return;

    try {
      // We need to load current settings first to preserve other settings
      const currentSettings = await window.PlayerSettings.loadSettings();
      
      const newSettings = {
        ...currentSettings,
        subtitleSettings: getSubtitleSettingsFromUI()
      };
      
      await window.PlayerSettings.saveSettings(newSettings);
      console.log('Subtitle settings saved');
    } catch (error) {
      console.error('Error auto-saving subtitle settings:', error);
    }
  }, debounceMs);
}

/**
 * Reset subtitle settings to defaults
 */
async function resetSubtitleSettingsUI() {
  if (!window.PlayerSettings) {
    showToast('Error: Settings module not loaded', true);
    return;
  }
  
  const defaultSubtitleSettings = window.PlayerSettings.DEFAULT_SETTINGS.subtitleSettings;
  loadSubtitleSettingsUI(defaultSubtitleSettings);
  
  // Save the reset
  try {
    await window.PlayerSettings.saveSettings({ subtitleSettings: defaultSubtitleSettings });
    showToast('✓ Subtitle settings reset to defaults');
  } catch (error) {
    console.error('Error resetting subtitle settings:', error);
    showToast('Failed to reset subtitle settings', true);
  }
}

/**
 * Initialize DOM element references
 */
function initDOMElements() {
  // Get general DOM elements
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
  
  // Get subtitle DOM elements
  subtitleFontSize = document.getElementById('subtitle-font-size');
  subtitleFontSizeNumber = document.getElementById('subtitle-font-size-number');
  subtitleFontColor = document.getElementById('subtitle-font-color');
  subtitleBgColor = document.getElementById('subtitle-bg-color');
  subtitleBgOpacity = document.getElementById('subtitle-bg-opacity');
  subtitleBgOpacityNumber = document.getElementById('subtitle-bg-opacity-number');
  subtitleFontFamily = document.getElementById('subtitle-font-family');
  subtitleEdgeStyle = document.getElementById('subtitle-edge-style');
  subtitlePreview = document.getElementById('subtitle-preview');
  resetSubtitleBtn = document.getElementById('reset-subtitle-settings');
  
  toggleAdvancedSubtitlesBtn = document.getElementById('toggle-advanced-subtitles');
  advancedSubtitleSettings = document.getElementById('advanced-subtitle-settings');
}

/**
 * Setup event listeners for general settings
 */
function initGeneralSettingsListeners() {
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

/**
 * Setup event listeners for subtitle settings
 */
function initSubtitleSettingsListeners() {
  
  // Advanced Subtitles Toggle
  if (toggleAdvancedSubtitlesBtn && advancedSubtitleSettings) {
    toggleAdvancedSubtitlesBtn.addEventListener('click', () => {
      advancedSubtitleSettings.classList.toggle('hidden');
      const isHidden = advancedSubtitleSettings.classList.contains('hidden');
      toggleAdvancedSubtitlesBtn.querySelector('span').textContent = isHidden 
        ? '⚙️ More Options' 
        : '🔼 Less Options';
    });
  }
  
  // Subtitle settings event listeners (live preview + debounced auto-save)
  if (subtitleFontSize && subtitleFontSizeNumber) {
    // Sync slider -> number
    subtitleFontSize.addEventListener('input', () => {
      subtitleFontSizeNumber.value = subtitleFontSize.value;
      updateSubtitleLabels();
      updateSubtitlePreview();
      debouncedSaveSubtitleSettings();
    });
    // Sync number -> slider
    subtitleFontSizeNumber.addEventListener('input', () => {
      subtitleFontSize.value = subtitleFontSizeNumber.value;
      updateSubtitleLabels();
      updateSubtitlePreview();
      debouncedSaveSubtitleSettings();
    });
  }

  // Sync background opacity slider and number input
  if (subtitleBgOpacity && subtitleBgOpacityNumber) {
    // Sync slider -> number
    subtitleBgOpacity.addEventListener('input', () => {
      subtitleBgOpacityNumber.value = subtitleBgOpacity.value;
      updateSubtitleLabels();
      updateSubtitlePreview();
      debouncedSaveSubtitleSettings();
    });
    // Sync number -> slider
    subtitleBgOpacityNumber.addEventListener('input', () => {
      subtitleBgOpacity.value = subtitleBgOpacityNumber.value;
      updateSubtitleLabels();
      updateSubtitlePreview();
      debouncedSaveSubtitleSettings();
    });
  }

  const subtitleInputs = [
    subtitleFontColor, 
    subtitleBgColor, 
    subtitleFontFamily, 
    subtitleEdgeStyle
  ];

  // Consolidated event handler for all subtitle inputs
  const handleSubtitleChange = () => {
    updateSubtitleLabels();
    updateSubtitlePreview();
    debouncedSaveSubtitleSettings();
  };

  subtitleInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', handleSubtitleChange);
      // For selects, also listen to change event
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', handleSubtitleChange);
      }
    }
  });

  if (resetSubtitleBtn) {
    resetSubtitleBtn.addEventListener('click', resetSubtitleSettingsUI);
  }
}

/**
 * Initialize options page
 */
function init() {
  // Initialize DOM references
  initDOMElements();
  
  // Initialize speed
  currentSpeed = 1.0;
  
  // Load initial data
  loadSettingsUI();
  loadHistoryUI();
  
  // Setup event listeners
  initGeneralSettingsListeners();
  initSubtitleSettingsListeners();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
