// La ventana de la agenda (62 días para cada lado) no entra en un solo pedido del listado: la API
// acepta hasta 93 días por vez. Encontrado al probar el panel contra el negocio de prueba (16/11).
import { describe, expect, it, vi } from 'vitest'
import { sumarDias } from '@/lib/reservas/fechas'

const agenda = vi.fn()
vi.mock('@/lib/reservasApi/cliente', () => ({ panel: { agenda: (f: unknown) => agenda(f) } }))

const { DIAS_POR_PEDIDO, VENTANA_DIAS, reservasEntre, tramosDeFechas } = await import('../api')

const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000) + 1

describe('la agenda de la API en tramos', () => {
  it('cubre la ventana entera, sin huecos ni días repetidos, de a 90 días como mucho', () => {
    const hoy = '2026-11-16'
    const tramos = tramosDeFechas(sumarDias(hoy, -VENTANA_DIAS), sumarDias(hoy, VENTANA_DIAS))
    expect(tramos).toHaveLength(2)
    expect(tramos[0][0]).toBe(sumarDias(hoy, -VENTANA_DIAS))
    expect(tramos.at(-1)?.[1]).toBe(sumarDias(hoy, VENTANA_DIAS))
    for (const [i, [d, h]] of tramos.entries()) {
      expect(dias(d, h)).toBeLessThanOrEqual(DIAS_POR_PEDIDO)
      if (i > 0) expect(d).toBe(sumarDias(tramos[i - 1][1], 1))
    }
    expect(tramosDeFechas('2026-11-16', '2026-11-16')).toEqual([['2026-11-16', '2026-11-16']])
  })

  it('pide cada tramo con todas sus páginas y junta todo', async () => {
    agenda.mockImplementation(async (f: { desde: string; page: number }) => {
      const total = f.desde < '2026-11-01' ? 150 : 20
      const data = Array.from({ length: Math.min(100, total - (f.page - 1) * 100) }, (_, i) => ({ id: `${f.desde}-${f.page}-${i}` }))
      return { data, total }
    })
    const reservas = await reservasEntre('2026-09-15', '2027-01-17')
    expect(reservas).toHaveLength(170)
    for (const [f] of agenda.mock.calls) expect(dias(f.desde, f.hasta)).toBeLessThan(93)
  })
})
