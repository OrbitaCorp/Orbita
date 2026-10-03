// P2.4 — Mis turnos, con cuenta de cliente. Rutas: /api/v1/me/appointments/...
// Van con la sesión del cliente (mismo camino que /me/orders: panelRequest manda
// el token que tenga la pestaña y lo renueva si vence). Un id ajeno es 404.
import { panelRequest } from '@/lib/api'
import { conCuerpo, qs, seg } from './http'
import type { DisponibilidadDiaDto, DisponibilidadMiTurnoQuery, DisponibilidadRangoDto, Fecha, MiCuentaTurnosDto, MiTurnoDto, RescheduleDto } from './tipos'

const M = '/me/appointments'

export const getMyAccountAppointments = () => panelRequest<MiCuentaTurnosDto>(M)
/** `kind`: si el id es de una inscripción a una clase. */
export const cancelMyAccountAppointment = (id: string, body: { reason?: string; kind?: 'appointment' | 'class' } = {}) =>
  panelRequest<MiTurnoDto>(`${M}/${seg(id)}/cancel`, conCuerpo('POST', body))
export const getMyAccountAvailability = <Q extends DisponibilidadMiTurnoQuery>(id: string, q: Q) =>
  panelRequest<Q extends { date: Fecha } ? DisponibilidadDiaDto : DisponibilidadRangoDto>(`${M}/${seg(id)}/availability${qs({ ...q })}`)
export const rescheduleMyAccountAppointment = (id: string, dto: RescheduleDto) =>
  panelRequest<MiTurnoDto>(`${M}/${seg(id)}/reschedule`, conCuerpo('POST', dto))
