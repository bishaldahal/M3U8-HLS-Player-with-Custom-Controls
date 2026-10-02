import { describe, expect, it } from 'vitest';
import {
  MAX_DETECTED_PER_TAB,
  addDetected,
  buildTabHeaderRules,
  pickReplayHeaders,
  streamKey,
  type DetectedStream,
} from '../../src/lib/detected';

const stream = (url: string, seenAt = 0): DetectedStream => ({
  url,
  type: 'hls',
  headers: {},
  seenAt,
});

describe('pickReplayHeaders', () => {
  it('keeps identity and auth headers and drops browser-managed ones', () => {
    expect(
      pickReplayHeaders([
        { name: 'Referer', value: 'https://site.test/watch' },
        { name: 'Cookie', value: 'sid=1' },
        { name: 'Authorization', value: 'Bearer t' },
        { name: 'X-Token', value: 'abc' },
        { name: 'Host', value: 'cdn.test' },
        { name: 'Range', value: 'bytes=0-' },
        { name: 'Sec-Fetch-Mode', value: 'cors' },
        { name: 'Accept-Encoding', value: 'gzip' },
        { name: 'If-None-Match', value: '"x"' },
        { name: 'X-Empty' },
      ]),
    ).toEqual({
      Referer: 'https://site.test/watch',
      Cookie: 'sid=1',
      Authorization: 'Bearer t',
      'X-Token': 'abc',
    });
  });

  it('drops values that could inject headers', () => {
    expect(pickReplayHeaders([{ name: 'X-A', value: 'a\r\nB: c' }])).toEqual({});
  });
});

describe('detected list', () => {
  it('treats URLs that differ only in query as the same stream', () => {
    expect(streamKey('https://cdn.test/a.m3u8?token=1')).toBe(
      streamKey('https://cdn.test/a.m3u8?token=2'),
    );
  });

  it('replaces older entries with the latest URL and keeps order', () => {
    let list = addDetected([], stream('https://cdn.test/a.m3u8?t=1'));
    list = addDetected(list, stream('https://cdn.test/b.mpd'));
    list = addDetected(list, stream('https://cdn.test/a.m3u8?t=2', 5));
    expect(list.map((s) => s.url)).toEqual([
      'https://cdn.test/a.m3u8?t=2',
      'https://cdn.test/b.mpd',
    ]);
  });

  it('caps the list per tab', () => {
    let list: DetectedStream[] = [];
    for (let i = 0; i < MAX_DETECTED_PER_TAB + 5; i++) {
      list = addDetected(list, stream(`https://cdn.test/${i}.m3u8`));
    }
    expect(list).toHaveLength(MAX_DETECTED_PER_TAB);
  });
});

describe('buildTabHeaderRules', () => {
  it('sends everything to the manifest host but only identity headers elsewhere', () => {
    const rules = buildTabHeaderRules(
      {
        url: 'https://cdn.test/a.m3u8',
        headers: { Referer: 'https://site.test/', Cookie: 'sid=1' },
      },
      7,
      'extid',
      10,
    );
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      id: 10,
      condition: { tabIds: [7], initiatorDomains: ['extid'], requestDomains: ['cdn.test'] },
    });
    expect(rules[0]!.action.requestHeaders!.map((h) => h.header)).toEqual(['Referer', 'Cookie']);
    expect(rules[1]!.id).toBe(11);
    expect(rules[1]!.condition.requestDomains).toBeUndefined();
    expect(rules[1]!.action.requestHeaders!.map((h) => h.header)).toEqual(['Referer']);
  });

  it('returns no rules without headers', () => {
    expect(buildTabHeaderRules({ url: 'https://cdn.test/a.m3u8', headers: {} }, 1, 'e', 1)).toEqual(
      [],
    );
  });
});
