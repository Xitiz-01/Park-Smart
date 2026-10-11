import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  applyTheme, isRedesignedPath, readThemePreference, resolveTheme, writeThemePreference,
} from '@/lib/theme';

const ThemeContext = createContext(null);
const DARK_QUERY = '(prefers-color-scheme: dark)';

function useSystemPrefersDark() {
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return prefersDark;
}

export function ThemeProvider({ children }) {
  const { pathname } = useLocation();
  const systemPrefersDark = useSystemPrefersDark();
  const [preference, setPreferenceState] = useState(readThemePreference);
  const redesigned = isRedesignedPath(pathname);
  const theme = redesigned ? resolveTheme(preference, systemPrefersDark) : 'light';
  const surface = redesigned ? 'new' : 'legacy';

  useEffect(() => { applyTheme(theme, surface); }, [theme, surface]);

  const setPreference = useCallback((next) => {
    writeThemePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
