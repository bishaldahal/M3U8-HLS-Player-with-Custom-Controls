import type { StreamType } from '../../lib/stream';
import { safeUrlParse } from '../../lib/stream';
import {
  buildNetworkFailureMessage,
  clearPlaybackErrorUI,
  createPlaybackErrorTracker,
  getMediaErrorMessage,
  isPlaybackErrorUIVisible,
  isRecoverableEngineError,
  normalizeErrorMessage,
  showPlaybackErrorUI,
  subscribeToNetworkErrors,
} from './errors';
import type { EngineApi, StreamVideoElement } from './types';

const STARTUP_TIMEOUT_MS = 10_000;
const MONITOR_INTERVAL_MS = 3000;
const ERROR_COOLDOWN_MS = 8000;

export async function waitForMediaApi(
  video: StreamVideoElement,
  timeoutMs = 6000,
): Promise<EngineApi> {
  const start = Date.now();
  while (!video.api) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for player API initialization`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return video.api;
}

export function createStreamElement(streamType: StreamType): StreamVideoElement {
  const el = document.createElement(streamType === 'dash' ? 'dash-video' : 'hls-video');
  el.setAttribute('slot', 'media');
  el.setAttribute('crossorigin', '');
  el.setAttribute('autoplay', '');
  return el as StreamVideoElement;
}

/** Must run before `src` is set so early load errors are captured. */
export function setupPlaybackErrorHandlers(
  video: StreamVideoElement,
  streamType: StreamType,
  sourceUrl: string,
): void {
  const label = streamType.toUpperCase();
  const sourceHost = safeUrlParse(sourceUrl)?.host ?? '';
  const errors = createPlaybackErrorTracker(showPlaybackErrorUI);
  const startedAt = Date.now();
  const boundNativeVideos = new WeakSet<HTMLVideoElement>();
  let started = false;
  let bindRetry: ReturnType<typeof setInterval> | undefined;

  // Only invoked from async callbacks, after startupTimeout/monitor are initialised below.
  const stopWatchers = () => {
    clearTimeout(startupTimeout);
    clearInterval(bindRetry);
    clearInterval(monitor);
  };

  // Engines retry failed requests, so these only explain a startup failure; they are never shown directly.
  const toFailure = buildNetworkFailureMessage(label, sourceHost);
  const unsubscribe = subscribeToNetworkErrors((event) => {
    if (started) return;
    const failure = toFailure(event);
    if (failure) errors.record(failure.title, failure.message);
  });

  const showMediaError = (mediaError: MediaError | null | undefined) => {
    if (mediaError?.code === MediaError.MEDIA_ERR_ABORTED) return;
    errors.show(`${label} Playback Error`, getMediaErrorMessage(mediaError));
  };

  const onStarted = () => {
    started = true;
    stopWatchers();
    clearPlaybackErrorUI();
  };
  video.addEventListener('loadedmetadata', onStarted);
  video.addEventListener('playing', onStarted);

  const bindNativeVideo = (): boolean => {
    const nativeVideo = video.nativeEl ?? video.shadowRoot?.querySelector('video');
    if (!nativeVideo) return false;
    if (boundNativeVideos.has(nativeVideo)) return true;
    boundNativeVideos.add(nativeVideo);

    nativeVideo.addEventListener('error', () => showMediaError(nativeVideo.error ?? video.error));
    return true;
  };

  if (!bindNativeVideo()) {
    let retries = 0;
    bindRetry = setInterval(() => {
      retries += 1;
      if (bindNativeVideo() || retries >= 40) clearInterval(bindRetry);
    }, 100);
  }

  const startupTimeout = setTimeout(() => {
    if (isPlaybackErrorUIVisible()) return;
    const concrete = errors.getConcreteError();
    if (concrete) return errors.show(concrete.title, concrete.message);
    errors.show(
      `${label} Playback Error`,
      'The stream did not start in time. The manifest or segment requests may be blocked, the ' +
        'link may have expired, or the site may require its own Referer or cookies; add them ' +
        'under "Site headers" and reload.',
      false,
    );
  }, STARTUP_TIMEOUT_MS);

  const monitor = setInterval(() => {
    if (started) return stopWatchers();
    if (!video.isConnected) {
      unsubscribe();
      return stopWatchers();
    }
    if (Date.now() - startedAt < STARTUP_TIMEOUT_MS) return;
    if (isPlaybackErrorUIVisible() || Date.now() - errors.getLastShownAt() <= ERROR_COOLDOWN_MS) {
      return;
    }

    const concrete = errors.getConcreteError();
    if (concrete?.message) {
      errors.show(concrete.title, concrete.message);
    } else {
      errors.show(
        `${label} Playback Error`,
        'Playback is still failing to start. Check the stream URL, its token, network access, ' +
          'and any Referer or cookie the site needs ("Site headers").',
        false,
      );
    }
  }, MONITOR_INTERVAL_MS);

  const onElementError = (event: Event) => {
    const payload = (event as CustomEvent).detail ?? event;
    if (isRecoverableEngineError(payload)) return;
    errors.show(`${label} Playback Error`, normalizeErrorMessage(payload));
  };
  video.addEventListener('error', () => showMediaError(video.error));
  video.addEventListener('hlsError', onElementError);
  video.addEventListener('dashError', onElementError);

  waitForMediaApi(video)
    .then((api) => {
      bindNativeVideo();
      const onEngineError = (...args: unknown[]) => {
        const payload = args.length > 1 ? args[1] : args[0];
        if (isRecoverableEngineError(payload)) return;
        errors.show(`${label} Playback Error`, normalizeErrorMessage(payload));
      };
      api.on?.('error', onEngineError);
      if (streamType === 'hls') api.on?.('hlsError', onEngineError);
    })
    .catch(() => {
      // The engine API may never appear in some failure modes; the media error handler still applies.
    });
}
