import '../../lib/ui-feedback.css';
import { ext } from '../../lib/browser';
import { DETECT_PERMISSIONS, type DetectedStream } from '../../lib/detected';
import { loadHistory, loadSettings, saveSettings, type HistoryEntry } from '../../lib/settings';
import { formatRelativeTime, formatTime } from '../../lib/time';
import { toast } from '../../lib/ui-feedback';

const DEBOUNCE_MS = 300;
const RECENT_COUNT = 5;
// Firefox MV3 leaves host permissions ungranted until the user allows them.
const HOST_PERMISSIONS: chrome.permissions.Permissions = { origins: ['<all_urls>'] };

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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderDetectedItem(stream: DetectedStream, tabId: number): HTMLElement {
  const item = el('div', 'detected-item');
  item.tabIndex = 0;
  item.setAttribute('role', 'button');

  const { hostname, pathname } = new URL(stream.url);
  const name = decodeURIComponent(pathname.split('/').pop() || pathname);
  const headerCount = Object.keys(stream.headers).length;
  item.title = stream.url;
  item.setAttribute(
    'aria-label',
    `Play ${stream.type.toUpperCase()} stream ${name} from ${hostname}` +
      (headerCount ? ` with ${headerCount} site headers` : ''),
  );

  const play = el('span', 'detected-play');
  play.setAttribute('aria-hidden', 'true');

  const info = el('div', 'detected-info');
  const top = el('div', 'detected-top');
  top.append(
    el('span', `detected-type detected-type-${stream.type}`, stream.type.toUpperCase()),
    el('span', 'detected-name', name),
  );
  const meta = el('div', 'detected-meta');
  meta.append(
    el('span', 'detected-host', hostname),
    el('span', 'detected-time', formatRelativeTime(stream.seenAt)),
  );
  if (headerCount) {
    const badge = el('span', 'detected-headers', `${headerCount} site headers`);
    badge.title = `Sent the way the page sent them: ${Object.keys(stream.headers).join(', ')}`;
    meta.append(badge);
  }
  info.append(top, meta);
  item.append(play, info);

  const open = async () => {
    try {
      // Wait for the reply: closing the popup first can drop the message on Firefox.
      const res = (await ext.runtime.sendMessage({
        command: 'PLAY_STREAM',
        url: stream.url,
        streamType: stream.type,
        tabId,
      })) as { success?: boolean; error?: string } | undefined;
      if (res && !res.success) throw new Error(res.error);
      window.close();
    } catch (error) {
      console.error('Failed to open detected stream:', error);
      toast.error('Could not open this stream');
    }
  };
  item.addEventListener('click', () => void open());
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void open();
    }
  });
  return item;
}

async function renderDetected(): Promise<boolean> {
  const list = $<HTMLElement>('detected-list');
  const hint = $<HTMLElement>('detect-hint');
  const enabled = await ext.permissions.contains(DETECT_PERMISSIONS);
  $<HTMLInputElement>('detect-streams').checked = enabled;
  list.replaceChildren();
  if (!enabled) {
    hint.textContent =
      'Off. Turn on to list streams that pages play and open them here with the same headers.';
    return false;
  }
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  const streams =
    tab?.id === undefined
      ? []
      : ((await ext.runtime.sendMessage({ command: 'GET_DETECTED', tabId: tab.id })) as
          DetectedStream[] | undefined);
  if (!streams?.length) {
    hint.textContent = 'None yet. Start the video on the page, then open this again.';
    return false;
  }
  hint.textContent = `${streams.length} found on this tab`;
  list.replaceChildren(...[...streams].reverse().map((s) => renderDetectedItem(s, tab!.id!)));
  return true;
}

function bindDetectToggle(): void {
  const toggle = $<HTMLInputElement>('detect-streams');
  toggle.addEventListener('change', () => {
    // Must run straight from the click: browsers only show the prompt during a user gesture.
    const change = toggle.checked
      ? ext.permissions.request(DETECT_PERMISSIONS)
      : ext.permissions.remove(DETECT_PERMISSIONS).then((removed) => !removed);
    void change
      .catch((error: unknown) => {
        console.error('Failed to change stream detection:', error);
        toast.error('Could not change stream detection');
      })
      .finally(() => void renderDetected());
  });
}

async function renderAccessBanner(): Promise<void> {
  $<HTMLElement>('access-banner').hidden = await ext.permissions.contains(HOST_PERMISSIONS);
}

function bindAccessButton(): void {
  $<HTMLButtonElement>('grant-access').addEventListener('click', () => {
    void ext.permissions
      .request(HOST_PERMISSIONS)
      .catch((error: unknown) => {
        console.error('Failed to request site access:', error);
        toast.error('Could not request site access');
      })
      .finally(() => void renderAccessBanner());
  });
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

  bindAccessButton();
  void renderAccessBanner().catch((error: unknown) => {
    console.error('Error checking site access:', error);
  });

  bindDetectToggle();
  const hasDetected = await renderDetected().catch((error) => {
    console.error('Error loading detected streams:', error);
    return false;
  });
  if (hasDetected)
    $<HTMLElement>('detected-list').querySelector<HTMLElement>('[role=button]')?.focus();
  await renderHistory(!hasDetected);
}

void init();
