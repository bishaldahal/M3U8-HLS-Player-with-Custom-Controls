import { nextPlaybackRate, renderShortcuts } from '../../lib/shortcuts';
import { isDrmPopupOpen } from './drm';
import { isLive, state } from './state';

const ASSUMED_FRAME_RATE = 48;

function isTypingInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
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

function handlePlayerKey(event: KeyboardEvent): void {
  const video = state.video;
  if (!video || isDrmPopupOpen() || isTypingInInput(event.target)) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (/^[0-9]$/.test(event.key)) {
    seekToFraction(video, Number(event.key) / 10);
    return;
  }

  switch (event.key) {
    case '>':
    case '+':
    case '<':
    case '-':
      video.playbackRate = nextPlaybackRate(video.playbackRate, event.key);
      break;
    case 'ArrowUp':
      video.volume = Math.min(video.volume + 0.1, 1);
      break;
    case 'ArrowDown':
      video.volume = Math.max(video.volume - 0.1, 0);
      break;
    case 'p':
      video.requestPictureInPicture?.();
      break;
    case 'P':
      document.exitPictureInPicture?.();
      break;
    case 'j':
    case 'J':
      event.preventDefault();
      seekBy(video, -5);
      break;
    case 'l':
    case 'L':
      event.preventDefault();
      seekBy(video, 5);
      break;
    case ',':
    case '.':
      video.pause();
      seekBy(video, (event.key === ',' ? -1 : 1) / ASSUMED_FRAME_RATE);
      break;
    case 'Home':
      video.currentTime = 0;
      break;
    case 'End':
      if (!isLive()) {
        video.currentTime = video.duration;
      } else if (video.buffered.length > 0) {
        video.currentTime = video.buffered.end(video.buffered.length - 1);
      }
      break;
  }
}

export function setupKeyboard(controller: HTMLElement): void {
  const modal = document.getElementById('keyboard-shortcuts')!;
  const list = document.getElementById('shortcuts-list')!;
  list.appendChild(renderShortcuts());

  const setModalOpen = (open: boolean) => {
    modal.hidden = !open;
  };

  document.addEventListener('keydown', (event) => {
    if (isDrmPopupOpen() || isTypingInInput(event.target)) return;
    if (event.key === '?') setModalOpen(Boolean(modal.hidden));
    if (event.key === 'Escape') setModalOpen(false);
    state.video?.focus();
  });

  document.getElementById('close-shortcuts')!.addEventListener('click', () => setModalOpen(false));

  controller.addEventListener('keydown', handlePlayerKey);
}
