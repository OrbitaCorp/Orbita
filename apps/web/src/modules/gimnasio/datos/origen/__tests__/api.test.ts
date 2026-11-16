// Las acciones del panel de Gimnasio sobre la API: qué ruta se llama para cada
// cosa que se hace en pantalla, en qué orden, qué se avisa y que después de
// cada una (salga bien o mal) se vuelve a leer. Con un cliente falso: nada
// viaja a la red.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/authClient', () => ({ authedFetch: vi.fn() }))

import type { FiltroAgenda, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { negocioDe, rubroPorKey, type ClaseSemanal, type NegocioGym, type Socio } from '../../index'
import { accionesApi, reservasEntre, type DepsAcciones } from '../api'

const recurso = (over: Partial<Recurso> = {}): Recurso => ({
  id: 'r1', modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null, margenMinutos: null,
  maximoSeguidos: 1, precio: 0, horario: { '1': [[1140, 1200]] }, orden: 0, activo: true,
  datos: { gimnasio: { actividadId: 'a1', color: '#7C3AED', profeId: 'p1', profe: 'Nico', sala: 'Box' } },
  ...over,
})
const clase = (over: Partial<ClaseSemanal> = {}): ClaseSemanal => ({ id: 'r1', actividadId: 'a1', dia: 0, inicio: 1140, profeId: 'p1', sala: 'Box', cupo: 12, ...over })
const socio: Socio = { id: 'tel:37550101', nombre: 'Lu Paz', telefono: '3757 55-0101', planId: null, desde: null, vence: null, clasesRestantes: null, probo: true }
const reservaDeVuelta = (over: Partial<Reserva> = {}) => ({ id: 'res-1', clienteNombre: 'Lu Paz', ...over }) as Reserva

function armar(over: { recursos?: Recurso[]; clases?: ClaseSemanal[]; negocio?: Partial<NegocioGym> } = {}) {
  const recursos = over.recursos ?? [recurso(), recurso({ id: 'r2', horario: { '1': [[600, 660]], '3': [[600, 660]] } })]
  const negocio: NegocioGym = {
    ...negocioDe(rubroPorKey('crossfit')),
    actividades: [{ id: 'a1', nombre: 'WOD', duracion: 60, cupo: 12, color: '#7C3AED' }],
    profes: [{ id: 'p1', nombre: 'Nico', color: '#1D4ED8', actividades: ['a1'] }],
    clases: over.clases ?? [clase(), clase({ id: 'r2~0-600', inicio: 600 }), clase({ id: 'r2~2-600', dia: 2, inicio: 600 })],
    bloqueos: [{ id: 'b1', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado', origen: 'dueno' }],
    ...over.negocio,
  }
  const cliente = {
    crearRecurso: vi.fn(async () => recurso({ id: 'nuevo' })),
    editarRecurso: vi.fn(async (id: string) => recurso({ id })),
    borrarRecurso: vi.fn(async () => ({ ok: true as const })),
    crearBloqueo: vi.fn(async () => ({ id: 'b-n', inicio: '', fin: '', afectadas: 2 })),
    borrarBloqueo: vi.fn(async () => ({ ok: true as const })),
    crear: vi.fn(async () => reservaDeVuelta()),
    completar: vi.fn(async () => reservaDeVuelta({ estado: 'COMPLETADA' })),
    ausente: vi.fn(async () => reservaDeVuelta({ estado: 'AUSENTE' })),
    cancelar: vi.fn(async () => ({ ...reservaDeVuelta({ estado: 'CANCELADA' }), sena: 'SIN_SENA' as const, promovida: null as Reserva | null })),
    anotarEnEspera: vi.fn(async () => ({ id: 'e9', posicion: 3 }) as never),
    darLugar: vi.fn(async () => reservaDeVuelta()),
    quitarDeEspera: vi.fn(async () => ({ ok: true as const })),
  }
  const recargar = vi.fn()
  const deps: DepsAcciones = { cliente, recursos, negocio, socios: [socio], recargar, clave: () => 'clave-fija' }
  return { acciones: accionesApi(deps), cliente, recargar, negocio }
}

describe('Gimnasio sobre la API · la grilla', () => {
  it('una clase nueva crea su recurso; una cambiada edita el suyo; una quitada lo borra si era su única sesión', async () => {
    const { acciones, cliente, recargar, negocio } = armar()
    const nueva = clase({ id: 'k-nueva', dia: 4, inicio: 480 })
    // r1 sube el cupo, r2~0-600 queda igual, r2~2-600 se quita y entra una nueva el viernes.
    await acciones.configurar({ clases: [{ ...negocio.clases[0], cupo: 15 }, negocio.clases[1], nueva] })
    expect(cliente.crearRecurso).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'CLASE', nombre: 'WOD', horario: { '5': [[480, 540]] } }))
    expect(cliente.editarRecurso).toHaveBeenCalledWith('r1', expect.objectContaining({ cupo: 15, horario: { '1': [[1140, 1200]] } }))
    // r2 tenía dos sesiones: se le saca la del miércoles, no se borra.
    expect(cliente.editarRecurso).toHaveBeenCalledWith('r2', { modulo: 'GIMNASIO', tipo: 'CLASE', nombre: 'WOD', horario: { '1': [[600, 660]] } })
    expect(cliente.borrarRecurso).not.toHaveBeenCalled()
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('quitar la única sesión de un recurso lo borra', async () => {
    const { acciones, cliente, negocio } = armar()
    await acciones.configurar({ clases: negocio.clases.filter(c => c.id !== 'r1') })
    expect(cliente.borrarRecurso).toHaveBeenCalledWith('r1')
  })

  it('si la API dice que no, el error sube con su mensaje, lo que sigue no se manda y se vuelve a leer igual', async () => {
    const { acciones, cliente, recargar, negocio } = armar()
    cliente.borrarRecurso.mockRejectedValueOnce(new Error('Tiene 3 reservas por delante. Movelas o cancelalas antes de borrarlo.'))
    await expect(acciones.configurar({ clases: negocio.clases.filter(c => c.id !== 'r1') })).rejects.toThrow(/3 reservas por delante/)
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('lo que no es la grilla ni los días sin clases no se manda: esas secciones todavía no guardan en la API', async () => {
    const { acciones, cliente, recargar } = armar()
    await expect(acciones.configurar({ planes: [] })).rejects.toThrow(/todavía no guarda en la API/)
    expect(cliente.crearRecurso).not.toHaveBeenCalled()
    expect(recargar).toHaveBeenCalledTimes(1)
  })
})

describe('Gimnasio sobre la API · días sin clases', () => {
  it('los nuevos se crean con el último día incluido, los quitados se borran y se avisa cuántas reservas quedaron adentro', async () => {
    const { acciones, cliente } = armar()
    const r = await acciones.configurar({ bloqueos: [{ id: 'bn', desde: '2026-12-24', hasta: '2026-12-26', motivo: 'Navidad', origen: 'dueno' }] })
    expect(cliente.crearBloqueo).toHaveBeenCalledWith({ modulo: 'GIMNASIO', fechaDesde: '2026-12-24', fechaHasta: '2026-12-25', motivo: 'Navidad' })
    expect(cliente.borrarBloqueo).toHaveBeenCalledWith('b1')
    expect(r.detalle).toBe('2 reservas quedan adentro: no se cancelan solas, avisales.')
  })
})

describe('Gimnasio sobre la API · anotar, la espera, presente y ausente', () => {
  it('anotar es una reserva confirmada con la clave del intento; con la clase llena, la espera dice el lugar en la fila', async () => {
    const { acciones, cliente } = armar()
    await acciones.inscribir({ id: 'n1', claseId: 'r2~0-600', fecha: '2026-11-16', socioId: socio.id, estado: 'reservada', creada: '2026-11-15', planId: null, cantidad: 2 })
    expect(cliente.crear).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r2', fecha: '2026-11-16', inicioMinutos: 600, cantidad: 2, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' }, estado: 'CONFIRMADA', clave: 'clave-fija' })
    const r = await acciones.inscribir({ id: 'n2', claseId: 'r1', fecha: '2026-11-16', socioId: socio.id, estado: 'espera', creada: '2026-11-15', planId: null })
    expect(cliente.anotarEnEspera).toHaveBeenCalledWith({ modulo: 'GIMNASIO', recursoId: 'r1', fecha: '2026-11-16', inicioMinutos: 1140, cliente: { nombre: 'Lu Paz', telefono: '3757 55-0101' } })
    expect(r.detalle).toBe('Está en el lugar 3 de la lista.')
  })

  it('alguien nuevo se anota con los datos que se cargaron', async () => {
    const { acciones, cliente } = armar()
    const nueva: Socio = { ...socio, id: 'sn-1', nombre: 'Sol Ríos', telefono: '11 4444-0000' }
    await acciones.inscribir({ id: 'n3', claseId: 'r1', fecha: '2026-11-16', socioId: 'sn-1', estado: 'reservada', creada: '2026-11-15', planId: null }, nueva)
    expect(cliente.crear).toHaveBeenCalledWith(expect.objectContaining({ cliente: { nombre: 'Sol Ríos', telefono: '11 4444-0000' }, cantidad: 1 }))
  })

  it('presente es completar, faltó es ausente y darle el lugar a quien espera es su ruta propia', async () => {
    const { acciones, cliente } = armar()
    await acciones.cambiarInscripcion('res-1', { estado: 'asistio' })
    await acciones.cambiarInscripcion('res-2', { estado: 'ausente' })
    await acciones.cambiarInscripcion('espera:e1', { estado: 'reservada' })
    expect(cliente.completar).toHaveBeenCalledWith('res-1')
    expect(cliente.ausente).toHaveBeenCalledWith('res-2')
    expect(cliente.darLugar).toHaveBeenCalledWith('e1')
    await expect(acciones.cambiarInscripcion('res-1', { estado: 'reservada' })).rejects.toThrow(/todavía no se guarda/)
  })

  it('liberar un lugar cancela la reserva y avisa si alguien pasó de la espera; sacar de la espera es quitarla', async () => {
    const { acciones, cliente } = armar()
    cliente.cancelar.mockResolvedValueOnce({ ...reservaDeVuelta({ estado: 'CANCELADA' }), sena: 'SIN_SENA', promovida: reservaDeVuelta({ id: 'res-9', clienteNombre: 'Sol Ríos' }) })
    const r = await acciones.cancelar('res-1')
    expect(cliente.cancelar).toHaveBeenCalledWith('res-1', { motivo: 'Lugar liberado desde el panel.' })
    expect(r.detalle).toBe('Sol pasó de la lista de espera y ya tiene su lugar.')
    await acciones.cancelar('espera:e7')
    expect(cliente.quitarDeEspera).toHaveBeenCalledWith('e7')
  })

  it('una clase que ya no está en la grilla no se reserva a ciegas', async () => {
    const { acciones, cliente } = armar()
    await expect(acciones.inscribir({ id: 'n4', claseId: 'r-borrada', fecha: '2026-11-16', socioId: socio.id, estado: 'reservada', creada: '2026-11-15', planId: null })).rejects.toThrow(/ya no está en la grilla/)
    expect(cliente.crear).not.toHaveBeenCalled()
  })
})

describe('Gimnasio sobre la API · la lectura', () => {
  it('una ventana larga se pide en tramos de hasta 90 días y cada tramo, en todas sus páginas', async () => {
    const agenda = vi.fn(async (f: FiltroAgenda = {}) => {
      const total = f.desde === '2026-10-01' ? 150 : 2
      const resto = total - ((f.page ?? 1) - 1) * 100
      return { data: Array.from({ length: Math.max(0, Math.min(100, resto)) }, (_, i) => ({ id: `${f.desde}-${f.page}-${i}` }) as Reserva), total, page: f.page ?? 1, limit: 100 }
    })
    const todas = await reservasEntre({ agenda }, { desde: '2026-10-01', hasta: '2027-01-15' })
    expect(agenda.mock.calls.map(([f]) => [f?.desde, f?.hasta, f?.page])).toEqual([
      ['2026-10-01', '2026-12-29', 1],
      ['2026-10-01', '2026-12-29', 2],
      ['2026-12-30', '2027-01-15', 1],
    ])
    expect(todas).toHaveLength(152)
  })
})
