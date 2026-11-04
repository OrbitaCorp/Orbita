import { describe, expect, it } from 'vitest'
import { agruparNoches, chocaRango, cumpleMinimo, motivoNoReservable, motivoNoReservableMes, nocheDeFinDeSemana, nochesDe, nochesEntre, precioEstadia, precioMensual, primeraEntradaLibre, salidaDeMeses, salidaMaxima, temporadaDe, type TarifaEstadia, type TarifaMensual } from '../estadia'

const tarifa: TarifaEstadia = {
  precioNoche: 60000,
  temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-20', hasta: '2027-02-28', precioNoche: 95000 }],
  finDeSemanaPct: 20,
  limpieza: 25000,
  minNoches: 2,
}

describe('estadía', () => {
  it('cuenta noches sin incluir la salida', () => {
    expect(nochesEntre('2026-11-14', '2026-11-16')).toBe(2)
    expect(nochesDe('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15'])
    expect(cumpleMinimo('2026-11-14', '2026-11-15', 2)).toBe(false)
  })

  it('dos estadías pueden tocarse: la salida de una es la entrada de la otra', () => {
    const ocupadas = [{ entrada: '2026-11-16', salida: '2026-11-19', id: 'r1' }]
    expect(chocaRango('2026-11-14', '2026-11-16', ocupadas)).toBeNull()
    expect(chocaRango('2026-11-19', '2026-11-21', ocupadas)).toBeNull()
    expect(chocaRango('2026-11-15', '2026-11-17', ocupadas)?.id).toBe('r1')
    expect(chocaRango('2026-11-17', '2026-11-18', ocupadas)?.id).toBe('r1')
  })

  it('desde una entrada, la salida máxima llega hasta la primera noche ocupada', () => {
    const ocupadas = [{ entrada: '2026-11-16', salida: '2026-11-19' }]
    expect(salidaMaxima('2026-11-14', ocupadas)).toBe('2026-11-16')
    expect(salidaMaxima('2026-11-17', ocupadas)).toBeNull()
    expect(salidaMaxima('2026-11-19', ocupadas, 3)).toBe('2026-11-22')
  })

  it('las noches de fin de semana son la del viernes y la del sábado, no la del domingo', () => {
    expect(nocheDeFinDeSemana('2026-11-12')).toBe(false) // jueves
    expect(nocheDeFinDeSemana('2026-11-13')).toBe(true) // viernes: se sale el sábado
    expect(nocheDeFinDeSemana('2026-11-14')).toBe(true) // sábado
    expect(nocheDeFinDeSemana('2026-11-15')).toBe(false) // domingo: se sale el lunes
    // Sin recargo configurado, ninguna noche se marca de fin de semana.
    const sinRecargo = precioEstadia('2026-11-13', '2026-11-15', { ...tarifa, finDeSemanaPct: 0 })
    expect(sinRecargo.noches.map(n => n.finDeSemana)).toEqual([false, false])
    expect(sinRecargo.subtotal).toBe(120000)
  })

  it('cobra por noche según temporada y fin de semana, más la limpieza', () => {
    // 13/11 (viernes, +20%), 14/11 (sábado, +20%), 15/11 (domingo, base)
    const p = precioEstadia('2026-11-13', '2026-11-16', tarifa)
    expect(p.noches.map(n => n.precio)).toEqual([72000, 72000, 60000])
    expect(p.subtotal).toBe(204000)
    expect(p.limpieza).toBe(25000)
    expect(p.total).toBe(229000)
    // En temporada alta manda el precio de la temporada.
    const alta = precioEstadia('2026-12-21', '2026-12-23', tarifa) // lunes y martes
    expect(alta.noches.map(n => n.precio)).toEqual([95000, 95000])
    expect(alta.noches[0].temporada).toBe('Temporada alta')
  })

  it('el recargo de fin de semana redondea bien a los cien (sin coma flotante)', () => {
    // Viernes 13/11 a $45.000 con +15 %: 51.750 → 51.800 (con × 1,15 daba 51.749,999… → 51.700).
    const p = precioEstadia('2026-11-13', '2026-11-14', { precioNoche: 45000, temporadas: [], finDeSemanaPct: 15, limpieza: 0, minNoches: 1 })
    expect(p.noches[0].precio).toBe(51800)
  })

  it('junta las noches por precio y por qué cuestan eso, en orden', () => {
    // 17/12 jueves (base), 18 viernes (+20), 19 sábado (+20), 20 domingo (alta), 21 lunes (alta)
    const p = precioEstadia('2026-12-17', '2026-12-22', tarifa)
    expect(agruparNoches(p.noches)).toEqual([
      { noches: 1, precio: 60000, temporada: null, finDeSemana: false },
      { noches: 2, precio: 72000, temporada: null, finDeSemana: true },
      { noches: 2, precio: 95000, temporada: 'Temporada alta', finDeSemana: false },
    ])
    // Los grupos suman el subtotal.
    expect(agruparNoches(p.noches).reduce((s, g) => s + g.noches * g.precio, 0)).toBe(p.subtotal)
    expect(agruparNoches([])).toEqual([])
  })

  it('si dos temporadas se pisan, manda la más corta (Carnaval adentro de la alta)', () => {
    const conCarnaval: TarifaEstadia = { ...tarifa, temporadas: [...tarifa.temporadas, { id: 'carnaval', nombre: 'Carnaval', desde: '2027-02-13', hasta: '2027-02-16', precioNoche: 120000 }] }
    expect(temporadaDe('2027-02-14', conCarnaval.temporadas)?.nombre).toBe('Carnaval')
    expect(temporadaDe('2027-02-20', conCarnaval.temporadas)?.nombre).toBe('Temporada alta')
    expect(temporadaDe('2026-11-14', conCarnaval.temporadas)).toBeNull()
  })

  it('explica por qué un rango no se puede reservar', () => {
    const ocupadas = [{ entrada: '2026-11-16', salida: '2026-11-19', tipo: 'bloqueo' as const }]
    expect(motivoNoReservable('2026-11-14', '2026-11-16', tarifa, ocupadas)).toBeNull()
    expect(motivoNoReservable('2026-11-14', '2026-11-15', tarifa, ocupadas)).toMatch(/mínima es de 2 noches/)
    expect(motivoNoReservable('2026-11-15', '2026-11-18', tarifa, ocupadas)).toMatch(/no están disponibles/)
    expect(motivoNoReservable('2026-11-16', '2026-11-14', tarifa, ocupadas)).toMatch(/después de la entrada/)
  })
})

describe('alquiler por mes', () => {
  const mensual: TarifaMensual = { precioMes: 520000, minMeses: 3, maxMeses: 12, deposito: 520000 }

  it('la salida es la misma fecha unos meses después, y el precio son los meses por el precio del mes', () => {
    expect(salidaDeMeses('2026-12-01', 3)).toBe('2027-03-01')
    const p = precioMensual('2026-12-01', 3, mensual)
    expect(p).toEqual({ meses: 3, precioMes: 520000, total: 1560000, deposito: 520000, entrada: '2026-12-01', salida: '2027-03-01' })
    // El depósito va aparte: no entra en el total.
    expect(p.total).toBe(3 * 520000)
  })

  it('respeta el mínimo y el máximo de meses y no pisa lo ocupado', () => {
    const ocupadas = [{ entrada: '2027-02-01', salida: '2027-05-01', id: 'r1', tipo: 'reserva' as const }]
    expect(motivoNoReservableMes('2026-12-01', 2, mensual, ocupadas)).toMatch(/mínimo es de 3 meses/)
    expect(motivoNoReservableMes('2026-12-01', 13, mensual, ocupadas)).toMatch(/máximo es de 12 meses/)
    expect(motivoNoReservableMes('2026-12-01', 3, mensual, ocupadas)).toMatch(/ya está alquilada/)
    // Dos alquileres pueden tocarse: uno sale el 1 de mayo y el otro entra ese día.
    expect(motivoNoReservableMes('2027-05-01', 3, mensual, ocupadas)).toBeNull()
    expect(motivoNoReservableMes('2026-11-01', 3, mensual, ocupadas)).toBeNull()
    expect(motivoNoReservableMes('2026-12-01', 3, mensual, [{ entrada: '2027-01-10', salida: '2027-01-20', tipo: 'bloqueo' }])).toMatch(/no está disponible/)
  })

  it('encuentra desde cuándo entra un alquiler entero', () => {
    const ocupadas = [{ entrada: '2026-11-01', salida: '2027-02-01' }]
    expect(primeraEntradaLibre('2026-11-14', 3, ocupadas)).toBe('2027-02-01')
    expect(primeraEntradaLibre('2027-03-01', 3, ocupadas)).toBe('2027-03-01')
    expect(primeraEntradaLibre('2026-11-14', 3, ocupadas, 30)).toBeNull()
  })
})
