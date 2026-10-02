import '../../lib/ui-feedback.css';
import { ext } from '../../lib/browser';
import { DETECT_PERMISSIONS } from '../../lib/detected';
import {
  DEFAULT_SETTINGS,
  MAX_LIVE_BUFFER_MINUTES,
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
  loadSettings,
  renameHistoryEntry,
  resetSettings,
  saveSettings,
  toggleHistoryPin,
  type HistoryEntry,
  type SubtitleSettings,
} from '../../lib/settings';
import {
  SITE_HEADERS_KEY,
  formatHeaderLines,
  loadSiteHeaders,
  normalizeHost,
  parseHeaderLines,
  removeSiteHeaders,
  upsertSiteHeaders,
  type SiteHeaderRule,
} from '../../lib/site-headers';
import { getEdgeStyleCSS, hexToRgba } from '../../lib/subtitles';
import { formatRelativeTime, formatTime } from '../../lib/time';
import { createIcon, createSpinner, toast } from '../../lib/ui-feedback';

const AUTO_SAVE_DEBOUNCE_MS = 300;
const MAX_HISTORY_DISPLAY = 50;
const SPEED_STEP = 0.25;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const dom = {
  autoSaveIndicator: byId<HTMLElement>('auto-save-indicator'),
  autoSaveText: byId<HTMLElement>('auto-save-text'),
  volumeInput: byId<HTMLInputElement>('volume'),
  volumeLabel: byId<HTMLElement>('volume-label'),
  speedDisplay: byId<HTMLElement>('speed-display'),
  speedDecrease: byId<HTMLButtonElement>('speed-decrease'),
  speedIncrease: byId<HTMLButtonElement>('speed-increase'),
  speedReset: byId<HTMLButtonElement>('speed-reset'),
  speedPresets: document.querySelectorAll<HTMLButtonElement>('.speed-preset'),
  saveHistoryToggle: byId<HTMLInputElement>('save-history'),
  liveBufferMinutes: byId<HTMLInputElement>('live-buffer-minutes'),
  autoSiteHeaders: byId<HTMLInputElement>('auto-site-headers'),
  detectStreams: byId<HTMLInputElement>('detect-streams'),
  siteHeadersList: byId<HTMLElement>('site-headers-list'),
  siteHeadersForm: byId<HTMLFormElement>('site-headers-form'),
  siteHeadersHost: byId<HTMLInputElement>('site-headers-host'),
  siteHeadersText: byId<HTMLTextAreaElement>('site-headers-text'),
  resetSettingsBtn: byId<HTMLButtonElement>('reset-settings'),
  subtitlePreview: document.querySelector<HTMLElement>('.subtitle-text'),
  subtitleFontSize: byId<HTMLInputElement>('subtitle-font-size'),
  subtitleFontSizeNumber: byId<HTMLInputElement>('subtitle-font-size-number'),
  subtitleFontColor: byId<HTMLInputElement>('subtitle-font-color'),
  subtitleFontColorLabel: byId<HTMLElement>('subtitle-font-color-label'),
  subtitleBgColor: byId<HTMLInputElement>('subtitle-bg-color'),
  subtitleBgColorLabel: byId<HTMLElement>('subtitle-bg-color-label'),
  subtitleBgOpacity: byId<HTMLInputElement>('subtitle-bg-opacity'),
  subtitleBgOpacityNumber: byId<HTMLInputElement>('subtitle-bg-opacity-number'),
  subtitleFontFamily: byId<HTMLSelectElement>('subtitle-font-family'),
  subtitleEdgeStyle: byId<HTMLSelectElement>('subtitle-edge-style'),
  toggleAdvancedSubtitles: byId<HTMLButtonElement>('toggle-advanced-subtitles'),
  advancedSubtitleSettings: byId<HTMLElement>('advanced-subtitle-settings'),
  resetSubtitleBtn: byId<HTMLButtonElement>('reset-subtitle-settings'),
  historySearch: byId<HTMLInputElement>('history-search'),
  historyList: byId<HTMLElement>('history-list'),
  batchActions: byId<HTMLElement>('batch-actions'),
  selectedCount: byId<HTMLElement>('selected-count'),
  deleteSelectedBtn: byId<HTMLButtonElement>('delete-selected'),
  clearHistoryBtn: byId<HTMLButtonElement>('clear-history'),
};

let currentSpeed = 1;
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
let allHistory: HistoryEntry[] = [];
const selected = new Set<string>();

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// --- Auto-save -------------------------------------------------------------

function setIndicatorIcon(icon: Element): void {
  dom.autoSaveIndicator.querySelector('svg, .feedback-spinner')?.replaceWith(icon);
}

function showSaving(): void {
  dom.autoSaveIndicator.classList.add('visible', 'saving');
  dom.autoSaveText.textContent = 'Saving...';
  setIndicatorIcon(createSpinner('small'));
}

function showSaved(): void {
  dom.autoSaveIndicator.classList.remove('saving');
  dom.autoSaveIndicator.classList.add('visible');
  dom.autoSaveText.textContent = 'Saved';
  setIndicatorIcon(createIcon('success', 14));
  setTimeout(() => dom.autoSaveIndicator.classList.remove('visible'), 2000);
}

function readSubtitleSettings(): SubtitleSettings {
  return {
    fontSize: Number.parseInt(dom.subtitleFontSize.value, 10),
    fontColor: dom.subtitleFontColor.value,
    backgroundColor: dom.subtitleBgColor.value,
    backgroundOpacity: Number.parseInt(dom.subtitleBgOpacity.value, 10),
    fontFamily: dom.subtitleFontFamily.value,
    edgeStyle: dom.subtitleEdgeStyle.value,
  };
}

function readLiveBufferMinutes(): number {
  const minutes = Math.round(Number(dom.liveBufferMinutes.value) || 0);
  return Math.min(Math.max(minutes, 0), MAX_LIVE_BUFFER_MINUTES);
}

function autoSave(): void {
  clearTimeout(autoSaveTimer);
  showSaving();
  autoSaveTimer = setTimeout(async () => {
    try {
      await saveSettings({
        volume: Number.parseFloat(dom.volumeInput.value),
        playbackRate: currentSpeed,
        saveHistory: dom.saveHistoryToggle.checked,
        liveBufferWhilePausedMinutes: readLiveBufferMinutes(),
        rememberLinkSiteHeaders: dom.autoSiteHeaders.checked,
        subtitleSettings: readSubtitleSettings(),
      });
      showSaved();
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast.error('Failed to save settings');
      dom.autoSaveIndicator.classList.remove('visible');
    }
  }, AUTO_SAVE_DEBOUNCE_MS);
}

// --- Settings --------------------------------------------------------------

function setSpeed(speed: number): void {
  currentSpeed = speed;
  dom.speedDisplay.textContent = `${speed.toFixed(2)}x`;
  dom.speedPresets.forEach((btn) => {
    btn.classList.toggle('active', Math.abs(Number(btn.dataset.speed) - speed) < 0.01);
  });
}

function updateSubtitlePreview(): void {
  const preview = dom.subtitlePreview;
  if (!preview) return;
  const s = readSubtitleSettings();
  preview.style.fontSize = `${(s.fontSize / 100) * 24}px`;
  preview.style.color = s.fontColor;
  preview.style.backgroundColor = hexToRgba(s.backgroundColor, s.backgroundOpacity);
  preview.style.fontFamily = s.fontFamily;
  preview.style.textShadow = getEdgeStyleCSS(s.edgeStyle);
}

async function populateSettings(): Promise<void> {
  try {
    const settings = await loadSettings();
    dom.volumeInput.value = String(settings.volume);
    dom.volumeLabel.textContent = `${Math.round(settings.volume * 100)}%`;
    setSpeed(settings.playbackRate || 1);
    dom.saveHistoryToggle.checked = settings.saveHistory !== false;
    dom.liveBufferMinutes.value = String(settings.liveBufferWhilePausedMinutes);
    dom.autoSiteHeaders.checked = settings.rememberLinkSiteHeaders;

    const s = settings.subtitleSettings;
    dom.subtitleFontSize.value = dom.subtitleFontSizeNumber.value = String(s.fontSize);
    dom.subtitleFontColor.value = dom.subtitleFontColorLabel.textContent = s.fontColor;
    dom.subtitleBgColor.value = dom.subtitleBgColorLabel.textContent = s.backgroundColor;
    dom.subtitleBgOpacity.value = dom.subtitleBgOpacityNumber.value = String(s.backgroundOpacity);
    dom.subtitleFontFamily.value = s.fontFamily;
    dom.subtitleEdgeStyle.value = s.edgeStyle;
    updateSubtitlePreview();
  } catch (error) {
    console.error('Error loading settings:', error);
    toast.error('Failed to load settings');
  }
}

// --- History ---------------------------------------------------------------

function openPlayer(url: string): void {
  void ext.tabs.create({ url: `${ext.runtime.getURL('player.html')}#${url}` });
}

function actionButton(className: string, label: string, title: string, onClick: () => void) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function renderHistoryItem(entry: HistoryEntry): HTMLElement {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.classList.toggle('pinned', entry.pinned);
  item.dataset.url = entry.url;

  if (entry.pinned) {
    const pin = document.createElement('div');
    pin.className = 'history-pin-indicator';
    pin.textContent = '📌';
    pin.title = 'Pinned';
    item.appendChild(pin);
  } else {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'history-checkbox';
    checkbox.checked = selected.has(entry.url);
    checkbox.setAttribute('aria-label', `Select ${entry.customTitle || entry.title}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(entry.url);
      else selected.delete(entry.url);
      updateBatchActions();
    });
    item.appendChild(checkbox);
  }

  const info = document.createElement('div');
  info.className = 'history-info';

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = entry.customTitle || entry.title;
  title.title = entry.url;

  const url = document.createElement('div');
  url.className = 'history-url';
  url.textContent = url.title = entry.url;

  const meta = document.createElement('div');
  meta.className = 'history-meta';
  const timeSpan = document.createElement('span');
  timeSpan.textContent =
    entry.duration > 0
      ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
      : `${formatTime(entry.currentTime)} (Live)`;
  const relSpan = document.createElement('span');
  relSpan.className = 'history-time';
  relSpan.textContent = formatRelativeTime(entry.timestamp);
  meta.append(timeSpan, relSpan);

  info.append(title, url, meta);

  if (entry.duration > 0 && entry.currentTime > 0) {
    const progress = document.createElement('div');
    progress.className = 'history-progress';
    const bar = document.createElement('div');
    bar.className = 'history-progress-bar';
    bar.style.width = `${Math.min((entry.currentTime / entry.duration) * 100, 100)}%`;
    progress.appendChild(bar);
    info.appendChild(progress);
  }

  const actions = document.createElement('div');
  actions.className = 'history-actions';
  const deleteBtn = actionButton(
    'btn-delete',
    '🗑',
    entry.pinned ? 'Unpin to delete' : 'Delete',
    () => void deleteOne(entry.url),
  );
  deleteBtn.disabled = entry.pinned;
  actions.append(
    actionButton(
      entry.pinned ? 'btn-pin pinned' : 'btn-pin',
      '📌',
      entry.pinned ? 'Unpin' : 'Pin',
      () => void togglePin(entry.url),
    ),
    actionButton('btn-rename', '✏️', 'Rename', () => void rename(entry)),
    actionButton('btn-play', '▶', 'Play', () => openPlayer(entry.url)),
    deleteBtn,
  );

  item.append(info, actions);
  return item;
}

function renderHistory(): void {
  const query = dom.historySearch.value.toLowerCase().trim();
  const visible = query
    ? allHistory.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          (e.customTitle ?? '').toLowerCase().includes(query) ||
          e.url.toLowerCase().includes(query),
      )
    : allHistory;

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No watch history';
    dom.historyList.replaceChildren(empty);
    return;
  }
  dom.historyList.replaceChildren(...visible.slice(0, MAX_HISTORY_DISPLAY).map(renderHistoryItem));
}

function updateBatchActions(): void {
  dom.batchActions.classList.toggle('visible', selected.size > 0);
  dom.selectedCount.textContent = String(selected.size);
}

async function refreshHistory(): Promise<void> {
  try {
    allHistory = await loadHistory();
    const urls = new Set(allHistory.map((e) => e.url));
    for (const url of selected) if (!urls.has(url)) selected.delete(url);
    renderHistory();
    updateBatchActions();
  } catch (error) {
    console.error('Error loading history:', error);
    toast.error('Failed to load history');
  }
}

async function runAction(action: () => Promise<unknown>, failMessage: string): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    console.error(failMessage, error);
    toast.error(failMessage);
    return false;
  }
}

async function deleteOne(url: string): Promise<void> {
  if (!confirm('Delete this entry?')) return;
  let deleted = false;
  const ok = await runAction(async () => {
    deleted = await deleteHistoryEntry(url);
  }, 'Failed to delete entry');
  if (!ok) return;
  if (!deleted) {
    toast.warning('Cannot delete pinned item. Unpin it first.');
    return;
  }
  selected.delete(url);
  await refreshHistory();
  toast.success('Entry deleted');
}

async function deleteSelected(): Promise<void> {
  if (selected.size === 0) return;

  const pinnedCount = allHistory.filter((e) => e.pinned && selected.has(e.url)).length;
  if (pinnedCount > 0) {
    toast.warning(`Cannot delete ${plural(pinnedCount, 'pinned item')}. Unpin them first.`);
    return;
  }
  const count = selected.size;
  if (!confirm(`Delete ${plural(count, 'selected item')}?`)) return;

  const ok = await runAction(async () => {
    for (const url of selected) await deleteHistoryEntry(url);
  }, 'Failed to delete items');
  selected.clear();
  await refreshHistory();
  if (ok) toast.success(`Deleted ${plural(count, 'item')}`);
}

async function rename(entry: HistoryEntry): Promise<void> {
  const newTitle = prompt('Enter new title:', entry.customTitle || entry.title);
  if (newTitle === null) return;
  if (await runAction(() => renameHistoryEntry(entry.url, newTitle), 'Failed to rename entry')) {
    await refreshHistory();
    toast.success('Title updated');
  }
}

async function togglePin(url: string): Promise<void> {
  let pinned = false;
  const ok = await runAction(async () => {
    pinned = await toggleHistoryPin(url);
  }, 'Failed to toggle pin');
  if (!ok) return;
  if (pinned) selected.delete(url);
  await refreshHistory();
  toast.success(pinned ? 'Item pinned' : 'Item unpinned');
}

async function clearAll(): Promise<void> {
  const pinnedCount = allHistory.filter((e) => e.pinned).length;
  const message =
    pinnedCount > 0
      ? `Clear all unpinned history? (${plural(pinnedCount, 'pinned item')} will be kept)`
      : 'Clear all watch history? This cannot be undone.';
  if (!confirm(message)) return;

  if (await runAction(clearHistory, 'Failed to clear history')) {
    selected.clear();
    await refreshHistory();
    toast.success(
      pinnedCount > 0
        ? `History cleared (${plural(pinnedCount, 'pinned item')} kept)`
        : 'History cleared',
    );
  }
}

// --- Site headers ----------------------------------------------------------

function renderSiteHeaderItem(rule: SiteHeaderRule): HTMLElement {
  const item = document.createElement('div');
  item.className = 'site-header-item';

  const info = document.createElement('div');
  info.className = 'site-header-info';
  const host = document.createElement('div');
  host.className = 'site-header-host';
  host.textContent = rule.host;
  if (rule.auto) {
    const badge = document.createElement('span');
    badge.className = 'site-header-badge';
    const active = dom.autoSiteHeaders.checked;
    badge.textContent = active ? 'remembered' : 'remembered · not sent';
    badge.title = active
      ? 'Captured from the page the stream was opened from'
      : 'Turn on remembering above to send these, or Edit to keep them as your own rule';
    host.appendChild(badge);
  }
  const values = document.createElement('pre');
  values.className = 'site-header-values';
  values.textContent = formatHeaderLines(rule.headers);
  info.append(host, values);

  const edit = actionButton('btn-secondary', 'Edit', `Edit headers for ${rule.host}`, () => {
    dom.siteHeadersHost.value = rule.host;
    dom.siteHeadersText.value = formatHeaderLines(rule.headers);
    dom.siteHeadersText.focus();
  });
  const remove = actionButton('btn-danger', 'Remove', `Remove headers for ${rule.host}`, () => {
    void runAction(() => removeSiteHeaders(rule.host), 'Failed to remove site headers');
  });

  item.append(info, edit, remove);
  return item;
}

async function renderSiteHeaders(): Promise<void> {
  const rules = await loadSiteHeaders();
  if (!rules.length) {
    const empty = document.createElement('div');
    empty.className = 'setting-hint';
    empty.textContent = 'No site headers yet.';
    dom.siteHeadersList.replaceChildren(empty);
    return;
  }
  dom.siteHeadersList.replaceChildren(...rules.map(renderSiteHeaderItem));
}

async function saveSiteHeaderForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const host = normalizeHost(dom.siteHeadersHost.value);
  if (!host) {
    toast.error('Enter a host such as cdn.example.com');
    return;
  }
  const { headers, errors } = parseHeaderLines(dom.siteHeadersText.value);
  if (errors.length) {
    toast.error(errors[0]!);
    return;
  }
  const ok = await runAction(
    () =>
      Object.keys(headers).length ? upsertSiteHeaders(host, headers) : removeSiteHeaders(host),
    'Failed to save site headers',
  );
  if (ok) {
    dom.siteHeadersForm.reset();
    toast.success(`Headers saved for ${host}`);
  }
}

// --- Wiring ----------------------------------------------------------------

function bindPair(slider: HTMLInputElement, number: HTMLInputElement): void {
  const sync = (from: HTMLInputElement, to: HTMLInputElement) => () => {
    to.value = from.value;
    updateSubtitlePreview();
    autoSave();
  };
  slider.addEventListener('input', sync(slider, number));
  number.addEventListener('input', sync(number, slider));
}

function bindColor(input: HTMLInputElement, label: HTMLElement): void {
  input.addEventListener('input', () => {
    label.textContent = input.value;
    updateSubtitlePreview();
    autoSave();
  });
}

async function showDetectState(): Promise<void> {
  dom.detectStreams.checked = await ext.permissions.contains(DETECT_PERMISSIONS);
}

function bindDetectToggle(): void {
  dom.detectStreams.addEventListener('change', () => {
    // Must run straight from the click: browsers only show the prompt during a user gesture.
    const change = dom.detectStreams.checked
      ? ext.permissions.request(DETECT_PERMISSIONS)
      : ext.permissions.remove(DETECT_PERMISSIONS);
    void change
      .catch((error: unknown) => {
        console.error('Failed to change stream detection:', error);
        toast.error('Could not change stream detection');
      })
      .finally(() => void showDetectState());
  });
  ext.permissions.onAdded.addListener(() => void showDetectState());
  ext.permissions.onRemoved.addListener(() => void showDetectState());
}

async function init(): Promise<void> {
  await populateSettings();
  bindDetectToggle();
  await showDetectState();

  dom.volumeInput.addEventListener('input', () => {
    dom.volumeLabel.textContent = `${Math.round(Number(dom.volumeInput.value) * 100)}%`;
    autoSave();
  });

  const changeSpeed = (speed: number) => {
    setSpeed(speed);
    autoSave();
  };
  dom.speedDecrease.addEventListener('click', () =>
    changeSpeed(Math.max(MIN_SPEED, currentSpeed - SPEED_STEP)),
  );
  dom.speedIncrease.addEventListener('click', () =>
    changeSpeed(Math.min(MAX_SPEED, currentSpeed + SPEED_STEP)),
  );
  dom.speedReset.addEventListener('click', () => changeSpeed(1));
  dom.speedPresets.forEach((btn) =>
    btn.addEventListener('click', () => changeSpeed(Number(btn.dataset.speed))),
  );

  dom.saveHistoryToggle.addEventListener('change', autoSave);
  dom.autoSiteHeaders.addEventListener('change', () => {
    autoSave();
    void renderSiteHeaders();
  });
  dom.siteHeadersForm.addEventListener('submit', (e) => void saveSiteHeaderForm(e));
  ext.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SITE_HEADERS_KEY]) void renderSiteHeaders();
  });
  await renderSiteHeaders();
  dom.liveBufferMinutes.addEventListener('change', () => {
    dom.liveBufferMinutes.value = String(readLiveBufferMinutes());
    autoSave();
  });
  dom.resetSettingsBtn.addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    if (await runAction(resetSettings, 'Failed to reset settings')) {
      await populateSettings();
      toast.success('Settings reset to defaults');
    }
  });

  bindPair(dom.subtitleFontSize, dom.subtitleFontSizeNumber);
  bindPair(dom.subtitleBgOpacity, dom.subtitleBgOpacityNumber);
  bindColor(dom.subtitleFontColor, dom.subtitleFontColorLabel);
  bindColor(dom.subtitleBgColor, dom.subtitleBgColorLabel);
  for (const select of [dom.subtitleFontFamily, dom.subtitleEdgeStyle]) {
    select.addEventListener('change', () => {
      updateSubtitlePreview();
      autoSave();
    });
  }

  dom.toggleAdvancedSubtitles.addEventListener('click', () => {
    const hidden = dom.advancedSubtitleSettings.classList.toggle('hidden');
    dom.toggleAdvancedSubtitles.setAttribute('aria-expanded', String(!hidden));
    dom.advancedSubtitleSettings.setAttribute('aria-hidden', String(hidden));
    const label = dom.toggleAdvancedSubtitles.querySelector('span');
    if (label) label.textContent = hidden ? 'More Options' : 'Less Options';
  });

  dom.resetSubtitleBtn.addEventListener('click', async () => {
    if (!confirm('Reset subtitle settings to defaults?')) return;
    const ok = await runAction(
      () => saveSettings({ subtitleSettings: { ...DEFAULT_SETTINGS.subtitleSettings } }),
      'Failed to reset settings',
    );
    if (ok) {
      await populateSettings();
      toast.success('Subtitle settings reset');
    }
  });

  dom.historySearch.addEventListener('input', renderHistory);
  dom.deleteSelectedBtn.addEventListener('click', () => void deleteSelected());
  dom.clearHistoryBtn.addEventListener('click', () => void clearAll());

  await refreshHistory();
}

void init();
