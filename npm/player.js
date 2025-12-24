// HLS Video Player - Main Player Logic

// Player state (exported via window for shortcuts.js)
let player = null;
let video = null;
let mediaTimeDisplay = null;
let mediastreamtype = null;
let resumePosition = 0;
let hasRestoredPosition = false;

let currentStreamUrl = '';
let currentStreamTitle = '';

// UI elements
let loadingOverlay, errorOverlay, playerToast, statsOverlay;
let toastTimeout = null;
let statsInterval = null;
let isStatsVisible = false;

// Debounced savers
let saveHistoryDebounced = null;
let saveVolumeDebounced = null;

// Expose state for shortcuts.js
Object.defineProperties(window, {
  player: { get: () => player },
  video: { get: () => video },
  mediastreamtype: { get: () => mediastreamtype },
  resumePosition: { get: () => resumePosition, set: v => { resumePosition = Math.max(0, v || 0); } }
});

// Loading/Error UI
function showLoading(url) {
  if (!loadingOverlay) return;
  const el = loadingOverlay.querySelector('#loading-url');
  if (el) el.textContent = url?.length > 80 ? url.slice(0, 80) + '...' : url;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay?.classList.add('hidden');
}

function showError(message, url) {
  hideLoading();
  if (!errorOverlay) return;
  const msgEl = errorOverlay.querySelector('#error-message');
  const urlEl = errorOverlay.querySelector('#error-url');
  if (msgEl) msgEl.textContent = message || 'An error occurred';
  if (urlEl) urlEl.textContent = url || '';
  errorOverlay.classList.add('show');
}

function hideError() {
  errorOverlay?.classList.remove('show');
}

// Toast
function showPlayerToast(message, actionText = null, actionCallback = null, duration = 4000) {
  if (!playerToast) return;
  const msgEl = playerToast.querySelector('#toast-message');
  const actionEl = playerToast.querySelector('#toast-action');
  
  if (msgEl) msgEl.textContent = message;
  if (actionEl) {
    if (actionText && actionCallback) {
      actionEl.textContent = actionText;
      actionEl.style.display = 'block';
      actionEl.onclick = () => { actionCallback(); hidePlayerToast(); };
    } else {
      actionEl.style.display = 'none';
    }
  }
  
  clearTimeout(toastTimeout);
  playerToast.classList.add('show');
  if (duration > 0) toastTimeout = setTimeout(hidePlayerToast, duration);
}

function hidePlayerToast() {
  playerToast?.classList.remove('show');
  clearTimeout(toastTimeout);
}

// Stats overlay
function toggleStatsOverlay() {
  if (!statsOverlay) return;
  isStatsVisible = !isStatsVisible;
  statsOverlay.classList.toggle('show', isStatsVisible);
  if (isStatsVisible) {
    updateStats();
    statsInterval = setInterval(updateStats, 1000);
  } else {
    clearInterval(statsInterval);
  }
}

function hideStatsOverlay() {
  isStatsVisible = false;
  statsOverlay?.classList.remove('show');
  clearInterval(statsInterval);
}

window.toggleStatsOverlay = toggleStatsOverlay;
window.hideStatsOverlay = hideStatsOverlay;

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return (bytes / k ** i).toFixed(2) + ' ' + sizes[i];
}

function formatBitrate(bps) {
  if (!bps || bps <= 0) return '--';
  return bps >= 1e6 ? (bps / 1e6).toFixed(2) + ' Mbps' : (bps / 1e3).toFixed(0) + ' Kbps';
}

function updateStats() {
  if (!video || !isStatsVisible) return;
  
  const width = safeVideoGet(video, 'videoWidth', 0);
  const height = safeVideoGet(video, 'videoHeight', 0);
  
  setStatText('stat-resolution', width && height ? `${width} × ${height}` : '--');
  
  const quality = video.getVideoPlaybackQuality?.();
  if (quality?.totalVideoFrames > 0) {
    const elapsed = safeVideoGet(video, 'currentTime', 0);
    setStatText('stat-framerate', elapsed > 0 ? `${(quality.totalVideoFrames / elapsed).toFixed(1)} fps` : '--');
    
    const dropped = quality.droppedVideoFrames || 0;
    const total = quality.totalVideoFrames || 1;
    const pct = ((dropped / total) * 100).toFixed(2);
    const droppedEl = document.getElementById('stat-dropped');
    if (droppedEl) {
      droppedEl.textContent = `${dropped} (${pct}%)`;
      droppedEl.className = 'stats-value ' + (pct > 5 ? 'bad' : pct > 1 ? 'warning' : 'good');
    }
  } else {
    setStatText('stat-framerate', '--');
    setStatText('stat-dropped', '--');
  }
  
  const currentTime = safeVideoGet(video, 'currentTime', 0);
  const bufferInfo = getBufferInfo(video, currentTime);
  const ahead = bufferInfo?.ahead || 0;
  const bufferEl = document.getElementById('stat-buffer');
  if (bufferEl) {
    bufferEl.textContent = `${ahead.toFixed(1)}s ahead`;
    bufferEl.className = 'stats-value ' + (ahead < 2 ? 'bad' : ahead < 5 ? 'warning' : 'good');
  }
  const barEl = document.getElementById('stat-buffer-bar');
  if (barEl) barEl.style.width = `${Math.min(100, (ahead / 30) * 100)}%`;
  
  setStatText('stat-type', mediastreamtype === 'live' ? '🔴 LIVE' : '📼 VOD');
  setStatText('stat-viewport', `${window.innerWidth} × ${window.innerHeight}`);
  
  updateHLSStats();
}

function setStatText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateHLSStats() {
  const hls = video?.hls || video?.player?.hls;
  const level = hls?.levels?.[hls?.currentLevel];
  
  setStatText('stat-bitrate', level ? formatBitrate(level.bitrate) : '--');
  setStatText('stat-codecs', level ? [level.videoCodec, level.audioCodec].filter(Boolean).join(', ') || '--' : '--');
  setStatText('stat-levels', hls?.levels ? `${hls.currentLevel + 1} / ${hls.levels.length}` : '--');
  setStatText('stat-bandwidth', hls?.bandwidthEstimate ? formatBitrate(hls.bandwidthEstimate) : '--');
  
  const latencyEl = document.getElementById('stat-latency');
  if (latencyEl) {
    if (mediastreamtype === 'live' && hls?.latency != null) {
      latencyEl.textContent = `${hls.latency.toFixed(1)}s`;
      latencyEl.className = 'stats-value ' + (hls.latency > 10 ? 'warning' : 'good');
    } else {
      latencyEl.textContent = mediastreamtype === 'live' ? '--' : 'N/A (VOD)';
    }
  }
}

// Stream playback
function playStream(url) {
  try {
    const m3u8Url = new URL(url);
    const rawTitle = m3u8Url.searchParams.get('extTitle');
    m3u8Url.searchParams.delete('extTitle');
    
    currentStreamUrl = m3u8Url.href;
    currentStreamTitle = sanitizeTitle(rawTitle);
    
    showLoading(m3u8Url.href);
    if (currentStreamTitle !== 'Untitled Stream') document.title = currentStreamTitle;
    
    const videoEl = document.createElement('hls-video');
    videoEl.setAttribute('slot', 'media');
    videoEl.setAttribute('crossorigin', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('src', m3u8Url.href);
    
    if (player) {
      player.appendChild(videoEl);
      document.body.appendChild(player);
    }
    
    return videoEl;
  } catch (e) {
    showError(`Failed to parse URL: ${e.message}`, url);
    return null;
  }
}

// Event handlers
function setupLiveTimeDisplay() {
  if (!video || !mediaTimeDisplay) return;
  video.addEventListener('timeupdate', () => {
    if (mediastreamtype !== 'live') return;
    const seekable = mediaTimeDisplay.getAttribute('mediaseekable');
    if (!seekable) return;
    const [, end] = seekable.split(':');
    const [sec, ms] = end.split('.');
    const total = (parseFloat(sec) || 0) + (parseFloat(ms) || 0) / 1000;
    if (Number.isFinite(total)) {
      mediaTimeDisplay.setAttribute('mediaduration', total);
      mediaTimeDisplay.setAttribute('remaining', '');
    }
  });
}

function setupResumeTracking() {
  if (!video) return;
  video.addEventListener('pause', () => {
    resumePosition = safeVideoGet(video, 'currentTime', 0);
    saveHistoryDebounced?.();
  });
  video.addEventListener('seeking', () => {
    resumePosition = safeVideoGet(video, 'currentTime', 0);
  });
}

function setupSettingsSaver() {
  if (!video) return;
  
  video.addEventListener('volumechange', () => saveVolumeDebounced?.());
  video.addEventListener('ratechange', () => {
    window.PlayerSettings?.saveSettings({ playbackRate: safeVideoGet(video, 'playbackRate', 1) });
  });
  
  let lastSave = 0;
  video.addEventListener('timeupdate', () => {
    if (Date.now() - lastSave > 30000 && !safeVideoGet(video, 'paused', true)) {
      lastSave = Date.now();
      saveHistoryDebounced?.();
    }
  });
}

function setupErrorHandling() {
  if (!video) return;
  
  const errorMsgs = {
    1: 'Playback aborted.',
    2: 'Network error.',
    3: 'Decode error.',
    4: 'Format not supported.'
  };
  
  video.addEventListener('error', () => {
    const code = video.error?.code;
    showError(errorMsgs[code] || 'Failed to load video.', currentStreamUrl);
  });
  
  let stallTimeout;
  video.addEventListener('waiting', () => {
    stallTimeout = setTimeout(() => {
      if (loadingOverlay?.classList.contains('hidden')) {
        showPlayerToast('Buffering...', null, null, 10000);
      }
    }, 5000);
  });
  video.addEventListener('playing', () => {
    clearTimeout(stallTimeout);
    hidePlayerToast();
  });
}

function applySettings(settings) {
  if (!video || !settings) return;
  safeVideoSet(video, 'volume', clamp(settings.volume ?? 1, 0, 1));
  safeVideoSet(video, 'muted', Boolean(settings.muted));
  safeVideoSet(video, 'playbackRate', clamp(settings.playbackRate ?? 1, 0.1, 10));
}

function focusVideo() {
  (video || player)?.focus?.();
}
window.focusVideo = focusVideo;

function saveState() {
  if (!video || !currentStreamUrl || !window.PlayerSettings) return;
  window.PlayerSettings.saveToHistory(
    currentStreamUrl,
    currentStreamTitle,
    safeVideoGet(video, 'currentTime', 0),
    safeVideoGet(video, 'duration', 0)
  );
}

// Init
async function init() {
  loadingOverlay = document.getElementById('loading-overlay');
  errorOverlay = document.getElementById('error-overlay');
  playerToast = document.getElementById('player-toast');
  statsOverlay = document.getElementById('stats-overlay');
  
  document.getElementById('stats-close')?.addEventListener('click', hideStatsOverlay);
  document.getElementById('retry-btn')?.addEventListener('click', () => { hideError(); location.reload(); });
  document.getElementById('copy-url-btn')?.addEventListener('click', async function() {
    await navigator.clipboard.writeText(location.hash.slice(1));
    this.textContent = 'Copied!';
    setTimeout(() => this.textContent = 'Copy URL', 2000);
  });
  
  player = document.querySelector('media-controller');
  if (!player) {
    showError('Player initialization failed', 'Media controller not found');
    return;
  }
  
  const url = location.hash.slice(1);
  if (!url) {
    showError('No stream URL provided', 'Provide an M3U8 URL in the hash fragment');
    return;
  }
  
  // Debounced savers
  saveHistoryDebounced = debounce(() => {
    if (video && currentStreamUrl) {
      window.PlayerSettings?.saveToHistory(currentStreamUrl, currentStreamTitle, safeVideoGet(video, 'currentTime', 0), safeVideoGet(video, 'duration', 0));
    }
  }, 1000);
  
  saveVolumeDebounced = debounce(() => {
    if (video) {
      window.PlayerSettings?.saveSettings({ volume: safeVideoGet(video, 'volume', 1), muted: safeVideoGet(video, 'muted', false) });
    }
  }, 500);
  
  video = playStream(url);
  if (!video) return;
  
  mediaTimeDisplay = document.querySelector('media-time-display');
  
  let settings = window.PlayerSettings?.DEFAULT_SETTINGS || {};
  let savedResume = 0;
  
  if (window.PlayerSettings) {
    settings = await window.PlayerSettings.loadSettings();
    savedResume = await window.PlayerSettings.getResumePosition(currentStreamUrl);
  }
  
  setupErrorHandling();
  
  video.addEventListener('loadedmetadata', () => {
    mediastreamtype = player.getAttribute('mediastreamtype');
    hideLoading();
    applySettings(settings);
    
    if (!hasRestoredPosition && savedResume > 0 && mediastreamtype !== 'live') {
      const duration = safeVideoGet(video, 'duration', 0);
      if (duration > 0 && savedResume < duration - 10) {
        safeVideoSet(video, 'currentTime', savedResume);
        resumePosition = savedResume;
        showPlayerToast(`Resuming from ${formatTime(savedResume)}`, 'Start Over', () => {
          safeVideoSet(video, 'currentTime', 0);
          resumePosition = 0;
        }, 5000);
      }
    }
    hasRestoredPosition = true;
  });
  
  setupLiveTimeDisplay();
  setupResumeTracking();
  setupSettingsSaver();
  
  window.addEventListener('load', focusVideo);
  window.addEventListener('beforeunload', () => { saveState(); clearInterval(statsInterval); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
}

document.addEventListener('DOMContentLoaded', init);
