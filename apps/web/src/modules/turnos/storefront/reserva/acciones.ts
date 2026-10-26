// Lo que pasa después de reservar: calendario, mapa y WhatsApp. Son las únicas
// acciones que hacen algo de verdad en la demo, y las tres salen del navegador
// (un archivo .ics, un link a Maps, un link a wa.me): no dependen de ninguna API.
import { generarICS, descargarICS as bajarICS } from '@/lib/reservas/ics'
import { iso } from '@/lib/reservas/fechas'
import type { Fecha } from './calendario'

export const CODIGO_DEMO = 'ORB-4F7K'

/**
 * Baja un .ics con el turno: lo abren Google Calendar, el calendario del iPhone
 * y Outlook. Lo arma la librería de reservas, la misma de Alquileres y
 * Gimnasio: hora de Argentina pasada a UTC (el turno queda a las 10 del local
 * aunque el teléfono esté en otra zona), líneas plegadas y la URL del archivo
 * liberada después de la descarga (si se libera en el acto, Safari la corta).
 */
export function descargarICS({ titulo, fecha, inicio, duracion, lugar }: { titulo: string; fecha: Fecha; inicio: number; duracion: number; lugar: string }) {
  const dia = iso(2026, fecha.mes, fecha.dia)
  const contenido = generarICS([{
    uid: `${CODIGO_DEMO}-${dia}-${inicio}@orbita.site`, titulo, lugar,
    inicio: { fecha: dia, minuto: inicio },
    fin: { fecha: dia, minuto: Math.min(inicio + duracion, 23 * 60 + 59) },
  }], { nombre: titulo, ahora: new Date(Date.UTC(2026, 8, 26, 13, 40)) }) // el "ahora" de la demo: sábado 26/09 a las 10:40
  bajarICS(contenido, 'turno.ics')
}

export const linkMapa = (direccion: string, barrio: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, ${barrio}`)}`

/** Abre WhatsApp para que la persona elija a quién mandárselo. Al negocio no se le escribe
 *  por wa.me: su teléfono es inventado y la demo es pública (ver ContactoDemo.tsx). */
export const linkWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`

/** Dirección del turno que lleva el QR (de ejemplo: el subdominio sale del nombre del negocio). */
export const urlTurno = (negocio: string) =>
  `https://${negocio.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.orbita.site/t/${CODIGO_DEMO}`

/** Flechas, Inicio y Fin dentro de un radiogroup: mueve el foco y elige, como un grupo de radios nativo. */
export function teclasRadio(e: React.KeyboardEvent<HTMLElement>) {
  const paso: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
  if (!(e.key in paso) && e.key !== 'Home' && e.key !== 'End') return
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)'))
  const i = radios.indexOf(document.activeElement as HTMLElement)
  if (i < 0 || radios.length === 0) return
  e.preventDefault()
  const destino = e.key === 'Home' ? 0 : e.key === 'End' ? radios.length - 1 : (i + paso[e.key] + radios.length) % radios.length
  radios[destino].focus()
  radios[destino].click()
}
