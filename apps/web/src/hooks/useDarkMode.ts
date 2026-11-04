// Hook global para manejar el tema de la app (claro / oscuro / sistema).
// Cómo funciona:
//  1. Al iniciar, busca si el usuario ya eligió un tema (localStorage).
//  2. Sin nada guardado (o con 'system' elegido a propósito), sigue la
//     preferencia del sistema operativo — 'system' NUNCA se escribe en
//     localStorage como string: se representa como ausencia de la clave, para
//     no romper los scripts anti-flash inline de otras páginas (login.tsx y
//     similares) que ya asumen "sin valor guardado = seguir al sistema".
//  3. Agrega o quita la clase 'dark' — globals.css hace el resto.
//  4. RBT-646: el panel además sincroniza esta preferencia con el backend
//     (por usuario, no por navegador) — ver Header.tsx y MiPerfil.tsx, que
//     llaman a setTema() con el valor guardado en member-profile.

import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'

export type TemaPreferencia = 'light' | 'dark' | 'system'

function leerTemaGuardado(): TemaPreferencia {
  const guardado = localStorage.getItem('orbita-theme')
  return guardado === 'dark' ? 'dark' : guardado === 'light' ? 'light' : 'system'
}

function prefiereSistemaOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Si una preferencia (claro, oscuro o sistema) termina en oscuro ahora mismo. */
export function esOscuro(tema: TemaPreferencia): boolean {
  return tema === 'dark' || (tema === 'system' && prefiereSistemaOscuro())
}

export function useDarkMode() {
  const [tema, setTemaState] = useState<TemaPreferencia>('system')
  const [isDark, setIsDark] = useState(false)

  function aplicarTema(dark: boolean) {
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }

  useEffect(() => {
    const t = leerTemaGuardado()
    setTemaState(t)
    aplicarTema(esOscuro(t))
  }, [])

  function setTema(t: TemaPreferencia) {
    setTemaState(t)
    aplicarTema(esOscuro(t))
    if (t === 'system') localStorage.removeItem('orbita-theme')
    else localStorage.setItem('orbita-theme', t)
  }

  function toggle() {
    setTema(isDark ? 'light' : 'dark')
  }

  return { isDark, tema, toggle, setTema }
}

/**
 * Cambia el tema con un fundido en vez de un corte. Usa View Transitions: el navegador
 * fotografía la pantalla como está, corre `cambiar` y funde la foto con lo nuevo según las
 * reglas de globals.css ("Cambio de tema con fundido"): cuando anochece la noche baja desde
 * arriba, cuando amanece la luz sube desde el horizonte. Mientras dura, <html> lleva
 * data-tema-fundido con la dirección. Donde la API no existe (Safari anterior al 18, Firefox
 * anterior al 144) el cambio es instantáneo, como siempre. `cambiar` va adentro de flushSync
 * para que React confirme el render ahí mismo: la transición necesita el DOM ya en el tema
 * nuevo cuando termina el callback.
 */
export function conFundidoDeTema(aOscuro: boolean, cambiar: () => void) {
  if (typeof document.startViewTransition !== 'function') { cambiar(); return }
  const html = document.documentElement
  const direccion = aOscuro ? 'anochece' : 'amanece'
  html.dataset.temaFundido = direccion
  // Si el atributo ya es de otro cambio (dos toques seguidos), ese lo limpia.
  const limpiar = () => { if (html.dataset.temaFundido === direccion) delete html.dataset.temaFundido }
  document.startViewTransition(() => { flushSync(cambiar) }).finished.then(limpiar, limpiar)
}
