// Lo que el panel hace con una escritura y cómo la cuenta: fuera de Panel.tsx
// para poder probarlo sin pantalla.
import type { AvisoNav } from '@/design-system/reservas/LayoutPanel'
import { cuenta, type CalendarioExterno } from '../datos'
import { HechoConAviso } from '../datos/origen/aviso'

/** El aviso que se va solo (useAviso del kit). */
export type Avisar = (titulo: string, descripcion?: string, variante?: 'success' | 'error') => void

/**
 * Corre una escritura del panel y avisa cómo salió. En la demo es al
 * instante; en un negocio real va a la API y vuelve a cargar, así que se dice
 * "Guardando…" mientras tanto y el resultado lo reemplaza.
 *
 * Devuelve si quedó hecha, para que la pantalla sepa qué hacer después (no
 * vaciar el campo de un enlace que la API rechazó, por ejemplo). Un rechazo
 * se avisa como error, con el motivo de la API. Lo que se hizo con una
 * salvedad (HechoConAviso) también es un aviso de error, pero cuenta como hecho.
 */
export async function ejecutar(accion: () => void | Promise<void>, avisar: Avisar, o: { real: boolean; texto?: string; detalle?: string }): Promise<boolean> {
  if (o.real) avisar('Guardando…')
  try {
    await accion()
    if (o.texto) avisar(o.texto, o.detalle)
    return true
  } catch (e) {
    const motivo = e instanceof Error && e.message ? e.message : 'Probá de nuevo.'
    if (e instanceof HechoConAviso) {
      avisar(e.titulo, motivo, 'error')
      return true
    }
    avisar('No se pudo guardar', motivo, 'error')
    return false
  }
}

/** Lo que dice la campanita de un calendario conectado: que está al día, o que no se pudo bajar y por qué. */
export function avisoDeCalendario(c: CalendarioExterno, o: { fechas: number; propiedad: string; cuando: string }): Pick<AvisoNav, 'tono' | 'titulo' | 'detalle' | 'cuando'> {
  if (c.error) return { tono: 'aviso', titulo: `${c.nombre}: no se pudo sincronizar`, detalle: [o.propiedad, c.error].filter(Boolean).join(' · '), cuando: o.cuando }
  return { titulo: `${c.nombre}: sincronizado`, detalle: `${cuenta(o.fechas, 'fecha bloqueada', 'fechas bloqueadas')} en ${o.propiedad}`, cuando: o.cuando }
}
