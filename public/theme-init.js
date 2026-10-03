// Runs before first paint so the page never flashes the wrong theme.
// Saved choice wins; otherwise follow the system, and fall back to dark.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('settingsTheme');
  } catch {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
})();
