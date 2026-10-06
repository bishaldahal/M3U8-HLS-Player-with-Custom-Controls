# Privacy Policy

The extension does not collect, transmit or sell any personal data. It contains no analytics or tracking.

## Data stored locally

The following is kept in your browser's local extension storage and never leaves your device:

- **Settings**: player preferences such as volume, playback speed and subtitle style.
- **Watch history**: stream URLs, titles and playback positions, used for resume. History is on by default in regular windows and off by default in private windows. **Save history in private/incognito windows** is unchecked by default in Settings; checking it explicitly permits private playback to use the same saved history as regular playback, provided watch history is enabled. Turning watch history off stops saving and automatic resume in all windows without deleting existing entries, which you can clear separately. Existing saved preferences are preserved on upgrade.
- **DRM settings** (optional): license URLs, request headers and robustness values you choose to remember, stored per stream host.
- **Site headers** (optional): request headers such as `Referer` and `Origin` for a stream host, either entered by you or, if you turn on **Remember the page a stream link was opened from** (off by default), saved from the page a stream link was clicked on. You can edit or remove any entry on the options page.

## Stream detection (on by default)

While **Detect streams on pages** is on, the extension notices when a page requests an `.m3u8` or `.mpd` file and keeps:

- the stream URL
- the request headers the page sent with it, which can include cookies and authorization tokens
- if you turn on **Advanced HLS detection**, which qualities and audio tracks an `.m3u8` playlist lists. This sends one additional request to each detected playlist on the same host the page used.

This is kept in memory only (`storage.session`), for that tab, and is cleared when the tab navigates, closes, or the browser exits. It is never written to disk and never sent anywhere except back to the same stream host. Other requests are ignored. You can turn detection off in the popup or Settings; that deletes everything detected.

## Private windows

Stream detection also runs in private windows once you allow the extension there in your browser's extension settings. Chromium uses a separate private extension context, and player tabs opened from detected streams stay in the source window. Firefox uses a shared background context; private streams are still detected, but advanced playlist inspection is skipped for them to avoid sending regular-session cookies.

Private players do not save or resume watch history by default. Stream detection works independently of history, including when history is disabled. Extension settings and previously saved data remain shared between regular and private windows; private browsing does not make extension storage private. If you opt into private history, those entries persist in the shared local history after private windows close.

## Network requests

The extension only contacts:

- the stream URLs you open, to play them
- HLS playlists a page has just requested, once each, if you turn on playlist inspection
- DRM license servers you configure yourself

When it plays a stream, the extension adds the site headers or detected headers above to requests made by its own player tab only. Pages you visit are never modified.

## Permissions

| Permission                            | Why                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `storage`                             | Save settings and history locally                                                 |
| `webNavigation`                       | Detect navigation to `.m3u8`/`.mpd` URLs so they open in the player               |
| `declarativeNetRequestWithHostAccess` | Open `.m3u8`/`.mpd` URLs in the player, and send site headers from the player tab |
| `webRequest`                          | Stream detection (can be turned off)                                              |
| Host permissions / content script     | Detect stream links on pages and load streams from any host you open              |

## Contact

Questions? Open an [issue](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/issues).
