type Theme = 'light' | 'dark';

// Keep in sync with public/theme-init.js.
const STORAGE_KEY = 'settingsTheme';

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function setupThemeToggle(): void {
  const systemLight = matchMedia('(prefers-color-scheme: light)');
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]');

  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === theme)));
  };

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice as Theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Not persisted; the choice still applies until the page closes.
      }
      apply(theme);
    }),
  );
  systemLight.addEventListener('change', () => {
    if (!savedTheme()) apply(systemLight.matches ? 'light' : 'dark');
  });
  apply(savedTheme() ?? (systemLight.matches ? 'light' : 'dark'));
}
