import { useEffect, useState } from 'react'

const KEY = 'orbita-theme-tienda'

// Tema del storefront (tienda del cliente). Clave de localStorage propia,
// separada de 'orbita-theme' del panel — el dueño de una tienda puede tener
// el panel en oscuro y su propio storefront en claro (o viceversa) sin que
// se pisen entre sí.
//
// El script anti-flash de _app.tsx ya aplica la clase 'dark' en <html> antes
// de esta primera renderización (mismo criterio) — acá solo se sincroniza el
// estado de React con lo que ya quedó pintado, para que el ícono del toggle
// arranque correcto sin parpadeo.
//
// (2026-08-26) Antes, tocar el toggle a "claro" hacía `removeItem` en vez de
// guardar 'light' — no había problema porque claro era SIEMPRE el default.
// Ahora el dueño puede elegir oscuro/sistema como default (Apariencia →
// Modo de color, ver COLOR_MODE_DEFAULT en _app.tsx): si se siguiera
// borrando la key, un visitante que eligió claro a mano volvería a caer en
// el default del dueño en su próxima visita, pisándole la elección explícita
// que se supone que nunca se pisa. Por eso ahora SIEMPRE se guarda un valor
// explícito ('dark' o 'light'), nunca se borra la key.
export function useStorefrontTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    setIsDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem(KEY, next ? 'dark' : 'light')
      return next
    })
  }

  return { isDark, toggle }
}
