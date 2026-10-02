# Privacy Policy

The extension does not collect, transmit or sell any personal data. It contains no analytics or tracking.

## Data stored locally

The following is kept in your browser's local extension storage and never leaves your device:

- **Settings**: player preferences such as volume, playback speed and subtitle style.
- **Watch history**: stream URLs, titles and playback positions, used for resume. You can turn history off or clear it on the options page.
- **DRM settings** (optional): license URLs, request headers and robustness values you choose to remember, stored per stream host.
- **Site headers** (optional): request headers such as `Referer` and `Origin` for a stream host, either entered by you or remembered from the page a stream link was opened on. You can turn remembering off, and edit or remove any entry, on the options page.

## Stream detection (off by default)

If you turn on **Detect streams on pages**, the browser asks you for permission to read request headers. While it is on, the extension notices when a page requests an `.m3u8` or `.mpd` file and keeps:

- the stream URL
- the request headers the page sent with it, which can include cookies and authorization tokens

This is kept in memory only (`storage.session`), for that tab, and is cleared when the tab navigates, closes, or the browser exits. It is never written to disk and never sent anywhere except back to the same stream host when you choose to play that stream. Other requests are ignored. Turning the switch off removes the permission and deletes everything detected.

## Network requests

The extension only contacts:

- the stream URLs you open, to play them
- DRM license servers you configure yourself

When it plays a stream, the extension adds the site headers or detected headers above to requests made by its own player tab only. Pages you visit are never modified.

## Permissions

| Permission                            | Why                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `storage`                             | Save settings and history locally                                                 |
| `webNavigation`                       | Detect navigation to `.m3u8`/`.mpd` URLs so they open in the player               |
| `declarativeNetRequestWithHostAccess` | Open `.m3u8`/`.mpd` URLs in the player, and send site headers from the player tab |
| `webRequest` (optional)               | Stream detection, only after you turn it on                                       |
| Host permissions / content script     | Detect stream links on pages and load streams from any host you open              |

## Contact

Questions? Open an [issue](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/issues).
