// El sitio de un negocio real de Turnos sobre la API pública de reservas
// (/storefront/:slug/reservas, sin sesión). Semana 4 del plan de Turnos.
//
// Qué trae y de dónde:
//   servicios   los que el negocio ofrece online, con su duración y su precio
//   agendas     las del modo del rubro (profesionales o espacios)
//   horario     el del negocio (la config pública); la seña y la política, también de ahí
//   días        cuántos lugares hay cada día (disponibilidad/rango), por agenda
//   horarios    los libres de un día (disponibilidad), pedidos cuando se mira ese día
//   reservar    retener el horario y confirmarlo con los datos de la persona, con una
//               clave por intento: repetir el pedido devuelve la misma reserva
//
// Con "Cualquiera" se pregunta a todas las agendas y gana la primera libre.
// La demo (/turnos-demo) no usa nada de esto: arma todo con los datos de ejemplo.
import { createContext, createElement, useContext, type ReactNode } from 'react'
import { sitio } from '@/lib/reservasApi/cliente'
import { sumarDias as sumarIso, type ISO } from '@/lib/reservas/fechas'
import type { Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { PoliticaReserva } from '@/modules/turnos/datos/negocio'
import type { Semana } from '@/modules/turnos/horario'
import { ahoraArgentina, recursoDeApi, semanaDeHorario, tipoDeAgenda } from '@/modules/turnos/datos/origen/mapear'
import { leerDatos } from '@/modules/turnos/datos/origen/datosConfig'

/** Un horario de un día: libre si alguna agenda pedida lo tiene, con la primera que lo tiene. */
export interface HorarioLibre { m: number; libre: boolean; recursoId: string | null }

export interface ReservaHecha { codigo: string; token: string; estado: 'RETENIDA' | 'PENDIENTE' | 'CONFIRMADA' | string; precio: number; sena: number }

export interface SitioApi {
  slug: string
  /** El rubro con los servicios y la seña del negocio en lugar de los de ejemplo. */
  rubro: RubroTurnos
  /** El id de cada servicio de `rubro.servicios`, en el mismo orden. */
  servicioIds: string[]
  recursos: Recurso[]
  semana: Semana
  hoy: ISO
  minutos: number
  /** La política de la config: plazo para cancelar y, si el negocio la puso, tolerancia y seña fuera de plazo. */
  politica: Partial<PoliticaReserva> & { cancelaHasta: number }
  /** Cuántos lugares hay cada día, desde `desde`, sumando las agendas pedidas. */
  rango(recursoIds: string[], servicioId: string, desde: ISO, dias: number): Promise<Map<ISO, { libres: number; cerrado: boolean }>>
  horarios(recursoIds: string[], servicioId: string, fecha: ISO): Promise<HorarioLibre[]>
  reservar(p: { recursoId: string; servicioId: string; fecha: ISO; inicio: number; clave: string; nombre: string; telefono?: string; email?: string; notas?: string }): Promise<ReservaHecha>
}

export async function cargarSitio(slug: string, rubro: RubroTurnos): Promise<SitioApi> {
  const api = sitio(slug)
  const [config, servicios, recursos] = await Promise.all([api.config('TURNOS'), api.servicios('TURNOS'), api.recursos('TURNOS')])
  const semana = semanaDeHorario(config.horario)
  const { hoy, minutos } = ahoraArgentina()
  const activos = servicios.filter(s => s.activo !== false && s.reservableOnline !== false).sort((a, b) => a.orden - b.orden)
  const tipo = tipoDeAgenda(rubro)
  const agendas = recursos.filter(r => r.tipo === tipo).sort((a, b) => a.orden - b.orden).map((r, i) => recursoDeApi(r, rubro, semana, i))
  const publico = leerDatos({ publico: (config as { publico?: unknown }).publico }).publico

  return {
    slug, semana, hoy, minutos, recursos: agendas,
    rubro: { ...rubro, sena: config.senaPorcentaje, servicios: activos.map(s => ({ nombre: s.nombre, duracion: s.duracionMinutos, precio: s.precio })) },
    servicioIds: activos.map(s => s.id),
    politica: {
      cancelaHasta: config.cancelacionHastaHoras,
      ...(publico.tolerancia !== undefined ? { tolerancia: publico.tolerancia } : {}),
      ...(publico.senaFueraDePlazo ? { senaFueraDePlazo: publico.senaFueraDePlazo } : {}),
    },
    async rango(recursoIds, servicioId, desde, dias) {
      const hasta = sumarIso(desde, dias - 1)
      const porAgenda = await Promise.all(recursoIds.map(recursoId => api.disponibilidadRango({ modulo: 'TURNOS', recursoId, servicioId, desde, hasta })))
      const out = new Map<ISO, { libres: number; cerrado: boolean }>()
      for (const r of porAgenda) for (const d of r.dias) {
        const antes = out.get(d.fecha)
        out.set(d.fecha, { libres: (antes?.libres ?? 0) + d.libres, cerrado: (antes?.cerrado ?? true) && d.cerrado })
      }
      return out
    },
    async horarios(recursoIds, servicioId, fecha) {
      const porAgenda = await Promise.all(recursoIds.map(recursoId => api.disponibilidad({ modulo: 'TURNOS', recursoId, servicioId, fecha })))
      const out = new Map<number, HorarioLibre>()
      for (const d of porAgenda) for (const f of d.franjas) {
        const antes = out.get(f.inicioMinutos)
        if (!antes) out.set(f.inicioMinutos, { m: f.inicioMinutos, libre: f.libres > 0, recursoId: f.libres > 0 ? d.recursoId : null })
        else if (!antes.libre && f.libres > 0) out.set(f.inicioMinutos, { m: f.inicioMinutos, libre: true, recursoId: d.recursoId })
      }
      return [...out.values()].sort((a, b) => a.m - b.m)
    },
    async reservar(p) {
      const retenida = await api.retener({ modulo: 'TURNOS', recursoId: p.recursoId, servicioId: p.servicioId, fecha: p.fecha, inicioMinutos: p.inicio, clave: p.clave })
      const cliente = { nombre: p.nombre, ...(p.telefono ? { telefono: p.telefono } : {}), ...(p.email ? { email: p.email } : {}) }
      // Si ya estaba confirmada (el mismo intento repetido), la retención devuelve la reserva tal cual.
      const r = retenida.estado === 'RETENIDA' ? await api.confirmar(retenida.token, { cliente, ...(p.notas ? { notas: p.notas } : {}) }) : retenida
      return { codigo: r.codigo, token: r.token ?? retenida.token, estado: r.estado, precio: r.precio, sena: r.sena }
    },
  }
}

const Contexto = createContext<string | null>(null)

/** El sitio de un negocio real monta la reserva adentro de este proveedor con su subdominio. */
export function SitioApiProvider({ slug, children }: { slug: string; children: ReactNode }) {
  return createElement(Contexto.Provider, { value: slug }, children)
}

export const useSlugSitio = () => useContext(Contexto)
