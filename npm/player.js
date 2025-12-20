/**
 * HLS Video Player - Main player logic
 * Handles stream playback, live stream time display, and video focus management
 */

// Player state - exported for use in shortcuts.js
let player = null;
let video = null;
let mediaTimeDisplay = null;
let mediastreamtype = null;
let resumePosition = 0;
let currentStreamUrl = '';
let currentStreamTitle = '';
let saveHistoryTimeout = null;

/**
 * Initialize and play an HLS stream
 * @param {string} url - The M3U8 stream URL (with optional extTitle parameter)
 */
function playStream(url) {
  try {
    const m3u8Url = new URL(url);
    const title = m3u8Url.searchParams.get('extTitle');
    m3u8Url.searchParams.delete('extTitle');

    // Store for history tracking
    currentStreamUrl = url;
    currentStreamTitle = title || 'Untitled Stream';

    // Set the page title if provided
    if (title) {
      document.title = title;
    }

    // Create the HLS video element
    const videoElement = document.createElement('hls-video');
    videoElement.setAttribute('slot', 'media');
    videoElement.setAttribute('crossorigin', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('src', m3u8Url.href);

    // Append to the media controller
    player.appendChild(videoElement);
    document.body.appendChild(player);

    return videoElement;
  } catch (error) {
    console.error('Failed to play stream:', error);
    
    // Create error display safely without XSS vulnerability
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'color: white; padding: 20px; font-family: sans-serif;';
    
    const h1 = document.createElement('h1');
    h1.textContent = 'Error Loading Stream';
    
    const p1 = document.createElement('p');
    p1.textContent = `Failed to parse URL: ${error.message}`;
    
    const p2 = document.createElement('p');
    p2.textContent = `URL: ${url}`;
    
    errorDiv.appendChild(h1);
    errorDiv.appendChild(p1);
    errorDiv.appendChild(p2);
    
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
    
    return null;
  }
}

/**
 * Handle live stream time display updates
 */
function setupLiveTimeDisplay() {
  video.addEventListener('timeupdate', () => {
    if (mediastreamtype !== 'live') return;

    const totalDuration = mediaTimeDisplay.getAttribute('mediaseekable');
    if (!totalDuration) return;

    const [, end] = totalDuration.split(':');
    const [seconds, milliseconds] = end.split('.');
    const totalSeconds = (parseFloat(seconds) || 0) + (parseFloat(milliseconds) || 0) / 1000;

    mediaTimeDisplay.setAttribute('mediaduration', totalSeconds);
    mediaTimeDisplay.setAttribute('remaining', '');
  });
}

/**
 * Handle pause/play resume position tracking
 */
function setupResumePosition() {
  video.addEventListener('pause', () => {
    resumePosition = video.currentTime;
    // Debounced save to history on pause
    debouncedSaveHistory();
  });

  video.addEventListener('play', () => {
    video.currentTime = resumePosition;
    // Reset to beginning if near the end
    if (video.currentTime >= video.duration - 5) {
      video.currentTime = 0;
    }
  });
}

/**
 * Debounced save to history (prevents excessive writes)
 */
function debouncedSaveHistory() {
  if (saveHistoryTimeout) {
    clearTimeout(saveHistoryTimeout);
  }
  saveHistoryTimeout = setTimeout(() => {
    if (window.PlayerSettings && video && currentStreamUrl) {
      window.PlayerSettings.saveToHistory(
        currentStreamUrl,
        currentStreamTitle,
        video.currentTime,
        video.duration || 0
      );
    }
  }, 1000);
}

/**
 * Apply loaded settings to the video element
 * @param {Object} settings - Settings object
 */
function applySettings(settings) {
  if (!video) return;
  
  video.volume = settings.volume;
  video.muted = settings.muted;
  video.playbackRate = settings.playbackRate;
}

/**
 * Setup event listeners to save settings on change
 */
function setupSettingsSaver() {
  if (!window.PlayerSettings) return;

  // Save volume changes
  video.addEventListener('volumechange', () => {
    window.PlayerSettings.saveSettings({
      volume: video.volume,
      muted: video.muted,
    });
  });

  // Save playback rate changes
  video.addEventListener('ratechange', () => {
    window.PlayerSettings.saveSettings({
      playbackRate: video.playbackRate,
    });
  });

  // Save history on time update (throttled)
  let lastSaveTime = 0;
  video.addEventListener('timeupdate', () => {
    const now = Date.now();
    // Save every 30 seconds during playback
    if (now - lastSaveTime > 30000 && !video.paused) {
      lastSaveTime = now;
      debouncedSaveHistory();
    }
  });

  // Save before page unload
  window.addEventListener('beforeunload', () => {
    if (video && currentStreamUrl) {
      window.PlayerSettings.saveToHistory(
        currentStreamUrl,
        currentStreamTitle,
        video.currentTime,
        video.duration || 0
      );
    }
  });
}

/**
 * Focus the video element for keyboard controls
 */
function focusVideo() {
  if (video) {
    video.focus();
  }
}

/**
 * Initialize the player
 */
async function init() {
  player = document.querySelector('media-controller');
  
  if (!player) {
    console.error('Media controller not found');
    return;
  }

  // Get URL from hash fragment
  const url = window.location.hash.slice(1);
  
  if (!url) {
    document.body.innerHTML = `
      <div style="color: white; padding: 20px; font-family: sans-serif;">
        <h1>No Stream URL</h1>
        <p>Please provide an M3U8 URL in the hash fragment.</p>
      </div>
    `;
    return;
  }

  // Play the stream
  video = playStream(url);
  
  if (!video) return;

  mediaTimeDisplay = document.querySelector('media-time-display');

  // Load and apply settings, get resume position
  let settings = window.PlayerSettings?.DEFAULT_SETTINGS || {};
  let savedResumePos = 0;
  
  if (window.PlayerSettings) {
    settings = await window.PlayerSettings.loadSettings();
    savedResumePos = await window.PlayerSettings.getResumePosition(url);
  }

  // Wait for metadata to determine stream type and apply settings
  video.addEventListener('loadedmetadata', () => {
    mediastreamtype = player.getAttribute('mediastreamtype');
    
    // Apply saved settings
    applySettings(settings);
    
    // Resume from saved position (only for non-live streams)
    if (savedResumePos > 0 && mediastreamtype !== 'live') {
      // Don't resume if we're near the end
      if (savedResumePos < video.duration - 10) {
        video.currentTime = savedResumePos;
        resumePosition = savedResumePos;
      }
    }
  });

  // Setup event handlers
  setupLiveTimeDisplay();
  setupResumePosition();
  setupSettingsSaver();

  // Focus video on load
  window.addEventListener('load', focusVideo);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
