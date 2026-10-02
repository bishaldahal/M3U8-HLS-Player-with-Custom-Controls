export interface Shortcut {
  key: string;
  description: string;
}

export const SHORTCUTS_BY_CATEGORY: Record<string, Shortcut[]> = {
  'Playback Control': [
    { key: 'Space / k', description: 'Toggle play/pause' },
    { key: 'Home', description: 'Seek to the beginning' },
    { key: 'End', description: 'Seek to the end' },
    { key: '0-9', description: 'Seek to percentage (0%-90%)' },
  ],
  Navigation: [
    { key: 'ArrowLeft (←)', description: 'Seek backward 10 seconds' },
    { key: 'ArrowRight (→)', description: 'Seek forward 10 seconds' },
    { key: 'j', description: 'Seek backward 5 seconds' },
    { key: 'l', description: 'Seek forward 5 seconds' },
  ],
  'Playback Speed': [
    { key: '<', description: 'Decrease speed by 0.1' },
    { key: '>', description: 'Increase speed by 0.1' },
    { key: '-', description: 'Decrease speed by 0.5' },
    { key: '+', description: 'Increase speed by 0.5' },
  ],
  'Volume Control': [
    { key: 'ArrowUp (↑)', description: 'Increase volume by 0.1' },
    { key: 'ArrowDown (↓)', description: 'Decrease volume by 0.1' },
    { key: 'm', description: 'Toggle mute' },
  ],
  'Frame Navigation': [
    { key: ',', description: 'Previous frame' },
    { key: '.', description: 'Next frame' },
  ],
  'View Controls': [
    { key: 'f', description: 'Toggle fullscreen' },
    { key: 'p', description: 'Enter Picture in Picture' },
    { key: 'P', description: 'Exit Picture in Picture' },
    { key: '?', description: 'Toggle keyboard shortcuts' },
    { key: 'Esc', description: 'Close shortcuts panel' },
  ],
};

export function renderShortcuts(byCategory = SHORTCUTS_BY_CATEGORY): HTMLElement {
  const container = document.createElement('div');

  for (const [category, shortcuts] of Object.entries(byCategory)) {
    const section = document.createElement('div');
    section.className = 'shortcuts-category';

    const title = document.createElement('h3');
    title.className = 'category-title';
    title.textContent = category;

    const list = document.createElement('ul');
    if (shortcuts.length <= 2) list.className = 'full-width';

    for (const shortcut of shortcuts) {
      const li = document.createElement('li');
      const code = document.createElement('code');

      const desc = document.createElement('span');
      desc.className = 'shortcut-desc';
      desc.textContent = shortcut.description;

      const binding = document.createElement('span');
      binding.className = 'key-binding';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = shortcut.key;
      binding.appendChild(key);

      code.append(desc, binding);
      li.appendChild(code);
      list.appendChild(li);
    }

    section.append(title, list);
    container.appendChild(section);
  }
  return container;
}

/** Returns the next playback rate for the speed keys `<`, `>`, `-`, `+`. */
export function nextPlaybackRate(current: number, key: string): number {
  const delta = key === '<' || key === '>' ? 0.1 : 0.5;
  const round = (n: number) => Math.round(n * 100) / 100;

  if (key === '>' || key === '+') {
    const raw = current === 0.1 && key === '+' ? 0.5 : current + delta;
    return Math.min(round(raw), 10);
  }
  return Math.max(round(current - delta), 0.1);
}
