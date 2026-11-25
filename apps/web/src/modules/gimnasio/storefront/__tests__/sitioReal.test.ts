// El sitio de un gimnasio real, dibujado en el servidor (sin navegador): qué
// muestra la portada y la reserva con lo que dice la API, que los links son
// los del negocio y que no aparece nada de la demo. Lo que pasa al tocar cada
// botón está en datos/origen/__tests__/sitio.test.ts (el flujo, sin React).
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ConfigPublica, Recurso } from '@/lib/reservasApi/tipos'
import type { GrillaApi } from '../../datos/origen/gimnasioApi'
import { RESERVA_INICIAL, diasDelSitio, negocioDelSitio, type ApiDelSitio, type CargaSitio, type EstadoDeReserva } from '../../datos/origen/sitio'
import { sesionesDe } from '../../datos/origen/mapear'
import { RelojProvider } from '../../datos/reloj'
import { inscripcionesDe, negocioDe, rubroPorKey, sociosDe } from '../../datos'
import Home from '../Home'
import HomeReal from '../HomeReal'
import ReservaReal from '../ReservaReal'
import SitioReal from '../SitioReal'
import { SitioProvider, rutaDelNegocio } from '../rutas'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

const HOY = '2026-11-25' // miércoles
const LUNES = '2026-11-30'

const config: ConfigPublica = {
  modulo: 'GIMNASIO', confirmacion: 'AUTOMATICA', retencionMinutos: 10, anticipacionMinimaMinutos: 30, anticipacionMaximaDias: 14, cancelacionHastaHoras: 2,
  reprogramacionHastaHoras: 2, reprogramacionesMaximas: 1, senaPorcentaje: 0, senaReembolsable: true, listaDeEspera: true,
  horario: { '1': [[420, 1320]], '3': [[420, 720], [960, 1320]] }, publico: null,
}
const recurso = (id: string, nombre: string, over: Partial<Recurso> = {}): Recurso => ({
  id, modulo: 'GIMNASIO', tipo: 'CLASE', nombre, descripcion: null, cupo: 12, duracionMinutos: 60, pasoMinutos: null, margenMinutos: null, maximoSeguidos: 1, precio: 0,
  horario: { '1': [[1140, 1200]] }, datos: { gimnasio: { actividadId: 'a1', color: '#2563EB', profeId: 'p1', profe: 'Nico', sala: 'Box' } }, orden: 0, activo: true, ...over,
})
const RECURSOS = [
  recurso('r-wod', 'WOD'),
  recurso('r-haltero', 'Halterofilia', { cupo: 3, horario: { '3': [[1080, 1140]] }, datos: { gimnasio: { actividadId: 'a3', color: '#059669', profeId: '', profe: '', sala: 'Box' } } }),
]
const PLANES = [
  { id: 'pl-prueba', tipo: 'PRUEBA' as const, nombre: 'WOD de prueba', precio: 0, clases: null, porSemana: null, vigenciaDias: 30 },
  { id: 'pl-suelta', tipo: 'SUELTA' as const, nombre: 'Clase suelta', precio: 10000, clases: null, porSemana: null, vigenciaDias: 1 },
  { id: 'pl-pack', tipo: 'PACK' as const, nombre: 'Pack de 8 WODs', precio: 60000, clases: 8, porSemana: null, vigenciaDias: 90 },
  { id: 'pl-libre', tipo: 'MEMBRESIA' as const, nombre: 'Ilimitado', precio: 85000, clases: null, porSemana: 0, vigenciaDias: 30 },
]
const GRILLA: GrillaApi = {
  desde: HOY, hasta: '2026-12-09',
  dias: [
    { fecha: HOY, cerrado: false, motivo: null, sesiones: [{ recursoId: 'r-haltero', inicioMinutos: 1080, finMinutos: 1140, libres: 0, cupo: 3 }] },
    { fecha: '2026-11-26', cerrado: true, motivo: 'Feriado', sesiones: [] },
    { fecha: '2026-11-27', cerrado: false, motivo: null, sesiones: [] },
    { fecha: LUNES, cerrado: false, motivo: null, sesiones: [{ recursoId: 'r-wod', inicioMinutos: 1140, finMinutos: 1200, libres: 11, cupo: 12 }] },
  ],
}

function carga(over: { planes?: typeof PLANES; listaDeEspera?: boolean; whatsapp?: string | null } = {}): CargaSitio {
  const tienda = {
    business: { name: 'Box Norte SRL', subdomain: 'box-norte', subrubros: ['crossfit'] },
    appearance: { storeName: 'Box Norte', tagline: 'Un WOD por día.', logoUrl: null },
    contact: { whatsapp: over.whatsapp === undefined ? '3757 55-0101' : over.whatsapp },
  }
  const { rubro, negocio } = negocioDelSitio({ slug: 'box-norte', tienda, config, recursos: RECURSOS, planes: over.planes ?? PLANES })
  return {
    rubro, negocio, dias: diasDelSitio(negocio, GRILLA), horarios: sesionesDe(config.horario),
    reglas: { dias: 14, cancelaHastaHoras: 2, retencionMinutos: 10, listaDeEspera: over.listaDeEspera ?? true, confirmaElNegocio: false },
  }
}

/** El sitio real: con los links del negocio y el reloj en el miércoles 25 a las 10:00. */
const dibujar = (el: ReactElement) => renderToStaticMarkup(
  // Los hijos van como prop: los dos proveedores los piden en su tipo y este test no es .tsx.
  // eslint-disable-next-line react/no-children-prop
  createElement(SitioProvider, { valor: { real: true, ruta: rutaDelNegocio('box-norte') }, children: createElement(RelojProvider, { reloj: { hoy: HOY, ahora: 600 }, children: el }) }),
)
/** El texto que se lee, sin etiquetas ni estilos. */
const texto = (html: string) => html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

const API: ApiDelSitio = {
  tienda: vi.fn(), config: vi.fn(), recursos: vi.fn(), planes: vi.fn(), grilla: vi.fn(), retener: vi.fn(), confirmar: vi.fn(), cancelar: vi.fn(), anotarseEnEspera: vi.fn(),
}
const reserva = (c: CargaSitio, query: Record<string, unknown> = {}, inicial?: Partial<EstadoDeReserva>, ahoraMs = 0) =>
  dibujar(createElement(ReservaReal, { carga: c, api: API, query, ahoraMs, onCambio: () => {}, ...(inicial ? { inicial: { ...RESERVA_INICIAL, ...inicial } } : {}) }))
/** El radio de un día o de una clase, como quedó en el HTML ('' si no está). */
const radio = (html: string, valor: string) => html.match(new RegExp(`<input type="radio"[^>]*value="${valor}"[^>]*>`))?.[0] ?? ''
/** El botón de seguir del resumen: su etiqueta de apertura y lo que dice. */
const boton = (html: string) => {
  const m = html.match(/(<button type="button" class="rv-btn rv-btn--primario rv-btn--lg rv-btn--ancho"[^>]*>)([^<]*)/)
  return { apagado: !!m?.[1].includes('disabled=""'), dice: (m?.[2] ?? '').trim() }
}

describe('la portada del sitio real', () => {
  const html = dibujar(createElement(HomeReal, { carga: carga() }))
  const t = texto(html)

  it('es el sitio del negocio: su nombre, su frase y los links a su reserva, sin nada de la demo', () => {
    expect(t).toContain('Box Norte')
    expect(t).toContain('Un WOD por día.')
    expect(html).toContain('href="/tienda/box-norte/reserva"')
    expect(html).toContain('data-real="true"')
    expect(html).toContain('--rv-tope: 0px')
    expect(html).not.toContain('/gimnasio-demo')
    // Lo que el negocio de ejemplo trae y un negocio real no cargó: ni la dirección, ni la foto, ni el mapa.
    expect(t).not.toContain('Av. Misiones')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('openstreetmap')
  })

  it('el menú no ofrece "Mis clases", que en el sitio real todavía no existe', () => {
    expect(t).not.toContain('Mis clases')
    expect(html).toContain('aria-current="page"')
  })

  it('hoy muestra las clases que quedan con sus lugares; la completa lleva a la lista de espera', () => {
    expect(html).toContain('href="/tienda/box-norte/reserva?clase=r-haltero&amp;fecha=2026-11-25"')
    expect(t).toContain('Halterofilia')
    expect(t).toContain('Profe a confirmar · Box · 60 min')
    expect(t).toContain('Completa · lista de espera')
    expect(html).toContain('aria-label="Halterofilia a las 18:00, completa: lista de espera"')
  })

  it('los próximos días: el feriado dice su motivo y cada clase, cuántos lugares le quedan', () => {
    expect(t).toContain('Los próximos días')
    expect(t).toContain('Del jue 26 nov al lun 30 nov. Se reserva hasta 14 días adelante.')
    expect(t).toMatch(/Jue 26 Cerrado Feriado/)
    expect(t).toMatch(/Vie 27 0 clases/)
    expect(t).toMatch(/Lun 30 1 clase 19:00 WOD 11 lugares/)
    expect(html).toContain('href="/tienda/box-norte/reserva?clase=r-wod&amp;fecha=2026-11-30"')
  })

  it('los planes que ofrece el negocio, con su precio, y sin botones para comprarlos: el pago es en el lugar', () => {
    expect(t).toContain('Acá reservás tu lugar; el pago lo arreglás en Box Norte.')
    expect(t).toContain('¿Primera vez? WOD de prueba: gratis, una vez por persona.')
    expect(t).toMatch(/Pack de 8 WODs \$\s?60\.000 el pack 8 clases para usar en 90 días\./)
    expect(t).toMatch(/Ilimitado \$\s?85\.000 por mes Todas las clases que quieras\./)
    expect(t).toMatch(/Clase suelta \$\s?10\.000 la clase/)
    expect(t).not.toContain('Elegir')
    expect(html).not.toContain('plan=')
  })

  it('cuándo abre, día por día (con sus dos turnos si los tiene), y el teléfono para llamar', () => {
    expect(t).toMatch(/Lun 07:00 – 22:00/)
    expect(t).toMatch(/Mar Cerrado/)
    expect(t).toMatch(/Mié 07:00 – 12:00 y 16:00 – 22:00/)
    expect(html).toContain('href="tel:3757550101"')
  })

  it('las cifras de arriba: clases por semana, lugares libres hoy y desde cuánto salen los planes', () => {
    expect(t).toMatch(/2 clases por semana/)
    expect(t).toMatch(/0 lugares libres hoy/)
    expect(t).toMatch(/\$10k planes, desde/)
  })

  it('sin lista de espera, una clase completa se ve pero no se puede elegir', () => {
    const sin = dibujar(createElement(HomeReal, { carga: carga({ listaDeEspera: false }) }))
    expect(sin).not.toContain('clase=r-haltero')
    expect(texto(sin)).not.toContain('lista de espera')
    expect(texto(sin)).toMatch(/Halterofilia .* Completa/)
  })

  it('sin planes cargados ni teléfono, esas partes no están', () => {
    const sin = texto(dibujar(createElement(HomeReal, { carga: carga({ planes: [], whatsapp: null }) })))
    expect(sin).not.toContain('Planes y pases')
    expect(sin).not.toContain('planes, desde')
    expect(sin).toContain('Horarios y contacto')
  })
})

describe('reservar en el sitio real', () => {
  it('arranca en hoy, con las clases del día como opciones y el botón a la espera de una elección', () => {
    const html = reserva(carga())
    const t = texto(html)
    expect(t).toContain('¿A qué clase venís?')
    expect(t).toContain('Podés reservar hasta 14 días adelante.')
    expect(html).toContain('aria-label="Hoy, miércoles 25 de noviembre"')
    expect(radio(html, HOY)).toContain('checked=""')
    expect(radio(html, 'r-haltero')).not.toBe('')
    expect(radio(html, 'r-haltero')).not.toContain('checked=""')
    expect(t).toContain('Elegí una clase para seguir')
    expect(boton(html)).toEqual({ apagado: true, dice: 'Continuar' })
    expect(html).not.toContain('/gimnasio-demo')
    expect(t).not.toContain('Cómo pagás')
    expect(t).not.toContain('Mercado Pago')
  })

  it('con la clase elegida desde la portada muestra el resumen y deja continuar', () => {
    const html = reserva(carga(), { clase: 'r-wod', fecha: LUNES })
    const t = texto(html)
    expect(radio(html, LUNES)).toContain('checked=""')
    expect(radio(html, 'r-wod')).toContain('checked=""')
    expect(t).toMatch(/Clase WOD Cuándo Lunes 30 de noviembre · 19:00 Lugar 11 libres de 12 Pago En Box Norte/i)
    expect(boton(html)).toEqual({ apagado: false, dice: 'Continuar' })
    expect(t).toContain('Si no podés ir, avisá con al menos 2 h de anticipación.')
  })

  it('una clase completa se puede elegir para la lista de espera; sin lista de espera, no', () => {
    const con = reserva(carga(), { clase: 'r-haltero', fecha: HOY })
    expect(texto(con)).toMatch(/Lugar Lista de espera/)
    expect(radio(con, 'r-haltero')).not.toContain('disabled=""')
    expect(boton(con)).toEqual({ apagado: false, dice: 'Anotarme en la lista de espera' })
    // Sin lista de espera, aunque venga elegida en la URL: su radio está apagado y no queda elegida.
    const sin = reserva(carga({ listaDeEspera: false }), { clase: 'r-haltero', fecha: HOY })
    expect(radio(sin, 'r-haltero')).toContain('disabled=""')
    expect(radio(sin, 'r-haltero')).not.toContain('checked=""')
    expect(boton(sin)).toEqual({ apagado: true, dice: 'Continuar' })
    expect(texto(sin)).toContain('Elegí una clase para seguir')
    expect(texto(sin)).not.toContain('lista de espera')
  })

  it('un día cerrado dice por qué y no ofrece clases', () => {
    const html = reserva(carga(), { fecha: '2026-11-26' })
    expect(texto(html)).toContain('Feriado: ese día no hay clases.')
    expect(html).not.toMatch(/name="[^"]*-clase"/)
  })

  it('una clase o una fecha de la URL que no se pueden reservar se ignoran', () => {
    const html = reserva(carga(), { clase: 'no-existe', fecha: '2027-01-01' })
    expect(radio(html, HOY)).toContain('checked=""')
    expect(texto(html)).toContain('Elegí una clase para seguir')
    // La clase existe, pero otro día: tampoco queda elegida.
    expect(texto(reserva(carga(), { clase: 'r-wod', fecha: HOY }))).toContain('Elegí una clase para seguir')
  })
})

describe('los datos y el final de la reserva', () => {
  const WOD = { clase: 'r-wod', fecha: LUNES }
  // El lugar del WOD del lunes, guardado hasta las 10:10 de Argentina.
  const LUGAR = { token: 'tok-1', hasta: '2026-11-25T13:10:00.000Z', firma: 'r-wod|2026-11-30|1140' }
  const ANTES = new Date('2026-11-25T13:00:00.000Z').getTime()
  const DESPUES = new Date('2026-11-25T13:11:00.000Z').getTime()
  const claseWod = () => carga().dias.find(d => d.fecha === LUNES)!.clases[0]

  it('con el lugar tomado pide los datos y dice hasta qué hora queda guardado', () => {
    const html = reserva(carga(), WOD, { paso: 1, camino: 'lugar', lugar: LUGAR }, ANTES)
    const t = texto(html)
    expect(t).toContain('Tus datos Sin registrarte: con tu nombre y tu celular alcanza.')
    expect(t).toContain('Tu lugar queda guardado hasta las 10:10 . Completá tus datos y confirmá antes de esa hora.')
    for (const campo of ['Nombre y apellido', 'Celular', 'Email (opcional)', 'Algo que tengamos que saber (opcional)']) expect(t).toContain(campo)
    expect(t).toMatch(/Lugar Guardado hasta las 10:10/)
    expect(boton(html)).toEqual({ apagado: false, dice: 'Confirmar reserva' })
    expect(html).toContain('id="gir-nombre"')
    expect(html).toContain('autoComplete="tel"')
  })

  it('si el tiempo se venció lo dice y el botón vuelve a tomar el lugar', () => {
    const html = reserva(carga(), WOD, { paso: 1, camino: 'lugar', lugar: LUGAR }, DESPUES)
    expect(texto(html)).toContain('Se venció el tiempo que tu lugar estuvo guardado.')
    expect(texto(html)).not.toContain('queda guardado hasta')
    expect(boton(html)).toEqual({ apagado: false, dice: 'Tomar el lugar de nuevo' })
  })

  it('por el camino de la lista de espera pide los datos sin guardar ningún lugar', () => {
    const html = reserva(carga(), { clase: 'r-haltero', fecha: HOY }, { paso: 1, camino: 'espera' })
    const t = texto(html)
    expect(t).toContain('La clase está completa: te anotás en la lista de espera y, si se libera un lugar, es tuyo.')
    expect(t).not.toContain('queda guardado')
    expect(t).not.toContain('Algo que tengamos que saber')
    expect(boton(html)).toEqual({ apagado: false, dice: 'Anotarme en la lista de espera' })
  })

  it('mientras el pedido viaja el botón lo dice y no se puede tocar', () => {
    expect(boton(reserva(carga(), WOD, { enviando: true }))).toEqual({ apagado: true, dice: 'Guardando tu lugar…' })
    expect(boton(reserva(carga(), WOD, { paso: 1, lugar: LUGAR, enviando: true }, ANTES))).toEqual({ apagado: true, dice: 'Reservando…' })
  })

  it('lo que dice la API se muestra como aviso', () => {
    const html = reserva(carga(), WOD, { aviso: 'Hay que reservar con al menos 30 minutos de anticipación.' })
    expect(html).toMatch(/<p class="rv-nota rv-nota--aviso" role="alert"[^>]*>Hay que reservar con al menos 30 minutos de anticipación\.<\/p>/)
  })

  it('reservado: el código, cuándo es, que el pago es en el lugar y la vuelta al inicio del negocio', () => {
    const html = reserva(carga(), WOD, { terminada: { tipo: 'reserva', clase: claseWod(), codigo: 'ABC234', pendiente: false, nombre: 'Ana Sosa', email: 'ana@test.com' } })
    const t = texto(html)
    expect(t).toContain('Tu lugar está reservado')
    expect(t).toContain('Te esperamos, Ana. Te mandamos el detalle a ana@test.com. Si no podés ir, avisá con al menos 2 h de anticipación.')
    expect(t).toMatch(/Código ABC234/)
    expect(t).toMatch(/Clase WOD Cuándo Lunes 30 de noviembre · 19:00 a 20:00 Dónde Box · con Nico Pago En Box Norte: con tu plan o la clase suelta/i)
    expect(t).toContain('Agregar al calendario')
    expect(html).toContain('<a class="rv-btn rv-btn--primario" href="/tienda/box-norte">Volver al inicio</a>')
    expect(html).not.toContain('/gimnasio-demo')
    expect(t).not.toContain('Es una demo')
  })

  it('si el negocio confirma a mano, dice que el pedido quedó a confirmar', () => {
    const t = texto(reserva(carga(), WOD, { terminada: { tipo: 'reserva', clase: claseWod(), codigo: 'ABC234', pendiente: true, nombre: 'Ana Sosa', email: null } }))
    expect(t).toContain('Recibimos tu pedido')
    expect(t).toContain('Box Norte tiene que confirmarlo. Preguntá en Box Norte si quedó confirmado.')
    expect(t).not.toContain('Tu lugar está reservado')
  })

  it('en la lista de espera: su lugar en la lista y cómo se entera; sin email, que pregunte', () => {
    const base = { tipo: 'espera' as const, clase: claseWod(), posicion: 2, yaEstaba: false, nombre: 'Ana Sosa' }
    const con = texto(reserva(carga(), WOD, { terminada: { ...base, email: 'ana@test.com' } }))
    expect(con).toContain('Estás en la lista de espera')
    expect(con).toContain('Estás en el lugar 2 de la lista. Si alguien cancela, el lugar pasa a ser tuyo. Te avisamos a ana@test.com.')
    expect(con).not.toContain('Agregar al calendario')
    expect(con).not.toContain('Código')
    const sin = texto(reserva(carga(), WOD, { terminada: { ...base, email: null, yaEstaba: true } }))
    expect(sin).toContain('Ya estabas en la lista de esta clase: seguís en tu lugar.')
    expect(sin).toContain('Como no dejaste un email no te llega el aviso: preguntá en Box Norte.')
  })
})

describe('la demo comparte el armazón y no cambia', () => {
  it('sin el contexto del sitio real, los links son los de la demo, está "Mis clases" y la tira de arriba conserva su lugar', () => {
    const negocio = negocioDe(rubroPorKey('crossfit'))
    const html = renderToStaticMarkup(createElement(Home, { negocio, inscripciones: inscripcionesDe(negocio, sociosDe(negocio)) }))
    expect(html).toContain('href="/gimnasio-demo/negocio?rubro=crossfit"')
    expect(html).toContain('href="/gimnasio-demo/reserva?rubro=crossfit"')
    expect(html).toContain('href="/gimnasio-demo/mis-clases?rubro=crossfit"')
    expect(html).not.toContain('data-real')
    expect(html).not.toContain('--rv-tope: 0px')
    expect(html).not.toContain('/tienda/')
    // El pie de la demo, con el teléfono y la dirección de ejemplo.
    expect(texto(html)).toContain('3757 55-0202 · Av. Misiones 310, Puerto Iguazú')
  })
})

describe('antes de estar en el navegador', () => {
  it('el servidor manda solo el estado de carga: sin hora no hay nada que pedir ni que mostrar', () => {
    const html = renderToStaticMarkup(createElement(SitioReal, { slug: 'box-norte', pagina: 'inicio' }))
    expect(texto(html)).toContain('Cargando…')
    expect(html).toContain('data-real="true"')
    expect(html).not.toContain('Reservar clase')
  })
})
