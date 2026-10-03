import { ext } from '../../lib/browser';
import {
  SHORTCUTS_KEY,
  defaultBindings,
  loadShortcutBindings,
  parseStoredBindings,
  renderShortcuts,
  type ShortcutBindings,
} from '../../lib/shortcuts';

const container = document.getElementById('shortcuts-container');
const show = (bindings: ShortcutBindings) => container?.replaceChildren(renderShortcuts(bindings));

show(defaultBindings());
void loadShortcutBindings().then(show);
ext?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[SHORTCUTS_KEY]) {
    show(parseStoredBindings(changes[SHORTCUTS_KEY].newValue));
  }
});

document.getElementById('customize-shortcuts')?.addEventListener('click', (event) => {
  event.preventDefault();
  void ext.tabs.create({ url: `${ext.runtime.getURL('options.html')}#shortcuts` });
});
