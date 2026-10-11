// Theme preference: 'light' | 'dark' | 'system' (default), stored per browser.
// index.html runs a copy of resolveTheme/isRedesignedPath before React loads so
// the first paint already has the right theme and surface; theme.test.js keeps
// the two in sync.

export const THEME_STORAGE_KEY = 'parksmart-theme';
export const THEME_PREFERENCES = ['system', 'light', 'dark'];

// Screens already on the new kit. Elsewhere <html> gets data-surface="legacy",
// which switches on index.css's element rules, and the theme stays light
// (legacy screens are light-only). Grows phase by phase; goes away once every
// screen is redesigned.
export const REDESIGNED_PATHS = { exact: ['/'], prefixes: ['/_design'] };

export function isRedesignedPath(pathname) {
  return REDESIGNED_PATHS.exact.includes(pathname)
    || REDESIGNED_PATHS.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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

export function applyTheme(theme, surface) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.surface = surface;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[theme]);
  });
}
