import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import themes from './index';

const ThemeContext = createContext();

function loadCustomTheme() {
  try {
    const raw = localStorage.getItem('fluxy-custom-theme');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('fluxy-theme') || 'glassy';
  });

  const [customThemeVars, setCustomThemeVars] = useState(loadCustomTheme);

  const allThemes = { ...themes };
  if (customThemeVars) {
    allThemes.__custom = { name: 'Custom', vars: customThemeVars };
  }

  useEffect(() => {
    const theme = allThemes[currentTheme];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-theme', currentTheme);
    localStorage.setItem('fluxy-theme', currentTheme);
  }, [currentTheme, customThemeVars]);

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
