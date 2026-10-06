import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session: Record<string, unknown> = {};
  const event = () => ({ addListener: vi.fn(), hasListener: vi.fn(() => false) });
  return {
    session,
    settings: {
      saveHistory: true,
      saveHistoryInIncognito: false,
      detectStreams: true,
      inspectHlsPlaylists: false,
      rememberLinkSiteHeaders: false,
    },
    ext: {
      extension: { inIncognitoContext: false },
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        onMessage: event(),
        onInstalled: event(),
      },
      storage: {
        session: {
          get: vi.fn(async (key: string | null) =>
            structuredClone(key === null ? session : { [key]: session[key] }),
          ),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(session, structuredClone(items));
          }),
          remove: vi.fn(async (key: string) => {
            delete session[key];
          }),
        },
        onChanged: event(),
      },
      action: { setBadgeText: vi.fn(async () => {}) },
      webRequest: { onBeforeSendHeaders: event() },
      webNavigation: { onCommitted: event(), onBeforeNavigate: event() },
      tabs: {
        onRemoved: event(),
        get: vi.fn(async (id: number) => ({ id, index: 2, windowId: 9, incognito: id === 10 })),
        create: vi.fn(async () => ({ id: 100 })),
        update: vi.fn(async () => ({})),
      },
    },
  };
});

vi.mock('../../src/lib/browser', () => ({ ext: mocks.ext }));
vi.mock('../../src/lib/settings', () => ({
  SETTINGS_KEY: 'playerSettings',
  loadSettings: async () => ({ ...mocks.settings }),
}));

let getDetected: typeof import('../../src/background/detect').getDetected;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of Object.keys(mocks.session)) delete mocks.session[key];
  mocks.settings.saveHistory = true;
  mocks.settings.saveHistoryInIncognito = false;
  mocks.settings.detectStreams = true;
  mocks.settings.inspectHlsPlaylists = false;
  mocks.ext.extension.inIncognitoContext = false;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await import('../../src/background/index');
  ({ getDetected } = await import('../../src/background/detect'));
});

afterEach(() => vi.unstubAllGlobals());

async function detect(tabId: number, incognito: boolean, url = 'https://video.test/live.m3u8') {
  const onRequest = mocks.ext.webRequest.onBeforeSendHeaders.addListener.mock.calls[0][0];
  onRequest({
    tabId,
    incognito,
    url,
    initiator: 'https://site.test',
    requestHeaders: [{ name: 'Referer', value: 'https://site.test/' }],
  });
  await vi.waitFor(async () => expect(await getDetected(tabId)).toHaveLength(1));
}

function message(command: Record<string, unknown>): Promise<unknown> {
  const listener = mocks.ext.runtime.onMessage.addListener.mock.calls[0][0];
  return new Promise((resolve) => listener(command, {}, resolve));
}

describe('private stream detection', () => {
  it.each([false, true])(
    'detects private streams with history off, split context %s',
    async (split) => {
      mocks.settings.saveHistory = false;
      mocks.ext.extension.inIncognitoContext = split;
      await detect(10, true);
      expect(await message({ command: 'GET_DETECTED', tabId: 10 })).toMatchObject([
        { url: 'https://video.test/live.m3u8', type: 'hls' },
      ]);
      const onChanged = mocks.ext.storage.onChanged.addListener.mock.calls[0][0];
      onChanged({ playerSettings: { newValue: { ...mocks.settings } } }, 'local');
      expect(await getDetected(10)).toHaveLength(1);
      await detect(30, true, 'https://video.test/next.mpd');
      expect(await getDetected(30)).toMatchObject([{ type: 'dash' }]);
    },
  );

  it.each([false, true])('detects private requests with split context %s', async (split) => {
    mocks.ext.extension.inIncognitoContext = split;
    await detect(10, true);
    await detect(20, false, 'https://video.test/regular.mpd');
    expect(await message({ command: 'GET_DETECTED', tabId: 10 })).toMatchObject([
      { url: 'https://video.test/live.m3u8', type: 'hls' },
    ]);
    expect(await getDetected(20)).toMatchObject([
      { url: 'https://video.test/regular.mpd', type: 'dash' },
    ]);
    expect(mocks.ext.action.setBadgeText).toHaveBeenCalledWith({ tabId: 10, text: '1' });
  });

  it('clears private detections on navigation and tab closure', async () => {
    await detect(10, true);
    const onCommitted = mocks.ext.webNavigation.onCommitted.addListener.mock.calls[0][0];
    onCommitted({ tabId: 10, frameId: 0 });
    expect(await getDetected(10)).toEqual([]);
    await detect(10, true);
    const onRemoved = mocks.ext.tabs.onRemoved.addListener.mock.calls[0][0];
    onRemoved(10);
    expect(await getDetected(10)).toEqual([]);
    expect(mocks.session['detected:10']).toBeUndefined();
  });

  it('does not probe private playlists from a shared regular background', async () => {
    mocks.settings.inspectHlsPlaylists = true;
    await detect(10, true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('can inspect private playlists from an isolated private background', async () => {
    mocks.settings.inspectHlsPlaylists = true;
    mocks.ext.extension.inIncognitoContext = true;
    await detect(10, true);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it('still inspects regular playlists in spanning mode', async () => {
    mocks.settings.inspectHlsPlaylists = true;
    await detect(20, false);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it.each([false, true])(
    'opens detected streams in their private window, fallback %s',
    async (fallback) => {
      await detect(10, true);
      if (fallback)
        mocks.ext.tabs.create.mockRejectedValueOnce(new Error('Unsupported openerTabId'));
      expect(
        await message({ command: 'PLAY_STREAM', tabId: 10, url: 'https://video.test/live.m3u8' }),
      ).toEqual({ success: true });
      expect(mocks.ext.tabs.create).toHaveBeenLastCalledWith({
        url: 'about:blank',
        index: 3,
        windowId: 9,
        ...(fallback ? {} : { openerTabId: 10 }),
      });
      expect(mocks.ext.tabs.update).toHaveBeenCalledWith(100, {
        url: 'chrome-extension://test/player.html#https://video.test/live.m3u8',
      });
    },
  );
});
