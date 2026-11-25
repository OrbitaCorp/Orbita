import { describe, expect, it } from 'vitest'
import { NEGOCIOS_DEMO, type NegocioAlquiler } from '../index'
import { hace, leerPesos, linkWhatsApp, milesTxt, plazoTxt, politicaCancelacion, senaAlCancelar, textoBloqueo } from '../textos'

const con = ({ pagos, ...n }: Omit<Partial<NegocioAlquiler>, 'pagos'> & { pagos?: Partial<NegocioAlquiler['pagos']> }): NegocioAlquiler => ({
  ...NEGOCIOS_DEMO.estadia, ...n, pagos: { ...NEGOCIOS_DEMO.estadia.pagos, ...pagos },
})

describe('plazoTxt', () => {
  it('en días si son 24 horas o más, en horas si no', () => {
    expect(plazoTxt(7 * 24)).toBe('7 días')
    expect(plazoTxt(24)).toBe('1 día')
    expect(plazoTxt(6)).toBe('6 horas')
  })
})

describe('política de cancelación', () => {
  it('dice lo mismo que está configurado en Pagos y señas, a tiempo y tarde', () => {
    const n = con({ senaPct: 30, cancelaHastaHoras: 7 * 24, pagos: { cancelaATiempo: 'devolver', cancelaTarde: 'mitad' } })
    expect(politicaCancelacion(n)).toBe('Si cancelás hasta 7 días antes, se devuelve la seña entera. Después, se devuelve la mitad de la seña.')
    expect(senaAlCancelar(n, true)).toBe('se devuelve la seña entera')
    expect(senaAlCancelar(n, false)).toBe('se devuelve la mitad de la seña')
  })
  it('con crédito o pérdida, lo dice así', () => {
    const n = con({ senaPct: 50, cancelaHastaHoras: 24, pagos: { cancelaATiempo: 'credito', cancelaTarde: 'pierde' } })
    expect(politicaCancelacion(n)).toBe('Si cancelás hasta 1 día antes, la seña queda como crédito para otra reserva. Después, se pierde la seña.')
  })
  it('sin seña, solo el plazo', () => {
    expect(politicaCancelacion(con({ senaPct: 0, cancelaHastaHoras: 48 }))).toBe('Podés cancelar sin cargo hasta 2 días antes.')
  })
})

describe('textoBloqueo', () => {
  it('en canchas y salones, el último día que se muestra es el último bloqueado (el fin se guarda sin incluir)', () => {
    expect(textoBloqueo('2026-11-25', '2026-11-27', 'bloque')).toBe('25 al 26 de noviembre')
    expect(textoBloqueo('2026-11-25', '2026-11-26', 'cancha')).toBe('mié 25 nov')
  })
  it('en la estadía, como las noches: del día que entra al que sale', () => {
    expect(textoBloqueo('2026-11-25', '2026-11-27', 'estadia')).toBe('25 al 27 de noviembre')
  })
})

describe('linkWhatsApp', () => {
  it('arma el link de wa.me con el 549 de un celular argentino', () => {
    expect(linkWhatsApp('3757 55-0101')).toBe('https://wa.me/5493757550101')
    expect(linkWhatsApp('03757 55-0101')).toBe('https://wa.me/5493757550101')
    expect(linkWhatsApp('+54 9 3757 55-0101')).toBe('https://wa.me/5493757550101')
    expect(linkWhatsApp('54 3757 550101')).toBe('https://wa.me/5493757550101')
  })
  it('lleva el mensaje armado', () => {
    expect(linkWhatsApp('3757550101', 'Hola Ana')).toBe('https://wa.me/5493757550101?text=Hola%20Ana')
  })
  it('sin teléfono no hay link', () => {
    expect(linkWhatsApp('')).toBeNull()
    expect(linkWhatsApp('—')).toBeNull()
  })
})

describe('montos', () => {
  it('milesTxt pone el punto de los miles', () => {
    expect(milesTxt(120000)).toBe('120.000')
    expect(milesTxt(0)).toBe('0')
    expect(milesTxt(1500)).toBe('1.500')
  })
  it('leerPesos se queda con los dígitos', () => {
    expect(leerPesos('120.000')).toBe(120000)
    expect(leerPesos('$ 1.500')).toBe(1500)
    expect(leerPesos('')).toBe(0)
  })
})

describe('hace', () => {
  const ahora = Date.parse('2026-11-25T15:00:00.000Z')
  const antes = (min: number) => new Date(ahora - min * 60_000).toISOString()
  it('dice hace cuánto fue, en la unidad que se entiende de un vistazo', () => {
    expect(hace(antes(0), ahora)).toBe('recién')
    expect(hace(antes(1), ahora)).toBe('recién')
    expect(hace(antes(12), ahora)).toBe('hace 12 min')
    expect(hace(antes(59), ahora)).toBe('hace 59 min')
    expect(hace(antes(60), ahora)).toBe('hace 1 h')
    expect(hace(antes(3 * 60 + 20), ahora)).toBe('hace 3 h')
    expect(hace(antes(47 * 60), ahora)).toBe('hace 47 h')
    expect(hace(antes(48 * 60), ahora)).toBe('hace 2 días')
  })
  it('sin fecha, o con una que no se entiende, todavía no pasó', () => {
    expect(hace(undefined, ahora)).toBe('todavía no se sincronizó')
    expect(hace('no es una fecha', ahora)).toBe('todavía no se sincronizó')
  })
  it('un reloj adelantado no da tiempos negativos', () => {
    expect(hace(new Date(ahora + 5 * 60_000).toISOString(), ahora)).toBe('recién')
  })
})
