import { ext } from '../lib/browser';
import { detectStreamType, type StreamType } from '../lib/stream';

function requestPlay(url: string, streamType: StreamType, replaceTab = false): Promise<unknown> {
  return ext.runtime.sendMessage({ command: 'PLAY_STREAM', url, streamType, replaceTab });
}

const CLICK_DEDUPE_MS = 1000;
let lastRequest = { url: '', at: 0 };

const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;

function handleStreamClick(event: MouseEvent): void {
  // Leave right-click alone so the context menu still works.
  if (event.button !== PRIMARY_BUTTON && event.button !== MIDDLE_BUTTON) return;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor?.href) return;

  const streamType = detectStreamType(anchor.href);
  if (!streamType) return;

  event.preventDefault();
  event.stopPropagation();
  // mousedown and click both land here for one click; open a single tab.
  const now = Date.now();
  if (lastRequest.url === anchor.href && now - lastRequest.at < CLICK_DEDUPE_MS) return;
  lastRequest = { url: anchor.href, at: now };
  requestPlay(anchor.href, streamType).catch((error) =>
    console.error('Error sending message:', error),
  );
}

function showRedirectNotice(streamType: StreamType): void {
  const container = document.createElement('div');
  container.style.cssText =
    'display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#1a1a1a;color:white;';

  const content = document.createElement('div');
  content.style.textAlign = 'center';

  const heading = document.createElement('h2');
  heading.textContent = `Opening ${streamType.toUpperCase()} Stream...`;
  const text = document.createElement('p');
  text.textContent = 'Redirecting to Stream Player';

  content.append(heading, text);
  container.appendChild(content);
  document.body.replaceChildren(container);
}

document.addEventListener('click', handleStreamClick, true);
// Firefox may navigate on mousedown before click fires.
document.addEventListener('mousedown', handleStreamClick, true);
// Middle-click opens links via auxclick, not click.
document.addEventListener('auxclick', handleStreamClick, true);

const directStreamType = detectStreamType(window.location.href);
if (directStreamType) {
  requestPlay(window.location.href, directStreamType, true)
    .then(() => showRedirectNotice(directStreamType))
    .catch((error) => console.error('Error opening stream:', error));
}
