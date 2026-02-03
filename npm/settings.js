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
    if (typeof window !== 'undefined' && window.UIFeedback) {
      window.UIFeedback.error('Failed to load settings');
    }
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save player settings to storage
 * @param {Object} settings - Settings to save (partial or full)
 * @param {Object} options - Save options (debounce, silent, etc.)
 */
async function saveSettings(settings, options = {}) {
  try {
    // Validate settings before saving
    const validation = validateSettings(settings);
    if (!validation.valid) {
      const errorMsg = `Invalid settings: ${validation.errors.join(', ')}`;
      console.error(errorMsg);
      if (typeof window !== 'undefined' && window.UIFeedback && !options.silent) {
        window.UIFeedback.error(errorMsg);
      }
      throw new Error(errorMsg);
    }

    const current = await loadSettings();
    const updated = deepMerge(current, settings);
    
    // Check storage quota before saving
    await checkStorageQuota();
    
    await storage.set({ playerSettings: updated });
    
    if (typeof window !== 'undefined' && window.UIFeedback && !options.silent && options.showSuccess) {
      window.UIFeedback.success('Settings saved');
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    if (typeof window !== 'undefined' && window.UIFeedback && !options.silent) {
      window.UIFeedback.error('Failed to save settings');
    }
    throw error;
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
    if (typeof window !== 'undefined' && window.UIFeedback) {
      window.UIFeedback.success('Settings reset to defaults');
    }
  } catch (error) {
    console.error('Failed to reset settings:', error);
    if (typeof window !== 'undefined' && window.UIFeedback) {
      window.UIFeedback.error('Failed to reset settings');
    }
    throw error;
  }
}

/**
 * Validate settings object
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validation result with valid flag and errors array
 */
function validateSettings(settings) {
  const errors = [];

  if (settings.volume !== undefined) {
    if (typeof settings.volume !== 'number' || settings.volume < 0 || settings.volume > 1) {
      errors.push('volume must be between 0 and 1');
    }
  }

  if (settings.playbackRate !== undefined) {
    if (typeof settings.playbackRate !== 'number' || settings.playbackRate < 0.25 || settings.playbackRate > 4) {
      errors.push('playbackRate must be between 0.25 and 4');
    }
  }

  if (settings.subtitleSettings) {
    const sub = settings.subtitleSettings;
    
    if (sub.fontSize !== undefined) {
      if (typeof sub.fontSize !== 'number' || sub.fontSize < 50 || sub.fontSize > 400) {
        errors.push('subtitleSettings.fontSize must be between 50 and 400');
      }
    }

    if (sub.backgroundOpacity !== undefined) {
      if (typeof sub.backgroundOpacity !== 'number' || sub.backgroundOpacity < 0 || sub.backgroundOpacity > 100) {
        errors.push('subtitleSettings.backgroundOpacity must be between 0 and 100');
      }
    }

    if (sub.fontColor !== undefined) {
      if (!isValidHexColor(sub.fontColor)) {
        errors.push('subtitleSettings.fontColor must be a valid hex color');
      }
    }

    if (sub.backgroundColor !== undefined) {
      if (!isValidHexColor(sub.backgroundColor)) {
        errors.push('subtitleSettings.backgroundColor must be a valid hex color');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate hex color format
 * @param {string} color - Color to validate
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Deep merge objects (for nested settings)
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Check storage quota and warn if approaching limit
 * @returns {Promise<number>} Bytes in use
 */
async function checkStorageQuota() {
  try {
    const browserAPI = typeof browser !== 'undefined' ? browser : 
                       (typeof chrome !== 'undefined' ? chrome : null);
    
    if (browserAPI?.storage?.local?.getBytesInUse) {
      const bytesInUse = await browserAPI.storage.local.getBytesInUse(['playerSettings', 'watchHistory']);
      const QUOTA_WARNING_THRESHOLD = 5 * 1024 * 1024; // 5MB
      
      if (bytesInUse > QUOTA_WARNING_THRESHOLD) {
        console.warn(`Storage usage: ${(bytesInUse / 1024 / 1024).toFixed(2)}MB`);
        if (typeof window !== 'undefined' && window.UIFeedback) {
          window.UIFeedback.warning('Storage usage is high. Consider clearing old history.');
        }
      }
      
      return bytesInUse;
    }
    return 0;
  } catch (error) {
    console.warn('Could not check storage quota:', error);
    return 0;
  }
}

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
  };
}
