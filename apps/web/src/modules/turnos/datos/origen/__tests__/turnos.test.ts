// Lo que el panel hace con un turno, sobre /reservas (semana 3 del plan de Turnos).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reserva } from '@/lib/reservasApi/tipos'

const crear = vi.fn()
const confirmar = vi.fn()
const completar = vi.fn()
const ausente = vi.fn()
const cancelar = vi.fn()
const reprogramar = vi.fn()
const detalle = vi.fn()
const pago = vi.fn()
vi.mock('@/lib/reservasApi/cliente', () => ({
  claveDeIntento: () => 'clave-1',
  panel: {
    crear: (d: unknown) => crear(d), confirmar: (id: string) => confirmar(id), completar: (id: string) => completar(id), ausente: (id: string) => ausente(id),
    cancelar: (id: string) => cancelar(id), reprogramar: (id: string, d: unknown) => reprogramar(id, d), detalle: (id: string) => detalle(id), pago: (id: string, d: unknown) => pago(id, d),
  },
}))
const { origenApi } = await import('../api')
const { ahoraArgentina } = await import('../mapear')
const { sumarDias } = await import('@/lib/reservas/fechas')
const turnos = origenApi.turnos!

const { hoy } = ahoraArgentina()
const manana = sumarDias(hoy, 1)
const reserva = (p: Partial<Reserva> = {}): Reserva => ({
  id: 'r1', modulo: 'TURNOS', recursoId: 'rec1', servicioId: 's1', codigo: 'ABCDEF', estado: 'CONFIRMADA', origen: 'PANEL',
  inicio: '', fin: '', fecha: manana, inicioMinutos: 600, finMinutos: 630, cantidad: 1, clienteId: null, clienteNombre: 'Juan Pérez',
  clienteTelefono: '11 0000-0100', clienteEmail: null, notas: null, notaInterna: null, servicio: { id: 's1', nombre: 'Corte', duracionMinutos: 30, precio: 12000 },
  extras: null, precio: 12000, sena: 3600, pagado: 0, pagoMetodo: null, confirmadaEn: null, completadaEn: null, canceladaEn: null, canceladaPor: null,
  motivoCancelacion: null, reprogramaciones: 0, version: 1, creadaPorMemberId: null, createdAt: '', updatedAt: '', ...p,
} as unknown as Reserva)
const turno = { recursoId: 'rec1', clienteId: 'tel:1100000100', servicio: 'Corte', inicio: 600, duracion: 30, precio: 12000, estado: 'confirmado' as const, dia: 1, nota: 'Trae la foto' }

beforeEach(() => vi.clearAllMocks())

describe('dar un turno', () => {
  it('a alguien sin ficha va con sus datos, con clave de intento y la nota interna', async () => {
    crear.mockResolvedValue(reserva())
    const t = await turnos.crear(turno, { id: 'tel:1100000100', nombre: 'Juan Pérez', telefono: '11 0000-0100' }, 's1')
    expect(crear).toHaveBeenCalledWith({
      modulo: 'TURNOS', recursoId: 'rec1', servicioId: 's1', fecha: manana, inicioMinutos: 600, estado: 'CONFIRMADA', clave: 'clave-1',
      cliente: { nombre: 'Juan Pérez', telefono: '11 0000-0100' }, notaInterna: 'Trae la foto',
    })
    expect(t).toMatchObject({ id: 'r1', dia: 1, inicio: 600, estado: 'confirmado' })
  })
  it('a alguien con ficha va por su id', async () => {
    crear.mockResolvedValue(reserva({ clienteId: 'cust-1' }))
    await turnos.crear({ ...turno, estado: 'pendiente' }, { id: 'cust-1', nombre: 'Juan' })
    expect(crear.mock.calls[0][0]).toMatchObject({ clienteId: 'cust-1', estado: 'PENDIENTE' })
    expect(crear.mock.calls[0][0]).not.toHaveProperty('cliente')
  })
})

describe('cambiar un turno', () => {
  it('cada estado va a su acción', async () => {
    confirmar.mockResolvedValue(reserva())
    completar.mockResolvedValue(reserva({ estado: 'COMPLETADA' }))
    ausente.mockResolvedValue(reserva({ estado: 'AUSENTE' }))
    expect((await turnos.estado('r1', 'confirmado')).estado).toBe('confirmado')
    expect((await turnos.estado('r1', 'completado')).estado).toBe('completado')
    expect((await turnos.estado('r1', 'ausente')).estado).toBe('ausente')
    await expect(turnos.estado('r1', 'en-curso')).rejects.toThrow('no se hace a mano')
  })
  it('cancelar vuelve a leer la reserva', async () => {
    cancelar.mockResolvedValue({ sena: 'DEVUELTA' })
    detalle.mockResolvedValue(reserva({ estado: 'CANCELADA' }))
    expect((await turnos.estado('r1', 'cancelado')).estado).toBe('cancelado')
    expect(detalle).toHaveBeenCalledWith('r1')
  })
  it('mover reprograma con la fecha del día pedido', async () => {
    reprogramar.mockResolvedValue(reserva({ fecha: sumarDias(hoy, 3), inicioMinutos: 960, finMinutos: 990 }))
    const t = await turnos.mover('r1', 3, 960)
    expect(reprogramar).toHaveBeenCalledWith('r1', { fecha: sumarDias(hoy, 3), inicioMinutos: 960 })
    expect(t).toMatchObject({ dia: 3, inicio: 960 })
  })
  it('la seña registra solo lo que falta', async () => {
    detalle.mockResolvedValue(reserva({ sena: 3600, pagado: 1000 }))
    pago.mockResolvedValue(reserva({ sena: 3600, pagado: 3600 }))
    expect((await turnos.sena('r1')).senaPagada).toBe(true)
    expect(pago).toHaveBeenCalledWith('r1', { monto: 2600, metodo: 'OTRO', referencia: 'Seña registrada desde el panel' })
  })
})
