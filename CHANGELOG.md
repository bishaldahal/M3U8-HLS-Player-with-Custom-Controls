# Changelog

## [2.0.0](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/compare/v1.5.0...v2.0.0) (2026-10-02)


### ⚠ BREAKING CHANGES

* rebuilt in TypeScript; updating asks for the new declarativeNetRequest permission.

### Features

* **detect:** make stream detection an opt-in with an optional permission ([922360c](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/922360cfad4f0bfbe7f466683aa18861f62fb381))
* **detect:** play streams with the headers the site's own player used ([c2ece7f](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/c2ece7f807f544404f20af802a8b817940ad6915))
* **headers:** send custom request headers per stream host ([44493f0](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/44493f0ea0029e2a078e53396ff8839caef9bad9))
* **lib:** add cross-browser API and storage abstractions ([c252d52](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/c252d52f6ffc343c8ceb9f0fa626a369c0293280))
* **lib:** add shared keyboard shortcut definitions ([b4df79f](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/b4df79f09ecccb67dc81a6e827b5330287091da4))
* **lib:** add stream detection and URL helpers ([51d0488](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/51d048840ac08b4111e7392f4295cc0040419719))
* **lib:** add time formatting and subtitle style helpers ([0967c72](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/0967c724f4730af740990f0f98b99d30d72f434e))
* **lib:** add validated settings and watch history store ([6899ac9](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/6899ac93322fadc437da055c69de7bbf6b46a81b))
* **lib:** port UI feedback utilities to TypeScript ([94eeff8](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/94eeff8dd3a17a989fa5ee33106326aa36be76e6))
* **options:** port options page to TypeScript ([4675ccf](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/4675ccf2bb28cc5b169223dbeacbcd7885818489))
* **player:** add player state, types and error overlay helpers ([1afcc42](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/1afcc42f4dee08bc8dc447bd2a77b6e56b00c1cc))
* **player:** explain blocked streams and edit site headers from the error ([8d04b18](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/8d04b1852779e4f18203fec29631e19c869dbe8c))
* **player:** port DRM configuration dialog ([5e4a1ad](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/5e4a1ada2f0c0c8b2d444ab5c6572a5af18cefb0))
* **player:** port media engine setup and keyboard controls ([b33c400](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/b33c400ecb18ef2712283e341543dc3bfa97599b))
* **player:** port player page entry, markup and styles ([f1bce3c](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/f1bce3cabc0253c7c44c062582131faba5c356f0))
* **popup:** port popup page to TypeScript ([56047c0](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/56047c0c5b1f12be0976f8da74fb036f86891b5b))
* port background and content scripts ([92b8a6c](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/92b8a6cdbfb9294f974fbf99ac034082f5cb191c))
* release the rewrite as 2.0.0 ([6b6850c](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/6b6850ca696437e3dfb760ec290a932651e3a5cf))
* **settings:** keep 3 minutes of live stream while paused by default ([3b58e6f](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/3b58e6f1465469b2100d0c5ad6187dcec6c4ff3f))
* **settings:** keep buffering live streams while paused ([5d553ea](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/5d553ea5270c808639a4333fc7d4cbd25e145520))
* **shortcuts:** port shortcuts reference page ([cdbc35a](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/cdbc35a859235d8d46bb3afa134295e61d6243b9))


### Bug Fixes

* **background:** open clicked stream links in a new tab ([87abe2f](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/87abe2f2382df2e9e0f05cf49b1c03b17c5ad724))
* **background:** stop manifests downloading when opened in the player ([b8d7c47](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/b8d7c4792eb74bcd80f31499c026bad9fe6f14b5))
* **dev:** use a project-local Firefox profile so web-ext works with snap Firefox ([2e65024](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/2e6502497f3226ca6fd8d63e3aeefbc2055a6153))
* **headers:** only remember a clicked link's page headers when opted in ([966d349](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/966d349c5cf6c41914613ee6ead3765a9f061ead))
* **manifest:** narrow web-accessible resources, host permissions and CSP ([40f3105](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/40f3105829b3f9eedd7ab9529bca4f37efe3ee8b))
* **player:** detect live streams reliably ([1e3ec0a](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/1e3ec0a3cc79315bbbd65c4fc2d0630c4c6cccc5))
* **player:** only prompt for DRM on key-system errors ([dc36d34](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/dc36d349622bebb4e254ceaf5d157701b127feff))
* **player:** only show the error overlay for fatal playback errors ([9dfa9b6](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/9dfa9b64dfa889bb7a12cf4478886f445fef6a2d))
* **player:** resume live streams from buffered position ([6db664a](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/6db664a2684c885baa0c429d5aa1eac0eb2b4432))
* **player:** resume live streams from the paused position ([c3a4a6f](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/c3a4a6f8e9344f705215d7a291333204b423f963))
* **player:** stop volume feedback loop and fix live time display ([e023984](https://github.com/bishaldahal/M3U8-HLS-Player-with-Custom-Controls/commit/e023984a8f4bdc5ea9e92b020f43e587539906d5))
