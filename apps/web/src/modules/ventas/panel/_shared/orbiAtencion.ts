import type { BotChatEstado, BotModo, OrbiCanalCambios, OrbiCanalEstado } from '@/lib/api'

// Orbi atendiendo a los clientes por chat, igual en WhatsApp (Mensajes → WhatsApp) y en Instagram (Difusión → Mensajes):
// cuándo contesta en una charla y el formulario de lo que se configura igual en los dos (indicaciones, topes del pedido,
// tope del cupo). Sin React, para probarlo solo.

/**
 * ¿Orbi contesta en esta charla? Mismo criterio que la API: con el interruptor general apagado, nunca; ON y OFF son del
 * dueño; DEFAULT sigue el modo general (solo atiende en "todos"); PAUSADO y DERIVADO lo callan hasta que el dueño lo reactive.
 */
export function orbiAtiende(config: { enabled: boolean; modo: BotModo } | null, estado: BotChatEstado | undefined): boolean {
  if (!config?.enabled) return false
  const e = estado ?? 'DEFAULT'
  if (e === 'ON') return true
  if (e === 'DEFAULT') return config.modo === 'TODOS'
  return false
}

export const MAX_INSTRUCCIONES = 1000

/** Lo que se escribe en el formulario, tal cual (los números como texto, para poder borrarlos). */
export interface FormularioDeOrbi {
  instrucciones: string
  tope: string
  maxUnidades: string
  maxMonto: string
}

export function formularioDe(bot: OrbiCanalEstado): FormularioDeOrbi {
  return {
    instrucciones: bot.instrucciones ?? '',
    tope: bot.topeCreditos === null ? '' : String(bot.topeCreditos),
    maxUnidades: String(bot.maxUnidades),
    maxMonto: String(bot.maxMonto),
  }
}

/** Solo dígitos: lo que queda de lo que se tipeó en un campo numérico. */
export const soloDigitos = (v: string): string => v.replace(/[^0-9]/g, '')

export interface RevisionDelFormulario {
  /** El tope del cupo es un entero de 0 en adelante, o vacío (sin tope). */
  topeValido: boolean
  /** Unidades entre 1 y 1000, monto desde $1.000 (lo mismo que valida la API). */
  topesValidos: boolean
  hayCambios: boolean
  /** Lo que hay que mandar a la API para guardar el formulario. */
  cambios: OrbiCanalCambios
}

export function revisarFormulario(f: FormularioDeOrbi, bot: OrbiCanalEstado): RevisionDelFormulario {
  const tope = f.tope.trim() === '' ? null : Number(f.tope)
  const topeValido = tope === null || (Number.isInteger(tope) && tope >= 0)
  const unidades = Number(f.maxUnidades)
  const monto = Number(f.maxMonto)
  const topesValidos = Number.isInteger(unidades) && unidades >= 1 && unidades <= 1000 && Number.isInteger(monto) && monto >= 1000
  const instrucciones = f.instrucciones.trim() || null
  const cambioTopes = unidades !== bot.maxUnidades || monto !== bot.maxMonto
  const hayCambios = instrucciones !== (bot.instrucciones ?? null) || tope !== bot.topeCreditos || cambioTopes
  return {
    topeValido,
    topesValidos,
    hayCambios,
    cambios: { instrucciones, topeCreditos: tope, ...(cambioTopes ? { maxUnidades: unidades, maxMonto: monto } : {}) },
  }
}

/** Cómo va el cupo del mes, en una frase. El cupo es uno para WhatsApp e Instagram: si el otro canal gastó, se dice. */
export function textoDelCupo(cupo: OrbiCanalEstado['cupo'], otroCanal: 'WhatsApp' | 'Instagram'): string {
  const n = (x: number) => x.toLocaleString('es-AR')
  const otro = cupo.otrosCanales && cupo.otrosCanales > 0 ? ` ${otroCanal} usó ${n(cupo.otrosCanales)} del mismo cupo.` : ''
  return `Usaste ${n(cupo.usados)} de ${n(cupo.limite)} créditos (${cupo.porcentaje}%).${otro}`
}
