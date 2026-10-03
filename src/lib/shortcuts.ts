import { getStorage } from './storage';

export const SHORTCUTS_KEY = 'shortcutBindings';

interface ActionDef {
  id: string;
  category: string;
  description: string;
  keys: readonly string[];
}

const action = <const T extends ActionDef>(def: T) => def;

export const SHORTCUT_ACTIONS = [
  action({
    id: 'togglePlay',
    category: 'Playback Control',
    description: 'Toggle play/pause',
    keys: [' ', 'k'],
  }),
  action({
    id: 'seekStart',
    category: 'Playback Control',
    description: 'Seek to the beginning',
    keys: ['Home'],
  }),
  action({
    id: 'seekEnd',
    category: 'Playback Control',
    description: 'Seek to the end',
    keys: ['End'],
  }),
  action({
    id: 'seekBack10',
    category: 'Navigation',
    description: 'Seek backward 10 seconds',
    keys: ['ArrowLeft'],
  }),
  action({
    id: 'seekForward10',
    category: 'Navigation',
    description: 'Seek forward 10 seconds',
    keys: ['ArrowRight'],
  }),
  action({
    id: 'seekBack5',
    category: 'Navigation',
    description: 'Seek backward 5 seconds',
    keys: ['j', 'J'],
  }),
  action({
    id: 'seekForward5',
    category: 'Navigation',
    description: 'Seek forward 5 seconds',
    keys: ['l', 'L'],
  }),
  action({
    id: 'speedDownSmall',
    category: 'Playback Speed',
    description: 'Decrease speed by 0.1',
    keys: ['<'],
  }),
  action({
    id: 'speedUpSmall',
    category: 'Playback Speed',
    description: 'Increase speed by 0.1',
    keys: ['>'],
  }),
  action({
    id: 'speedDown',
    category: 'Playback Speed',
    description: 'Decrease speed by 0.5',
    keys: ['-'],
  }),
  action({
    id: 'speedUp',
    category: 'Playback Speed',
    description: 'Increase speed by 0.5',
    keys: ['+'],
  }),
  action({
    id: 'volumeUp',
    category: 'Volume Control',
    description: 'Increase volume by 0.1',
    keys: ['ArrowUp'],
  }),
  action({
    id: 'volumeDown',
    category: 'Volume Control',
    description: 'Decrease volume by 0.1',
    keys: ['ArrowDown'],
  }),
  action({ id: 'toggleMute', category: 'Volume Control', description: 'Toggle mute', keys: ['m'] }),
  action({
    id: 'prevFrame',
    category: 'Frame Navigation',
    description: 'Previous frame',
    keys: [','],
  }),
  action({ id: 'nextFrame', category: 'Frame Navigation', description: 'Next frame', keys: ['.'] }),
  action({
    id: 'toggleFullscreen',
    category: 'View Controls',
    description: 'Toggle fullscreen',
    keys: ['f'],
  }),
  action({
    id: 'toggleCaptions',
    category: 'View Controls',
    description: 'Toggle subtitles',
    keys: ['c'],
  }),
  action({
    id: 'enterPip',
    category: 'View Controls',
    description: 'Enter Picture in Picture',
    keys: ['p'],
  }),
  action({
    id: 'exitPip',
    category: 'View Controls',
    description: 'Exit Picture in Picture',
    keys: ['P'],
  }),
  action({
    id: 'toggleShortcuts',
    category: 'View Controls',
    description: 'Toggle keyboard shortcuts',
    keys: ['?'],
  }),
];

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]['id'];
export type ShortcutBindings = Record<ShortcutAction, string[]>;
export type ShortcutOverrides = Partial<Record<ShortcutAction, string[]>>;

/** Shortcuts that cannot be changed; listed alongside the customizable ones. */
export const FIXED_SHORTCUTS = [
  { category: 'Playback Control', description: 'Seek to percentage (0%-90%)', label: '0-9' },
  { category: 'View Controls', description: 'Close shortcuts panel', label: 'Esc' },
];

/** Toggles fire once per press; holding the key must not flip them back and forth. */
export const NO_REPEAT_ACTIONS: ReadonlySet<ShortcutAction> = new Set<ShortcutAction>([
  'togglePlay',
  'toggleMute',
  'toggleFullscreen',
  'toggleCaptions',
  'enterPip',
  'exitPip',
  'toggleShortcuts',
]);

export const MAX_KEYS_PER_ACTION = 4;

const ACTION_IDS = new Set<string>(SHORTCUT_ACTIONS.map((a) => a.id));

const LOWER = [...'abcdefghijklmnopqrstuvwxyz'];

/** Every key a shortcut may use, grouped for the picker. Digits and Esc are reserved. */
export const ASSIGNABLE_KEY_GROUPS: ReadonlyArray<{ label: string; keys: readonly string[] }> = [
  { label: 'Letters', keys: LOWER },
  { label: 'Shift + letters', keys: LOWER.map((c) => c.toUpperCase()) },
  { label: 'Symbols', keys: [...'`-=[]\\;\',./~!@#$%^&*()_+{}|:"<>?'] },
  {
    label: 'Other keys',
    keys: [
      ' ',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Insert',
      'Delete',
      'Backspace',
      'Enter',
    ],
  },
];

const ASSIGNABLE = new Set(ASSIGNABLE_KEY_GROUPS.flatMap((g) => g.keys));

export function isAssignableKey(key: unknown): key is string {
  return typeof key === 'string' && ASSIGNABLE.has(key);
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Escape: 'Esc',
};

export function keyLabel(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (/^[A-Z]$/.test(key)) return `Shift + ${key}`;
  if (/^[a-z]$/.test(key)) return key.toUpperCase();
  return key;
}

/** Why a keydown cannot become a shortcut, or null when it can. */
export function rejectKeyReason(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): string | null {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return 'Ctrl, Alt and Meta combinations are reserved for the browser';
  }
  if (/^[0-9]$/.test(event.key)) return 'Number keys are reserved for seeking to a percentage';
  if (event.key === 'Escape') return 'Esc is reserved for closing panels';
  if (!isAssignableKey(event.key)) return `${keyLabel(event.key)} cannot be used as a shortcut`;
  return null;
}

export function defaultBindings(): ShortcutBindings {
  return Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, [...a.keys]])) as ShortcutBindings;
}

/** Drops unknown actions and invalid keys from untrusted storage data. */
export function sanitizeOverrides(raw: unknown): ShortcutOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: ShortcutOverrides = {};
  for (const [id, keys] of Object.entries(raw)) {
    if (!ACTION_IDS.has(id) || !Array.isArray(keys)) continue;
    result[id as ShortcutAction] = [...new Set(keys.filter(isAssignableKey))].slice(
      0,
      MAX_KEYS_PER_ACTION,
    );
  }
  return result;
}

/**
 * Applies user overrides on top of the defaults so every key maps to at most one action.
 * User choices win; a default that collides with one is dropped.
 */
export function resolveBindings(overrides: ShortcutOverrides): ShortcutBindings {
  const claimed = new Set<string>();
  const result = {} as ShortcutBindings;
  const claim = (keys: readonly string[]) =>
    keys.filter((k) => !claimed.has(k) && Boolean(claimed.add(k)));

  for (const { id } of SHORTCUT_ACTIONS) {
    const custom = overrides[id];
    if (custom) result[id] = claim(custom);
  }
  for (const { id, keys } of SHORTCUT_ACTIONS) {
    if (!overrides[id]) result[id] = claim(keys);
  }
  return result;
}

/** Stores only the actions that differ from their defaults, so new defaults still apply. */
export function toOverrides(bindings: ShortcutBindings): ShortcutOverrides {
  const overrides: ShortcutOverrides = {};
  for (const { id, keys } of SHORTCUT_ACTIONS) {
    const current = bindings[id];
    const same = current.length === keys.length && current.every((k, i) => k === keys[i]);
    if (!same) overrides[id] = [...current];
  }
  return overrides;
}

export function buildKeyMap(bindings: ShortcutBindings): Map<string, ShortcutAction> {
  const map = new Map<string, ShortcutAction>();
  for (const { id } of SHORTCUT_ACTIONS) {
    for (const key of bindings[id]) if (!map.has(key)) map.set(key, id);
  }
  return map;
}

export function actionForKey(bindings: ShortcutBindings, key: string): ShortcutAction | null {
  return SHORTCUT_ACTIONS.find((a) => bindings[a.id].includes(key))?.id ?? null;
}

/** Returns new bindings with `key` added to `target`, taking it away from any other action. */
export function assignKey(
  bindings: ShortcutBindings,
  target: ShortcutAction,
  key: string,
): ShortcutBindings {
  const next = structuredClone(bindings);
  for (const { id } of SHORTCUT_ACTIONS) {
    if (id !== target) next[id] = next[id].filter((k) => k !== key);
  }
  if (!next[target].includes(key)) next[target] = [...next[target], key];
  return next;
}

export function removeKey(
  bindings: ShortcutBindings,
  target: ShortcutAction,
  key: string,
): ShortcutBindings {
  return { ...bindings, [target]: bindings[target].filter((k) => k !== key) };
}

export function getActionDef(id: ShortcutAction) {
  return SHORTCUT_ACTIONS.find((a) => a.id === id)!;
}

export function isDefaultBindings(bindings: ShortcutBindings): boolean {
  return Object.keys(toOverrides(bindings)).length === 0;
}

export function parseStoredBindings(raw: unknown): ShortcutBindings {
  return resolveBindings(sanitizeOverrides(raw));
}

export async function loadShortcutBindings(): Promise<ShortcutBindings> {
  try {
    const result = await getStorage().get([SHORTCUTS_KEY]);
    return parseStoredBindings(result[SHORTCUTS_KEY]);
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
    return defaultBindings();
  }
}

export async function saveShortcutBindings(bindings: ShortcutBindings): Promise<void> {
  await getStorage().set({ [SHORTCUTS_KEY]: toOverrides(bindings) });
}

export function renderShortcuts(bindings: ShortcutBindings = defaultBindings()): HTMLElement {
  const byCategory = new Map<string, { description: string; labels: string[] }[]>();
  const add = (category: string, description: string, labels: string[]) => {
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({ description, labels });
  };
  for (const a of SHORTCUT_ACTIONS) add(a.category, a.description, bindings[a.id].map(keyLabel));
  for (const fixed of FIXED_SHORTCUTS) add(fixed.category, fixed.description, [fixed.label]);

  const container = document.createElement('div');
  for (const [category, shortcuts] of byCategory) {
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
      if (shortcut.labels.length === 0) {
        const none = document.createElement('span');
        none.className = 'key-none';
        none.textContent = 'Not set';
        binding.appendChild(none);
      }
      for (const label of shortcut.labels) {
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = label;
        binding.appendChild(key);
      }

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
