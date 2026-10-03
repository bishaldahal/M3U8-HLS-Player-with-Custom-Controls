import { describe, expect, it } from 'vitest';
import {
  SHORTCUT_ACTIONS,
  actionForKey,
  assignKey,
  buildKeyMap,
  defaultBindings,
  isAssignableKey,
  isDefaultBindings,
  keyLabel,
  parseStoredBindings,
  rejectKeyReason,
  removeKey,
  resolveBindings,
  sanitizeOverrides,
  toOverrides,
} from '../../src/lib/shortcuts';

const press = (
  key: string,
  mods: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey', boolean>> = {},
) => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe('shortcut defaults', () => {
  it('give every key to exactly one action', () => {
    const keys = SHORTCUT_ACTIONS.flatMap((a) => a.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only use assignable keys', () => {
    for (const a of SHORTCUT_ACTIONS) for (const k of a.keys) expect(isAssignableKey(k)).toBe(true);
  });

  it('round-trip to empty overrides', () => {
    expect(toOverrides(defaultBindings())).toEqual({});
    expect(isDefaultBindings(defaultBindings())).toBe(true);
  });
});

describe('sanitizeOverrides', () => {
  it('drops unknown actions, bad keys, duplicates and non-arrays', () => {
    expect(
      sanitizeOverrides({
        togglePlay: ['x', 'x', '5', 'Escape', 42, 'F1'],
        bogus: ['q'],
        toggleMute: 'm',
      }),
    ).toEqual({ togglePlay: ['x'] });
  });

  it('handles garbage input', () => {
    expect(sanitizeOverrides(null)).toEqual({});
    expect(sanitizeOverrides(['a'])).toEqual({});
    expect(sanitizeOverrides('x')).toEqual({});
  });

  it('caps the number of keys per action', () => {
    expect(sanitizeOverrides({ togglePlay: ['a', 'b', 'c', 'd', 'e'] }).togglePlay).toHaveLength(4);
  });
});

describe('resolveBindings', () => {
  it('lets a user key win over a default that uses it', () => {
    const b = resolveBindings({ toggleFullscreen: ['k'] });
    expect(b.toggleFullscreen).toEqual(['k']);
    expect(b.togglePlay).toEqual([' ']);
    expect(buildKeyMap(b).get('k')).toBe('toggleFullscreen');
    expect(buildKeyMap(b).get('f')).toBeUndefined();
  });

  it('keeps an explicitly cleared action empty', () => {
    expect(resolveBindings({ toggleMute: [] }).toggleMute).toEqual([]);
  });

  it('never maps one key to two actions even with conflicting overrides', () => {
    const b = parseStoredBindings({ togglePlay: ['x'], toggleMute: ['x'] });
    const all = Object.values(b).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('assignKey / removeKey', () => {
  it('moves a key from its previous action', () => {
    const b = assignKey(defaultBindings(), 'toggleFullscreen', 'm');
    expect(b.toggleFullscreen).toEqual(['f', 'm']);
    expect(b.toggleMute).toEqual([]);
    expect(actionForKey(b, 'm')).toBe('toggleFullscreen');
  });

  it('does not mutate the input', () => {
    const original = defaultBindings();
    assignKey(original, 'toggleFullscreen', 'm');
    expect(original).toEqual(defaultBindings());
  });

  it('survives a save/load round trip', () => {
    const b = removeKey(assignKey(defaultBindings(), 'seekBack10', 'a'), 'togglePlay', 'k');
    expect(parseStoredBindings(toOverrides(b))).toEqual(b);
  });
});

describe('rejectKeyReason', () => {
  it.each([
    [press('5'), /Number keys/],
    [press('Escape'), /Esc/],
    [press('s', { ctrlKey: true }), /reserved for the browser/],
    [press('F5'), /cannot be used/],
    [press('Tab'), /cannot be used/],
  ])('rejects %o', (event, reason) => {
    expect(rejectKeyReason(event)).toMatch(reason);
  });

  it.each(['a', 'Z', '?', ' ', 'ArrowLeft', 'PageDown'])('accepts %s', (key) => {
    expect(rejectKeyReason(press(key))).toBeNull();
  });
});

describe('keyLabel', () => {
  it.each([
    [' ', 'Space'],
    ['ArrowLeft', '←'],
    ['k', 'K'],
    ['P', 'Shift + P'],
    ['?', '?'],
  ])('%s → %s', (key, label) => {
    expect(keyLabel(key)).toBe(label);
  });
});
