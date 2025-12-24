// HLS Video Player - Settings & History Management

const storage = browserAPI.storage.local;

const DEFAULT_SETTINGS = {
  volume: 1.0,
  muted: false,
  playbackRate: 1.0,
  saveHistory: true,
  customShortcuts: {}
};

const DEFAULT_SHORTCUTS = {
  playPause: { key: ' ', display: 'Space', description: 'Play/Pause', category: 'Playback' },
  playPauseAlt: { key: 'k', display: 'K', description: 'Play/Pause (alt)', category: 'Playback' },
  seekStart: { key: 'Home', display: 'Home', description: 'Seek to beginning', category: 'Playback' },
  seekEnd: { key: 'End', display: 'End', description: 'Seek to end', category: 'Playback' },
  seekBack10: { key: 'ArrowLeft', display: '←', description: 'Seek back 10s', category: 'Navigation' },
  seekForward10: { key: 'ArrowRight', display: '→', description: 'Seek forward 10s', category: 'Navigation' },
  seekBack5: { key: 'j', display: 'J', description: 'Seek back 5s', category: 'Navigation' },
  seekForward5: { key: 'l', display: 'L', description: 'Seek forward 5s', category: 'Navigation' },
  speedDown01: { key: '<', display: '<', description: 'Speed -0.1', category: 'Speed' },
  speedUp01: { key: '>', display: '>', description: 'Speed +0.1', category: 'Speed' },
  speedDown05: { key: '-', display: '-', description: 'Speed -0.5', category: 'Speed' },
  speedUp05: { key: '+', display: '+', description: 'Speed +0.5', category: 'Speed' },
  volumeUp: { key: 'ArrowUp', display: '↑', description: 'Volume up', category: 'Volume' },
  volumeDown: { key: 'ArrowDown', display: '↓', description: 'Volume down', category: 'Volume' },
  mute: { key: 'm', display: 'M', description: 'Mute/Unmute', category: 'Volume' },
  framePrev: { key: ',', display: ',', description: 'Previous frame', category: 'Frame' },
  frameNext: { key: '.', display: '.', description: 'Next frame', category: 'Frame' },
  fullscreen: { key: 'f', display: 'F', description: 'Fullscreen', category: 'View' },
  pipEnter: { key: 'p', display: 'P', description: 'Enter PiP', category: 'View' },
  pipExit: { key: 'P', display: 'Shift+P', description: 'Exit PiP', category: 'View' },
  stats: { key: 'i', display: 'I', description: 'Toggle stats', category: 'View' },
  shortcuts: { key: '?', display: '?', description: 'Show shortcuts', category: 'View' }
};

const MAX_HISTORY = 50;

// Settings
async function loadSettings() {
  const result = await storage.get('playerSettings');
  return { ...DEFAULT_SETTINGS, ...result.playerSettings };
}

async function saveSettings(settings) {
  const current = await loadSettings();
  await storage.set({ playerSettings: { ...current, ...settings } });
}

async function resetSettings() {
  await storage.set({ playerSettings: { ...DEFAULT_SETTINGS } });
}

// History
function getUrlKey(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('extTitle');
    return u.href;
  } catch {
    return url;
  }
}

async function loadHistory() {
  const result = await storage.get('watchHistory');
  return result.watchHistory || [];
}

async function saveToHistory(url, title, currentTime, duration) {
  const settings = await loadSettings();
  if (!settings.saveHistory) return;

  const history = await loadHistory();
  const urlKey = getUrlKey(url);
  const filtered = history.filter(e => e.url !== urlKey);

  filtered.unshift({
    url: urlKey,
    title: title || 'Untitled Stream',
    currentTime: Math.floor(currentTime),
    duration: Math.floor(duration) || 0,
    timestamp: Date.now()
  });

  await storage.set({ watchHistory: filtered.slice(0, MAX_HISTORY) });
}

async function getResumePosition(url) {
  const history = await loadHistory();
  const entry = history.find(h => h.url === getUrlKey(url));
  return entry?.currentTime || 0;
}

async function deleteHistoryEntry(url) {
  const history = await loadHistory();
  await storage.set({ watchHistory: history.filter(e => e.url !== url) });
}

async function clearHistory() {
  await storage.set({ watchHistory: [] });
}

// Shortcuts
async function getShortcuts() {
  const settings = await loadSettings();
  const custom = settings.customShortcuts || {};
  const merged = {};
  for (const [id, def] of Object.entries(DEFAULT_SHORTCUTS)) {
    merged[id] = custom[id] ? { ...def, ...custom[id] } : { ...def };
  }
  return merged;
}

async function saveCustomShortcut(actionId, key, display) {
  const settings = await loadSettings();
  const custom = settings.customShortcuts || {};
  custom[actionId] = { key, display };
  await saveSettings({ customShortcuts: custom });
}

async function resetShortcut(actionId) {
  const settings = await loadSettings();
  const custom = settings.customShortcuts || {};
  delete custom[actionId];
  await saveSettings({ customShortcuts: custom });
}

async function resetAllShortcuts() {
  await saveSettings({ customShortcuts: {} });
}

window.PlayerSettings = {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  loadSettings,
  saveSettings,
  resetSettings,
  loadHistory,
  saveToHistory,
  getResumePosition,
  deleteHistoryEntry,
  clearHistory,
  getShortcuts,
  saveCustomShortcut,
  resetShortcut,
  resetAllShortcuts
};
