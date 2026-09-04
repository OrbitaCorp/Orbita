import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ThemeContextValue {
  isDark:      boolean;
  toggleTheme: () => void;
}

// Clave PROPIA de la landing, separada de `orbita-theme` del panel.
//
// Antes compartían la misma: si el dueño tenía el panel en claro, la landing se
// abría en claro también, aunque el diseño de la landing esté pensado en oscuro
// (el fondo espacial es lo primero que se ve). Son dos superficies distintas y
// la preferencia de una no dice nada de la otra — mismo criterio que ya usa el
// storefront con `orbita-theme-tienda` (ver useStorefrontTheme.ts).
const CLAVE = 'orbita-theme-landing';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true); // oscuro por defecto (SSR-safe)

  useEffect(() => {
    // Sin preferencia guardada => oscuro. Solo se respeta el claro si el
    // visitante lo eligió a mano en la landing.
    const saved = localStorage.getItem(CLAVE);
    setIsDark(saved !== 'light');
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
    localStorage.setItem(CLAVE, isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
