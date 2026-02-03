const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

let debounceTimer = null;
const DEBOUNCE_MS = 300;

async function loadSubtitleSize() {
  try {
    const settings = await window.PlayerSettings.loadSettings();
    const fontSize = settings.subtitleSettings?.fontSize || 100;
    const subtitlesEnabled = settings.subtitlesEnabled !== false; // default to true
    
    const slider = document.getElementById('subtitle-size');
    const value = document.getElementById('subtitle-size-value');
    const toggle = document.getElementById('subtitles-enabled');
    
    if (slider && value) {
      slider.value = fontSize;
      value.textContent = `${fontSize}%`;
    }
    
    if (toggle) {
      toggle.checked = subtitlesEnabled;
    }
  } catch (error) {
    console.error('Error loading subtitle size:', error);
    window.UIFeedback.showToast('Failed to load subtitle settings', 'error');
  }
}

async function saveSubtitleSize(fontSize) {
  const savingIndicator = document.getElementById('saving-indicator');
  const saveStatus = document.getElementById('save-status');
  
  if (savingIndicator) savingIndicator.classList.add('visible');
  if (saveStatus) saveStatus.classList.remove('visible');
  
  clearTimeout(debounceTimer);
  
  debounceTimer = setTimeout(async () => {
    try {
      const settings = await window.PlayerSettings.loadSettings();
      await window.PlayerSettings.saveSettings({
        ...settings,
        subtitleSettings: {
          ...settings.subtitleSettings,
          fontSize: parseInt(fontSize)
        }
      }, { silent: true });
      
      if (savingIndicator) savingIndicator.classList.remove('visible');
      if (saveStatus) {
        saveStatus.classList.add('visible');
        setTimeout(() => saveStatus.classList.remove('visible'), 2000);
      }
    } catch (error) {
      console.error('Error saving subtitle size:', error);
      if (savingIndicator) savingIndicator.classList.remove('visible');
      window.UIFeedback.showToast('Failed to save subtitle size', 'error');
    }
  }, DEBOUNCE_MS);
}

async function saveSubtitlesEnabled(enabled) {
  try {
    const settings = await window.PlayerSettings.loadSettings();
    await window.PlayerSettings.saveSettings({
      ...settings,
      subtitlesEnabled: enabled
    }, { silent: true });
  } catch (error) {
    console.error('Error saving subtitle enabled state:', error);
    window.UIFeedback.showToast('Failed to save subtitle setting', 'error');
  }
}

async function loadHistoryUI() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  
  try {
    historyList.innerHTML = '<div class="history-empty">Loading...</div>';
    
    const history = await window.PlayerSettings.loadHistory();
    
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No recent streams<br/><small>Start watching M3U8/HLS streams and they will appear here</small></div>';
      return;
    }
    
    const recent = history.slice(0, 5);
    
    recent.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Play ${entry.title}`);
      
      const info = document.createElement('div');
      info.className = 'history-info';
      
      const title = document.createElement('div');
      title.className = 'history-title';
      title.textContent = entry.title;
      title.title = entry.url;
      
      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const timeText = entry.duration > 0 
        ? `${window.PlayerUtils.formatTime(entry.currentTime)} / ${window.PlayerUtils.formatTime(entry.duration)}`
        : `${window.PlayerUtils.formatTime(entry.currentTime)} (Live)`;
      meta.textContent = `${timeText} • ${window.PlayerUtils.formatRelativeTime(entry.timestamp)}`;
      
      info.appendChild(title);
      info.appendChild(meta);
      item.appendChild(info);
      
      const playHandler = () => {
        const playerUrl = browserAPI.runtime.getURL('player.html');
        browserAPI.tabs.create({ url: `${playerUrl}#${entry.url}` });
        window.close();
      };
      
      item.onclick = playHandler;
      item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playHandler();
        }
      };
      
      historyList.appendChild(item);
      
      if (index === 0) item.focus();
    });
  } catch (error) {
    console.error('Error loading history:', error);
    historyList.innerHTML = '<div class="history-empty">Error loading history<br/><small>Please try again</small></div>';
  }
}

function init() {
  const openOptionsBtn = document.getElementById('open-options');
  openOptionsBtn.onclick = () => {
    browserAPI.runtime.openOptionsPage();
    window.close();
  };
  
  const openShortcutsBtn = document.getElementById('open-shortcuts');
  openShortcutsBtn.onclick = () => {
    const shortcutsUrl = browserAPI.runtime.getURL('shortcuts.html');
    browserAPI.tabs.create({ url: shortcutsUrl });
    window.close();
  };
  
  const subtitleSlider = document.getElementById('subtitle-size');
  const subtitleValue = document.getElementById('subtitle-size-value');
  
  if (subtitleSlider && subtitleValue) {
    subtitleSlider.oninput = () => {
      subtitleValue.textContent = `${subtitleSlider.value}%`;
      saveSubtitleSize(subtitleSlider.value);
    };
    
    loadSubtitleSize();
  }
  
  const subtitlesToggle = document.getElementById('subtitles-enabled');
  if (subtitlesToggle) {
    subtitlesToggle.onchange = () => {
      saveSubtitlesEnabled(subtitlesToggle.checked);
    };
  }
  
  loadHistoryUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
