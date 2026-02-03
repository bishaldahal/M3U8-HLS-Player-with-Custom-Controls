/**
 * HLS Video Player - Centralized State Manager
 * Manages settings and storage with debouncing, error handling, and event emissions
 */

const STATE_MANAGER_CONFIG = {
  AUTO_SAVE_DEBOUNCE_MS: 300,
  STORAGE_KEY_SETTINGS: 'playerSettings',
  STORAGE_KEY_HISTORY: 'watchHistory',
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

class StateManager {
  constructor() {
    this.storage = this._getStorage();
    this.pendingSaves = new Map();
    this.listeners = new Map();
    this.loadingStates = new Map();
    this.lastSavedSettings = null;
    this.lastSavedHistory = null;
    this._initialized = false;
  }

  /**
   * Initialize state manager and load current state
   */
  async initialize() {
    if (this._initialized) return;
    
    try {
      this._setLoading('settings', true);
      this.lastSavedSettings = await this._loadSettingsFromStorage();
      this._initialized = true;
      this._emit('initialized');
    } catch (error) {
      this._emit('error', { type: 'initialization', error });
      throw error;
    } finally {
      this._setLoading('settings', false);
    }
  }

  /**
   * Get storage API with chrome/browser compatibility
   */
  _getStorage() {
    const browserAPI = typeof browser !== 'undefined' ? browser : 
                       (typeof chrome !== 'undefined' ? chrome : null);
    
    if (browserAPI?.storage?.local) {
      return {
        get: (keys) => browserAPI.storage.local.get(keys),
        set: (items) => browserAPI.storage.local.set(items),
        remove: (keys) => browserAPI.storage.local.remove(keys),
        getBytesInUse: (keys) => browserAPI.storage.local.getBytesInUse?.(keys) || Promise.resolve(0),
      };
    }

    // LocalStorage fallback for non-extension contexts
    return {
      get: (keys) => {
        const result = {};
        keys.forEach(key => {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              result[key] = JSON.parse(val);
            } catch (e) {
              result[key] = val;
            }
          }
        });
        return Promise.resolve(result);
      },
      set: (items) => {
        Object.entries(items).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
        });
        return Promise.resolve();
      },
      remove: (keys) => {
        keys.forEach(k => localStorage.removeItem(k));
        return Promise.resolve();
      },
      getBytesInUse: () => Promise.resolve(0),
    };
  }

  /**
   * Load settings from storage
   */
  async _loadSettingsFromStorage() {
    const result = await this.storage.get([STATE_MANAGER_CONFIG.STORAGE_KEY_SETTINGS]);
    return result[STATE_MANAGER_CONFIG.STORAGE_KEY_SETTINGS] || null;
  }

  /**
   * Save to storage with retry logic
   */
  async _saveToStorage(key, value, attempt = 1) {
    try {
      await this.storage.set({ [key]: value });
      return true;
    } catch (error) {
      if (attempt < STATE_MANAGER_CONFIG.MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, STATE_MANAGER_CONFIG.RETRY_DELAY_MS));
        return this._saveToStorage(key, value, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Update settings with auto-save and debouncing
   */
  async updateSettings(partialSettings, options = {}) {
    const {
      debounce = true,
      debounceMs = STATE_MANAGER_CONFIG.AUTO_SAVE_DEBOUNCE_MS,
      silent = false,
    } = options;

    // Merge with current settings
    const currentSettings = this.lastSavedSettings || {};
    const updatedSettings = this._deepMerge(currentSettings, partialSettings);

    // Validate settings
    const validation = this._validateSettings(updatedSettings);
    if (!validation.valid) {
      const error = new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      this._emit('error', { type: 'validation', error, settings: partialSettings });
      throw error;
    }

    // Update in-memory state immediately
    this.lastSavedSettings = updatedSettings;

    // Emit optimistic update
    if (!silent) {
      this._emit('settingsChanged', { settings: updatedSettings, saved: false });
    }

    if (debounce) {
      return this._debouncedSave('settings', updatedSettings, debounceMs, silent);
    } else {
      return this._saveSettings(updatedSettings, silent);
    }
  }

  /**
   * Save settings immediately
   */
  async _saveSettings(settings, silent = false) {
    const key = STATE_MANAGER_CONFIG.STORAGE_KEY_SETTINGS;
    
    try {
      this._setLoading('settingsSave', true);
      await this._saveToStorage(key, settings);
      this.lastSavedSettings = settings;
      
      if (!silent) {
        this._emit('settingsSaved', { settings });
      }
      return { success: true };
    } catch (error) {
      this._emit('error', { type: 'save', error, key });
      throw error;
    } finally {
      this._setLoading('settingsSave', false);
    }
  }

  /**
   * Debounced save implementation
   */
  _debouncedSave(key, value, debounceMs, silent) {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (this.pendingSaves.has(key)) {
        clearTimeout(this.pendingSaves.get(key).timeout);
      }

      // Emit saving state
      if (!silent) {
        this._emit('saving', { key });
      }

      const timeout = setTimeout(async () => {
        try {
          if (key === 'settings') {
            const result = await this._saveSettings(value, silent);
            resolve(result);
          } else {
            await this._saveToStorage(STATE_MANAGER_CONFIG.STORAGE_KEY_HISTORY, value);
            if (!silent) {
              this._emit('historySaved', { history: value });
            }
            resolve({ success: true });
          }
          this.pendingSaves.delete(key);
        } catch (error) {
          reject(error);
          this.pendingSaves.delete(key);
        }
      }, debounceMs);

      this.pendingSaves.set(key, { timeout, resolve, reject });
    });
  }

  /**
   * Get current settings (in-memory)
   */
  getSettings() {
    return this.lastSavedSettings ? { ...this.lastSavedSettings } : null;
  }

  /**
   * Reload settings from storage
   */
  async reloadSettings() {
    this._setLoading('settings', true);
    try {
      this.lastSavedSettings = await this._loadSettingsFromStorage();
      this._emit('settingsReloaded', { settings: this.lastSavedSettings });
      return this.lastSavedSettings;
    } catch (error) {
      this._emit('error', { type: 'reload', error });
      throw error;
    } finally {
      this._setLoading('settings', false);
    }
  }

  /**
   * Check storage quota usage
   */
  async checkStorageQuota() {
    try {
      const bytesInUse = await this.storage.getBytesInUse([
        STATE_MANAGER_CONFIG.STORAGE_KEY_SETTINGS,
        STATE_MANAGER_CONFIG.STORAGE_KEY_HISTORY,
      ]);
      
      // Chrome local storage quota is typically 5-10MB
      const QUOTA_WARNING_THRESHOLD = 5 * 1024 * 1024; // 5MB
      
      if (bytesInUse > QUOTA_WARNING_THRESHOLD) {
        this._emit('quotaWarning', { bytesInUse });
      }
      
      return bytesInUse;
    } catch (error) {
      console.warn('Could not check storage quota:', error);
      return 0;
    }
  }

  /**
   * Validate settings object
   */
  _validateSettings(settings) {
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
        if (!this._isValidHexColor(sub.fontColor)) {
          errors.push('subtitleSettings.fontColor must be a valid hex color');
        }
      }

      if (sub.backgroundColor !== undefined) {
        if (!this._isValidHexColor(sub.backgroundColor)) {
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
   */
  _isValidHexColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  /**
   * Deep merge objects (for nested settings)
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Set loading state
   */
  _setLoading(key, isLoading) {
    this.loadingStates.set(key, isLoading);
    this._emit('loadingChanged', { key, isLoading });
  }

  /**
   * Check if currently loading
   */
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Flush all pending saves immediately
   */
  async flushPendingSaves() {
    const pending = Array.from(this.pendingSaves.entries());
    
    for (const [key, { timeout }] of pending) {
      clearTimeout(timeout);
    }

    const promises = pending.map(([key]) => {
      const saveData = this.pendingSaves.get(key);
      this.pendingSaves.delete(key);
      
      if (key === 'settings') {
        return this._saveSettings(this.lastSavedSettings, true);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.pendingSaves.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingSaves.clear();
    this.listeners.clear();
    this.loadingStates.clear();
  }
}

// Create singleton instance
const stateManager = new StateManager();

// Export for global use
if (typeof window !== 'undefined') {
  window.StateManager = stateManager;
}
