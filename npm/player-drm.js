let activeDrmModal = null;
const DRM_PREFS_STORAGE_KEY = 'drmPopupPrefsV1';

function getDrmSourceHost(sourceUrl) {
  try {
    return new URL(sourceUrl).host;
  } catch {
    return '';
  }
}

function sanitizeStoredDrmConfig(config) {
  if (!config || typeof config !== 'object') return null;

  return {
    widevineLicenseUrl: typeof config.widevineLicenseUrl === 'string' ? config.widevineLicenseUrl : '',
    headers: config.headers && typeof config.headers === 'object' && !Array.isArray(config.headers) ? config.headers : null,
    robustness: typeof config.robustness === 'string' ? config.robustness : undefined,
    authHeaderName: typeof config.authHeaderName === 'string' && config.authHeaderName.trim() ? config.authHeaderName : 'Authorization',
    authToken: typeof config.authToken === 'string' ? config.authToken : '',
  };
}

function loadDrmPrefs() {
  try {
    const raw = localStorage.getItem(DRM_PREFS_STORAGE_KEY);
    if (!raw) {
      return { lastConfig: null, hostConfigs: {} };
    }

    const parsed = JSON.parse(raw);
    return {
      lastConfig: sanitizeStoredDrmConfig(parsed?.lastConfig),
      hostConfigs: parsed?.hostConfigs && typeof parsed.hostConfigs === 'object' ? parsed.hostConfigs : {},
    };
  } catch {
    return { lastConfig: null, hostConfigs: {} };
  }
}

function saveDrmPrefs(prefs) {
  try {
    localStorage.setItem(DRM_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to persist DRM popup preferences:', error);
  }
}

function getStoredDrmConfig(sourceUrl) {
  const prefs = loadDrmPrefs();
  const host = getDrmSourceHost(sourceUrl);
  const hostConfig = host ? sanitizeStoredDrmConfig(prefs.hostConfigs?.[host]) : null;
  return hostConfig || prefs.lastConfig || null;
}

function persistDrmConfig(sourceUrl, drmConfig, rememberForHost = false) {
  const normalizedConfig = sanitizeStoredDrmConfig(drmConfig);
  if (!normalizedConfig || !normalizedConfig.widevineLicenseUrl) return;

  const prefs = loadDrmPrefs();
  prefs.lastConfig = normalizedConfig;

  if (rememberForHost) {
    const host = getDrmSourceHost(sourceUrl);
    if (host) {
      prefs.hostConfigs[host] = normalizedConfig;
    }
  }

  saveDrmPrefs(prefs);
}

function extractAuthTokenFromHeaders(headers, preferredHeader = 'Authorization') {
  if (!headers || typeof headers !== 'object') {
    return { authHeaderName: preferredHeader, authToken: '' };
  }

  const keys = Object.keys(headers);
  if (!keys.length) {
    return { authHeaderName: preferredHeader, authToken: '' };
  }

  const matchingKey = keys.find((key) => key.toLowerCase() === preferredHeader.toLowerCase())
    || keys.find((key) => key.toLowerCase() === 'authorization')
    || keys[0];

  const headerValue = String(headers[matchingKey] ?? '').trim();
  const bearerPrefix = /^bearer\s+/i;
  const authToken = bearerPrefix.test(headerValue) ? headerValue.replace(bearerPrefix, '').trim() : '';

  return {
    authHeaderName: matchingKey,
    authToken,
  };
}

function headersToPairs(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return [{ key: '', value: '' }];
  }

  const pairs = Object.entries(headers).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }));

  return pairs.length ? pairs : [{ key: '', value: '' }];
}

function createHeaderRow(key = '', value = '') {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr auto; gap:8px; margin-bottom:8px;';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.placeholder = 'Header key';
  keyInput.value = key;
  keyInput.setAttribute('data-header-key', 'true');
  keyInput.style.cssText = 'width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid #30363d; background:#161b22; color:#e6edf3;';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.placeholder = 'Header value';
  valueInput.value = value;
  valueInput.setAttribute('data-header-value', 'true');
  valueInput.style.cssText = 'width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid #30363d; background:#161b22; color:#e6edf3;';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = 'Remove';
  removeButton.setAttribute('data-header-remove', 'true');
  removeButton.style.cssText = 'padding:8px 10px; background:#21262d; border:1px solid #30363d; color:#c9d1d9; border-radius:8px; cursor:pointer;';

  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(removeButton);

  return row;
}

function readHeaderRows(container) {
  const headers = {};
  const rows = Array.from(container.querySelectorAll('[data-header-key="true"]'));

  rows.forEach((keyInput) => {
    const row = keyInput.parentElement;
    const valueInput = row?.querySelector('[data-header-value="true"]');
    const key = (keyInput.value || '').trim();
    const value = (valueInput?.value || '').trim();

    if (key) {
      headers[key] = value;
    }
  });

  return Object.keys(headers).length ? headers : null;
}

function isChromiumBrowser() {
  const ua = navigator.userAgent || '';
  return /(Chrome|Chromium|Edg|OPR|Brave)/i.test(ua) && !/Firefox/i.test(ua);
}

function getDrmErrorText(errorEvent) {
  const payload = [
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

  return payload;
}

function isLikelyDrmError(errorEvent) {
  const errorText = getDrmErrorText(errorEvent);
  if (!errorText) return false;

  return [
    'drm',
    'encrypted',
    'key_system',
    'key system',
    'license',
    'eme',
    'protection',
    'media key',
    'widevine'
  ].some((keyword) => errorText.includes(keyword));
}

function buildDrmPopup(messageText = '') {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-drm-popup', 'open');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 16px;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: min(680px, 95vw);
    max-height: 90vh;
    overflow: auto;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 12px;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.8);
    padding: 20px;
    color: #c9d1d9;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;

  panel.innerHTML = `
    <h2 style="margin: 0 0 10px; color: #fff; font-size: 20px;">DRM License Required</h2>
    <p style="margin: 0 0 14px; color: #8b949e; font-size: 13px;">Enter Widevine license details to continue this encrypted DASH stream.</p>
    <p id="drm-popup-message" style="margin: 0 0 12px; color: #e6edf3; font-size: 12px; white-space: pre-wrap;"></p>
    <label style="display:block; margin-bottom: 12px; font-size: 13px;">
      License URL
      <input id="drm-license-url" type="url" placeholder="https://license.example.com/widevine"
        style="width:100%; margin-top:6px; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid #30363d; background:#161b22; color:#e6edf3;" />
    </label>
    <label style="display:block; margin-bottom: 12px; font-size: 13px;">
      Request Headers (optional)
      <div id="drm-header-rows" style="margin-top:6px;"></div>
      <button id="drm-add-header" type="button" style="margin-top:6px; padding:8px 12px; background:#21262d; border:1px solid #30363d; color:#c9d1d9; border-radius:8px; cursor:pointer;">Add header</button>
    </label>
    <label style="display:block; margin-bottom: 16px; font-size: 13px;">
      Robustness (optional)
      <input id="drm-robustness" type="text" placeholder="SW_SECURE_DECODE"
        style="width:100%; margin-top:6px; box-sizing:border-box; padding:10px 12px; border-radius:8px; border:1px solid #30363d; background:#161b22; color:#e6edf3;" />
    </label>
    <label style="display:flex; align-items:center; gap:8px; margin-bottom: 12px; font-size: 13px; color:#8b949e;">
      <input id="drm-remember-host" type="checkbox" checked />
      Remember for this stream host
    </label>
    <p id="drm-popup-error" style="display:none; margin:0 0 12px; color:#ff7b72; font-size:12px;"></p>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button id="drm-cancel" type="button" style="padding:8px 12px; background:#21262d; border:1px solid #30363d; color:#c9d1d9; border-radius:8px; cursor:pointer;">Cancel</button>
      <button id="drm-apply" type="button" style="padding:8px 12px; background:#238636; border:1px solid #2ea043; color:#fff; border-radius:8px; cursor:pointer;">Apply DRM</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const messageEl = panel.querySelector('#drm-popup-message');
  if (messageEl) {
    messageEl.textContent = messageText ? `Detected DRM issue:\n${messageText}` : '';
    messageEl.style.display = messageText ? 'block' : 'none';
  }

  return { overlay, panel };
}

function showDrmPrompt(errorMessage, sourceUrl, prefill = null) {
  if (activeDrmModal) {
    return activeDrmModal;
  }

  activeDrmModal = new Promise((resolve) => {
    const { overlay, panel } = buildDrmPopup(errorMessage);
    const licenseInput = panel.querySelector('#drm-license-url');
    const headerRowsContainer = panel.querySelector('#drm-header-rows');
    const addHeaderButton = panel.querySelector('#drm-add-header');
    const robustnessInput = panel.querySelector('#drm-robustness');
    const rememberHostInput = panel.querySelector('#drm-remember-host');
    const applyButton = panel.querySelector('#drm-apply');
    const cancelButton = panel.querySelector('#drm-cancel');
    const errorEl = panel.querySelector('#drm-popup-error');

    const resolvedPrefill = prefill || getStoredDrmConfig(sourceUrl);

    if (resolvedPrefill?.widevineLicenseUrl) {
      licenseInput.value = resolvedPrefill.widevineLicenseUrl;
    }
    if (resolvedPrefill?.robustness) {
      robustnessInput.value = resolvedPrefill.robustness;
    }

    const existingHeaderPairs = headersToPairs(resolvedPrefill?.headers);
    existingHeaderPairs.forEach(({ key, value }) => {
      headerRowsContainer.appendChild(createHeaderRow(key, value));
    });

    addHeaderButton.addEventListener('click', () => {
      headerRowsContainer.appendChild(createHeaderRow('', ''));
    });

    headerRowsContainer.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches('[data-header-remove="true"]')) return;

      const rows = headerRowsContainer.querySelectorAll('[data-header-key="true"]');
      if (rows.length <= 1) {
        const row = target.parentElement;
        const keyInput = row?.querySelector('[data-header-key="true"]');
        const valueInput = row?.querySelector('[data-header-value="true"]');
        if (keyInput) keyInput.value = '';
        if (valueInput) valueInput.value = '';
        return;
      }

      target.parentElement?.remove();
    });

    rememberHostInput.checked = true;

    const close = (result) => {
      overlay.remove();
      activeDrmModal = null;
      resolve(result);
    };

    cancelButton.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    applyButton.addEventListener('click', () => {
      try {
        const widevineLicenseUrl = (licenseInput.value || '').trim();
        if (!widevineLicenseUrl) {
          throw new Error('License URL is required');
        }

        const headers = readHeaderRows(headerRowsContainer);

        const robustness = (robustnessInput.value || '').trim() || undefined;
        const rememberForHost = Boolean(rememberHostInput.checked);

        close({
          widevineLicenseUrl,
          headers,
          robustness,
          rememberForHost,
        });
      } catch (error) {
        errorEl.style.display = 'block';
        errorEl.textContent = error.message || 'Invalid DRM configuration';
      }
    });

    setTimeout(() => licenseInput.focus(), 0);
  });

  return activeDrmModal;
}
