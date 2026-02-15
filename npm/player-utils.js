let streamXhrProbeInstalled = false;
const streamNetworkErrorSubscribers = new Set();
let activePlaybackErrorOverlay = null;

function safeUrlParse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function truncateText(text, maxLength = 500) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function installStreamXhrProbe() {
  if (streamXhrProbeInstalled || typeof XMLHttpRequest === 'undefined') return;
  streamXhrProbeInstalled = true;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__streamRequestUrl = typeof url === 'string' ? url : String(url || '');
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    const notify = () => {
      const requestUrl = this.__streamRequestUrl || this.responseURL || '';
      const status = Number(this.status || 0);
      if (!requestUrl) return;

      if (status >= 400 || status === 0) {
        const responseText = typeof this.responseText === 'string'
          ? truncateText(this.responseText, 1200)
          : '';

        for (const subscriber of streamNetworkErrorSubscribers) {
          subscriber({
            url: requestUrl,
            status,
            statusText: this.statusText || '',
            responseText,
          });
        }
      }
    };

    this.addEventListener('loadend', notify);
    this.addEventListener('error', notify);
    return originalSend.apply(this, args);
  };
}

function subscribeToStreamNetworkErrors(listener) {
  installStreamXhrProbe();
  streamNetworkErrorSubscribers.add(listener);
  return () => streamNetworkErrorSubscribers.delete(listener);
}

function createPlaybackErrorTracker(showErrorUI) {
  const state = {
    lastShownAt: 0,
    concrete: null,
  };

  return {
    show(title, message, isConcrete = true) {
      state.lastShownAt = Date.now();
      if (isConcrete) {
        state.concrete = { title, message };
      }
      showErrorUI(title, message);
    },
    getLastShownAt() {
      return state.lastShownAt;
    },
    hasConcreteError() {
      return Boolean(state.concrete?.message);
    },
    getConcreteError() {
      return state.concrete;
    },
  };
}

function buildNetworkFailureMessage(streamLabel, sourceHost) {
  return ({ url, status, statusText, responseText }) => {
    const parsed = safeUrlParse(url);
    if (!parsed || !sourceHost || parsed.host !== sourceHost) return null;

    const statusLabel = status > 0 ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : 'Network error';
    const detail = `${statusLabel} while requesting ${url}${responseText ? `\n\n${responseText}` : ''}`;

    return {
      title: `${streamLabel} Network Error`,
      message: detail,
    };
  };
}

function getMediaErrorMessage(mediaError) {
  if (!mediaError) return 'Unknown media error';

  switch (mediaError.code) {
    case 1:
      return 'Playback aborted by the browser';
    case 2:
      return 'Network error while loading the stream';
    case 3:
      return 'Media decoding error';
    case 4:
      return 'Stream format is not supported';
    default:
      return mediaError.message || 'Unknown media error';
  }
}

function normalizeErrorMessage(errorEvent) {
  if (!errorEvent) return 'Unknown playback error';

  if (typeof errorEvent === 'string') return errorEvent;

  if (errorEvent?.error?.message) return errorEvent.error.message;
  if (errorEvent?.details && errorEvent?.type) {
    const parts = [`${errorEvent.type}: ${errorEvent.details}`];
    if (errorEvent?.response?.code) {
      parts.push(`HTTP ${errorEvent.response.code}`);
    }
    if (errorEvent?.response?.text) {
      parts.push(String(errorEvent.response.text));
    }
    return parts.join(' | ');
  }
  if (errorEvent?.event?.message) return errorEvent.event.message;
  if (errorEvent?.message) return errorEvent.message;
  if (errorEvent?.reason) return String(errorEvent.reason);

  try {
    return JSON.stringify(errorEvent, null, 2);
  } catch {
    return String(errorEvent);
  }
}

function clearPlaybackErrorUI() {
  if (activePlaybackErrorOverlay) {
    activePlaybackErrorOverlay.remove();
    activePlaybackErrorOverlay = null;
  }
}

function isPlaybackErrorUIVisible() {
  return Boolean(activePlaybackErrorOverlay);
}

function showPlaybackErrorUI(title, detail) {
  clearPlaybackErrorUI();

  const overlay = document.createElement('div');
  overlay.setAttribute('data-player-error', 'open');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1950;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: min(760px, 96vw);
    max-height: 85vh;
    overflow: auto;
    background: #0d1117;
    border: 1px solid #f85149;
    border-radius: 12px;
    color: #f0f6fc;
    padding: 18px;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.8);
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = title || 'Playback Error';
  titleEl.style.cssText = 'font-size:18px; font-weight:700; margin-bottom:10px; color:#ff7b72;';

  const subtitleEl = document.createElement('div');
  subtitleEl.textContent = 'The stream failed during playback. Details are shown below.';
  subtitleEl.style.cssText = 'font-size:13px; color:#c9d1d9; margin-bottom:12px;';

  const detailEl = document.createElement('pre');
  detailEl.textContent = detail || 'An unexpected playback error occurred.';
  detailEl.style.cssText = `
    margin: 0;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #30363d;
    background: #161b22;
    color: #f0f6fc;
    font-size: 13px;
    line-height: 1.45;
    max-height: 40vh;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  `;

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:12px;';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy Details';
  copyBtn.style.cssText = 'padding:8px 12px; border-radius:8px; border:1px solid #30363d; background:#21262d; color:#c9d1d9; cursor:pointer;';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(detailEl.textContent || '');
      copyBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Details';
      }, 1200);
    } catch {
      copyBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Details';
      }, 1200);
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Dismiss';
  closeBtn.style.cssText = 'padding:8px 12px; border-radius:8px; border:1px solid #30363d; background:#21262d; color:#c9d1d9; cursor:pointer;';
  closeBtn.addEventListener('click', clearPlaybackErrorUI);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      clearPlaybackErrorUI();
    }
  });

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);
  panel.appendChild(titleEl);
  panel.appendChild(subtitleEl);
  panel.appendChild(detailEl);
  panel.appendChild(actions);
  overlay.appendChild(panel);

  document.body.appendChild(overlay);
  activePlaybackErrorOverlay = overlay;
}
