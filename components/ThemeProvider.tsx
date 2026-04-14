'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with dark (matches the server-rendered html class)
  const [theme, setTheme] = useState<Theme>('dark');

  // On mount: read from localStorage immediately (before API response)
  useEffect(() => {
    const stored = localStorage.getItem('fb_theme') as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    }

    // Then sync from DB (source of truth for cross-device)
    fetch('/api/preferences')
      .then((r) => r.json())
      .then((data) => {
        const dbTheme: Theme = data.theme === 'light' ? 'light' : 'dark';
        // Only update if DB differs from localStorage (localStorage wins on first load)
        if (!stored && dbTheme !== 'dark') {
          setTheme(dbTheme);
          applyTheme(dbTheme);
          localStorage.setItem('fb_theme', dbTheme);
        }
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('fb_theme', next);
      // Persist to DB (fire and forget)
      fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
