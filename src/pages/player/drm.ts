import { isChromiumBrowser } from '../../lib/browser';
import { safeUrlParse } from '../../lib/stream';
import type { StreamVideoElement } from './types';
import { waitForMediaApi } from './media';

export interface DrmConfig {
  widevineLicenseUrl: string;
  headers: Record<string, string> | null;
  robustness?: string;
  rememberForHost?: boolean;
}

interface DrmPrefs {
  lastConfig: DrmConfig | null;
  hostConfigs: Record<string, DrmConfig>;
}

const PREFS_KEY = 'drmPopupPrefsV1';
const DRM_KEYWORDS = [
  'drm',
  'encrypted',
  'key_system',
  'key system',
  'keysystem',
  'license',
  'mediakeys',
  'media key',
  'widevine',
  'playready',
];

/** dash.js 5 protection error codes (MEDIA_KEYERR_*, KEY_SYSTEM_*, licenser, etc.). */
const DASH_DRM_ERROR_CODES = new Set([
  24, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 111, 112, 113, 114,
]);

const configCache = new Map<string, DrmConfig>();
let activeModal: Promise<DrmConfig | null> | null = null;

export function sanitizeDrmConfig(config: unknown): DrmConfig | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;
  const headers =
    c.headers && typeof c.headers === 'object' && !Array.isArray(c.headers)
      ? (c.headers as Record<string, string>)
      : null;
  return {
    widevineLicenseUrl: typeof c.widevineLicenseUrl === 'string' ? c.widevineLicenseUrl : '',
    headers,
    robustness: typeof c.robustness === 'string' ? c.robustness : undefined,
  };
}

function loadPrefs(): DrmPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { lastConfig: null, hostConfigs: {} };
    const parsed = JSON.parse(raw);
    return {
      lastConfig: sanitizeDrmConfig(parsed?.lastConfig),
      hostConfigs:
        parsed?.hostConfigs && typeof parsed.hostConfigs === 'object' ? parsed.hostConfigs : {},
    };
  } catch {
    return { lastConfig: null, hostConfigs: {} };
  }
}

function getStoredConfig(sourceUrl: string): DrmConfig | null {
  const prefs = loadPrefs();
  const host = safeUrlParse(sourceUrl)?.host;
  const hostConfig = host ? sanitizeDrmConfig(prefs.hostConfigs[host]) : null;
  return hostConfig ?? prefs.lastConfig;
}

function persistConfig(sourceUrl: string, config: DrmConfig): void {
  const normalized = sanitizeDrmConfig(config);
  if (!normalized?.widevineLicenseUrl) return;

  const prefs = loadPrefs();
  prefs.lastConfig = normalized;
  const host = safeUrlParse(sourceUrl)?.host;
  if (config.rememberForHost && host) prefs.hostConfigs[host] = normalized;

  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to persist DRM preferences:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDrmErrorText(errorEvent: any): string {
  return [
    errorEvent?.error,
    errorEvent?.event,
    errorEvent,
    errorEvent?.error?.message,
    errorEvent?.error?.data?.message,
    errorEvent?.event?.message,
    errorEvent?.message,
    errorEvent?.reason,
  ]
    .filter(Boolean)
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      try {
        return JSON.stringify(entry);
      } catch {
        return String(entry);
      }
    })
    .join(' ')
    .toLowerCase();
}

export function isLikelyDrmError(errorEvent: unknown): boolean {
  const code = (errorEvent as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === 'number' && DASH_DRM_ERROR_CODES.has(code)) return true;
  const text = getDrmErrorText(errorEvent);
  return Boolean(text) && DRM_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function createHeaderRow(key = '', value = ''): HTMLElement {
  const row = document.createElement('div');
  row.className = 'drm-header-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = 'Header key';
  keyInput.value = key;
  keyInput.dataset.headerKey = '';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Header value';
  valueInput.value = value;
  valueInput.dataset.headerValue = '';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'overlay-btn';
  removeButton.textContent = 'Remove';
  removeButton.dataset.headerRemove = '';

  row.append(keyInput, valueInput, removeButton);
  return row;
}

export function readHeaderRows(container: HTMLElement): Record<string, string> | null {
  const headers: Record<string, string> = {};
  container.querySelectorAll<HTMLElement>('.drm-header-row').forEach((row) => {
    const key = row.querySelector<HTMLInputElement>('[data-header-key]')?.value.trim();
    const value = row.querySelector<HTMLInputElement>('[data-header-value]')?.value.trim() ?? '';
    if (key) headers[key] = value;
  });
  return Object.keys(headers).length ? headers : null;
}

function showDrmPrompt(
  errorMessage: string,
  sourceUrl: string,
  prefill: DrmConfig | null,
): Promise<DrmConfig | null> {
  if (activeModal) return activeModal;

  activeModal = new Promise((resolve) => {
    const template = document.getElementById('drm-template') as HTMLTemplateElement;
    const overlay = (template.content.firstElementChild as HTMLElement).cloneNode(
      true,
    ) as HTMLElement;
    const $ = <T extends HTMLElement>(sel: string) => overlay.querySelector(sel) as T;

    const messageEl = $<HTMLElement>('[data-drm-message]');
    const licenseInput = $<HTMLInputElement>('[data-drm-license]');
    const headerRows = $<HTMLElement>('[data-drm-headers]');
    const robustnessInput = $<HTMLInputElement>('[data-drm-robustness]');
    const rememberInput = $<HTMLInputElement>('[data-drm-remember]');
    const errorEl = $<HTMLElement>('[data-drm-error]');

    messageEl.textContent = errorMessage ? `Detected DRM issue:\n${errorMessage}` : '';
    messageEl.hidden = !errorMessage;

    const initial = prefill ?? getStoredConfig(sourceUrl);
    licenseInput.value = initial?.widevineLicenseUrl ?? '';
    robustnessInput.value = initial?.robustness ?? '';
    const pairs = Object.entries(initial?.headers ?? {});
    (pairs.length ? pairs : [['', '']]).forEach(([k, v]) =>
      headerRows.appendChild(createHeaderRow(k, String(v ?? ''))),
    );

    $<HTMLButtonElement>('[data-drm-add-header]').addEventListener('click', () =>
      headerRows.appendChild(createHeaderRow()),
    );

    headerRows.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.matches('[data-header-remove]')) return;
      const row = target.parentElement!;
      if (headerRows.children.length <= 1) {
        row.querySelectorAll('input').forEach((input) => (input.value = ''));
      } else {
        row.remove();
      }
    });

    const close = (result: DrmConfig | null) => {
      overlay.remove();
      activeModal = null;
      resolve(result);
    };

    $<HTMLButtonElement>('[data-drm-cancel]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });

    $<HTMLButtonElement>('[data-drm-apply]').addEventListener('click', () => {
      const widevineLicenseUrl = licenseInput.value.trim();
      if (!widevineLicenseUrl) {
        errorEl.hidden = false;
        errorEl.textContent = 'License URL is required';
        return;
      }
      close({
        widevineLicenseUrl,
        headers: readHeaderRows(headerRows),
        robustness: robustnessInput.value.trim() || undefined,
        rememberForHost: rememberInput.checked,
      });
    });

    document.body.appendChild(overlay);
    setTimeout(() => licenseInput.focus(), 0);
  });

  return activeModal;
}

async function applyDrmConfig(video: StreamVideoElement, config: DrmConfig, sourceUrl: string) {
  if (!config.widevineLicenseUrl) return;
  try {
    const api = await waitForMediaApi(video, 5000);
    const widevine: Record<string, unknown> = { serverURL: config.widevineLicenseUrl, priority: 1 };
    if (config.headers) widevine.httpRequestHeaders = config.headers;
    if (config.robustness) {
      widevine.videoRobustness = config.robustness;
      widevine.audioRobustness = config.robustness;
    }
    api.setProtectionData?.({ 'com.widevine.alpha': widevine });
    api.attachSource?.(sourceUrl);
  } catch (error) {
    console.error('Failed to apply DASH DRM configuration:', error);
  }
}

export function isDrmPopupOpen(): boolean {
  return activeModal !== null;
}

/** Widevine via dash.js is only wired up on Chromium browsers. */
export async function setupDashDrm(video: StreamVideoElement, sourceUrl: string): Promise<void> {
  if (!isChromiumBrowser()) return;

  try {
    const api = await waitForMediaApi(video, 5000);
    let prompting = false;

    const handleFailure = async (errorEvent: unknown, forcePrompt: boolean) => {
      if (prompting || !(forcePrompt || isLikelyDrmError(errorEvent))) return;

      prompting = true;
      const errorText = getDrmErrorText(errorEvent).slice(0, 500);
      const config = await showDrmPrompt(errorText, sourceUrl, configCache.get(sourceUrl) ?? null);
      if (config) {
        configCache.set(sourceUrl, config);
        persistConfig(sourceUrl, config);
        await applyDrmConfig(video, config, sourceUrl);
      }
      prompting = false;
    };

    api.on?.('error', (event) => handleFailure(event, false));
    // dash.js 5 prefixes protection events with `public_`.
    api.on?.('public_keyError', (event) => handleFailure(event, true));

    const cached = configCache.get(sourceUrl) ?? getStoredConfig(sourceUrl);
    if (cached) {
      configCache.set(sourceUrl, cached);
      await applyDrmConfig(video, cached, sourceUrl);
    }
  } catch (error) {
    console.error('Failed to initialize DASH DRM handler:', error);
  }
}
