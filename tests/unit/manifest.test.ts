import { describe, expect, it } from 'vitest';
import { FIREFOX_ADDON_ID, buildManifest } from '../../src/manifest';

describe('buildManifest', () => {
  it('uses a module service worker for Chrome', () => {
    const m = buildManifest('chrome', '1.2.3');
    expect(m.version).toBe('1.2.3');
    expect(m.manifest_version).toBe(3);
    expect(m.background).toEqual({ service_worker: 'js/background.js', type: 'module' });
    expect(m.browser_specific_settings).toBeUndefined();
  });

  it('uses background scripts and gecko settings for Firefox', () => {
    const m = buildManifest('firefox', '1.2.3');
    expect(m.background).toEqual({ scripts: ['js/background.js'] });
    expect(m.browser_specific_settings).toMatchObject({ gecko: { id: FIREFOX_ADDON_ID } });
  });

  it('references files emitted by the build', () => {
    const m = buildManifest('chrome', '1.0.0');
    expect(m.content_scripts?.[0]?.js).toEqual(['js/content.js']);
    expect(m.action?.default_popup).toBe('popup.html');
    expect(m.options_ui?.page).toBe('options.html');
  });
});
