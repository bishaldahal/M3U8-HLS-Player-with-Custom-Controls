import { ext } from '../../lib/browser';
import {
  ASSIGNABLE_KEY_GROUPS,
  MAX_KEYS_PER_ACTION,
  SHORTCUTS_KEY,
  SHORTCUT_ACTIONS,
  actionForKey,
  assignKey,
  defaultBindings,
  getActionDef,
  isDefaultBindings,
  keyLabel,
  loadShortcutBindings,
  parseStoredBindings,
  rejectKeyReason,
  removeKey,
  saveShortcutBindings,
  type ShortcutAction,
  type ShortcutBindings,
} from '../../lib/shortcuts';
import { toast } from '../../lib/ui-feedback';

let bindings: ShortcutBindings = defaultBindings();
let capturing: ShortcutAction | null = null;
let list: HTMLElement;
let resetAllBtn: HTMLButtonElement;

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

async function commit(next: ShortcutBindings, message?: string): Promise<void> {
  const previous = bindings;
  bindings = next;
  capturing = null;
  render();
  try {
    await saveShortcutBindings(next);
    if (message) toast.success(message);
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
    toast.error('Shortcuts could not be saved. Try again.');
    bindings = previous;
    render();
  }
}

function tryAssign(target: ShortcutAction, key: string): void {
  if (bindings[target].includes(key)) {
    toast.info(`${keyLabel(key)} is already assigned to this action.`);
    return;
  }
  const owner = actionForKey(bindings, key);
  if (owner) {
    const ownerName = getActionDef(owner).description;
    if (!confirm(`${keyLabel(key)} is used by "${ownerName}". Move it to this action?`)) return;
  }
  const label = keyLabel(key);
  void commit(
    assignKey(bindings, target, key),
    owner
      ? `${label} moved to "${getActionDef(target).description}".`
      : `${label} assigned to "${getActionDef(target).description}".`,
  );
}

function keyChip(id: ShortcutAction, key: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'shortcut-key';
  const label = document.createElement('kbd');
  label.textContent = keyLabel(key);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'shortcut-key-remove';
  remove.textContent = '×';
  remove.title = `Remove ${keyLabel(key)}`;
  remove.setAttribute('aria-label', `Remove ${keyLabel(key)} from ${getActionDef(id).description}`);
  remove.addEventListener('click', () => void commit(removeKey(bindings, id, key)));
  chip.append(label, remove);
  return chip;
}

function keyPicker(id: ShortcutAction): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'shortcut-picker';

  const capture = document.createElement('button');
  capture.type = 'button';
  capture.className = 'shortcut-capture';
  capture.textContent = 'Listening: press a key';
  capture.setAttribute('aria-label', `Press a key for ${getActionDef(id).description}`);
  capture.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      capturing = null;
      render();
      return;
    }
    // Lone modifier presses are part of a combination still being typed.
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph'].includes(event.key)) return;
    const reason = rejectKeyReason(event);
    if (reason) {
      toast.warning(reason);
      return;
    }
    tryAssign(id, event.key);
  });

  const select = document.createElement('select');
  select.className = 'select-input shortcut-select';
  select.setAttribute('aria-label', `Choose a key for ${getActionDef(id).description}`);
  const placeholder = new Option('Or choose a key', '');
  placeholder.disabled = true;
  placeholder.selected = true;
  select.add(placeholder);
  for (const group of ASSIGNABLE_KEY_GROUPS) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    for (const key of group.keys) {
      const owner = actionForKey(bindings, key);
      if (owner === id) continue;
      const text = owner
        ? `${keyLabel(key)} — used by ${getActionDef(owner).description}`
        : keyLabel(key);
      const option = new Option(text, key);
      if (owner) option.className = 'in-use';
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.addEventListener('change', () => {
    if (select.value) tryAssign(id, select.value);
    select.value = '';
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-secondary shortcut-small-btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    capturing = null;
    render();
  });

  wrap.append(capture, select, cancel);
  return wrap;
}

function renderRow(id: ShortcutAction): HTMLElement {
  const def = getActionDef(id);
  const row = document.createElement('div');
  row.className = 'shortcut-row';
  row.dataset.action = id;

  const name = document.createElement('div');
  name.className = 'shortcut-name';
  name.textContent = def.description;

  const keys = document.createElement('div');
  keys.className = 'shortcut-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', `Assigned shortcuts for ${def.description}`);
  if (bindings[id].length === 0) {
    const none = document.createElement('span');
    none.className = 'shortcut-none';
    none.textContent = 'Not set';
    keys.appendChild(none);
  }
  for (const key of bindings[id]) keys.appendChild(keyChip(id, key));

  const actions = document.createElement('div');
  actions.className = 'shortcut-actions';
  if (capturing === id) {
    row.classList.add('is-editing');
    actions.appendChild(keyPicker(id));
  } else {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn-secondary shortcut-small-btn';
    add.textContent = 'Add shortcut';
    add.disabled = bindings[id].length >= MAX_KEYS_PER_ACTION;
    add.title = add.disabled ? `At most ${MAX_KEYS_PER_ACTION} keys per action` : '';
    add.addEventListener('click', () => {
      capturing = id;
      render();
      list.querySelector<HTMLElement>(`[data-action="${id}"] .shortcut-capture`)?.focus();
    });
    actions.appendChild(add);

    if (!sameKeys(bindings[id], def.keys)) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn-text shortcut-small-btn';
      reset.textContent = 'Reset';
      reset.title = `Default: ${def.keys.map(keyLabel).join(', ')}`;
      reset.addEventListener('click', () => {
        let next = bindings;
        for (const key of def.keys) next = assignKey(next, id, key);
        next = { ...next, [id]: [...def.keys] };
        void commit(next, `"${def.description}" reset`);
      });
      actions.appendChild(reset);
    }
  }

  row.append(name, keys, actions);
  return row;
}

function render(): void {
  const groups = new Map<string, HTMLElement>();
  for (const { id, category } of SHORTCUT_ACTIONS) {
    let group = groups.get(category);
    if (!group) {
      group = document.createElement('div');
      group.className = 'shortcut-group';
      const title = document.createElement('h3');
      title.className = 'shortcut-group-title';
      title.textContent = category;
      const rows = document.createElement('div');
      rows.className = 'shortcut-group-rows';
      group.append(title, rows);
      groups.set(category, group);
    }
    group.lastElementChild!.appendChild(renderRow(id));
  }
  list.replaceChildren(...groups.values());
  resetAllBtn.disabled = isDefaultBindings(bindings);
}

export async function setupShortcutEditor(): Promise<void> {
  list = document.getElementById('shortcut-editor')!;
  resetAllBtn = document.getElementById('reset-shortcuts') as HTMLButtonElement;

  resetAllBtn.addEventListener('click', () => {
    if (!confirm('Reset all keyboard shortcuts to defaults?')) return;
    void commit(defaultBindings(), 'Shortcuts reset to defaults');
  });

  ext.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SHORTCUTS_KEY]) return;
    const next = parseStoredBindings(changes[SHORTCUTS_KEY].newValue);
    // Skip echoes of our own save so an open key picker is not closed.
    if (SHORTCUT_ACTIONS.every(({ id }) => sameKeys(next[id], bindings[id]))) return;
    bindings = next;
    capturing = null;
    render();
  });

  bindings = await loadShortcutBindings();
  render();
}
