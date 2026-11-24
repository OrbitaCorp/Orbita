// Textos que el panel y el sitio tienen que decir igual: la política de
// cancelación (lo que el dueño configura en Pagos y señas es lo que lee el
// cliente al reservar, en la portada y en Mis reservas), cómo se nombra un
// bloqueo y cómo se escribe un monto. Antes cada pantalla los armaba a mano y
// no coincidían: Pagos decía "se devuelve la mitad" y el sitio "la seña no se
// devuelve" (auditoría del 20/11, docs/alquileres/).
import { diasEntre, fechaCorta, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import type { NegocioAlquiler, Pagos, TipoAlquiler } from './index'

/** "7 días", "1 día", "6 horas". */
export const plazoTxt = (horas: number) =>
  horas >= 24 ? `${horas / 24} ${horas / 24 === 1 ? 'día' : 'días'}` : `${horas} ${horas === 1 ? 'hora' : 'horas'}`

/** Qué pasa con la seña si cancelan antes del plazo. */
export const SENA_A_TIEMPO: Record<Pagos['cancelaATiempo'], string> = {
  devolver: 'se devuelve la seña entera',
  credito: 'la seña queda como crédito para otra reserva',
  pierde: 'la seña no se devuelve',
}
/** Qué pasa con la seña si cancelan después del plazo. */
export const SENA_TARDE: Record<Pagos['cancelaTarde'], string> = {
  pierde: 'se pierde la seña',
  mitad: 'se devuelve la mitad de la seña',
  credito: 'la seña queda como crédito para otra reserva',
}

/** "se devuelve la seña entera", según cancelen a tiempo o tarde. */
export const senaAlCancelar = (n: NegocioAlquiler, aTiempo: boolean) =>
  aTiempo ? SENA_A_TIEMPO[n.pagos.cancelaATiempo] : SENA_TARDE[n.pagos.cancelaTarde]

/** La política entera, en una o dos frases, como la lee el cliente. */
export function politicaCancelacion(n: NegocioAlquiler): string {
  const plazo = plazoTxt(n.cancelaHastaHoras)
  if (!n.senaPct) return `Podés cancelar sin cargo hasta ${plazo} antes.`
  return `Si cancelás hasta ${plazo} antes, ${senaAlCancelar(n, true)}. Después, ${senaAlCancelar(n, false)}.`
}

/**
 * Cómo se nombra un bloqueo `[desde, hasta)`. En canchas y salones se bloquean
 * días enteros y el fin se guarda sin incluir: del 25 al 27 son el 25 y el 26,
 * y así se muestra. En la estadía se lee como las noches de una reserva: del
 * día que entra al que sale.
 */
export function textoBloqueo(desde: ISO, hasta: ISO, tipo: TipoAlquiler): string {
  if (tipo === 'estadia') return rangoTxt(desde, hasta)
  if (diasEntre(desde, hasta) <= 1) return fechaCorta(desde)
  return rangoTxt(desde, sumarDias(hasta, -1))
}

/**
 * El link de WhatsApp de un celular argentino (wa.me no necesita la API de
 * WhatsApp: abre el chat con el mensaje escrito). WhatsApp pide el número
 * internacional: 54, el 9 de los celulares y el número sin el 0 de larga
 * distancia. Sin teléfono, null.
 */
export function linkWhatsApp(telefono: string, texto?: string): string | null {
  let d = telefono.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  d = d.replace(/^0+/, '')
  if (d.length < 8) return null
  return `https://wa.me/549${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/** El link para llamar, o null sin teléfono. */
export const linkLlamar = (telefono: string) => (telefono.replace(/\D/g, '') ? `tel:${telefono.replace(/[^\d+]/g, '')}` : null)

/** "120.000": el monto con el punto de los miles, para un campo de plata. */
export const milesTxt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('es-AR')

/** Lo que se escribió en un campo de plata, como número: solo los dígitos. */
export const leerPesos = (s: string) => Number(s.replace(/\D/g, '')) || 0
