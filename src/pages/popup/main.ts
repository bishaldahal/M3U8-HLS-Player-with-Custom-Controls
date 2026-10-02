import '../../lib/ui-feedback.css';
import { ext } from '../../lib/browser';
import type { DetectedStream } from '../../lib/detected';
import { loadHistory, loadSettings, saveSettings, type HistoryEntry } from '../../lib/settings';
import { formatRelativeTime, formatTime } from '../../lib/time';
import { toast } from '../../lib/ui-feedback';

const DEBOUNCE_MS = 300;
const RECENT_COUNT = 5;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function openPlayer(url: string): void {
  void ext.tabs.create({ url: `${ext.runtime.getURL('player.html')}#${url}` });
  window.close();
}

function emptyMessage(text: string, hint?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'history-empty';
  el.textContent = text;
  if (hint) {
    const small = document.createElement('small');
    small.textContent = hint;
    el.append(document.createElement('br'), small);
  }
  return el;
}

function renderHistoryItem(entry: HistoryEntry): HTMLElement {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Play ${entry.title}`);

  const info = document.createElement('div');
  info.className = 'history-info';

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = entry.title;
  title.title = entry.url;

  const meta = document.createElement('div');
  meta.className = 'history-meta';
  const timeText =
    entry.duration > 0
      ? `${formatTime(entry.currentTime)} / ${formatTime(entry.duration)}`
      : `${formatTime(entry.currentTime)} (Live)`;
  meta.textContent = `${timeText} • ${formatRelativeTime(entry.timestamp)}`;

  info.append(title, meta);
  item.appendChild(info);

  item.addEventListener('click', () => openPlayer(entry.url));
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPlayer(entry.url);
    }
  });
  return item;
}

function renderDetectedItem(stream: DetectedStream, tabId: number): HTMLElement {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.tabIndex = 0;
  item.setAttribute('role', 'button');

  const { hostname, pathname } = new URL(stream.url);
  const name = decodeURIComponent(pathname.split('/').pop() || pathname);
  item.setAttribute('aria-label', `Play ${name} from ${hostname}`);

  const info = document.createElement('div');
  info.className = 'history-info';
  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = `${stream.type.toUpperCase()} · ${name}`;
  title.title = stream.url;
  const meta = document.createElement('div');
  meta.className = 'history-meta';
  const headerCount = Object.keys(stream.headers).length;
  meta.textContent = `${hostname} • ${formatRelativeTime(stream.seenAt)}${
    headerCount ? ` • plays with the site's ${headerCount} headers` : ''
  }`;
  info.append(title, meta);
  item.appendChild(info);

  const play = () => {
    void ext.runtime.sendMessage({
      command: 'PLAY_STREAM',
      url: stream.url,
      streamType: stream.type,
      tabId,
    });
    window.close();
  };
  item.addEventListener('click', play);
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      play();
    }
  });
  return item;
}

async function renderDetected(): Promise<boolean> {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return false;
  const streams = (await ext.runtime.sendMessage({ command: 'GET_DETECTED', tabId: tab.id })) as
    DetectedStream[] | undefined;
  if (!streams?.length) return false;
  $<HTMLElement>('detected-list').replaceChildren(
    ...[...streams].reverse().map((s) => renderDetectedItem(s, tab.id!)),
  );
  $<HTMLElement>('detected-section').hidden = false;
  return true;
}

async function renderHistory(focusFirst = true): Promise<void> {
  const list = $<HTMLElement>('history-list');
  list.replaceChildren(emptyMessage('Loading...'));

  try {
    const history = await loadHistory();
    if (history.length === 0) {
      list.replaceChildren(
        emptyMessage(
          'No recent streams',
          'Start watching M3U8/HLS/DASH streams and they will appear here',
        ),
      );
      return;
    }
    const items = history.slice(0, RECENT_COUNT).map(renderHistoryItem);
    list.replaceChildren(...items);
    if (focusFirst) items[0]?.focus();
  } catch (error) {
    console.error('Error loading history:', error);
    list.replaceChildren(emptyMessage('Error loading history', 'Please try again'));
  }
}

function saveSubtitleSize(fontSize: number): void {
  const savingIndicator = $<HTMLElement>('saving-indicator');
  const saveStatus = $<HTMLElement>('save-status');
  savingIndicator.classList.add('visible');
  saveStatus.classList.remove('visible');

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await saveSettings({ subtitleSettings: { fontSize } });
      savingIndicator.classList.remove('visible');
      saveStatus.classList.add('visible');
      setTimeout(() => saveStatus.classList.remove('visible'), 2000);
    } catch (error) {
      console.error('Error saving subtitle size:', error);
      savingIndicator.classList.remove('visible');
      toast.error('Failed to save subtitle size');
    }
  }, DEBOUNCE_MS);
}

async function init(): Promise<void> {
  $<HTMLButtonElement>('open-options').addEventListener('click', () => {
    void ext.runtime.openOptionsPage();
    window.close();
  });

  $<HTMLButtonElement>('open-shortcuts').addEventListener('click', () => {
    void ext.tabs.create({ url: ext.runtime.getURL('shortcuts.html') });
    window.close();
  });

  const slider = $<HTMLInputElement>('subtitle-size');
  const sliderValue = $<HTMLElement>('subtitle-size-value');
  const toggle = $<HTMLInputElement>('subtitles-enabled');

  slider.addEventListener('input', () => {
    sliderValue.textContent = `${slider.value}%`;
    saveSubtitleSize(Number.parseInt(slider.value, 10));
  });

  toggle.addEventListener('change', async () => {
    try {
      await saveSettings({ subtitlesEnabled: toggle.checked });
    } catch (error) {
      console.error('Error saving subtitle enabled state:', error);
      toast.error('Failed to save subtitle setting');
    }
  });

  try {
    const settings = await loadSettings();
    const fontSize = settings.subtitleSettings.fontSize || 100;
    slider.value = String(fontSize);
    sliderValue.textContent = `${fontSize}%`;
    toggle.checked = settings.subtitlesEnabled !== false;
  } catch (error) {
    console.error('Error loading subtitle settings:', error);
    toast.error('Failed to load subtitle settings');
  }

  const hasDetected = await renderDetected().catch((error) => {
    console.error('Error loading detected streams:', error);
    return false;
  });
  if (hasDetected)
    $<HTMLElement>('detected-list').querySelector<HTMLElement>('[role=button]')?.focus();
  await renderHistory(!hasDetected);
}

void init();
