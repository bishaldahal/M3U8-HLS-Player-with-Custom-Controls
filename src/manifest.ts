export type Browser = 'chrome' | 'firefox';

// Firefox-only keys (background.scripts, browser_specific_settings) aren't in @types/chrome.
type Manifest = Omit<chrome.runtime.ManifestV3, 'background'> & Record<string, unknown>;

const NAME: Record<Browser, string> = {
  chrome: 'M3U8/HLS/DASH Player - Custom Keyboard Shortcuts',
  firefox: 'M3U8/HLS/DASH Player Custom Keyboard Shortcut',
};

export const FIREFOX_ADDON_ID = '{1dcebb07-6afe-48b8-9b52-2dd1d15979e4}';

export function buildManifest(browser: Browser, version: string): Manifest {
  const base: Manifest = {
    manifest_version: 3,
    name: NAME[browser],
    version,
    description:
      'Advanced M3U8/HLS/DASH player with customizable controls. Supports keyboard shortcuts, PIP mode, frame navigation, and live streams.',
    permissions: ['webNavigation', 'webRequest', 'storage', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['*://*/*', 'http://*/*', 'https://*/*', 'file:///*', '<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['*.html', '*.js', '*.css', '*.png'],
        matches: ['<all_urls>'],
      },
    ],
    content_scripts: [{ matches: ['<all_urls>'], js: ['js/content.js'] }],
    action: {
      default_title: 'M3U8/HLS/DASH Player',
      default_popup: 'popup.html',
    },
    options_ui: { page: 'options.html', open_in_tab: true },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval' ; object-src 'self' ;",
    },
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  };

  if (browser === 'chrome') {
    return { ...base, background: { service_worker: 'js/background.js', type: 'module' } };
  }

  return {
    ...base,
    background: { scripts: ['js/background.js'] },
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_ADDON_ID,
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}
