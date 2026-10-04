import { describe, expect, it } from 'vitest';
import {
  MAX_DETECTED_PER_TAB,
  addDetected,
  buildTabHeaderRules,
  findMatchingStream,
  groupDetected,
  isKnownTrack,
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

  it('keeps provisional query variants until their playlist relationship is known', () => {
    let list = addDetected([], stream('https://cdn.test/a.m3u8?t=1'));
    list = addDetected(list, stream('https://cdn.test/b.mpd'));
    list = addDetected(list, stream('https://cdn.test/a.m3u8?t=2', 5));
    expect(list.map((s) => s.url)).toEqual([
      'https://cdn.test/a.m3u8?t=1',
      'https://cdn.test/b.mpd',
      'https://cdn.test/a.m3u8?t=2',
    ]);
  });

  it('keeps what is known about the playlist when the URL refreshes', () => {
    const first = {
      ...stream('https://cdn.test/a.m3u8?t=1'),
      playlist: { kind: 'media' as const, mediaKind: 'unknown' as const },
    };
    const list = addDetected([first], stream('https://cdn.test/a.m3u8?t=2'));
    expect(list[0]).toMatchObject({
      url: 'https://cdn.test/a.m3u8?t=2',
      playlist: { kind: 'media', mediaKind: 'unknown' },
    });
  });

  it('keeps query-distinguished tracks declared by a master playlist', () => {
    const master: DetectedStream = {
      ...stream('https://cdn.test/master.m3u8'),
      playlist: {
        kind: 'master',
        renditions: [
          { key: 'https://cdn.test/audio.m3u8?lang=en', kind: 'audio', label: 'English' },
          { key: 'https://cdn.test/audio.m3u8?lang=es', kind: 'audio', label: 'Spanish' },
        ],
      },
    };
    let list = addDetected([master], stream('https://cdn.test/audio.m3u8?lang=en'));
    list = addDetected(list, stream('https://cdn.test/audio.m3u8?lang=es'));
    expect(list.map((item) => item.url)).toEqual([
      master.url,
      'https://cdn.test/audio.m3u8?lang=en',
      'https://cdn.test/audio.m3u8?lang=es',
    ]);
    expect(groupDetected(list)[0]!.tracks.map(({ rendition }) => rendition.label)).toEqual([
      'English',
      'Spanish',
    ]);
  });

  it('refreshes an exact declared rendition without duplicating it', () => {
    const audio = stream('https://cdn.test/audio.m3u8?lang=en', 1);
    const master: DetectedStream = {
      ...stream('https://cdn.test/master.m3u8'),
      playlist: {
        kind: 'master',
        renditions: [{ key: audio.url, kind: 'audio', label: 'English' }],
      },
    };
    const list = addDetected([master, audio], {
      ...audio,
      headers: { Authorization: 'new' },
      seenAt: 2,
    });
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ headers: { Authorization: 'new' }, seenAt: 2 });
  });

  it('caps the list per tab', () => {
    let list: DetectedStream[] = [];
    for (let i = 0; i < MAX_DETECTED_PER_TAB + 5; i++) {
      list = addDetected(list, stream(`https://cdn.test/${i}.m3u8`));
    }
    expect(list).toHaveLength(MAX_DETECTED_PER_TAB);
  });

  it('matches an exact query variant before an unambiguous token fallback', () => {
    const english = { ...stream('https://cdn.test/audio.m3u8?lang=en'), headers: { Token: 'en' } };
    const spanish = { ...stream('https://cdn.test/audio.m3u8?lang=es'), headers: { Token: 'es' } };
    expect(findMatchingStream([english, spanish], spanish.url)).toBe(spanish);
    expect(findMatchingStream([english, spanish], 'https://cdn.test/audio.m3u8?token=new')).toBe(
      undefined,
    );
    expect(findMatchingStream([english], 'https://cdn.test/audio.m3u8?token=new')).toBe(english);
  });
});

describe('groupDetected', () => {
  const master: DetectedStream = {
    ...stream('https://cdn.test/master.m3u8', 1),
    playlist: {
      kind: 'master',
      renditions: [
        { key: 'https://cdn.test/720.m3u8', kind: 'video', label: '720p', height: 720 },
        { key: 'https://cdn.test/audio.m3u8', kind: 'audio', label: 'Audio' },
        { key: 'https://cdn.test/1080.m3u8', kind: 'video', label: '1080p', height: 1080 },
        { key: 'https://cdn.test/subs.m3u8', kind: 'subtitles', label: 'English' },
      ],
    },
  };

  it('nests the tracks a page loaded under their full stream, in playlist order', () => {
    const audio = stream('https://cdn.test/audio.m3u8?t=1', 3);
    const video = stream('https://cdn.test/720.m3u8', 2);
    const other = stream('https://cdn.test/other.mpd', 9);
    const subtitles = stream('https://cdn.test/subs.m3u8', 4);
    const groups = groupDetected([video, master, audio, subtitles, other]);
    expect(groups.map((g) => g.stream.url)).toEqual([master.url, other.url]);
    expect(groups[0]!.tracks.map((t) => [t.stream.url, t.rendition.label])).toEqual([
      [video.url, '720p'],
      [audio.url, 'Audio'],
    ]);
    expect(groups[1]!.tracks).toEqual([]);
    expect(groups.some((group) => group.stream === subtitles)).toBe(false);
  });

  it('lists tracks on their own when the full stream is unknown', () => {
    const groups = groupDetected([stream('https://cdn.test/720.m3u8', 1)]);
    expect(groups).toHaveLength(1);
  });

  it('knows which playlists a full stream already describes', () => {
    expect(isKnownTrack([master], 'https://cdn.test/1080.m3u8?t=5')).toBe(true);
    expect(isKnownTrack([master], 'https://cdn.test/other.m3u8')).toBe(false);
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
