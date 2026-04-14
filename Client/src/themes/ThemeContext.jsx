import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import themes from './index';

const ThemeContext = createContext();

function loadCustomTheme() {
  try {
    const raw = localStorage.getItem('fluxy-custom-theme');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function resolveInitialTheme() {
  const saved = localStorage.getItem('fluxy-theme') || 'glassy';
  if (saved === '__custom') return saved;
  if (themes[saved]) return saved;
  return 'glassy';
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(resolveInitialTheme);

  const [customThemeVars, setCustomThemeVars] = useState(loadCustomTheme);

  const allThemes = { ...themes };
  if (customThemeVars) {
    allThemes.__custom = { name: 'Custom', vars: customThemeVars };
  }

  useEffect(() => {
    const theme = allThemes[currentTheme];
    if (!theme) {
      setCurrentTheme('glassy');
      return;
    }
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-theme', currentTheme);
    localStorage.setItem('fluxy-theme', currentTheme);
  }, [currentTheme, customThemeVars]);

  useEffect(() => {
    function onStorage(e) {
      if (e.storageArea !== localStorage) return;
      if (e.key === 'fluxy-theme' && typeof e.newValue === 'string' && e.newValue) {
        setCurrentTheme(e.newValue);
      }
      if (e.key === 'fluxy-custom-theme') {
        if (e.newValue) {
          try {
            setCustomThemeVars(JSON.parse(e.newValue));
          } catch {
            /* ignore */
          }
        } else {
          setCustomThemeVars(null);
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const saveCustomTheme = useCallback((vars) => {
    setCustomThemeVars(vars);
    localStorage.setItem('fluxy-custom-theme', JSON.stringify(vars));
    setCurrentTheme('__custom');
  }, []);

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      setCurrentTheme,
      themes: allThemes,
      saveCustomTheme,
      customThemeVars,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
