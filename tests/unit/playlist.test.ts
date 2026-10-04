import { describe, expect, it } from 'vitest';
import { parsePlaylist } from '../../src/lib/playlist';

const BASE = 'https://cdn.test/show/master.m3u8?token=1';

describe('parsePlaylist', () => {
  it('lists qualities and audio tracks of a master playlist, best first', () => {
    const info = parsePlaylist(
      [
        '#EXTM3U',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",URI="audio/en.m3u8"',
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="subs/en.m3u8"',
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="aud"',
        'video/360.m3u8?token=1',
        '#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,AUDIO="aud"',
        'https://other.test/1080.m3u8',
      ].join('\n'),
      BASE,
    );
    expect(info).toEqual({
      kind: 'master',
      renditions: [
        {
          key: 'https://other.test/1080.m3u8',
          kind: 'video',
          label: '1080p',
          height: 1080,
        },
        {
          key: 'https://cdn.test/show/video/360.m3u8?token=1',
          kind: 'video',
          label: '360p',
          height: 360,
        },
        { key: 'https://cdn.test/show/audio/en.m3u8', kind: 'audio', label: 'English' },
        {
          key: 'https://cdn.test/show/subs/en.m3u8',
          kind: 'subtitles',
          label: 'English',
        },
      ],
    });
  });

  it('treats variants with muxed audio as playable with sound', () => {
    const info = parsePlaylist(
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1280x720\n720.m3u8\n',
      BASE,
    );
    expect(info).toMatchObject({
      kind: 'master',
      renditions: [{ kind: 'combined', label: '720p' }],
    });
  });

  it('recognises audio-only variants by codec', () => {
    const info = parsePlaylist(
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"\naudio.m3u8\n',
      BASE,
    );
    expect(info).toMatchObject({
      kind: 'master',
      renditions: [{ kind: 'audio', label: '128 kbps' }],
    });
  });

  it('keeps renditions that use query parameters to select a language', () => {
    const info = parsePlaylist(
      [
        '#EXTM3U',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",URI="audio.m3u8?lang=en"',
        '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Spanish",URI="audio.m3u8?lang=es"',
      ].join('\n'),
      BASE,
    );
    expect(info).toMatchObject({
      kind: 'master',
      renditions: [
        { key: 'https://cdn.test/show/audio.m3u8?lang=en', label: 'English' },
        { key: 'https://cdn.test/show/audio.m3u8?lang=es', label: 'Spanish' },
      ],
    });
  });

  it.each([
    ['audio', 'segment.aac'],
    ['video', 'segment.m4v'],
    ['unknown', 'segment.ts'],
  ] as const)('classifies a %s media playlist from its segment type', (mediaKind, segment) => {
    expect(
      parsePlaylist(`#EXTM3U\r\n#EXT-X-TARGETDURATION:6\r\n#EXTINF:6,\r\n${segment}\r\n`, BASE),
    ).toEqual({ kind: 'media', mediaKind });
  });

  it('rejects anything that is not a playlist', () => {
    expect(parsePlaylist('<html>403</html>', BASE)).toBeNull();
    expect(parsePlaylist('#EXTM3U\n', BASE)).toBeNull();
  });
});
