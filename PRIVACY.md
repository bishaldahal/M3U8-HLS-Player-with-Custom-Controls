# Privacy Policy

The extension does not collect, transmit or sell any personal data. It contains no analytics or tracking.

## Data stored locally

The following is kept in your browser's local extension storage and never leaves your device:

- **Settings**: player preferences such as volume, playback speed and subtitle style.
- **Watch history**: stream URLs, titles and playback positions, used for resume. You can turn history off or clear it on the options page.
- **DRM settings** (optional): license URLs, request headers and robustness values you choose to remember, stored per stream host.

## Network requests

The extension only contacts:

- the stream URLs you open, to play them
- DRM license servers you configure yourself

## Permissions

| Permission                        | Why                                                                  |
| --------------------------------- | -------------------------------------------------------------------- |
| `storage`                         | Save settings and history locally                                    |
| `webNavigation`                   | Detect navigation to `.m3u8`/`.mpd` URLs so they open in the player  |
| Host permissions / content script | Detect stream links on pages and load streams from any host you open |

## Contact

Questions? Open an [issue](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/issues).
