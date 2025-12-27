/**
 * HLS Video Player - Settings & History Management
 * Handles persistent storage for player preferences and watch history
 */

// Constants
const SUBTITLE_BASE_FONT_SIZE_PX = 24;
const SAVE_DEBOUNCE_MS = 1000;
const SAVE_INTERVAL_MS = 5000;
const TOAST_DURATION_MS = 2500;
const SUBTITLE_AUTO_SAVE_DEBOUNCE_MS = 300;

// Default settings
const DEFAULT_SETTINGS = {
  volume: 1.0,
  muted: false,
  playbackRate: 1.0,
  preferredQuality: 'auto', // 'auto', 'highest', 'lowest'
  saveHistory: true, // Enable history saving by default
  // Subtitle/Caption settings
  subtitleSettings: {
    fontSize: 100,           // percentage: 50-200
    fontColor: '#ffffff',    // hex color
    backgroundColor: '#000000', // hex color
    backgroundOpacity: 80,   // 0-100
    fontFamily: 'sans-serif', // 'sans-serif', 'serif', 'monospace', 'cursive'
    edgeStyle: 'none',       // 'none', 'shadow', 'raised', 'depressed', 'outline'
  },
};

// Maximum history entries to keep (LRU)
const MAX_HISTORY_ENTRIES = 50;

/**
 * Get storage API (chrome.storage or browser.storage or fallback to localStorage wrapper)
 */
function getStorage() {
  // Try browser API first (Firefox), then chrome API
  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  
  if (browserAPI && browserAPI.storage && browserAPI.storage.local) {
    return {
      get: (keys) => browserAPI.storage.local.get(keys),
      set: (items) => browserAPI.storage.local.set(items),
      remove: (keys) => browserAPI.storage.local.remove(keys),
    };
  }
  // Fallback for non-extension contexts
  return {
    get: (keys) => {
      return Promise.resolve(
        keys.reduce((acc, key) => {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              acc[key] = JSON.parse(val);
            } catch (e) {
              acc[key] = val;
            }
          }
          return acc;
        }, {})
      );
    },
    set: (items) => {
      Object.entries(items).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v));
      });
      return Promise.resolve();
    },
    remove: (keys) => {
      keys.forEach((k) => localStorage.removeItem(k));
      return Promise.resolve();
    },
  };
}

const storage = getStorage();

/**
 * Load player settings from storage
 * @returns {Promise<Object>} Settings object
 */
async function loadSettings() {
  try {
    const result = await storage.get(['playerSettings']);
    return { ...DEFAULT_SETTINGS, ...result.playerSettings };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save player settings to storage
 * @param {Object} settings - Settings to save (partial or full)
 */
async function saveSettings(settings) {
  try {
    const current = await loadSettings();
    const updated = { ...current, ...settings };
    await storage.set({ playerSettings: updated });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * Get a clean URL key for history (without extTitle param)
 * @param {string} url - Full URL
 * @returns {string} Clean URL for use as key
 */
function getUrlKey(url) {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('extTitle');
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Load watch history from storage
 * @returns {Promise<Array>} Array of history entries
 */
async function loadHistory() {
  try {
    const result = await storage.get(['watchHistory']);
    return result.watchHistory || [];
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

/**
 * Save a URL to watch history with resume position
 * @param {string} url - Stream URL
 * @param {string} title - Stream title
 * @param {number} currentTime - Current playback position
 * @param {number} duration - Total duration (0 for live)
 */
async function saveToHistory(url, title, currentTime, duration) {
  try {
    // Check if history saving is enabled
    const settings = await loadSettings();
    if (!settings.saveHistory) {
      return; // Don't save if disabled
    }
    
    const history = await loadHistory();
    const urlKey = getUrlKey(url);
    
    // Remove existing entry for this URL
    const filtered = history.filter((entry) => entry.url !== urlKey);
    
    // Add new entry at the beginning
    const newEntry = {
      url: urlKey,
      title: title || 'Untitled Stream',
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration) || 0,
      timestamp: Date.now(),
    };
    
    filtered.unshift(newEntry);
    
    // Keep only MAX_HISTORY_ENTRIES
    const trimmed = filtered.slice(0, MAX_HISTORY_ENTRIES);
    
    await storage.set({ watchHistory: trimmed });
  } catch (error) {
    console.error('Failed to save to history:', error);
  }
}

/**
 * Get resume position for a URL
 * @param {string} url - Stream URL
 * @returns {Promise<number>} Resume position in seconds (0 if not found)
 */
async function getResumePosition(url) {
  try {
    const history = await loadHistory();
    const urlKey = getUrlKey(url);
    const entry = history.find((h) => h.url === urlKey);
    return entry ? entry.currentTime : 0;
  } catch (error) {
    console.error('Failed to get resume position:', error);
    return 0;
  }
}

/**
 * Delete a single history entry
 * @param {string} url - URL to delete
 */
async function deleteHistoryEntry(url) {
  try {
    const history = await loadHistory();
    const filtered = history.filter((entry) => entry.url !== url);
    await storage.set({ watchHistory: filtered });
  } catch (error) {
    console.error('Failed to delete history entry:', error);
  }
}

/**
 * Clear all watch history
 */
async function clearHistory() {
  try {
    await storage.set({ watchHistory: [] });
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
  try {
    await storage.set({ playerSettings: { ...DEFAULT_SETTINGS } });
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }
}

// Export for use in other modules (when using module bundler or global scope)
if (typeof window !== 'undefined') {
  window.PlayerSettings = {
    loadSettings,
    saveSettings,
    loadHistory,
    saveToHistory,
    getResumePosition,
    deleteHistoryEntry,
    clearHistory,
    resetSettings,
    DEFAULT_SETTINGS,
    // Constants
    SUBTITLE_BASE_FONT_SIZE_PX,
    SAVE_DEBOUNCE_MS,
    SAVE_INTERVAL_MS,
    TOAST_DURATION_MS,
    SUBTITLE_AUTO_SAVE_DEBOUNCE_MS,
  };
}
