import { safeUrlParse } from '../../lib/stream';

export interface NetworkErrorEvent {
  url: string;
  status: number;
  statusText: string;
  responseText: string;
}

type NetworkErrorListener = (event: NetworkErrorEvent) => void;

const subscribers = new Set<NetworkErrorListener>();
const requestUrls = new WeakMap<XMLHttpRequest, string>();
let probeInstalled = false;
let activeOverlay: HTMLElement | null = null;

export function truncateText(text: string, maxLength = 500): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// hls.js and dash.js both use XHR; patching it is the only way to see failing segment requests.
function installXhrProbe(): void {
  if (probeInstalled || typeof XMLHttpRequest === 'undefined') return;
  probeInstalled = true;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    requestUrls.set(this, String(url ?? ''));
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const notify = () => {
      const url = requestUrls.get(this) || this.responseURL || '';
      const status = Number(this.status || 0);
      if (!url || (status > 0 && status < 400)) return;

      let responseText = '';
      try {
        responseText =
          typeof this.responseText === 'string' ? truncateText(this.responseText, 1200) : '';
      } catch {
        // responseText throws for non-text responseType.
      }

      for (const subscriber of subscribers) {
        subscriber({ url, status, statusText: this.statusText || '', responseText });
      }
    };

    this.addEventListener('loadend', notify);
    this.addEventListener('error', notify);
    return originalSend.call(this, body);
  };
}

export function subscribeToNetworkErrors(listener: NetworkErrorListener): () => void {
  installXhrProbe();
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function buildNetworkFailureMessage(streamLabel: string, sourceHost: string) {
  return ({ url, status, statusText, responseText }: NetworkErrorEvent) => {
    const parsed = safeUrlParse(url);
    if (!parsed || !sourceHost || parsed.host !== sourceHost) return null;

    const statusLabel =
      status > 0 ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : 'Network error';
    return {
      title: `${streamLabel} Network Error`,
      message: `${statusLabel} while requesting ${url}${responseText ? `\n\n${responseText}` : ''}`,
    };
  };
}

export function getMediaErrorMessage(mediaError: MediaError | null | undefined): string {
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

// Engine error payloads are untyped and differ between hls.js, dash.js and DOM events.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeErrorMessage(errorEvent: any): string {
  if (!errorEvent) return 'Unknown playback error';
  if (typeof errorEvent === 'string') return errorEvent;

  if (errorEvent.error?.message) return errorEvent.error.message;
  if (errorEvent.details && errorEvent.type) {
    const parts = [`${errorEvent.type}: ${errorEvent.details}`];
    if (errorEvent.response?.code) parts.push(`HTTP ${errorEvent.response.code}`);
    if (errorEvent.response?.text) parts.push(String(errorEvent.response.text));
    return parts.join(' | ');
  }
  if (errorEvent.event?.message) return errorEvent.event.message;
  if (errorEvent.message) return errorEvent.message;
  if (errorEvent.reason) return String(errorEvent.reason);

  try {
    return JSON.stringify(errorEvent, null, 2);
  } catch {
    return String(errorEvent);
  }
}

export function createPlaybackErrorTracker(showErrorUI: (title: string, message: string) => void) {
  let lastShownAt = 0;
  let concrete: { title: string; message: string } | null = null;

  return {
    show(title: string, message: string, isConcrete = true) {
      lastShownAt = Date.now();
      if (isConcrete) concrete = { title, message };
      showErrorUI(title, message);
    },
    getLastShownAt: () => lastShownAt,
    hasConcreteError: () => Boolean(concrete?.message),
    getConcreteError: () => concrete,
  };
}

export function clearPlaybackErrorUI(): void {
  activeOverlay?.remove();
  activeOverlay = null;
}

export function isPlaybackErrorUIVisible(): boolean {
  return activeOverlay !== null;
}

function button(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'overlay-btn';
  btn.textContent = label;
  return btn;
}

export function showPlaybackErrorUI(title: string, detail: string): void {
  clearPlaybackErrorUI();

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.dataset.playerError = 'open';

  const panel = document.createElement('div');
  panel.className = 'overlay-panel overlay-panel--error';

  const titleEl = document.createElement('div');
  titleEl.className = 'error-title';
  titleEl.textContent = title || 'Playback Error';

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'error-subtitle';
  subtitleEl.textContent = 'The stream failed during playback. Details are shown below.';

  const detailEl = document.createElement('pre');
  detailEl.className = 'error-detail';
  detailEl.textContent = detail || 'An unexpected playback error occurred.';

  const actions = document.createElement('div');
  actions.className = 'overlay-actions';

  const copyBtn = button('Copy Details');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(detailEl.textContent ?? '');
      copyBtn.textContent = 'Copied';
    } catch {
      copyBtn.textContent = 'Copy Failed';
    }
    setTimeout(() => (copyBtn.textContent = 'Copy Details'), 1200);
  });

  const closeBtn = button('Dismiss');
  closeBtn.addEventListener('click', clearPlaybackErrorUI);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) clearPlaybackErrorUI();
  });

  actions.append(copyBtn, closeBtn);
  panel.append(titleEl, subtitleEl, detailEl, actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}

export function showFatalError(title: string, ...lines: string[]): void {
  const container = document.createElement('div');
  container.className = 'fatal-error';
  const h1 = document.createElement('h1');
  h1.textContent = title;
  container.appendChild(h1);
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    container.appendChild(p);
  }
  document.body.replaceChildren(container);
}
