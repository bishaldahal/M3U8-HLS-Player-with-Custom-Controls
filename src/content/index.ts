import { ext } from '../lib/browser';
import { detectStreamType, type StreamType } from '../lib/stream';

function requestPlay(url: string, streamType: StreamType): Promise<unknown> {
  return ext.runtime.sendMessage({ command: 'PLAY_STREAM', url, streamType });
}

function handleStreamClick(event: MouseEvent): void {
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor?.href) return;

  const streamType = detectStreamType(anchor.href);
  if (!streamType) return;

  event.preventDefault();
  event.stopPropagation();
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

const directStreamType = detectStreamType(window.location.href);
if (directStreamType) {
  requestPlay(window.location.href, directStreamType)
    .then(() => showRedirectNotice(directStreamType))
    .catch((error) => console.error('Error opening stream:', error));
}
