import { createContext, useContext, useState, useEffect } from 'react';
import themes from './index';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('fluxy-theme') || 'glassy';
  });

  useEffect(() => {
    const theme = themes[currentTheme];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-theme', currentTheme);
    localStorage.setItem('fluxy-theme', currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setCurrentTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
