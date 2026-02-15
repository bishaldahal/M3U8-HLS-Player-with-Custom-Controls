# M3U8/HLS/DASH Player with Custom Controls

Advanced **M3U8/HLS/DASH** player with customizable controls. Supports keyboard shortcuts, **Picture-in-Picture (PiP)**, frame navigation, and live streams.

## 📦 Store Downloads

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Available_on_Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/gcefmpmkobjndjglciibnendclkahgma?utm_source=github-readme)
[![Microsoft Edge](https://img.shields.io/badge/Edge-Available_on_Edge_Store-0078D4?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef?utm_source=github-readme)
[![Firefox](https://img.shields.io/badge/Firefox-Available_on_Firefox_Addons-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts?utm_source=github_readme)

## ✨ Features

- Customizable controls
- Keyboard shortcuts
- Picture in Picture (PiP) mode
- Frame navigation
- Support for live streams

## 🔧 Installation

### From Store (Recommended)

- **Chrome Web Store**: https://chromewebstore.google.com/detail/gcefmpmkobjndjglciibnendclkahgma?utm_source=github-readme
- **Microsoft Edge Add-ons**: https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef?utm_source=github-readme
- **Firefox Add-ons**: https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts?utm_source=github-readme

### From Source

```bash
git clone https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls.git
cd M3U8-HLS-Player-with-Custom-Controls
npm install
npm run build:chrome    # for Chrome/Edge
# or
npm run build:firefox   # for Firefox
```

### Load Unpacked / Temporary Add-on

- **Chrome**: `chrome://extensions` → Enable **Developer mode** → **Load unpacked** → select the extension folder
- **Edge**: `edge://extensions` → Enable **Developer mode** → **Load unpacked** → select the extension folder
- **Firefox**: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select `manifest.json`

## 🧑‍💻 Development

```bash
npm run build              # Build source files
npm run build:chrome       # Build + package for Chrome/Edge
npm run build:firefox      # Build + package for Firefox
npm run build:all          # Build both platforms
```

## ⌨️ Keyboard Shortcuts

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `<` | Decrease playback speed by 0.1 | `-` | Decrease playback speed by 0.5 |
| `>` | Increase playback speed by 0.1 | `+` | Increase playback speed by 0.5 |
| `ArrowDown (↓)` | Decrease volume by 0.1 | `ArrowLeft (←)` | Seek backward 10 seconds |
| `ArrowUp (↑)` | Increase volume by 0.1 | `ArrowRight (→)` | Seek forward 10 seconds |
| `p` | Request Picture in Picture | `j` | Seek backward 5 seconds |
| `P` | Exit Picture in Picture | `Space / k` | Toggle play/pause |
| `,` | Previous frame | `l` | Seek forward 5 seconds |
| `.` | Next frame | `Home` | Seek to the beginning of the video |
| `0-9` | Seek to a percentage of the video | `End` | Seek to the end of the video |
| `Esc` | Close keyboard shortcuts | `?` | Toggle keyboard shortcuts |
| `f` | Toggle fullscreen | `m` | Toggle mute |

## 🤝 Contributing

We welcome contributions from everyone. Whether you're an experienced developer or just getting started, there's a place for you to contribute.

### Ways to Contribute

1. **Bug Fixes**: Fork the repo, fix the issue, and open a PR with details.
2. **New Features**: Open an issue to discuss the feature before implementing.
3. **Improve Documentation**: Fix typos, add examples, or clarify usage.
4. **Testing**: Add tests to ensure stability and prevent regressions.
5. **Code Reviews**: Review PRs and help improve code quality.

Before you start, please read:
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

### Getting Started

1. Fork the repository:
   `git clone https://github.com/{yourusername}/M3U8-HLS-Player-with-Custom-Controls.git`
2. Navigate to the project directory:
   `cd M3U8-HLS-Player-with-Custom-Controls`
3. Install the dependencies:
   `npm install`
4. Create a new branch:
   `git checkout -b your-branch-name`
5. Make your changes.
6. Commit your changes:
   `git commit -m "Your commit message"`
7. Push your changes:
   `git push origin your-branch-name`
8. Open a Pull Request.

## 🔗 Links

- Chrome Web Store: https://chromewebstore.google.com/detail/gcefmpmkobjndjglciibnendclkahgma?utm_source=github-readme
- Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef?utm_source=github-readme
- Firefox Add-ons: https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts?utm_source=github_readme)utm_source=github-readme
