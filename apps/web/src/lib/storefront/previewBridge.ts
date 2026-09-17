// ─── Puente del preview de Apariencia ────────────────────────────────────────
//
// La vista previa del panel (Configuración → Apariencia) es la TIENDA REAL
// dentro de un iframe, no una réplica: antes StorePreview.tsx dibujaba a mano
// un home de mentira (productos, categorías y hasta un chat de WhatsApp
// inventados), así que cada cambio en el storefront había que copiarlo ahí
// también y el dueño veía algo que no era su tienda.
//
// Lo único que el iframe no puede saber solo es el borrador SIN GUARDAR: eso
// se lo manda el panel por postMessage y acá se pisa sobre la config que la
// tienda ya trajo del backend. Cuando el dueño guarda, el borrador y lo
// guardado coinciden y el preview no cambia nada.
//
// Mismo origen siempre: el panel vive en `{slug}.orbita.site/panel` y la
// tienda en `{slug}.orbita.site/` (o `/admin/...` y `/tienda/{slug}` en dev
// sin subdominios). Igual se valida `event.origin` y se manda con
// targetOrigin explícito — si algún día el panel se sirve de otro host, el
// preview simplemente muestra lo guardado en vez de aceptar mensajes de
// cualquiera.

import { useEffect, useState } from 'react'
import { fontStack, googleFontsHref } from '@/lib/fonts'
import type { StorefrontConfigResponse } from './api'

type Appearance = NonNullable<StorefrontConfigResponse['appearance']>
/** Borrador de Apariencia tal como lo manda el panel (apToUpdateDto). */
export type AppearanceOverrides = Partial<Appearance>

export const MSG_BORRADOR = 'orbita-preview:appearance'
export const MSG_LISTA = 'orbita-preview:ready'
/** `?preview=1` — lo agrega el panel al src del iframe. */
export const PREVIEW_QUERY = 'preview'

let overrides: AppearanceOverrides | null = null
const oyentes = new Set<() => void>()
let instalado = false

/** Solo el iframe del panel corre en modo preview; una visita real, nunca. */
export function esPreview(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get(PREVIEW_QUERY) === '1'
}

/** Escucha el borrador del panel. Idempotente: se llama desde _app.tsx. */
export function instalarPreviewBridge(): void {
  if (instalado || !esPreview()) return
  instalado = true
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    const data = e.data as { type?: string; appearance?: unknown } | null
    if (!data || data.type !== MSG_BORRADOR) return
    if (typeof data.appearance !== 'object' || data.appearance === null) return
    overrides = data.appearance as AppearanceOverrides
    aplicarTema(overrides)
    oyentes.forEach((avisar) => avisar())
  })
  // El panel espera esto para mandar el primer borrador: el iframe puede
  // tardar en cargar y un postMessage a una página que todavía no instaló el
  // listener se pierde sin aviso.
  window.parent?.postMessage({ type: MSG_LISTA }, window.location.origin)
}

export function overridesPreview(): AppearanceOverrides | null {
  return esPreview() ? overrides : null
}

// ─── Tema en vivo (colores, tipografías, escala, claro/oscuro) ───────────────
//
// Esto NO pasa por React a propósito. _app.tsx inyecta estas mismas variables
// desde lo GUARDADO (__storeMeta, ver forceSSR.ts) y es el componente más
// sensible de la app: meterle un hook nuevo rompía el orden de hooks en dev.
// Acá se escribe un <style> aparte, que gana por ir después en el <head>, y
// se toca la clase `dark` a mano — el resto del preview (toggles, textos,
// slides) sí va por React, desde el config que ya trae cada página.

const ID_ESTILO = 'orbita-preview-tema'
const ID_FUENTES = 'orbita-preview-fuentes'
const HEX = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

function hex(v: string | null | undefined): string | null {
  if (!v || !HEX.test(v)) return null
  return v.startsWith('#') ? v : `#${v}`
}

function escala(v: string | number | null | undefined): number | null {
  const n = v == null ? NaN : Number(v)
  if (!Number.isFinite(n) || n < 0.5 || n > 2 || n === 1) return null
  return n
}

function aplicarTema(ov: AppearanceOverrides): void {
  const primario = hex(ov.colorPrimary)
  const fondo = hex(ov.colorBackground)
  const texto = hex(ov.colorSecondary)
  const acento = hex(ov.colorAccent)
  const zoom = escala(ov.fontScale)
  const titulos = ov.fontFamily ?? null
  const cuerpo = ov.fontFamilyBody ?? null

  // Mismas reglas que _app.tsx (ahí desde lo guardado, acá desde el borrador).
  const css = [
    primario ? `:root, .dark { --color-primary: ${primario} !important; --color-primary-bg: color-mix(in srgb, ${primario} 15%, transparent) !important; }
      :root { --color-primary-h: color-mix(in srgb, ${primario} 82%, black) !important; }
      .dark { --color-primary-h: color-mix(in srgb, ${primario} 75%, white) !important; }` : '',
    fondo ? `:root:not(.dark) { --color-bg: ${fondo} !important; }` : '',
    texto ? `:root:not(.dark) { --color-text: ${texto} !important; }` : '',
    acento ? `:root, .dark { --color-accent: ${acento} !important; }` : '',
    titulos ? `:root { --font-heading: ${fontStack(titulos)}; } h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }` : '',
    cuerpo ? `:root { --font-body: ${fontStack(cuerpo)}; } body { font-family: var(--font-body); }` : '',
    zoom ? `html { zoom: ${zoom}; }` : '',
  ].filter(Boolean).join('\n')

  let estilo = document.getElementById(ID_ESTILO) as HTMLStyleElement | null
  if (!estilo) {
    estilo = document.createElement('style')
    estilo.id = ID_ESTILO
    document.head.appendChild(estilo)
  }
  estilo.textContent = css

  // La fuente elegida puede no estar cargada todavía (el <link> de _app.tsx
  // trae solo las guardadas).
  const href = googleFontsHref([titulos, cuerpo])
  let link = document.getElementById(ID_FUENTES) as HTMLLinkElement | null
  if (href) {
    if (!link) {
      link = document.createElement('link')
      link.id = ID_FUENTES
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  } else if (link) {
    link.remove()
  }

  // Claro/oscuro: el script pre-hidratación ya corrió con el modo guardado.
  if (ov.colorMode) {
    const oscuro = ov.colorMode === 'dark'
      || (ov.colorMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', oscuro)
  }
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar)
  return () => { oyentes.delete(avisar) }
}

/**
 * Re-renderiza el componente cada vez que llega un borrador nuevo.
 *
 * Arranca en null (igual en server y en cliente) y recién se llena después
 * de montar: con useSyncExternalStore el snapshot del cliente no coincidía
 * con el del server y React rompía la hidratación de _app.
 */
export function usarOverridesPreview(): AppearanceOverrides | null {
  const [ov, setOv] = useState<AppearanceOverrides | null>(null)
  useEffect(() => {
    if (!esPreview()) return
    instalarPreviewBridge()
    // Por si el borrador llegó entre el install y este efecto.
    setOv(overridesPreview())
    return suscribir(() => setOv(overridesPreview()))
  }, [])
  return ov
}

/**
 * Pisa `appearance` con el borrador. Devuelve el mismo objeto si no hay nada
 * que pisar, así no dispara re-renders ni invalida memos fuera del preview.
 */
export function conOverrides<T extends StorefrontConfigResponse | null>(cfg: T, ov: AppearanceOverrides | null): T {
  if (!cfg || !ov) return cfg
  // `appearance` puede venir en null (negocio que nunca guardó Apariencia):
  // el merge queda parcial y el storefront cae a sus defaults campo por
  // campo, igual que hace hoy con la config real.
  return { ...cfg, appearance: { ...(cfg.appearance ?? {}), ...ov } as Appearance }
}
