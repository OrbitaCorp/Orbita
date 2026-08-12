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

export type TemaPreferencia = 'light' | 'dark' | 'system'

function leerTemaGuardado(): TemaPreferencia {
  const guardado = localStorage.getItem('orbita-theme')
  return guardado === 'dark' ? 'dark' : guardado === 'light' ? 'light' : 'system'
}

function prefiereSistemaOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function esOscuro(tema: TemaPreferencia): boolean {
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
