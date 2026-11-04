import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { conFundidoDeTema } from '@/hooks/useDarkMode';

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

// La clase del tema en <html>, separada del estado: el fundido la necesita
// puesta adentro de la View Transition (toggleTheme) y el efecto de abajo la
// repone cuando el estado cambia por otro camino (la carga inicial).
function aplicarClase(dark: boolean) {
  const html = document.documentElement;
  html.classList.toggle('dark', dark);
  html.classList.toggle('light', !dark);
}

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
    aplicarClase(isDark);
    // Con forceDark no se persiste ni se toca la preferencia guardada: esta
    // página no ofrece elegir, así que no debe pisar lo que el visitante haya
    // guardado para cuando SÍ vea una página con el toggle.
    if (!forceDark) localStorage.setItem(CLAVE, isDark ? 'dark' : 'light');
  }, [isDark, forceDark]);

  // El cambio se funde en vez de cortar (pedido de Ale, 04/11/2026: "modo oscuro
  // y claro para todo, home incluida, con ese efecto"): conFundidoDeTema envuelve
  // la clase y el estado en una View Transition y globals.css ("Cambio de tema
  // con fundido") hace bajar la noche desde arriba o subir el día desde abajo.
  // Con forceDark, toggleTheme no hace nada en vez de habilitar un claro que la
  // página no sostiene (no debería haber botón que lo dispare).
  const toggleTheme = () => {
    if (forceDark) return;
    const siguiente = !isDark;
    conFundidoDeTema(siguiente, () => { aplicarClase(siguiente); setIsDark(siguiente); });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Igual que useTheme pero sin exigir el provider: fuera de la landing devuelve
 * null. Lo usa la escena espacial cuando se monta en otra pantalla (el alta),
 * donde montar el ThemeProvider le cambiaría la clase de tema al <html>.
 */
export function useThemeOpcional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
