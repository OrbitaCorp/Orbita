// Lo que pasa después de reservar: calendario, mapa y WhatsApp. Son las únicas
// acciones que hacen algo de verdad en la demo, y las tres salen del navegador
// (un archivo .ics, un link a Maps, un link a wa.me): no dependen de ninguna API.
import type { Fecha } from './calendario'

export const CODIGO_DEMO = 'ORB-4F7K'

const dos = (n: number) => String(n).padStart(2, '0')
const limpio = (s: string) => s.replace(/([,;\\])/g, '\\$1')

/** Baja un .ics con el turno: lo abren Google Calendar, el calendario del iPhone y Outlook. */
export function descargarICS({ titulo, fecha, inicio, duracion, lugar }: { titulo: string; fecha: Fecha; inicio: number; duracion: number; lugar: string }) {
  const sello = (m: number) => `2026${dos(fecha.mes)}${dos(fecha.dia)}T${dos(Math.floor(m / 60))}${dos(m % 60)}00`
  const cuerpo = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orbita//Turnos//ES', 'BEGIN:VEVENT',
    `UID:${CODIGO_DEMO}-${sello(inicio)}@orbita.site`, 'DTSTAMP:20260926T134000',
    `DTSTART:${sello(inicio)}`, `DTEND:${sello(Math.min(inicio + duracion, 23 * 60 + 59))}`,
    `SUMMARY:${limpio(titulo)}`, `LOCATION:${limpio(lugar)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([cuerpo], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'turno.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
