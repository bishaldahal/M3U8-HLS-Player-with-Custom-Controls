// HLS Video Player - Shared Utilities

// Browser API (cached)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function sanitizeTitle(title) {
  if (!title) return 'Untitled Stream';
  return String(title).replace(/[<>]/g, '').substring(0, 200).trim() || 'Untitled Stream';
}

function isM3U8Url(url) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.m3u8') || path.includes('.m3u8');
  } catch {
    return false;
  }
}

function validateUrl(url) {
  if (!url?.trim()) return { valid: false, error: 'Please enter a URL' };
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
    return { valid: true, url: parsed.href, isM3u8: isM3U8Url(parsed.href) };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function debounce(func, wait) {
  let timeout = null;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}

function throttle(func, limit) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  };
}

function getBufferInfo(video, time) {
  if (!video?.buffered?.length) return null;
  for (let i = 0; i < video.buffered.length; i++) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (time >= start && time <= end) {
      return { start, end, ahead: end - time };
    }
  }
  return null;
}

function safeVideoGet(video, prop, defaultValue = 0) {
  const val = video?.[prop];
  return (val != null && (typeof val !== 'number' || Number.isFinite(val))) ? val : defaultValue;
}

function safeVideoSet(video, prop, value) {
  if (!video) return false;
  video[prop] = value;
  return true;
}

// Export all utilities
window.PlayerUtils = {
  browserAPI,
  formatTime,
  formatRelativeTime,
  escapeHtml,
  sanitizeTitle,
  isM3U8Url,
  validateUrl,
  clamp,
  roundTo,
  debounce,
  throttle,
  getBufferInfo,
  safeVideoGet,
  safeVideoSet
};
