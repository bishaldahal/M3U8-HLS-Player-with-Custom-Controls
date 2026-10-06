import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  HISTORY_KEY,
  MAX_HISTORY_ENTRIES,
  SETTINGS_KEY,
  clearHistory,
  deepMerge,
  deleteHistoryEntry,
  getResumePosition,
  loadHistory,
  loadSettings,
  renameHistoryEntry,
  saveSettings,
  saveToHistory,
  sortHistory,
  toggleHistoryPin,
  validateSettings,
  type HistoryEntry,
} from '../../src/lib/settings';
import { setStorage, type KeyValueStorage } from '../../src/lib/storage';

const extensionContext = vi.hoisted(() => ({ inIncognitoContext: false }));
vi.mock('../../src/lib/browser', () => ({ ext: { extension: extensionContext } }));

function memoryStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initial);
  const storage: KeyValueStorage = {
    get: async (keys) =>
      Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    set: async (items) => {
      Object.assign(data, structuredClone(items));
    },
  };
  return { storage, data };
}

const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  url: 'https://x.test/a.m3u8',
  title: 'A',
  customTitle: null,
  currentTime: 0,
  duration: 0,
  timestamp: 0,
  pinned: false,
  ...overrides,
});

let data: Record<string, unknown>;

beforeEach(() => {
  extensionContext.inIncognitoContext = false;
  const mem = memoryStorage();
  data = mem.data;
  setStorage(mem.storage);
});

afterEach(() => setStorage(null));

describe('validateSettings', () => {
  it('accepts defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects out-of-range values', () => {
    const errors = validateSettings({
      volume: 2,
      playbackRate: 0,
      subtitleSettings: { fontSize: 10, backgroundOpacity: 101, fontColor: 'red' },
    });
    expect(errors).toHaveLength(5);
  });

  it('validates liveBufferWhilePausedMinutes', () => {
    expect(validateSettings({ liveBufferWhilePausedMinutes: 10 })).toEqual([]);
    expect(validateSettings({ liveBufferWhilePausedMinutes: -1 })).toHaveLength(1);
    expect(validateSettings({ liveBufferWhilePausedMinutes: 31 })).toHaveLength(1);
    expect(validateSettings({ liveBufferWhilePausedMinutes: 1.5 })).toHaveLength(1);
  });
});

describe('deepMerge', () => {
  it('merges nested objects without mutating the target', () => {
    const target = { a: 1, nested: { b: 2, c: 3 } };
    const merged = deepMerge(target, { nested: { c: 4 } });
    expect(merged).toEqual({ a: 1, nested: { b: 2, c: 4 } });
    expect(target.nested.c).toBe(3);
  });
});

describe('loadSettings / saveSettings', () => {
  it('returns defaults when storage is empty', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect((await loadSettings()).inspectHlsPlaylists).toBe(false);
    expect((await loadSettings()).saveHistory).toBe(true);
    expect((await loadSettings()).saveHistoryInIncognito).toBe(false);
  });

  it('defaults existing users to no private history without changing normal history', async () => {
    data[SETTINGS_KEY] = { saveHistory: true };
    expect(await loadSettings()).toMatchObject({
      saveHistory: true,
      saveHistoryInIncognito: false,
    });
  });

  it('merges partial updates with stored settings', async () => {
    await saveSettings({ volume: 0.5 });
    await saveSettings({ subtitleSettings: { fontSize: 200 } });
    const settings = await loadSettings();
    expect(settings.volume).toBe(0.5);
    expect(settings.subtitleSettings.fontSize).toBe(200);
    expect(settings.subtitleSettings.fontColor).toBe('#ffffff');
  });

  it('throws on invalid settings and does not write', async () => {
    await expect(saveSettings({ volume: 5 })).rejects.toThrow(/volume/);
    expect(data[SETTINGS_KEY]).toBeUndefined();
  });
});

describe('history', () => {
  it('sorts pinned first, then newest', () => {
    const sorted = sortHistory([
      entry({ url: 'a', timestamp: 1 }),
      entry({ url: 'b', timestamp: 3 }),
      entry({ url: 'c', timestamp: 2, pinned: true }),
    ]);
    expect(sorted.map((e) => e.url)).toEqual(['c', 'b', 'a']);
  });

  it('saves, dedupes by URL key and preserves pin/custom title', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    await saveToHistory('https://x.test/a.m3u8?extTitle=One', 'One', 10.7, 100.2);
    await toggleHistoryPin('https://x.test/a.m3u8');
    await renameHistoryEntry('https://x.test/a.m3u8', '  Custom  ');
    await saveToHistory('https://x.test/a.m3u8', 'One', 20, 100);

    const history = await loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      url: 'https://x.test/a.m3u8',
      currentTime: 20,
      pinned: true,
      customTitle: 'Custom',
    });
    expect(await getResumePosition('https://x.test/a.m3u8?extTitle=Other')).toBe(20);
  });

  it('respects the saveHistory setting', async () => {
    await saveSettings({ saveHistory: false });
    await saveToHistory('https://x.test/a.m3u8', 'A', 1, 2);
    expect(await loadHistory()).toEqual([]);
  });

  it('does not save history or resume when history is disabled', async () => {
    await saveSettings({ saveHistory: false });
    data[HISTORY_KEY] = [entry({ currentTime: 42 })];
    expect((await loadSettings()).saveHistory).toBe(false);
    await saveToHistory('https://x.test/new.m3u8', 'New', 10, 100);
    expect(await loadHistory()).toEqual([entry({ currentTime: 42 })]);
    expect(await getResumePosition('https://x.test/a.m3u8')).toBe(0);
  });

  it('does not save or resume in private windows by default', async () => {
    data[HISTORY_KEY] = [entry({ currentTime: 42 })];
    extensionContext.inIncognitoContext = true;
    await saveToHistory('https://x.test/a.m3u8', 'Private', 80, 100);
    expect(await loadHistory()).toEqual([entry({ currentTime: 42 })]);
    expect(await getResumePosition('https://x.test/a.m3u8')).toBe(0);
  });

  it('allows explicitly opting into private history and resume', async () => {
    extensionContext.inIncognitoContext = true;
    await saveSettings({ saveHistoryInIncognito: true });
    await saveToHistory('https://x.test/a.m3u8', 'Private', 80, 100);
    expect(await loadHistory()).toMatchObject([{ title: 'Private', currentTime: 80 }]);
    expect(await getResumePosition('https://x.test/a.m3u8')).toBe(80);
  });

  it('the master history switch also disables opted-in private history', async () => {
    extensionContext.inIncognitoContext = true;
    await saveSettings({ saveHistory: false, saveHistoryInIncognito: true });
    await saveToHistory('https://x.test/a.m3u8', 'Private', 80, 100);
    expect(await loadHistory()).toEqual([]);
  });

  it('caps the number of entries', async () => {
    data[HISTORY_KEY] = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) =>
      entry({ url: `u${i}`, timestamp: i }),
    );
    await saveToHistory('https://x.test/new.m3u8', 'New', 0, 0);
    const history = await loadHistory();
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(history.some((e) => e.url === 'u0')).toBe(false);
  });

  it('refuses to delete pinned entries unless forced', async () => {
    data[HISTORY_KEY] = [entry({ url: 'p', pinned: true })];
    expect(await deleteHistoryEntry('p')).toBe(false);
    expect(await deleteHistoryEntry('p', true)).toBe(true);
    expect(await loadHistory()).toEqual([]);
  });

  it('clearHistory keeps pinned entries', async () => {
    data[HISTORY_KEY] = [entry({ url: 'a' }), entry({ url: 'p', pinned: true })];
    await clearHistory();
    expect((await loadHistory()).map((e) => e.url)).toEqual(['p']);
  });
});
