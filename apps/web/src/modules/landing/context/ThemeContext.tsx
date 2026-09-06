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

export function ThemeProvider({ children, forceDark = false }: { children: ReactNode; forceDark?: boolean }) {
  const [isDark, setIsDark] = useState(true); // oscuro por defecto (SSR-safe)

  useEffect(() => {
    if (forceDark) return; // sin toggle: siempre oscuro, no hay nada que leer
    // Sin preferencia guardada => oscuro. Solo se respeta el claro si el
    // visitante lo eligió a mano en la landing.
    const saved = localStorage.getItem(CLAVE);
    setIsDark(saved !== 'light');
  }, [forceDark]);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
    // Con forceDark no se persiste ni se toca la preferencia guardada: esta
    // página no ofrece elegir, así que no debe pisar lo que el visitante haya
    // guardado para cuando SÍ vea una página con el toggle.
    if (!forceDark) localStorage.setItem(CLAVE, isDark ? 'dark' : 'light');
  }, [isDark, forceDark]);

  return (
    // Con forceDark, toggleTheme queda de adorno (no debería llamarse porque no
    // hay botón que lo dispare) pero por las dudas no hace nada en vez de
    // habilitar un claro que la página no sostiene.
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => { if (!forceDark) setIsDark(d => !d); } }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
