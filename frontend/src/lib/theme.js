// Theme preference: 'light' | 'dark' | 'system' (default), stored per browser.
// index.html runs a copy of resolveTheme/isThemedPath before React loads so the
// first paint already has the right theme; theme.test.js keeps the two in sync.

export const THEME_STORAGE_KEY = 'parksmart-theme';
export const THEME_PREFERENCES = ['system', 'light', 'dark'];

// Dark mode only applies to screens that have been redesigned. Legacy screens
// are light-only, so they stay light whatever the preference. Grows phase by
// phase and goes away once every screen is on the new kit.
export const THEMED_PATHS = { exact: [], prefixes: ['/_design'] };

export function isThemedPath(pathname) {
  return THEMED_PATHS.exact.includes(pathname)
    || THEMED_PATHS.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function readThemePreference() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(preference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice
    // then lasts for this page view only.
  }
}

export function resolveTheme(preference, systemPrefersDark) {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}

// Browser chrome colours, matching --surface in each theme.
export const THEME_COLORS = { light: '#f3f5f8', dark: '#0e131a' };

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[theme]);
  });
}
