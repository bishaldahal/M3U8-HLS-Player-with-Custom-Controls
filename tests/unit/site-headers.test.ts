import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HEADER_RULE_ID_BASE,
  SITE_HEADERS_KEY,
  buildHeaderRules,
  headersFromPage,
  loadSiteHeaders,
  normalizeHost,
  parseHeaderLines,
  removeSiteHeaders,
  upsertSiteHeaders,
  validateHeaders,
} from '../../src/lib/site-headers';
import { setStorage, type KeyValueStorage } from '../../src/lib/storage';

function memoryStorage() {
  const data: Record<string, unknown> = {};
  const storage: KeyValueStorage = {
    get: async (keys) =>
      Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    set: async (items) => {
      Object.assign(data, structuredClone(items));
    },
  };
  return { storage, data };
}

describe('normalizeHost', () => {
  it('accepts hosts and URLs', () => {
    expect(normalizeHost(' CDN.Example.com ')).toBe('cdn.example.com');
    expect(normalizeHost('https://cdn.example.com:8443/a.m3u8')).toBe('cdn.example.com');
    expect(normalizeHost('127.0.0.1')).toBe('127.0.0.1');
  });

  it('rejects junk', () => {
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('a b')).toBeNull();
    expect(normalizeHost('*.example.com')).toBeNull();
  });
});

describe('header parsing and validation', () => {
  it('parses Name: value lines and keeps colons in values', () => {
    const { headers, errors } = parseHeaderLines(
      'Referer: https://site.test/\n\n Cookie : a=1; b=2 ',
    );
    expect(errors).toEqual([]);
    expect(headers).toEqual({ Referer: 'https://site.test/', Cookie: 'a=1; b=2' });
  });

  it('reports malformed lines and names', () => {
    expect(parseHeaderLines('no colon').errors[0]).toMatch(/Line 1/);
    expect(parseHeaderLines('Bad Name: x').errors[0]).toMatch(/Invalid header name/);
  });

  it('rejects header injection in values', () => {
    expect(validateHeaders({ Referer: 'a\r\nX-Evil: 1' })).toHaveLength(1);
  });
});

describe('headersFromPage', () => {
  it('uses the page origin only', () => {
    expect(headersFromPage('https://site.test/watch?id=1#t')).toEqual({
      Referer: 'https://site.test/',
      Origin: 'https://site.test',
    });
  });

  it('ignores non-web pages', () => {
    expect(headersFromPage('file:///tmp/a.html')).toBeNull();
    expect(headersFromPage(undefined)).toBeNull();
  });
});

describe('site header storage', () => {
  let mem: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    mem = memoryStorage();
    setStorage(mem.storage);
  });
  afterEach(() => setStorage(null));

  it('adds, replaces and removes a rule', async () => {
    await upsertSiteHeaders('cdn.test', { Referer: 'https://a.test/' });
    await upsertSiteHeaders('CDN.test', { Referer: 'https://b.test/' });
    expect(await loadSiteHeaders()).toMatchObject([
      { host: 'cdn.test', headers: { Referer: 'https://b.test/' }, auto: false },
    ]);
    await removeSiteHeaders('cdn.test');
    expect(await loadSiteHeaders()).toEqual([]);
  });

  it('never lets an auto capture overwrite a manual rule', async () => {
    await upsertSiteHeaders('cdn.test', { Cookie: 'x=1' });
    expect(await upsertSiteHeaders('cdn.test', { Referer: 'https://a.test/' }, true)).toBe(false);
    expect((await loadSiteHeaders())[0]!.headers).toEqual({ Cookie: 'x=1' });
  });

  it('drops invalid stored entries', async () => {
    mem.data[SITE_HEADERS_KEY] = [
      { host: 'ok.test', headers: { Referer: 'r' } },
      { host: 'bad host', headers: { Referer: 'r' } },
      { host: 'empty.test', headers: { 'Bad Name': 'x' } },
    ];
    expect((await loadSiteHeaders()).map((r) => r.host)).toEqual(['ok.test']);
  });

  it('rejects invalid input', async () => {
    await expect(upsertSiteHeaders('a b', { Referer: 'x' })).rejects.toThrow(/Invalid host/);
    await expect(upsertSiteHeaders('cdn.test', { Referer: 'a\nb' })).rejects.toThrow();
  });
});

describe('buildHeaderRules', () => {
  it('limits rules to the extension and the stream host', () => {
    const [rule] = buildHeaderRules(
      [{ host: 'cdn.test', headers: { Referer: 'https://a.test/' }, auto: true, updatedAt: 0 }],
      'extid',
    );
    expect(rule!.id).toBe(HEADER_RULE_ID_BASE);
    expect(rule!.condition).toMatchObject({
      requestDomains: ['cdn.test'],
      initiatorDomains: ['extid'],
    });
    expect(rule!.action.requestHeaders).toEqual([
      { header: 'Referer', operation: 'set', value: 'https://a.test/' },
    ]);
  });
});
