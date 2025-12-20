# M3U8/HLS Player with Custom Controls

Advanced M3U8/HLS player with customizable controls. Supports keyboard shortcuts, PIP mode, frame navigation, and live streams.

### 📦 Store Downloads

[![Microsoft Edge](https://img.shields.io/badge/Edge-Available_on_Edge_Store-0078D4?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef)
[![Firefox](https://img.shields.io/badge/Firefox-Available_on_Firefox_Addons-FF7139?style=for-the-badge&logo=firefox&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts/)

## Features

- Customizable controls
- Keyboard shortcuts
- Picture in Picture (PIP) mode
- Frame navigation
- Support for live streams

## Installation

### From Store
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/m3u8hls-player-with-cust/bmlnobfgkikeejhbbdlhjinbmdcfgaef)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/m3u8-hls-player-with-shortcuts/)

### From Source

```bash
git clone https://github.com/bishaldahal/Customized-m3u8-Video-Player-Extension.git
cd Customized-m3u8-Video-Player-Extension
npm install
npm run build:chrome    # or npm run build:firefox
```

Load unpacked: Chrome (`chrome://extensions`) or Firefox (`about:debugging`)

## Development

```bash
npm run build              # Build source files
npm run build:chrome       # Build + package for Chrome/Edge
npm run build:firefox      # Build + package for Firefox
npm run build:all          # Build both platforms
```

## Usage

To use this extension, load it into your browser as an unpacked extension. The steps to do this vary by browser:

### Chrome

1. Navigate to `chrome://extensions`
2. Enable Developer Mode by clicking the toggle switch next to Developer mode.
3. Click the LOAD UNPACKED button and select the extension directory.

### Edge

1. Navigate to `edge://extensions`
2. Enable Developer Mode by clicking the toggle switch at the bottom.
3. Click the LOAD UNPACKED button and select the extension directory.

## Keyboard Shortcuts

Here are the keyboard shortcuts supported by this extension:

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

## Contributing

We welcome contributions from everyone. Whether you're an experienced developer or just getting started, there's a place for you to contribute.

Here are some ways you can contribute:

1. **Bug Fixes**: If you spot a bug, feel free to fork the repository, fix the bug, and submit a pull request. Please include a detailed description of the bug and how your code fixes it.

2. **New Features**: Have an idea for a new feature? Open an issue to discuss it, and if it's agreed upon, you can get to work on implementing it.

3. **Improving Documentation**: Good documentation is key to a successful project. If you notice any areas of the documentation that could be improved, or if there's a lack of documentation in some areas, feel free to contribute.

4. **Testing**: Writing tests for our code ensures that everything is running smoothly. If you're interested in contributing to our tests, we'd be more than happy to have you.

5. **Code Reviews**: Reviewing code from others can help to catch bugs and improve the quality of our code. If you're interested in participating in code reviews, please do.

Before you start coding, please read our [Contributing Guide](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). These will provide you with all the information you need to start contributing to the project.

Remember, all contributions are valued. Even if you're fixing a typo, you're improving the project. So don't hesitate to contribute!

To get started with contributing, follow these steps:

1. Fork the repository: `git clone https://github.com/bishaldahal/Customized-m3u8-Video-Player-Extension.git`
2. Navigate to the project directory: `cd Customized-m3u8-Video-Player-Extension`
3. Install the dependencies: `npm install`
4. Create a new branch for your feature or bug fix: `git checkout -b your-branch-name`
5. Make your changes.
6. Commit your changes: `git commit -m "Your commit message"`
7. Push your changes to your fork: `git push origin your-branch-name`
8. Open a pull request from your fork to the original repository.

We look forward to your contributions!
