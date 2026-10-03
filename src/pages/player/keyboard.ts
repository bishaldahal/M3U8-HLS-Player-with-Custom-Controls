import { ext } from '../../lib/browser';
import {
  NO_REPEAT_ACTIONS,
  SHORTCUTS_KEY,
  buildKeyMap,
  defaultBindings,
  loadShortcutBindings,
  nextPlaybackRate,
  parseStoredBindings,
  renderShortcuts,
  type ShortcutAction,
  type ShortcutBindings,
} from '../../lib/shortcuts';
import { isDrmPopupOpen } from './drm';
import { isLive, state } from './state';

const ASSUMED_FRAME_RATE = 48;

let keyMap = buildKeyMap(defaultBindings());

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** media-chrome controls (sliders, menus, buttons) declare the keys they handle themselves. */
function isKeyUsedByTarget(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const used =
    target.getAttribute('keysused')?.split(' ') ??
    (target as HTMLElement & { keysUsed?: string[] }).keysUsed ??
    [];
  return used.some((k) => (k === 'Space' ? ' ' : k) === key);
}

function seekToFraction(video: HTMLVideoElement, fraction: number): void {
  if (!isLive()) {
    video.currentTime = video.duration * fraction;
    return;
  }
  // Live streams: seek within the buffered range containing the playhead.
  const { buffered, currentTime } = video;
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    const end = buffered.end(i);
    if (currentTime >= start && currentTime <= end) {
      if (end - start > 0) video.currentTime = start + (end - start) * fraction;
      return;
    }
  }
}

export function seekBy(video: HTMLVideoElement, seconds: number): void {
  video.currentTime += seconds;
  state.resumePosition = video.currentTime;
}

function seekToEnd(video: HTMLVideoElement): void {
  if (!isLive()) {
    video.currentTime = video.duration;
  } else if (video.buffered.length > 0) {
    video.currentTime = video.buffered.end(video.buffered.length - 1);
  }
}

function toggleFullscreen(controller: HTMLElement): void {
  if (document.fullscreenElement) void document.exitFullscreen?.();
  else void controller.requestFullscreen?.();
}

function requestMedia(controller: HTMLElement, type: string): void {
  controller.dispatchEvent(new CustomEvent(type, { composed: true, bubbles: true }));
}

const SPEED_KEYS: Partial<Record<ShortcutAction, string>> = {
  speedDownSmall: '<',
  speedUpSmall: '>',
  speedDown: '-',
  speedUp: '+',
};

function runPlayerAction(
  action: ShortcutAction,
  video: HTMLVideoElement,
  controller: HTMLElement,
): void {
  switch (action) {
    case 'togglePlay':
      requestMedia(controller, video.paused ? 'mediaplayrequest' : 'mediapauserequest');
      break;
    case 'seekStart':
      video.currentTime = 0;
      break;
    case 'seekEnd':
      seekToEnd(video);
      break;
    case 'seekBack10':
      seekBy(video, -10);
      break;
    case 'seekForward10':
      seekBy(video, 10);
      break;
    case 'seekBack5':
      seekBy(video, -5);
      break;
    case 'seekForward5':
      seekBy(video, 5);
      break;
    case 'speedDownSmall':
    case 'speedUpSmall':
    case 'speedDown':
    case 'speedUp':
      video.playbackRate = nextPlaybackRate(video.playbackRate, SPEED_KEYS[action]!);
      break;
    case 'volumeUp':
      video.volume = Math.min(video.volume + 0.1, 1);
      break;
    case 'volumeDown':
      video.volume = Math.max(video.volume - 0.1, 0);
      break;
    case 'toggleMute':
      requestMedia(
        controller,
        video.muted || video.volume === 0 ? 'mediaunmuterequest' : 'mediamuterequest',
      );
      break;
    case 'prevFrame':
    case 'nextFrame':
      video.pause();
      seekBy(video, (action === 'prevFrame' ? -1 : 1) / ASSUMED_FRAME_RATE);
      break;
    case 'toggleFullscreen':
      toggleFullscreen(controller);
      break;
    case 'toggleCaptions':
      requestMedia(controller, 'mediatogglesubtitlesrequest');
      break;
    case 'enterPip':
      void video.requestPictureInPicture?.();
      break;
    case 'exitPip':
      if (document.pictureInPictureElement) void document.exitPictureInPicture?.();
      break;
    case 'toggleShortcuts':
      // Handled at document level so it also works while the panel has focus.
      break;
  }
}

function shouldIgnore(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    isDrmPopupOpen() ||
    isTypingInInput(event.target)
  );
}

function handlePlayerKey(event: KeyboardEvent, controller: HTMLElement): void {
  const video = state.video;
  if (!video || shouldIgnore(event) || isKeyUsedByTarget(event.target, event.key)) return;

  if (/^[0-9]$/.test(event.key)) {
    seekToFraction(video, Number(event.key) / 10);
    return;
  }

  const action = keyMap.get(event.key);
  if (!action || action === 'toggleShortcuts') return;
  event.preventDefault();
  if (event.repeat && NO_REPEAT_ACTIONS.has(action)) return;
  runPlayerAction(action, video, controller);
}

export function setupKeyboard(controller: HTMLElement): void {
  const modal = document.getElementById('keyboard-shortcuts')!;
  const list = document.getElementById('shortcuts-list')!;

  const applyBindings = (bindings: ShortcutBindings) => {
    keyMap = buildKeyMap(bindings);
    list.replaceChildren(renderShortcuts(bindings));
  };
  applyBindings(defaultBindings());
  void loadShortcutBindings().then(applyBindings);
  ext?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SHORTCUTS_KEY]) {
      applyBindings(parseStoredBindings(changes[SHORTCUTS_KEY].newValue));
    }
  });

  // Our handler owns every key, so media-chrome's built-in hotkeys must not fire as well.
  controller.setAttribute('nohotkeys', '');
  (controller as HTMLElement & { disableHotkeys?: () => void }).disableHotkeys?.();

  const setModalOpen = (open: boolean) => {
    modal.hidden = !open;
  };

  document.addEventListener('keydown', (event) => {
    if (isDrmPopupOpen() || isTypingInInput(event.target)) return;
    if (event.key === 'Escape') setModalOpen(false);
    else if (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.repeat &&
      keyMap.get(event.key) === 'toggleShortcuts'
    ) {
      event.preventDefault();
      setModalOpen(Boolean(modal.hidden));
    }
    state.video?.focus();
  });

  document.getElementById('close-shortcuts')!.addEventListener('click', () => setModalOpen(false));

  controller.addEventListener('keydown', (event) => handlePlayerKey(event, controller));
}
