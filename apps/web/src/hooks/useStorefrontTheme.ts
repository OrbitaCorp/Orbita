import { useEffect, useState } from 'react'

const KEY = 'orbita-theme-tienda'

// Tema del storefront (tienda del cliente) — a diferencia del panel
// (useDarkMode.ts) acá NO hay modo "según el sistema": el storefront
// arranca SIEMPRE en claro y el visitante elige oscuro a mano si quiere.
// Clave de localStorage propia, separada de 'orbita-theme' del panel — el
// dueño de una tienda puede tener el panel en oscuro y su propio storefront
// en claro (o viceversa) sin que se pisen entre sí.
//
// El script anti-flash de _app.tsx ya aplica la clase 'dark' en <html> antes
// de esta primera renderización (mismo criterio) — acá solo se sincroniza el
// estado de React con lo que ya quedó pintado, para que el ícono del toggle
// arranque correcto sin parpadeo.
export function useStorefrontTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    setIsDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      if (next) localStorage.setItem(KEY, 'dark')
      else localStorage.removeItem(KEY)
      return next
    })
  }

  return { isDark, toggle }
}
