import './player.css';
import { ext } from '../../lib/browser';
import {
  getResumePosition,
  loadSettings,
  saveSettings,
  saveToHistory,
  type PlayerSettings,
  type SubtitleSettings,
} from '../../lib/settings';
import { detectStreamType, parseStreamUrl } from '../../lib/stream';
import { buildCueCss } from '../../lib/subtitles';
import { setupDashDrm } from './drm';
import { clearPlaybackErrorUI, showFatalError } from './errors';
import { setupKeyboard } from './keyboard';
import { createStreamElement, setupPlaybackErrorHandlers } from './media';
import { isLive, state } from './state';
import type { StreamVideoElement } from './types';

const HISTORY_SAVE_DEBOUNCE_MS = 1000;
const HISTORY_SAVE_INTERVAL_MS = 30_000;
const MEDIA_PREFS_SAVE_DEBOUNCE_MS = 300;
const SUBTITLE_STYLE_ID = 'subtitle-custom-style';

let historySaveTimer: ReturnType<typeof setTimeout> | undefined;

function saveHistoryNow(): void {
  const { video, streamUrl, streamTitle } = state;
  if (video && streamUrl) {
    void saveToHistory(streamUrl, streamTitle, video.currentTime, video.duration || 0);
  }
}

function debouncedSaveHistory(): void {
  clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(saveHistoryNow, HISTORY_SAVE_DEBOUNCE_MS);
}

function subtitleTracks(video: HTMLVideoElement): TextTrack[] {
  return Array.from(video.textTracks ?? []).filter(
    (t) => t.kind === 'subtitles' || t.kind === 'captions',
  );
}

function applySubtitleStyles(subtitleSettings: SubtitleSettings): void {
  const video = state.video;
  if (!video) return;
  // The real <video> lives in the custom element's shadow root.
  const root: ShadowRoot | Document = video.shadowRoot ?? document;
  root.getElementById(SUBTITLE_STYLE_ID)?.remove();

  const style = document.createElement('style');
  style.id = SUBTITLE_STYLE_ID;
  style.textContent = buildCueCss(subtitleSettings);
  (video.shadowRoot ?? document.head).appendChild(style);
}

function applySettings(settings: PlayerSettings): void {
  const video = state.video;
  if (!video) return;

  video.volume = settings.volume;
  video.muted = settings.muted;
  video.playbackRate = settings.playbackRate;

  if (settings.subtitlesEnabled) {
    applySubtitleStyles(settings.subtitleSettings);
  } else {
    subtitleTracks(video).forEach((t) => (t.mode = 'disabled'));
  }
}

function enableSubtitles(settings: PlayerSettings): void {
  const video = state.video;
  if (!video) return;
  subtitleTracks(video).forEach(
    (t) => (t.mode = settings.subtitlesEnabled ? 'showing' : 'disabled'),
  );
  if (settings.subtitlesEnabled) applySubtitleStyles(settings.subtitleSettings);
}

/** hls.js loads subtitle fragments on demand, so wait for cues after a seek. */
function waitForSubtitleCues(video: StreamVideoElement, timeoutMs = 2000): Promise<void> {
  const api = video.api;
  if (!api?.once) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    api.once!('hlsSubtitleFragProcessed', done);
    api.once!('hlsCuesParsed', done);
    setTimeout(done, timeoutMs);
  });
}

async function resumeFrom(position: number, settings: PlayerSettings): Promise<void> {
  const video = state.video!;
  video.currentTime = position;
  await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
  if (state.streamType === 'hls') await waitForSubtitleCues(video);
  enableSubtitles(settings);
  setTimeout(() => enableSubtitles(settings), 300);
}

function setupLiveTimeDisplay(video: HTMLVideoElement): void {
  const display = document.querySelector('media-time-display');
  if (!display) return;

  video.addEventListener('timeupdate', () => {
    if (!isLive()) return;
    const seekable = display.getAttribute('mediaseekable');
    if (!seekable) return;
    const end = parseFloat(seekable.split(':')[1] ?? '');
    if (Number.isFinite(end)) {
      // Live times can be wall-clock based (DASH), so only show the offset from the live edge.
      display.removeAttribute('showduration');
      display.setAttribute('mediaduration', String(end));
      display.setAttribute('remaining', '');
    }
  });
}

function setupResumeTracking(video: HTMLVideoElement): void {
  video.addEventListener('pause', () => {
    state.resumePosition = video.currentTime;
    debouncedSaveHistory();
  });
  video.addEventListener('seeked', () => {
    if (video.paused) state.resumePosition = video.currentTime;
  });
  video.addEventListener('play', () => {
    if (isLive()) return;
    video.currentTime = state.resumePosition;
    if (!isLive() && video.currentTime >= video.duration - 5) video.currentTime = 0;
  });
}

function setupPersistence(video: HTMLVideoElement): void {
  const written: Partial<Pick<PlayerSettings, 'volume' | 'muted' | 'playbackRate'>> = {};
  let prefsTimer: ReturnType<typeof setTimeout> | undefined;
  const saveMediaPrefs = () => {
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => {
      written.volume = video.volume;
      written.muted = video.muted;
      written.playbackRate = video.playbackRate;
      void saveSettings({ ...written }).catch(console.error);
    }, MEDIA_PREFS_SAVE_DEBOUNCE_MS);
  };
  video.addEventListener('volumechange', saveMediaPrefs);
  video.addEventListener('ratechange', saveMediaPrefs);

  ext?.storage?.onChanged?.addListener((changes, areaName) => {
    const next = changes.playerSettings?.newValue as PlayerSettings | undefined;
    if (areaName !== 'local' || !next) return;
    // Ignore echoes of our own writes; applying them would fight an in-progress slider drag.
    const prev = changes.playerSettings?.oldValue as Partial<PlayerSettings> | undefined;
    const external = (key: keyof typeof written) =>
      next[key] !== prev?.[key] && next[key] !== written[key];
    if (external('volume')) video.volume = next.volume;
    if (external('muted')) video.muted = next.muted;
    if (external('playbackRate')) video.playbackRate = next.playbackRate;
    if (next.subtitlesEnabled) applySubtitleStyles(next.subtitleSettings);
    else subtitleTracks(video).forEach((t) => (t.mode = 'disabled'));
  });

  video.textTracks?.addEventListener('addtrack', (event) => {
    setTimeout(async () => {
      const settings = await loadSettings();
      if (settings.subtitlesEnabled) {
        applySubtitleStyles(settings.subtitleSettings);
      } else if (event.track) {
        event.track.mode = 'disabled';
      }
    }, 100);
  });

  let lastSave = 0;
  video.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (!video.paused && now - lastSave > HISTORY_SAVE_INTERVAL_MS) {
      lastSave = now;
      debouncedSaveHistory();
    }
  });

  window.addEventListener('beforeunload', saveHistoryNow);
}

function playStream(controller: HTMLElement, rawUrl: string): StreamVideoElement | null {
  try {
    clearPlaybackErrorUI();
    const { streamUrl, title } = parseStreamUrl(rawUrl);
    const streamType = detectStreamType(streamUrl);
    if (!streamType) throw new Error('Unsupported stream type. Only .m3u8 and .mpd are supported.');

    state.streamType = streamType;
    state.streamUrl = rawUrl;
    state.streamTitle = title || 'Untitled Stream';
    if (title) document.title = title;

    const video = createStreamElement(streamType);
    setupPlaybackErrorHandlers(video, streamType, streamUrl);
    video.setAttribute('src', streamUrl);
    controller.appendChild(video);

    if (streamType === 'dash') void setupDashDrm(video, streamUrl);
    return video;
  } catch (error) {
    console.error('Failed to play stream:', error);
    showFatalError(
      'Error Loading Stream',
      `Failed to parse URL: ${(error as Error).message}`,
      `URL: ${rawUrl}`,
    );
    return null;
  }
}

async function init(): Promise<void> {
  const controller = document.querySelector<HTMLElement>('media-controller');
  if (!controller) return;
  state.controller = controller;

  const url = window.location.hash.slice(1);
  if (!url) {
    showFatalError('No Stream URL', 'Please provide a stream URL in the hash fragment.');
    return;
  }
  if (!detectStreamType(url)) {
    showFatalError('Unsupported Stream URL', 'Only .m3u8 and .mpd streams are supported.');
    return;
  }

  const [settings, savedPosition] = await Promise.all([loadSettings(), getResumePosition(url)]);

  const video = playStream(controller, url);
  if (!video) return;
  state.video = video;

  video.addEventListener('loadedmetadata', () => {
    state.mediaStreamType = controller.getAttribute('mediastreamtype');
    applySettings(settings);

    const shouldResume =
      savedPosition > 0 && !isLive() && video.duration > 0 && savedPosition < video.duration - 10;
    if (!shouldResume) return;

    state.resumePosition = savedPosition;
    if (video.readyState >= 3) {
      void resumeFrom(savedPosition, settings);
    } else {
      video.addEventListener('playing', () => resumeFrom(savedPosition, settings), { once: true });
    }
  });

  setupLiveTimeDisplay(video);
  setupResumeTracking(video);
  setupPersistence(video);
  setupKeyboard(controller);
  video.focus();
}

void init();
