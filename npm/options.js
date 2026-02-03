const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let currentSpeed = 1.0;
let autoSaveTimer = null;
let historyFilteredData = [];
let selectedHistoryItems = new Set();
const AUTO_SAVE_DEBOUNCE_MS = 300;
const MAX_HISTORY_DISPLAY = 50;

let DOM = {};

function showSaving() {
  const indicator = DOM.autoSaveIndicator;
  const text = DOM.autoSaveText;
  if (!indicator || !text) return;
  
  indicator.classList.add('visible', 'saving');
  text.textContent = 'Saving...';
  
  const icon = indicator.querySelector('svg, .feedback-spinner');
  if (icon) {
    icon.outerHTML = `
      <div class="feedback-spinner feedback-spinner-small">
        <div class="feedback-spinner-bar"></div>
        <div class="feedback-spinner-bar"></div>
        <div class="feedback-spinner-bar"></div>
        <div class="feedback-spinner-bar"></div>
      </div>
    `;
  }
}

function showSaved() {
  const indicator = DOM.autoSaveIndicator;
  const text = DOM.autoSaveText;
  if (!indicator || !text) return;
  
  indicator.classList.remove('saving');
  indicator.classList.add('visible');
  text.textContent = 'Saved';
  
  const icon = indicator.querySelector('.feedback-spinner, svg');
  if (icon) {
    icon.outerHTML = `
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="currentColor"/>
      </svg>
    `;
  }
  
  setTimeout(() => indicator.classList.remove('visible'), 2000);
}

async function autoSaveSettings() {
  clearTimeout(autoSaveTimer);
  showSaving();
  
  autoSaveTimer = setTimeout(async () => {
    try {
      const newSettings = {
        volume: parseFloat(DOM.volumeInput.value),
        playbackRate: currentSpeed,
        saveHistory: DOM.saveHistoryToggle.checked,
        subtitleSettings: getSubtitleSettingsFromUI(),
      };
      
      await window.PlayerSettings.saveSettings(newSettings, { silent: true });
      showSaved();
    } catch (error) {
      console.error('Auto-save failed:', error);
      window.UIFeedback.showToast('Failed to save settings', 'error');
      DOM.autoSaveIndicator?.classList.remove('visible');
    }
  }, AUTO_SAVE_DEBOUNCE_MS);
}

function getSubtitleSettingsFromUI() {
  return {
    fontSize: parseInt(DOM.subtitleFontSize.value),
    fontColor: DOM.subtitleFontColor.value,
    backgroundColor: DOM.subtitleBgColor.value,
    backgroundOpacity: parseInt(DOM.subtitleBgOpacity.value),
    fontFamily: DOM.subtitleFontFamily.value,
    edgeStyle: DOM.subtitleEdgeStyle.value,
  };
}

async function loadAndPopulateSettings() {
  try {
    const settings = await window.PlayerSettings.loadSettings();
    
    DOM.volumeInput.value = settings.volume || 1.0;
    DOM.volumeLabel.textContent = `${Math.round((settings.volume || 1.0) * 100)}%`;
    
    currentSpeed = settings.playbackRate || 1.0;
    DOM.speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
    updateSpeedPresets();
    
    DOM.saveHistoryToggle.checked = settings.saveHistory !== false;
    
    const subtitleSettings = settings.subtitleSettings || {};
    DOM.subtitleFontSize.value = subtitleSettings.fontSize || 100;
    DOM.subtitleFontSizeNumber.value = subtitleSettings.fontSize || 100;
    DOM.subtitleFontColor.value = subtitleSettings.fontColor || '#ffffff';
    DOM.subtitleFontColorLabel.textContent = subtitleSettings.fontColor || '#ffffff';
    DOM.subtitleBgColor.value = subtitleSettings.backgroundColor || '#000000';
    DOM.subtitleBgColorLabel.textContent = subtitleSettings.backgroundColor || '#000000';
    DOM.subtitleBgOpacity.value = subtitleSettings.backgroundOpacity !== undefined ? subtitleSettings.backgroundOpacity : 80;
    DOM.subtitleBgOpacityNumber.value = subtitleSettings.backgroundOpacity !== undefined ? subtitleSettings.backgroundOpacity : 80;
    DOM.subtitleFontFamily.value = subtitleSettings.fontFamily || 'sans-serif';
    DOM.subtitleEdgeStyle.value = subtitleSettings.edgeStyle || 'none';
    
    updateSubtitlePreview();
  } catch (error) {
    console.error('Error loading settings:', error);
    window.UIFeedback.showToast('Failed to load settings', 'error');
  }
}

function updateSpeedPresets() {
  DOM.speedPresets.forEach(btn => {
    const speed = parseFloat(btn.dataset.speed);
    btn.classList.toggle('active', Math.abs(speed - currentSpeed) < 0.01);
  });
}

function updateSubtitlePreview() {
  const preview = DOM.subtitlePreview;
  if (!preview) return;
  
  const fontSize = parseInt(DOM.subtitleFontSize.value);
  const fontColor = DOM.subtitleFontColor.value;
  const bgColor = DOM.subtitleBgColor.value;
  const bgOpacity = parseInt(DOM.subtitleBgOpacity.value);
  const fontFamily = DOM.subtitleFontFamily.value;
  const edgeStyle = DOM.subtitleEdgeStyle.value;
  
  preview.style.fontSize = `${fontSize / 100 * 24}px`;
  preview.style.color = fontColor;
  preview.style.backgroundColor = `${bgColor}${Math.round(bgOpacity / 100 * 255).toString(16).padStart(2, '0')}`;
  preview.style.fontFamily = fontFamily;
  
  preview.style.textShadow = '';
  if (edgeStyle === 'shadow') {
    preview.style.textShadow = '2px 2px 4px rgba(0,0,0,0.9)';
  } else if (edgeStyle === 'raised') {
    preview.style.textShadow = '1px 1px 0px rgba(0,0,0,0.8)';
  } else if (edgeStyle === 'depressed') {
    preview.style.textShadow = '-1px -1px 0px rgba(0,0,0,0.8)';
  } else if (edgeStyle === 'outline') {
    preview.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
  }
}

async function loadHistoryUI() {
  try {
    const history = await window.PlayerSettings.loadHistory();
    historyFilteredData = history;
    renderHistory(history);
  } catch (error) {
    console.error('Error loading history:', error);
    window.UIFeedback.showToast('Failed to load history', 'error');
  }
}

function renderHistory(history) {
  if (!DOM.historyList) return;
  
  DOM.historyList.innerHTML = '';
  
  if (history.length === 0) {
    DOM.historyList.innerHTML = '<div class="history-empty">No watch history</div>';
    return;
  }
  
  const displayHistory = history.slice(0, MAX_HISTORY_DISPLAY);
  
  displayHistory.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.url = entry.url;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'history-checkbox';
    checkbox.addEventListener('change', handleCheckboxChange);
    item.appendChild(checkbox);
    
    const info = document.createElement('div');
    info.className = 'history-info';
    
    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = entry.title;
    title.title = entry.url;
    
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = entry.url;
    
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    
    const timeText = entry.duration > 0
      ?  `${window.PlayerUtils.formatTime(entry.currentTime)} / ${window.PlayerUtils.formatTime(entry.duration)}`
      : `${window.PlayerUtils.formatTime(entry.currentTime)} (Live)`;
    
    meta.innerHTML = `
      <span>${timeText}</span>
      <span class="history-time">${window.PlayerUtils.formatRelativeTime(entry.timestamp)}</span>
    `;
    
    info.appendChild(title);
    info.appendChild(url);
    info.appendChild(meta);
    
    if (entry.duration > 0 && entry.currentTime > 0) {
      const progress = document.createElement('div');
      progress.className = 'history-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'history-progress-bar';
      progressBar.style.width = `${(entry.currentTime / entry.duration) * 100}%`;
      progress.appendChild(progressBar);
      info.appendChild(progress);
    }
    
    item.appendChild(info);
    
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'btn-play';
    playBtn.textContent = '▶';
    playBtn.title = 'Play';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      openPlayer(entry.url);
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '🗑';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryEntry(entry.url);
    };
    
    actions.appendChild(playBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    
    DOM.historyList.appendChild(item);
  });
}

function handleCheckboxChange() {
  const checkboxes = DOM.historyList.querySelectorAll('.history-checkbox:checked');
  selectedHistoryItems.clear();
  
  checkboxes.forEach(cb => {
    const url = cb.closest('.history-item').dataset.url;
    selectedHistoryItems.add(url);
  });
  
  DOM.batchActions.classList.toggle('visible', selectedHistoryItems.size > 0);
  DOM.selectedCount.textContent = selectedHistoryItems.size;
}

function filterHistory() {
  const searchText = DOM.historySearch.value.toLowerCase().trim();
  
  if (!searchText) {
    renderHistory(historyFilteredData);
    return;
  }
  
  const filtered = historyFilteredData.filter(entry => {
    return entry.title.toLowerCase().includes(searchText) ||
           entry.url.toLowerCase().includes(searchText);
  });
  
  renderHistory(filtered);
}

async function deleteSelected() {
  if (selectedHistoryItems.size === 0) return;
  
  const confirmMsg = `Delete ${selectedHistoryItems.size} selected item${selectedHistoryItems.size > 1 ? 's' : ''}?`;
  if (!confirm(confirmMsg)) return;
  
  try {
    const count = selectedHistoryItems.size;
    
    for (const url of selectedHistoryItems) {
      await window.PlayerSettings.deleteHistoryEntry(url);
    }
    
    selectedHistoryItems.clear();
    await loadHistoryUI();
    DOM.batchActions.classList.remove('visible');
    window.UIFeedback.showToast(`Deleted ${count} item${count > 1 ? 's' : ''}`, 'success');
  } catch (error) {
    console.error('Error deleting history:', error);
    window.UIFeedback.showToast('Failed to delete items', 'error');
  }
}

async function deleteHistoryEntry(url) {
  if (!confirm('Delete this entry?')) return;
  
  try {
    await window.PlayerSettings.deleteHistoryEntry(url);
    await loadHistoryUI();
    window.UIFeedback.showToast('Entry deleted', 'success');
  } catch (error) {
    console.error('Error deleting entry:', error);
    window.UIFeedback.showToast('Failed to delete entry', 'error');
  }
}

async function clearAllHistory() {
  if (!confirm('Clear all watch history? This cannot be undone.')) return;
  
  try {
    await window.PlayerSettings.clearHistory();
    await loadHistoryUI();
    window.UIFeedback.showToast('History cleared', 'success');
  } catch (error) {
    console.error('Error clearing history:', error);
    window.UIFeedback.showToast('Failed to clear history', 'error');
  }
}

async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  
  try {
    await window.PlayerSettings.resetSettings();
    await loadAndPopulateSettings();
    window.UIFeedback.showToast('Settings reset to defaults', 'success');
  } catch (error) {
    console.error('Error resetting settings:', error);
    window.UIFeedback.showToast('Failed to reset settings', 'error');
  }
}

function openPlayer(url) {
  const playerUrl = browserAPI.runtime.getURL('player.html');
  browserAPI.tabs.create({ url: `${playerUrl}#${url}` });
}

async function init() {
  DOM = {
    autoSaveIndicator: document.getElementById('auto-save-indicator'),
    autoSaveText: document.getElementById('auto-save-text'),
    
    volumeInput: document.getElementById('volume'),
    volumeLabel: document.getElementById('volume-label'),
    
    speedDisplay: document.getElementById('speed-display'),
    speedDecrease: document.getElementById('speed-decrease'),
    speedIncrease: document.getElementById('speed-increase'),
    speedReset: document.getElementById('speed-reset'),
    speedPresets: document.querySelectorAll('.speed-preset'),
    
    saveHistoryToggle: document.getElementById('save-history'),
    resetSettingsBtn: document.getElementById('reset-settings'),
    
    subtitlePreview: document.querySelector('.subtitle-text'),
    subtitleFontSize: document.getElementById('subtitle-font-size'),
    subtitleFontSizeNumber: document.getElementById('subtitle-font-size-number'),
    subtitleFontColor: document.getElementById('subtitle-font-color'),
    subtitleFontColorLabel: document.getElementById('subtitle-font-color-label'),
    subtitleBgColor: document.getElementById('subtitle-bg-color'),
    subtitleBgColorLabel: document.getElementById('subtitle-bg-color-label'),
    subtitleBgOpacity: document.getElementById('subtitle-bg-opacity'),
    subtitleBgOpacityNumber: document.getElementById('subtitle-bg-opacity-number'),
    subtitleFontFamily: document.getElementById('subtitle-font-family'),
    subtitleEdgeStyle: document.getElementById('subtitle-edge-style'),
    toggleAdvancedSubtitles: document.getElementById('toggle-advanced-subtitles'),
    advancedSubtitleSettings: document.getElementById('advanced-subtitle-settings'),
    resetSubtitleBtn: document.getElementById('reset-subtitle-settings'),
    
    historySearch: document.getElementById('history-search'),
    historyList: document.getElementById('history-list'),
    batchActions: document.getElementById('batch-actions'),
    selectedCount: document.getElementById('selected-count'),
    deleteSelectedBtn: document.getElementById('delete-selected'),
    clearHistoryBtn: document.getElementById('clear-history'),
  };
  
  await loadAndPopulateSettings();
  
  DOM.volumeInput.oninput = () => {
    DOM.volumeLabel.textContent = `${Math.round(DOM.volumeInput.value * 100)}%`;
    autoSaveSettings();
  };
  
  DOM.speedDecrease.onclick = () => {
    currentSpeed = Math.max(0.25, currentSpeed - 0.25);
    DOM.speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
    updateSpeedPresets();
    autoSaveSettings();
  };
  
  DOM.speedIncrease.onclick = () => {
    currentSpeed = Math.min(4.0, currentSpeed + 0.25);
    DOM.speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
    updateSpeedPresets();
    autoSaveSettings();
  };
  
  DOM.speedReset.onclick = () => {
    currentSpeed = 1.0;
    DOM.speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
    updateSpeedPresets();
    autoSaveSettings();
  };
  
  DOM.speedPresets.forEach(btn => {
    btn.onclick = () => {
      currentSpeed = parseFloat(btn.dataset.speed);
      DOM.speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
      updateSpeedPresets();
      autoSaveSettings();
    };
  });
  
  DOM.saveHistoryToggle.onchange = () => autoSaveSettings();
  DOM.resetSettingsBtn.onclick = () => resetSettings();
  
  const syncSliderAndNumber = (slider, numberInput, label, updateFn) => {
    slider.oninput = () => {
      numberInput.value = slider.value;
      if (label) label.textContent = `${slider.value}%`;
      updateFn();
      autoSaveSettings();
    };
    numberInput.oninput = () => {
      slider.value = numberInput.value;
      if (label) label.textContent = `${numberInput.value}%`;
      updateFn();
      autoSaveSettings();
    };
  };
  
  syncSliderAndNumber(DOM.subtitleFontSize, DOM.subtitleFontSizeNumber, null, updateSubtitlePreview);
  syncSliderAndNumber(DOM.subtitleBgOpacity, DOM.subtitleBgOpacityNumber, null, updateSubtitlePreview);
  
  DOM.subtitleFontColor.oninput = () => {
    DOM.subtitleFontColorLabel.textContent = DOM.subtitleFontColor.value;
    updateSubtitlePreview();
    autoSaveSettings();
  };
  
  DOM.subtitleBgColor.oninput = () => {
    DOM.subtitleBgColorLabel.textContent = DOM.subtitleBgColor.value;
    updateSubtitlePreview();
    autoSaveSettings();
  };
  
  DOM.subtitleFontFamily.onchange = () => {
    updateSubtitlePreview();
    autoSaveSettings();
  };
  
  DOM.subtitleEdgeStyle.onchange = () => {
    updateSubtitlePreview();
    autoSaveSettings();
  };
  
  DOM.toggleAdvancedSubtitles.onclick = () => {
    const isHidden = DOM.advancedSubtitleSettings.classList.toggle('hidden');
    DOM.toggleAdvancedSubtitles.setAttribute('aria-expanded', !isHidden);
    DOM.advancedSubtitleSettings.setAttribute('aria-hidden', isHidden);
    DOM.toggleAdvancedSubtitles.querySelector('span').textContent = isHidden ? 'More Options' : 'Less Options';
  };
  
  DOM.resetSubtitleBtn.onclick = async () => {
    if (!confirm('Reset subtitle settings to defaults?')) return;
    try {
      const settings = await window.PlayerSettings.loadSettings();
      await window.PlayerSettings.saveSettings({
        ...settings,
        subtitleSettings: window.PlayerSettings.DEFAULT_SETTINGS.subtitleSettings
      });
      await loadAndPopulateSettings();
      window.UIFeedback.showToast('Subtitle settings reset', 'success');
    } catch (error) {
      console.error('Error resetting subtitles:', error);
      window.UIFeedback.showToast('Failed to reset settings', 'error');
    }
  };
  
  await loadHistoryUI();
  
  DOM.historySearch.oninput = () => filterHistory();
  DOM.deleteSelectedBtn.onclick = () => deleteSelected();
  DOM.clearHistoryBtn.onclick = () => clearAllHistory();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
