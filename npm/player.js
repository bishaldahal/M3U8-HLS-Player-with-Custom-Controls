/**
 * Stream Player - Main player logic
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
let currentStreamType = null;

/**
 * Detect stream type from URL
 * @returns {'hls'|'dash'|null}
 */
function detectStreamType(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    if (pathname.endsWith('.m3u8') || pathname.includes('.m3u8?')) return 'hls';
    if (pathname.endsWith('.mpd') || pathname.includes('.mpd?')) return 'dash';
    return null;
  } catch {
    return null;
  }
}

/**
 * Initialize and play a stream
 * @param {string} url - Stream URL (with optional extTitle parameter)
 */
function playStream(url) {
  try {
    const streamUrl = new URL(url);
    const title = streamUrl.searchParams.get('extTitle');
    streamUrl.searchParams.delete('extTitle');

    const streamType = detectStreamType(streamUrl.href);
    if (!streamType) {
      throw new Error('Unsupported stream type. Only .m3u8 and .mpd are supported.');
    }
    currentStreamType = streamType;

    // Store for history tracking
    currentStreamUrl = url;
    currentStreamTitle = title || 'Untitled Stream';

    // Set the page title if provided
    if (title) {
      document.title = title;
    }

    // Create the media element based on stream type
    const tagName = streamType === 'dash' ? 'dash-video' : 'hls-video';
    const videoElement = document.createElement(tagName);
    videoElement.setAttribute('slot', 'media');
    videoElement.setAttribute('crossorigin', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.setAttribute('src', streamUrl.href);

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

  // Update resume position when seeking while paused
  video.addEventListener('seeked', () => {
    if (video.paused) {
      resumePosition = video.currentTime;
    }
  });

  video.addEventListener('play', () => {
    video.currentTime = resumePosition;

    if (mediastreamtype !== 'live' && video.currentTime >= video.duration - 5) {
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
  
  // Apply subtitle styles if enabled
  if (settings.subtitlesEnabled !== false && settings.subtitleSettings) {
    applySubtitleStyles(settings.subtitleSettings);
  } else if (settings.subtitlesEnabled === false) {
    // Disable all subtitle tracks if subtitles are disabled
    if (video?.textTracks) {
      Array.from(video.textTracks)
        .filter(track => track.kind === 'subtitles' || track.kind === 'captions')
        .forEach(track => track.mode = 'disabled');
    }
  }
}

/**
 * Setup subtitle track listener to reapply styles when tracks are added
 */
function setupSubtitleTrackListener() {
  if (!video || !video.textTracks) return;
  
  video.textTracks.addEventListener('addtrack', async (e) => {
    // Wait a bit for the track to be fully loaded
    setTimeout(async () => {
      const settings = await window.PlayerSettings.loadSettings();
      if (settings.subtitlesEnabled !== false && settings.subtitleSettings) {
        applySubtitleStyles(settings.subtitleSettings);
      } else if (settings.subtitlesEnabled === false) {
        // Disable the track if subtitles are disabled
        e.track.mode = 'disabled';
      }
    }, 100);
  });
}

/**
 * Wait for subtitle cues to be parsed by HLS.js after seeking
 * HLS.js loads subtitle fragments on-demand, so we need to wait for them
 */
function waitForSubtitleCues(hlsInstance, timeoutMs = 2000) {
  if (!hlsInstance) return Promise.resolve();

  return new Promise((resolve) => {
    const cleanup = () => {
      hlsInstance.off('hlsSubtitleFragProcessed', resolve);
      hlsInstance.off('hlsCuesParsed', resolve);
      resolve();
    };

    // Wait for either event indicating subtitles are ready
    hlsInstance.once('hlsSubtitleFragProcessed', resolve);
    hlsInstance.once('hlsCuesParsed', resolve);

    // Fallback timeout
    setTimeout(cleanup, timeoutMs);
  });
}

/**
 * Enable subtitle tracks and apply custom styles
 */
function enableSubtitles(settings) {
  if (!video?.textTracks) return;

  // Check if subtitles are globally enabled
  const subtitlesEnabled = settings.subtitlesEnabled !== false; // default to true

  // Show or hide all subtitle and caption tracks
  Array.from(video.textTracks)
    .filter(track => track.kind === 'subtitles' || track.kind === 'captions')
    .forEach(track => track.mode = subtitlesEnabled ? 'showing' : 'disabled');

  // Apply custom styles if enabled
  if (subtitlesEnabled && settings.subtitleSettings) {
    applySubtitleStyles(settings.subtitleSettings);
  }
}

/**
 * Resume playback from saved position with subtitle support
 */
async function resumeFromPosition(resumePos, settings) {
  video.currentTime = resumePos;
  
  // Wait for seek to complete
  await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }));
  
  // Wait for HLS.js to load subtitle fragments for the new position
  if (currentStreamType === 'hls') {
    await waitForSubtitleCues(video.api);
  }
  
  // Enable subtitles and apply styles
  enableSubtitles(settings);
  
  // Fallback check to ensure subtitles are visible
  setTimeout(() => enableSubtitles(settings), 300);
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/**
 * Get text-shadow CSS for edge style
 */
function getEdgeStyleCSS(edgeStyle) {
  switch (edgeStyle) {
    case 'shadow':
      return '2px 2px 4px rgba(0, 0, 0, 0.9)';
    case 'raised':
      return '1px 1px 0 #000, 2px 2px 0 #333';
    case 'depressed':
      return '-1px -1px 0 #000, -2px -2px 0 #333';
    case 'outline':
      return '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    default:
      return 'none';
  }
}

/**
 * Apply subtitle styles using ::cue CSS injection
 * @param {Object} subtitleSettings - Subtitle settings object
 */
function applySubtitleStyles(subtitleSettings) {
  if (!video) return;

  // We need to inject styles into the shadow DOM of the custom element
  // because the video element is encapsulated there.
  const targetRoot = video.shadowRoot || document.head;
  
  // Remove existing subtitle style if any
  const existingStyle = targetRoot.getElementById('subtitle-custom-style');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const {
    fontSize = 100,
    fontColor = '#ffffff',
    backgroundColor = '#000000',
    backgroundOpacity = 80,
    fontFamily = 'sans-serif',
    edgeStyle = 'none',
  } = subtitleSettings;
  
  // Calculate font size (base is approximately 2.5% of video height)
  const fontSizePercent = fontSize / 100;
  const bgColor = hexToRgba(backgroundColor, backgroundOpacity);
  const textShadow = getEdgeStyleCSS(edgeStyle);
  
  // Create style element with ::cue rules
  const style = document.createElement('style');
  style.id = 'subtitle-custom-style';
  style.textContent = `
    video::cue {
      font-size: ${fontSizePercent}em;
      color: ${fontColor};
      background-color: ${bgColor};
      font-family: ${fontFamily};
      text-shadow: ${textShadow};
      outline: none;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Fallback for webkit browsers */
    video::-webkit-media-text-track-display {
      font-size: ${fontSizePercent}em !important;
    }
    
    video::-webkit-media-text-track-container {
      font-size: ${fontSize}% !important;
    }
  `;
  
  targetRoot.appendChild(style);
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

  // Listen for external setting changes (e.g. from options page)
  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (browserAPI && browserAPI.storage && browserAPI.storage.onChanged) {
    browserAPI.storage.onChanged.addListener((changes, areaName) => {
      // Check if the change is in local storage
      if ((areaName === 'local' || areaName === undefined) && changes.playerSettings) {
        const newSettings = changes.playerSettings.newValue;
        if (newSettings) {
          // Apply settings including subtitle customizations immediately
          applySettings(newSettings);
          
          // If subtitle settings changed, force reapplication
          if (changes.playerSettings.oldValue && 
              JSON.stringify(changes.playerSettings.oldValue.subtitleSettings) !== 
              JSON.stringify(newSettings.subtitleSettings)) {
            // Reapply subtitle styles after a short delay to ensure they take effect
            setTimeout(() => {
              if (newSettings.subtitleSettings) {
                applySubtitleStyles(newSettings.subtitleSettings);
              }
            }, 50);
          }
        }
      }
    });
  }

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
        <p>Please provide a stream URL in the hash fragment.</p>
      </div>
    `;
    return;
  }

  const streamType = detectStreamType(url);
  if (!streamType) {
    document.body.innerHTML = `
      <div style="color: white; padding: 20px; font-family: sans-serif;">
        <h1>Unsupported Stream URL</h1>
        <p>Only .m3u8 and .mpd streams are supported.</p>
      </div>
    `;
    return;
  }

  // Load and apply settings, get resume position
  let settings = window.PlayerSettings?.DEFAULT_SETTINGS || {};
  let savedResumePos = 0;
  
  if (window.PlayerSettings) {
    settings = await window.PlayerSettings.loadSettings();
    savedResumePos = await window.PlayerSettings.getResumePosition(url);
  }

  // Play the stream with optional start position
  video = playStream(url, savedResumePos);
  
  if (!video) return;

  mediaTimeDisplay = document.querySelector('media-time-display');

  // Wait for metadata to determine stream type and apply settings
  video.addEventListener('loadedmetadata', () => {
    mediastreamtype = player.getAttribute('mediastreamtype');
    
    // Apply saved settings
    applySettings(settings);
    
    // Handle resume position for non-live streams
    const shouldResume = savedResumePos > 0 && 
                        mediastreamtype !== 'live' && 
                        video.duration > 0 && 
                        savedResumePos < video.duration - 10;

    if (shouldResume) {
      resumePosition = savedResumePos;
      
      // Wait for playback to start before seeking
      const onReady = () => resumeFromPosition(savedResumePos, settings);
      
      if (video.readyState >= 3) {
        onReady();
      } else {
        video.addEventListener('playing', onReady, { once: true });
      }
    }
  });

  // Setup event handlers
  setupLiveTimeDisplay();
  setupResumePosition();
  setupSettingsSaver();
  setupSubtitleTrackListener();

  // Focus video on load
  window.addEventListener('load', focusVideo);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
