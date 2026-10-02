import { getStorage } from './storage';
import { getUrlKey } from './stream';

export interface SubtitleSettings {
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: string;
  edgeStyle: string;
}

export interface PlayerSettings {
  volume: number;
  muted: boolean;
  playbackRate: number;
  preferredQuality: 'auto' | 'highest' | 'lowest';
  saveHistory: boolean;
  /** Minutes of live stream to keep buffering and retain while paused; 0 uses engine defaults. */
  liveBufferWhilePausedMinutes: number;
  /** Remember the Referer/Origin of the page a stream link was opened from (opt-in). */
  rememberLinkSiteHeaders: boolean;
  subtitlesEnabled: boolean;
  subtitleSettings: SubtitleSettings;
}

export interface HistoryEntry {
  url: string;
  title: string;
  customTitle: string | null;
  currentTime: number;
  duration: number;
  timestamp: number;
  pinned: boolean;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const SETTINGS_KEY = 'playerSettings';
export const HISTORY_KEY = 'watchHistory';
export const MAX_HISTORY_ENTRIES = 50;
const QUOTA_WARNING_BYTES = 5 * 1024 * 1024;

export const DEFAULT_SETTINGS: Readonly<PlayerSettings> = Object.freeze({
  volume: 1.0,
  muted: false,
  playbackRate: 1.0,
  preferredQuality: 'auto',
  saveHistory: true,
  // ~3 min of 1080p stays within the browser's ~150 MB SourceBuffer quota.
  liveBufferWhilePausedMinutes: 3,
  rememberLinkSiteHeaders: false,
  subtitlesEnabled: true,
  subtitleSettings: Object.freeze({
    fontSize: 100,
    fontColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 80,
    fontFamily: 'sans-serif',
    edgeStyle: 'none',
  }),
});

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export const MAX_LIVE_BUFFER_MINUTES = 30;

export function validateSettings(settings: DeepPartial<PlayerSettings>): string[] {
  const errors: string[] = [];
  const inRange = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && v >= min && v <= max;

  if (settings.volume !== undefined && !inRange(settings.volume, 0, 1)) {
    errors.push('volume must be between 0 and 1');
  }
  if (settings.playbackRate !== undefined && !inRange(settings.playbackRate, 0.25, 4)) {
    errors.push('playbackRate must be between 0.25 and 4');
  }
  const liveMinutes = settings.liveBufferWhilePausedMinutes;
  if (
    liveMinutes !== undefined &&
    !(Number.isInteger(liveMinutes) && inRange(liveMinutes, 0, MAX_LIVE_BUFFER_MINUTES))
  ) {
    errors.push(
      `liveBufferWhilePausedMinutes must be a whole number between 0 and ${MAX_LIVE_BUFFER_MINUTES}`,
    );
  }

  const sub = settings.subtitleSettings;
  if (sub) {
    if (sub.fontSize !== undefined && !inRange(sub.fontSize, 50, 400)) {
      errors.push('subtitleSettings.fontSize must be between 50 and 400');
    }
    if (sub.backgroundOpacity !== undefined && !inRange(sub.backgroundOpacity, 0, 100)) {
      errors.push('subtitleSettings.backgroundOpacity must be between 0 and 100');
    }
    if (sub.fontColor !== undefined && !HEX_COLOR.test(sub.fontColor)) {
      errors.push('subtitleSettings.fontColor must be a valid hex color');
    }
    if (sub.backgroundColor !== undefined && !HEX_COLOR.test(sub.backgroundColor)) {
      errors.push('subtitleSettings.backgroundColor must be a valid hex color');
    }
  }
  return errors;
}

export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(source)) {
    const current = result[key];
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge((current as object) ?? {}, value as object)
        : value;
  }
  return result as T;
}

export async function loadSettings(): Promise<PlayerSettings> {
  try {
    const result = await getStorage().get([SETTINGS_KEY]);
    return deepMerge(
      structuredClone(DEFAULT_SETTINGS) as PlayerSettings,
      (result[SETTINGS_KEY] as DeepPartial<PlayerSettings>) ?? {},
    );
  } catch (error) {
    console.error('Failed to load settings:', error);
    return structuredClone(DEFAULT_SETTINGS) as PlayerSettings;
  }
}

export async function saveSettings(settings: DeepPartial<PlayerSettings>): Promise<void> {
  const errors = validateSettings(settings);
  if (errors.length) {
    throw new Error(`Invalid settings: ${errors.join(', ')}`);
  }
  const updated = deepMerge(await loadSettings(), settings);
  await warnIfStorageHigh();
  await getStorage().set({ [SETTINGS_KEY]: updated });
}

export async function resetSettings(): Promise<void> {
  await getStorage().set({ [SETTINGS_KEY]: structuredClone(DEFAULT_SETTINGS) });
}

async function warnIfStorageHigh(): Promise<void> {
  try {
    const bytes = (await getStorage().getBytesInUse?.([SETTINGS_KEY, HISTORY_KEY])) ?? 0;
    if (bytes > QUOTA_WARNING_BYTES) {
      console.warn(`Storage usage is high: ${(bytes / 1024 / 1024).toFixed(2)}MB`);
    }
  } catch {
    // getBytesInUse is not available in every browser.
  }
}

export function sortHistory(history: HistoryEntry[]): HistoryEntry[] {
  return [...history].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const result = await getStorage().get([HISTORY_KEY]);
    return sortHistory((result[HISTORY_KEY] as HistoryEntry[]) ?? []);
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

async function writeHistory(history: HistoryEntry[]): Promise<void> {
  await getStorage().set({ [HISTORY_KEY]: history });
}

export async function saveToHistory(
  url: string,
  title: string,
  currentTime: number,
  duration: number,
): Promise<void> {
  try {
    const settings = await loadSettings();
    if (!settings.saveHistory) return;

    const history = await loadHistory();
    const urlKey = getUrlKey(url);
    const existing = history.find((e) => e.url === urlKey);

    const entry: HistoryEntry = {
      url: urlKey,
      title: title || 'Untitled Stream',
      customTitle: existing?.customTitle ?? null,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration) || 0,
      timestamp: Date.now(),
      pinned: existing?.pinned ?? false,
    };

    const next = [entry, ...history.filter((e) => e.url !== urlKey)].slice(0, MAX_HISTORY_ENTRIES);
    await writeHistory(next);
  } catch (error) {
    console.error('Failed to save to history:', error);
  }
}

export async function getResumePosition(url: string): Promise<number> {
  const urlKey = getUrlKey(url);
  const entry = (await loadHistory()).find((h) => h.url === urlKey);
  return entry?.currentTime ?? 0;
}

/** Returns false when the entry is pinned and `force` is not set. */
export async function deleteHistoryEntry(url: string, force = false): Promise<boolean> {
  const history = await loadHistory();
  if (!force && history.find((e) => e.url === url)?.pinned) return false;
  await writeHistory(history.filter((e) => e.url !== url));
  return true;
}

export async function renameHistoryEntry(url: string, newTitle: string): Promise<void> {
  const history = await loadHistory();
  const entry = history.find((e) => e.url === url);
  if (!entry) return;
  entry.customTitle = newTitle.trim() || null;
  await writeHistory(history);
}

export async function toggleHistoryPin(url: string): Promise<boolean> {
  const history = await loadHistory();
  const entry = history.find((e) => e.url === url);
  if (!entry) return false;
  entry.pinned = !entry.pinned;
  await writeHistory(history);
  return entry.pinned;
}

/** Clears all unpinned entries. */
export async function clearHistory(): Promise<void> {
  const history = await loadHistory();
  await writeHistory(history.filter((e) => e.pinned));
}
