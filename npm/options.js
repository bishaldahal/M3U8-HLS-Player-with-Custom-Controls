// HLS Video Player - Options Page

// DOM refs
let volumeInput, saveBtn, resetBtn, historyList, clearHistoryBtn, saveHistoryToggle;
let speedPresets, speedDisplay, speedIncreaseBtn, speedDecreaseBtn, speedResetBtn;
let historySearchInput, historyExpandBtn, historyExpandControls, historyCountEl;
let shortcutsConfig, recordingHint, resetAllShortcutsBtn, shortcutsFilterBtns;

// State
let historyData = [];
let currentSpeed = 1.0;
let undoData = null;
let undoTimeout = null;
let currentRecordingAction = null;
let activeFilter = 'all';
let isHistoryExpanded = false;
const COLLAPSED_COUNT = 5;

// Toast
function showToast(message, isError = false) {
  document.querySelector('.toast')?.remove();
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

function showToastWithUndo(message, undoCallback) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${escapeHtml(message)}</span>
    <button class="toast-undo" style="margin-left:12px;padding:4px 12px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;cursor:pointer">Undo</button>`;
  
  toast.querySelector('.toast-undo').onclick = () => {
    clearTimeout(undoTimeout);
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
    undoCallback();
  };
  
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  undoTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
    undoData = null;
  }, 5000);
}

// Settings UI
async function loadSettingsUI() {
  const settings = await loadSettings();
  volumeInput.value = settings.volume || 1.0;
  currentSpeed = settings.playbackRate || 1.0;
  saveHistoryToggle.checked = settings.saveHistory !== false;
  updateVolumeLabel();
  updateSpeedDisplay();
  updateSpeedPresets();
}

function updateVolumeLabel() {
  const label = document.getElementById('volume-label');
  if (label) label.textContent = `${Math.round(volumeInput.value * 100)}%`;
}

function updateSpeedDisplay() {
  if (speedDisplay) speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
}

function updateSpeedPresets() {
  speedPresets.forEach(btn => {
    btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - currentSpeed) < 0.01);
  });
}

function changeSpeed(delta) {
  currentSpeed = Math.max(0.1, Math.min(10.0, Math.round((currentSpeed + delta) * 100) / 100));
  updateSpeedDisplay();
  updateSpeedPresets();
}

async function saveSettingsUI() {
  await saveSettings({
    volume: parseFloat(volumeInput.value),
    playbackRate: currentSpeed,
    saveHistory: saveHistoryToggle.checked
  });
  showToast('✓ Settings saved!');
}

async function resetSettingsUI() {
  if (!confirm('Reset all settings to defaults?')) return;
  await resetSettings();
  await loadSettingsUI();
  showToast('✓ Settings reset');
}

// History UI
async function loadHistoryUI() {
  historyData = await loadHistory();
  isHistoryExpanded = false;
  historyExpandBtn?.classList.remove('expanded');
  historyList?.classList.remove('expanded');
  historyList?.classList.add('collapsed');
  renderHistoryList(historyData);
}

function renderHistoryList(entries) {
  if (!historyList) return;
  historyList.innerHTML = '';
  
  const total = entries?.length || 0;
  const showExpand = total > COLLAPSED_COUNT;
  
  if (historyExpandControls) historyExpandControls.style.display = showExpand ? 'flex' : 'none';
  if (historyCountEl) {
    const shown = isHistoryExpanded ? total : Math.min(total, COLLAPSED_COUNT);
    historyCountEl.textContent = `Showing ${shown} of ${total} items`;
  }
  
  if (!total) {
    const search = historySearchInput?.value?.trim();
    historyList.innerHTML = search
      ? `<div class="history-empty">🔍 No results for "${escapeHtml(search)}"</div>`
      : '<div class="history-empty">📺 No watch history yet</div>';
    return;
  }
  
  const toShow = isHistoryExpanded ? entries : entries.slice(0, COLLAPSED_COUNT);
  
  toShow.forEach(entry => {
    if (!entry) return;
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const progress = entry.duration > 0 ? Math.min(100, (entry.currentTime / entry.duration) * 100) : 0;
    const timeStr = entry.duration > 0
      ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
      : `${formatTime(entry.currentTime)} (Live)`;
    
    item.innerHTML = `
      <div class="history-info">
        <div class="history-title">${escapeHtml(entry.title)}</div>
        <div class="history-url" title="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</div>
        <div class="history-meta">${timeStr} <span class="history-time">${formatRelativeTime(entry.timestamp)}</span></div>
        ${entry.duration > 0 ? `<div class="history-progress"><div class="history-progress-bar" style="width:${progress}%"></div></div>` : ''}
      </div>
      <div class="history-actions">
        <button class="btn-play" title="Play">▶</button>
        <button class="btn-delete" title="Delete">✕</button>
      </div>
    `;
    
    item.querySelector('.btn-play')?.addEventListener('click', () => {
      browserAPI.tabs.create({ url: `${browserAPI.runtime.getURL('player.html')}#${entry.url}` });
    });
    
    item.querySelector('.btn-delete')?.addEventListener('click', async () => {
      await deleteHistoryEntry(entry.url);
      await loadHistoryUI();
      showToast('✓ Entry deleted');
    });
    
    historyList.appendChild(item);
  });
}

function toggleHistoryExpand() {
  isHistoryExpanded = !isHistoryExpanded;
  historyExpandBtn?.classList.toggle('expanded', isHistoryExpanded);
  historyExpandBtn.innerHTML = isHistoryExpanded
    ? '<span>Show Less</span><span class="expand-icon">▼</span>'
    : '<span>Show More</span><span class="expand-icon">▼</span>';
  historyList?.classList.toggle('expanded', isHistoryExpanded);
  historyList?.classList.toggle('collapsed', !isHistoryExpanded);
  
  const search = historySearchInput?.value?.trim();
  search ? filterHistory(search) : renderHistoryList(historyData);
  if (!isHistoryExpanded) historyList?.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterHistory(term) {
  if (!term.trim()) {
    renderHistoryList(historyData);
    return;
  }
  const q = term.toLowerCase();
  const filtered = historyData.filter(e => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
  isHistoryExpanded = true;
  renderHistoryList(filtered);
}

async function clearAllHistory() {
  undoData = [...historyData];
  await clearHistory();
  historyData = [];
  renderHistoryList([]);
  showToastWithUndo('All history cleared', async () => {
    if (undoData?.length) {
      for (const e of undoData) {
        await window.PlayerSettings.saveToHistory(e.url, e.title, e.currentTime, e.duration);
      }
      undoData = null;
      await loadHistoryUI();
      showToast('✓ History restored');
    }
  });
}

// Shortcuts UI
async function loadShortcutsUI() {
  const shortcuts = await getShortcuts();
  renderShortcutsList(shortcuts);
}

async function renderShortcutsList(shortcuts) {
  if (!shortcutsConfig) return;
  
  const settings = await loadSettings();
  const custom = settings?.customShortcuts || {};
  
  shortcutsConfig.innerHTML = '';
  
  const entries = Object.entries(shortcuts || {});
  const filtered = activeFilter === 'all' ? entries : entries.filter(([, d]) => d?.category === activeFilter);
  
  if (!filtered.length) {
    shortcutsConfig.innerHTML = '<div class="history-empty">No shortcuts in this category</div>';
    return;
  }
  
  filtered.forEach(([actionId, data]) => {
    if (!data) return;
    const isModified = !!custom[actionId];
    const defaultKey = DEFAULT_SHORTCUTS[actionId]?.key || '';
    
    const row = document.createElement('div');
    row.className = 'shortcut-row';
    row.dataset.action = actionId;
    
    row.innerHTML = `
      <div class="shortcut-info">
        <div class="shortcut-action">${escapeHtml(data.description)}</div>
        <div class="shortcut-category">${escapeHtml(data.category)}</div>
      </div>
      <div class="shortcut-controls">
        <button class="shortcut-key ${isModified ? 'modified' : ''}" title="Click to change">${escapeHtml(data.display || data.key)}</button>
        <button class="shortcut-reset ${isModified ? '' : 'hidden'}" title="Reset to default (${escapeHtml(defaultKey)})">↩</button>
      </div>
    `;
    
    row.querySelector('.shortcut-key')?.addEventListener('click', () => startRecording(actionId, row));
    row.querySelector('.shortcut-reset')?.addEventListener('click', () => doResetShortcut(actionId));
    
    shortcutsConfig.appendChild(row);
  });
}

function startRecording(actionId, row) {
  cancelRecording();
  currentRecordingAction = actionId;
  row.classList.add('recording');
  row.querySelector('.shortcut-key').classList.add('recording');
  row.querySelector('.shortcut-key').textContent = '...';
  recordingHint?.classList.add('show');
  document.addEventListener('keydown', handleRecordKeyDown);
}

function cancelRecording() {
  if (!currentRecordingAction) return;
  recordingHint?.classList.remove('show');
  document.removeEventListener('keydown', handleRecordKeyDown);
  currentRecordingAction = null;
  loadShortcutsUI();
}

function getKeyDisplay(key) {
  const map = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ' ': 'Space' };
  return map[key] || key.toUpperCase();
}

async function handleRecordKeyDown(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (e.key === 'Escape') {
    cancelRecording();
    return;
  }
  
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
  
  const key = e.key;
  const display = getKeyDisplay(key);
  
  const shortcuts = await getShortcuts();
  const conflict = Object.entries(shortcuts).find(([id, d]) => id !== currentRecordingAction && d.key.toLowerCase() === key.toLowerCase());
  
  if (conflict) {
    showToast(`"${display}" is already used for "${conflict[1].description}"`, true);
    cancelRecording();
    return;
  }
  
  await saveCustomShortcut(currentRecordingAction, key, display);
  showToast(`✓ Shortcut set to "${display}"`);
  
  recordingHint?.classList.remove('show');
  document.removeEventListener('keydown', handleRecordKeyDown);
  currentRecordingAction = null;
  await loadShortcutsUI();
}

async function doResetShortcut(actionId) {
  await resetShortcut(actionId);
  await loadShortcutsUI();
  showToast('✓ Shortcut reset');
}

async function doResetAllShortcuts() {
  if (!confirm('Reset all shortcuts to defaults?')) return;
  await resetAllShortcuts();
  await loadShortcutsUI();
  showToast('✓ All shortcuts reset');
}

function handleFilterClick(e) {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  shortcutsFilterBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  loadShortcutsUI();
}

// Init
function init() {
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
  historySearchInput = document.getElementById('history-search');
  historyExpandBtn = document.getElementById('history-expand-btn');
  historyExpandControls = document.getElementById('history-expand-controls');
  historyCountEl = document.getElementById('history-count');
  shortcutsConfig = document.getElementById('shortcuts-config');
  recordingHint = document.getElementById('recording-hint');
  resetAllShortcutsBtn = document.getElementById('reset-all-shortcuts');
  shortcutsFilterBtns = document.querySelectorAll('.filter-btn');
  
  loadSettingsUI();
  loadHistoryUI();
  loadShortcutsUI();
  
  volumeInput?.addEventListener('input', updateVolumeLabel);
  saveBtn?.addEventListener('click', saveSettingsUI);
  resetBtn?.addEventListener('click', resetSettingsUI);
  clearHistoryBtn?.addEventListener('click', clearAllHistory);
  historyExpandBtn?.addEventListener('click', toggleHistoryExpand);
  
  let searchTimeout;
  historySearchInput?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterHistory(e.target.value), 200);
  });
  
  speedIncreaseBtn?.addEventListener('click', () => changeSpeed(0.1));
  speedDecreaseBtn?.addEventListener('click', () => changeSpeed(-0.1));
  speedResetBtn?.addEventListener('click', () => { currentSpeed = 1.0; updateSpeedDisplay(); updateSpeedPresets(); });
  
  speedPresets.forEach(btn => btn.addEventListener('click', () => {
    currentSpeed = parseFloat(btn.dataset.speed);
    updateSpeedDisplay();
    updateSpeedPresets();
  }));
  
  shortcutsFilterBtns.forEach(btn => btn.addEventListener('click', handleFilterClick));
  resetAllShortcutsBtn?.addEventListener('click', doResetAllShortcuts);
  
  document.addEventListener('click', e => {
    if (currentRecordingAction && !e.target.closest('.shortcut-key') && !e.target.closest('.shortcut-row.recording')) {
      cancelRecording();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
