import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REDESIGNED_PATHS, THEME_COLORS, THEME_STORAGE_KEY, isRedesignedPath, readThemePreference, resolveTheme, writeThemePreference,
} from './theme';

describe('resolveTheme', () => {
  test.each([
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ])('%s with system dark=%s resolves to %s', (preference, systemDark, expected) => {
    expect(resolveTheme(preference, systemDark)).toBe(expected);
  });
});

describe('theme preference storage', () => {
  afterEach(() => window.localStorage.clear());

  test('defaults to system and ignores unknown values', () => {
    expect(readThemePreference()).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemePreference()).toBe('system');
  });

  test('persists explicit choices and clears on system', () => {
    writeThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
    writeThemePreference('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  test('survives storage that throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readThemePreference()).toBe('system');
    expect(() => writeThemePreference('dark')).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

test('only redesigned routes get the new surface and dark mode', () => {
  expect(isRedesignedPath('/_design')).toBe(true);
  expect(isRedesignedPath('/_design/buttons')).toBe(true);
  expect(isRedesignedPath('/_designer')).toBe(false);
  expect(isRedesignedPath('/dashboard')).toBe(false);
  expect(isRedesignedPath('/')).toBe(true);
  expect(isRedesignedPath('/login')).toBe(true);
  expect(isRedesignedPath('/register')).toBe(true);
});

test('the pre-paint script in index.html mirrors src/lib/theme.js', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  expect(html).toContain(`var redesigned = ${JSON.stringify(REDESIGNED_PATHS)};`);
  expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  expect(html).toContain(`'${THEME_COLORS.dark}'`);
  expect(html).toContain(`content="${THEME_COLORS.light}"`);
});
