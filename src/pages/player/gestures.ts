import { seekBy } from './keyboard';
import { state } from './state';

export type TapZone = 'left' | 'center' | 'right';

export const SEEK_STEP_SECONDS = 10;
const DOUBLE_TAP_MS = 280;
const SEEK_CHAIN_MS = 800;
const LONG_PRESS_MS = 450;
const LONG_PRESS_RATE = 2;
const MOVE_TOLERANCE_PX = 12;

export function tapZone(x: number, width: number): TapZone {
  if (x < width / 3) return 'left';
  if (x > (width * 2) / 3) return 'right';
  return 'center';
}

/** Running total shown in the seek bubble: grows on repeated taps, restarts on a side switch. */
export function nextSeekTotal(
  previous: { side: TapZone; total: number } | null,
  side: TapZone,
  step = SEEK_STEP_SECONDS,
): number {
  return previous?.side === side ? previous.total + step : step;
}

function toggleFullscreen(controller: HTMLElement): void {
  if (document.fullscreenElement) void document.exitFullscreen?.();
  else void controller.requestFullscreen?.();
}

function togglePlay(video: HTMLVideoElement): void {
  if (video.paused) void video.play();
  else video.pause();
}

/** Lock to landscape in fullscreen on phones, the way native video players do. */
function setupOrientationLock(controller: HTMLElement): void {
  const coarse = window.matchMedia('(pointer: coarse)');
  document.addEventListener('fullscreenchange', () => {
    if (!coarse.matches) return;
    const video = state.video;
    if (document.fullscreenElement === controller) {
      if (video && video.videoWidth >= video.videoHeight) {
        screen.orientation?.lock?.('landscape').catch(() => {});
      }
    } else {
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Not supported outside fullscreen on some browsers.
      }
    }
  });
}

export function setupGestures(controller: HTMLElement): void {
  const layer = controller.querySelector<HTMLElement>('.gesture-layer');
  if (!layer) return;
  const bubbles = {
    left: layer.querySelector<HTMLElement>('[data-side="left"]')!,
    right: layer.querySelector<HTMLElement>('[data-side="right"]')!,
  };
  const rateBadge = layer.querySelector<HTMLElement>('.rate-feedback')!;

  let lastPointerType = 'mouse';
  let start: { x: number; y: number; id: number } | null = null;
  let moved = false;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressRate: number | null = null;
  let pendingTap: ReturnType<typeof setTimeout> | undefined;
  let seekChain: { side: TapZone; total: number; until: number } | null = null;
  const hideTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  // media-controller toggles its controls when a touch pointerup targets itself.
  const toggleControls = () =>
    controller.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));

  const showSeek = (side: 'left' | 'right', total: number) => {
    const bubble = bubbles[side];
    bubble.textContent = side === 'left' ? `« ${total}s` : `${total}s »`;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
    clearTimeout(hideTimers.get(bubble));
    hideTimers.set(
      bubble,
      setTimeout(() => bubble.classList.remove('show'), SEEK_CHAIN_MS),
    );
  };

  const seek = (side: 'left' | 'right') => {
    const video = state.video;
    if (!video) return;
    const now = performance.now();
    const chain = seekChain && seekChain.until > now ? seekChain : null;
    const total = nextSeekTotal(chain, side);
    seekChain = { side, total, until: now + SEEK_CHAIN_MS };
    seekBy(video, side === 'left' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
    showSeek(side, total);
  };

  const endLongPress = () => {
    clearTimeout(longPressTimer);
    if (longPressRate === null) return false;
    if (state.video) state.video.playbackRate = longPressRate;
    longPressRate = null;
    rateBadge.hidden = true;
    return true;
  };

  const onTouchTap = (event: PointerEvent) => {
    const rect = layer.getBoundingClientRect();
    const zone = tapZone(event.clientX - rect.left, rect.width);

    // Keep seeking on each further tap while the bubble is still up, like native players.
    if (zone !== 'center' && seekChain && seekChain.until > performance.now()) {
      seek(zone);
      return;
    }

    if (pendingTap !== undefined) {
      clearTimeout(pendingTap);
      pendingTap = undefined;
      if (zone === 'center') toggleFullscreen(controller);
      else seek(zone);
      return;
    }

    pendingTap = setTimeout(() => {
      pendingTap = undefined;
      toggleControls();
    }, DOUBLE_TAP_MS);
  };

  layer.addEventListener('pointerdown', (event) => {
    lastPointerType = event.pointerType;
    if (event.pointerType === 'mouse') return;
    event.stopPropagation();
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    moved = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      const video = state.video;
      if (!video || video.paused || moved) return;
      longPressRate = video.playbackRate;
      video.playbackRate = LONG_PRESS_RATE;
      rateBadge.hidden = false;
    }, LONG_PRESS_MS);
  });

  layer.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || !start || event.pointerId !== start.id) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) {
      moved = true;
      if (longPressRate === null) clearTimeout(longPressTimer);
    }
  });

  layer.addEventListener('click', () => {
    if (lastPointerType === 'mouse' && state.video) togglePlay(state.video);
  });

  layer.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') return;
    event.stopPropagation();
    const wasLongPress = endLongPress();
    const wasMoved = moved;
    start = null;
    if (!wasLongPress && !wasMoved) onTouchTap(event);
  });

  layer.addEventListener('pointercancel', () => {
    endLongPress();
    start = null;
  });

  // Double-click is mouse-only; touch double-taps are handled above.
  layer.addEventListener('dblclick', () => {
    if (lastPointerType === 'mouse') toggleFullscreen(controller);
  });

  layer.addEventListener('contextmenu', (event) => {
    if (longPressRate !== null || window.matchMedia('(pointer: coarse)').matches) {
      event.preventDefault();
    }
  });

  setupOrientationLock(controller);
}
