# M3U8/HLS/DASH Player with Custom Controls

[![CI](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/actions/workflows/ci.yml/badge.svg)](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/bishaldahal/M3U8-HLS-Player-with-Custom-Controls)](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/releases)

A browser extension that plays **M3U8/HLS** and **MPD/DASH** streams directly in the browser, with keyboard shortcuts, Picture-in-Picture, frame stepping, subtitles, watch history and resume.

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/gcefmpmkobjndjglciibnendclkahgma?utm_source=github-readme)
[![Microsoft Edge](https://img.shields.io/badge/Edge-Add--ons-0078D4?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef?utm_source=github-readme)
[![Firefox](https://img.shields.io/badge/Firefox-Add--ons-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts?utm_source=github-readme)

## Features

- Plays `.m3u8` (HLS via [hls.js](https://github.com/video-dev/hls.js)) and `.mpd` (DASH via [dash.js](https://github.com/Dash-Industry-Forum/dash.js)) links, including live streams
- Opens stream links automatically when you click or navigate to them
- Optional stream detection: lists the streams a page plays in the toolbar popup and opens them with the headers that page used
- Per-host site headers (`Referer`, `Origin`, cookies...) for streams that only play on their own site
- Live streams keep buffering while paused (configurable) and resume where you left off
- Controls built on [media-chrome](https://github.com/muxinc/media-chrome), plus keyboard shortcuts
- Picture-in-Picture, frame-by-frame navigation, playback speed from 0.1× to 10×
- Subtitle styling: size, color, background, font and edge style
- Watch history with resume, pinning and renaming
- Widevine license configuration for DASH DRM on Chromium browsers

## Keyboard shortcuts

| Key         | Action                | Key       | Action                      |
| ----------- | --------------------- | --------- | --------------------------- |
| `Space`/`k` | Play / pause          | `f`       | Toggle fullscreen           |
| `←` / `→`   | Seek −/+ 10 s         | `j` / `l` | Seek −/+ 5 s                |
| `↓` / `↑`   | Volume −/+ 10 %       | `m`       | Toggle mute                 |
| `<` / `>`   | Speed −/+ 0.1         | `-` / `+` | Speed −/+ 0.5               |
| `,` / `.`   | Previous / next frame | `0`–`9`   | Seek to 0–90 %              |
| `Home`      | Seek to start         | `End`     | Seek to end                 |
| `p` / `P`   | Enter / exit PiP      | `?`       | Toggle the shortcuts dialog |

## Streams that only play on their own site

Some hosts answer with **403 Forbidden** unless the request looks like it came from their own page.

- **Detect streams on pages** (off by default): turn it on from the popup or Settings. The browser asks for permission to read request headers. Start the video on the site, then open the popup and pick it from **On this page**. The player sends the same headers the page did, from its own tab only, and forgets them when that tab closes.
- **Site headers**: in Settings, or from the **Site headers** button on a player error, save headers for a stream host. They are sent with every request the player makes to that host.

Nothing captured or saved here leaves your browser. See [PRIVACY.md](PRIVACY.md).

## DASH DRM (Chromium)

If an encrypted `.mpd` stream fails with a key-system error, the player shows a dialog where you can enter:

- a Widevine license URL
- optional request headers, such as `Authorization: Bearer <token>`
- an optional robustness level, such as `SW_SECURE_DECODE`

You can remember these values per stream host. They are stored locally in your browser and never sent anywhere except the license server you configure. See [PRIVACY.md](PRIVACY.md).

## Install from source

You need Node.js 22 or later ([.nvmrc](.nvmrc)).

```bash
git clone https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls.git
cd M3U8-HLS-Player-with-Custom-Controls
npm ci
npm run fetch:vendor   # downloads pinned, hash-verified player libraries
npm run build          # outputs dist/chrome and dist/firefox
```

Then load the unpacked build:

- **Chrome / Edge**: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select `dist/chrome`
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and select `dist/firefox/manifest.json`

Read [docs/building.md](docs/building.md) for the details of the build pipeline.

## Development

| Command                                  | Description                                       |
| ---------------------------------------- | ------------------------------------------------- |
| `npm run build`                          | Build both targets into `dist/`                   |
| `npm run build:chrome` / `build:firefox` | Build one target                                  |
| `npm run start:chrome` / `start:firefox` | Launch a browser with the build loaded (web-ext)  |
| `npm run start:android`                  | Run the build in Firefox for Android over adb     |
| `npm test` / `npm run test:watch`        | Run the unit tests (Vitest)                       |
| `npm run lint` / `npm run typecheck`     | ESLint and TypeScript checks                      |
| `npm run format`                         | Format with Prettier                              |
| `npm run zip`                            | Package `dist/` and the sources into `artifacts/` |

[docs/architecture.md](docs/architecture.md) describes how the code is organized.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) first. To report a security problem, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Acknowledgements

Built on [hls.js](https://github.com/video-dev/hls.js), [dash.js](https://github.com/Dash-Industry-Forum/dash.js), [media-chrome](https://github.com/muxinc/media-chrome) and their companion custom elements.
