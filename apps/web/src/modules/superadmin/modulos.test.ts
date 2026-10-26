import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { anchoCaptura, inline, parsearMarkdown, srcSeguro } from './MarkdownInforme'
import {
  TabModulos, armarInforme, armarModulo, confirmacionDe, estadoSemana, focoDe, informeVisible, proximoHito, slugDe, todasLasEntradas,
  type DatosModulos, type DefModulo,
} from './Modulos'
import { PLANES, type PlanModulo } from './modulos/plan'
import { AVISO_SESION, ENTRADAS, type Entrada } from './modulos/entradas'
import { DECISIONES } from './modulos/decisiones'
import { ESTADO_VACIO, accionesModulos, estadoGuardado, sanear, type EstadoModulos } from './modulos/estado'

// TabModulos lee ?modulo= y ?vista= del router: acá se pinta en el servidor
// con una query de mentira.
const ruta = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({ useRouter: () => ({ query: ruta.query, pathname: '/superadmin', push: () => Promise.resolve(true) }) }))

const DEF: Record<'gimnasio' | 'turnos' | 'alquileres', DefModulo> = {
  gimnasio: { slug: 'gimnasio', nombre: 'Gimnasio', persona: 'Ale' },
  turnos: { slug: 'turnos', nombre: 'Turnos', persona: 'Mateo' },
  alquileres: { slug: 'alquileres', nombre: 'Alquileres', persona: 'Alan' },
}
const datos = (estado: EstadoModulos = ESTADO_VACIO, planes: PlanModulo[] = PLANES, entradas: Entrada[] = todasLasEntradas(estado)): DatosModulos => ({ planes, entradas, estado })
const conEstado = (cambio: Partial<EstadoModulos>): EstadoModulos => ({ ...ESTADO_VACIO, ...cambio })
// Los planes sin ninguna tarea documentada: para ver los atrasos como si nada se hubiera hecho.
const sinDocumentar = PLANES.map((p) => ({ ...p, tareas: p.tareas.map((t) => ({ ...t, auditoria: undefined })) }))
const gimnasio = PLANES.find((p) => p.modulo === 'gimnasio')!
const LIB = 'auditoria.gimnasio.2026-10-26-lib-reservas'

describe('MarkdownInforme — imágenes', () => {
  it('srcSeguro deja pasar https y /auditoria/…, y nada más', () => {
    expect(srcSeguro('https://i.imgur.com/a.jpg')).toBe('https://i.imgur.com/a.jpg')
    expect(srcSeguro('/auditoria/modulos/gimnasio/a-antes-1280.jpg')).toBe('/auditoria/modulos/gimnasio/a-antes-1280.jpg')
    for (const malo of ['http://x.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAA', '//evil.com/a.jpg', '/auditoria/../api/logout', '/auditoria/a b.jpg', '/api/x', 'https://x.com/a".jpg', '/auditoria/x\\y.jpg']) {
      expect(srcSeguro(malo)).toBeNull()
    }
  })

  it('anchoCaptura sale del alt o del archivo', () => {
    expect(anchoCaptura('Antes · 390', '/x.jpg')).toBe(390)
    expect(anchoCaptura('Antes', '/auditoria/modulos/t/agenda-despues-390.jpg')).toBe(390)
    expect(anchoCaptura('Después · 1280', '/x.jpg')).toBe(1280)
    expect(anchoCaptura('', '/auditoria/x-3900.jpg')).toBe(1280)
    expect(anchoCaptura('Tablet 768', '/x.jpg')).toBe(768)
  })

  it('un párrafo hecho solo de imágenes es una galería; con texto o con un src malo, no', () => {
    const md = '## Antes / Después\n\n![Antes · 1280](/auditoria/modulos/turnos/a-1280.jpg)\n![Después · 1280](/auditoria/modulos/turnos/d-1280.jpg)\n\n![Antes · 390](/auditoria/modulos/turnos/a-390.jpg)\n![Después · 390](/auditoria/modulos/turnos/d-390.jpg)\n\nTexto con ![una](https://x.com/a.jpg) imagen.\n\n![mala](http://x.com/a.jpg)'
    const b = parsearMarkdown(md)
    expect(b.map((x) => x.tipo)).toEqual(['h', 'imgs', 'imgs', 'p', 'p'])
    expect(b[1]).toEqual({ tipo: 'imgs', imagenes: [{ alt: 'Antes · 1280', src: '/auditoria/modulos/turnos/a-1280.jpg' }, { alt: 'Después · 1280', src: '/auditoria/modulos/turnos/d-1280.jpg' }] })
  })

  it('una entrada se parsea con su aviso, sus secciones, sus archivos y su galería', () => {
    const b = parsearMarkdown(ENTRADAS[0].informe)
    expect(b[0]).toMatchObject({ tipo: 'quote' })
    const titulos = b.filter((x) => x.tipo === 'h').map((x) => (x as { texto: string }).texto)
    expect(titulos).toEqual(['Qué se hizo', 'Quién', 'Cuándo', 'Archivos'])
    expect(b.some((x) => x.tipo === 'ul')).toBe(true)
    expect(b.some((x) => x.tipo === 'imgs')).toBe(true)
    // Un diseño trae sus dos pares de capturas como galerías.
    const diseno = ENTRADAS.find((e) => e.tipo === 'diseño')!
    expect(parsearMarkdown(diseno.informe).filter((x) => x.tipo === 'imgs')).toHaveLength(2)
  })

  it('el código corta después de cada barra (<wbr>) y el texto no cambia', () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, inline('Ver `apps/web/src/x.tsx:30` y `sin-barras`')))
    expect(html).toBe('Ver <code class="md-code">apps/<wbr/>web/<wbr/>src/<wbr/>x.tsx:30</code> y <code class="md-code">sin-barras</code>')
  })
})

describe('Modulos — aviso de las entradas de sesión', () => {
  it('al confirmar deja de decir "pendiente" y el resto del informe queda igual', () => {
    const informe = ENTRADAS[0].informe
    expect(informe.startsWith(AVISO_SESION)).toBe(true)
    expect(informeVisible(informe, false)).toBe(informe)
    const confirmada = informeVisible(informe, true)
    expect(confirmada).not.toContain('pendiente de confirmación')
    expect(confirmada.startsWith('> **Generada en sesión y confirmada por el responsable.**')).toBe(true)
    // Solo cambia el aviso (el primer renglón).
    expect(confirmada.split('\n').slice(1)).toEqual(informe.split('\n').slice(1))
    expect(parsearMarkdown(confirmada).map((x) => x.tipo)).toEqual(parsearMarkdown(informe).map((x) => x.tipo))
  })
})

describe('Modulos — modelo', () => {
  it('sin nada guardado: 8 semanas, lo documentado espera confirmación y no cuenta como atraso', () => {
    const m = armarModulo(DEF.gimnasio, datos(), '2026-10-28')
    expect(m.semanas).toHaveLength(8)
    expect(m.fin).toBe('2026-12-18')
    expect(m.semanas[0]).toMatchObject({ n: 1, desde: '2026-10-26', hasta: '2026-10-30', titulo: 'Lib de reservas y esqueleto de Módulos' })
    expect(m.semanas[7]).toMatchObject({ desde: '2026-12-14', hasta: '2026-12-18' })
    expect(m.hechas).toBe(0)
    expect(m.porConfirmar).toBe(gimnasio.tareas.filter((t) => t.auditoria).length)
    expect(m.tareas.filter((t) => t.tarea.auditoria).every((t) => t.estado === 'por-confirmar' && t.atraso === 0)).toBe(true)
    // La semana 1 de Gimnasio está toda documentada: en curso, sin atrasos.
    expect(m.atrasadas).toEqual([])
    expect(estadoSemana(m.semanas[0], '2026-10-28')).toBe('en-curso')
    // Las entradas del módulo: las de sesión y las decisiones abiertas, ninguna de otro módulo.
    expect(m.entradas.map((e) => e.key).sort()).toEqual([...ENTRADAS, ...DECISIONES].filter((e) => e.modulo === 'gimnasio').map((e) => e.key).sort())
    expect(m.abiertas.every((e) => e.abierta && e.modulo === 'gimnasio')).toBe(true)
  })

  it('atrasos desde la tarea más vieja sin documentar; sin hoy (servidor) no hay atrasos', () => {
    const m = armarModulo(DEF.gimnasio, datos(ESTADO_VACIO, sinDocumentar), '2026-10-28')
    expect(m.atrasadas.map((t) => [t.tarea.dia, t.atraso])).toEqual([['2026-10-26', 2], ['2026-10-27', 1]])
    expect(m.diasAtraso).toBe(2)
    expect(estadoSemana(m.semanas[0], '2026-10-28')).toBe('atrasada')
    expect(estadoSemana(m.semanas[1], '2026-10-28')).toBe('pendiente')
    expect(proximoHito(m, '2026-10-28')?.n).toBe(1)
    const sinHoy = armarModulo(DEF.gimnasio, datos(ESTADO_VACIO, sinDocumentar), null)
    expect(sinHoy.atrasadas).toEqual([])
    expect(sinHoy.diasAtraso).toBe(0)
  })

  it('confirmar en el navegador tilda lo que documenta; destildar deja "falta tildar"', () => {
    const tareasLib = gimnasio.tareas.filter((t) => t.auditoria === LIB)
    expect(tareasLib.length).toBe(3)
    const estado = conEstado({
      confirmadas: { [LIB]: '2026-10-27' },
      tildadas: { [`gimnasio.${tareasLib[0].id}`]: true, [`gimnasio.${tareasLib[1].id}`]: true },
    })
    const m = armarModulo(DEF.gimnasio, datos(estado), '2026-10-28')
    const vista = (id: string) => m.tareas.find((t) => t.tarea.id === id)!
    expect(vista(tareasLib[0].id)).toMatchObject({ estado: 'hecha', hecha: true, fija: false, confirmada: true })
    // La tercera se destildó después de confirmar: sigue documentada, ya confirmada.
    expect(vista(tareasLib[2].id)).toMatchObject({ estado: 'por-confirmar', hecha: false, confirmada: true })
    expect(m.hechas).toBe(2)
    const lib = m.entradas.find((e) => e.key === LIB)!
    expect(confirmacionDe(lib, estado)).toEqual({ dia: '2026-10-27', local: true })
    expect(confirmacionDe(lib, ESTADO_VACIO)).toBeNull()
  })

  it('una entrada confirmada en el código deja sus tareas hechas para todos', () => {
    const entradas = todasLasEntradas(ESTADO_VACIO).map((e) => (e.key === LIB ? { ...e, confirmada: '2026-10-28' } : e))
    const m = armarModulo(DEF.gimnasio, datos(ESTADO_VACIO, PLANES, entradas), '2026-10-28')
    const deLib = m.tareas.filter((t) => t.tarea.auditoria === LIB)
    expect(deLib.length).toBe(3)
    expect(deLib.every((t) => t.estado === 'hecha' && t.fija)).toBe(true)
    expect(confirmacionDe(entradas.find((e) => e.key === LIB)!, ESTADO_VACIO)).toEqual({ dia: '2026-10-28', local: false })
  })

  it('una decisión abierta no se confirma y figura en su módulo', () => {
    const tur = armarModulo(DEF.turnos, datos(), '2026-10-28')
    expect(tur.abiertas.map((e) => e.quien)).toEqual(DECISIONES.filter((e) => e.modulo === 'turnos').map((e) => e.quien))
    for (const e of DECISIONES) expect(confirmacionDe(e, conEstado({ confirmadas: { [e.key]: '2026-10-28' } }))).toBeNull()
  })

  it('una entrada cargada en el navegador se suma a su módulo y documenta su tarea; si repite una key del código, vale la del código', () => {
    const nueva: Entrada = { ...ENTRADAS[0], key: 'auditoria.turnos.2026-11-05-rubros-revisados', modulo: 'turnos', transversal: false, titulo: 'Rubros revisados', origen: 'navegador' }
    const repetida: Entrada = { ...ENTRADAS[0], titulo: 'Otra con la misma key', origen: 'navegador' }
    const estado = conEstado({ nuevas: [nueva, repetida], vinculos: { 'turnos.t9': nueva.key } })
    const entradas = todasLasEntradas(estado)
    expect(entradas.filter((e) => e.key === ENTRADAS[0].key)).toEqual([ENTRADAS[0]])
    const tur = armarModulo(DEF.turnos, datos(estado), '2026-11-06')
    expect(tur.entradas.some((e) => e.key === nueva.key)).toBe(true)
    expect(tur.tareas.find((t) => t.tarea.id === 't9')).toMatchObject({ estado: 'por-confirmar', entrada: nueva })
  })

  it('1 mes: 4 semanas, lo de 5 a 8 comprimido al mismo día de la semana, la estadía afuera', () => {
    const estado = conEstado({ horizonte: { turnos: '1m', alquileres: '1m' } })
    const tur = armarModulo(DEF.turnos, datos(estado), '2026-10-26')
    expect(tur.semanas).toHaveLength(4)
    expect(tur.fin).toBe('2026-11-20')
    expect(tur.tareas).toHaveLength(PLANES[0].tareas.length)
    // El martes 01/12 (semana 6) cae el martes de la semana 4.
    const mar = tur.tareas.find((t) => t.tarea.dia === '2026-12-01')!
    expect([mar.semana, mar.dia]).toEqual([4, '2026-11-17'])
    // Turnos en el alta única (24/11, semana 5) va adelantada a la semana 3, martes.
    const alta = tur.tareas.find((t) => t.tarea.dia === '2026-11-24')!
    expect([alta.semana, alta.dia]).toEqual([3, '2026-11-10'])
    expect(tur.semanas[3].comprimidas).toEqual([5, 6, 7, 8])
    expect(tur.semanas[2].comprimidas).toEqual([5])
    expect(tur.fuera).toEqual([])

    const alq = armarModulo(DEF.alquileres, datos(estado), '2026-10-26')
    expect(alq.fuera.length).toBe(9)
    expect(alq.fuera.every((t) => t.tarea.texto.startsWith('Estadía') && t.dia === null && t.semana === null)).toBe(true)
    expect(alq.tareas.some((t) => t.tarea.texto.startsWith('Estadía'))).toBe(false)
    // Todo cae de lunes a viernes dentro del ciclo de 1 mes.
    for (const t of [...tur.tareas, ...alq.tareas]) {
      expect(t.dia! >= '2026-10-26' && t.dia! <= '2026-11-20').toBe(true)
      expect(new Date(`${t.dia}T00:00:00Z`).getUTCDay()).toBeGreaterThanOrEqual(1)
      expect(new Date(`${t.dia}T00:00:00Z`).getUTCDay()).toBeLessThanOrEqual(5)
    }
  })

  it('los títulos de semana salen del horizonte elegido (semanas1m en 1 mes, sin la estadía)', () => {
    for (const p of PLANES) {
      const def = DEF[p.modulo]
      const enUnMes: EstadoModulos['horizonte'] = {}
      enUnMes[p.modulo] = '1m'
      expect(armarModulo(def, datos(conEstado({ horizonte: enUnMes })), '2026-10-26').semanas.map((s) => s.titulo)).toEqual(p.semanas1m)
      expect(armarModulo(def, datos(), '2026-10-26').semanas.map((s) => s.titulo)).toEqual(p.semanas)
    }
    expect(armarModulo(DEF.alquileres, datos(conEstado({ horizonte: { alquileres: '1m' } })), '2026-10-26').semanas.some((s) => /estad[ií]a/i.test(s.titulo))).toBe(false)
  })

  it('slug, foco e informe de la hoja', () => {
    expect(slugDe('Transversal: sección Módulos del superadmin')).toBe('seccion-modulos-del-superadmin')
    expect(slugDe('¡¡!!')).toBe('entrada')
    expect(slugDe('a'.repeat(80))).toHaveLength(60)
    expect(focoDe('\n## Se rehízo la **agenda**\n- otra')).toBe('Se rehízo la agenda')
    const base = { que: 'Se hizo.', quien: 'Mateo' as const, fecha: '2026-11-04', archivos: ['apps/web/x.tsx:3'], decision: '', porque: '' }
    const sin390 = armarInforme({ ...base, tipo: 'diseño', capturas: { antes1280: '/auditoria/modulos/turnos/a.jpg', despues1280: 'https://x.com/d.jpg', antes390: '', despues390: '' } })
    expect(sin390).toContain('## Cuándo\n\nmiércoles 04/11/2026')
    expect(sin390).toContain('![Antes · 1280](/auditoria/modulos/turnos/a.jpg)\n![Después · 1280](https://x.com/d.jpg)')
    expect(sin390).not.toContain('390')
    const dec = armarInforme({ ...base, tipo: 'decisión', capturas: { antes1280: '', despues1280: '', antes390: '', despues390: '' }, decision: 'Va', porque: 'Porque sí' })
    expect(dec).toContain('## Decisión y porqué\n\n**Decisión:** Va\n\n**Porqué:** Porque sí')
    expect(dec).not.toContain('Antes / Después')
    expect(parsearMarkdown(sin390).filter((b) => b.tipo === 'imgs')).toHaveLength(1)
  })
})

describe('Modulos — lo guardado en el navegador', () => {
  beforeEach(() => accionesModulos.reiniciar())

  it('sanear descarta lo que no tiene la forma de hoy', () => {
    expect(sanear('roto')).toEqual(ESTADO_VACIO)
    const s = sanear({
      tildadas: { 'turnos.t1': true, 'turnos.t2': 'sí' },
      vinculos: { 'turnos.t3': 'auditoria.turnos.x', 'turnos.t4': 'decision.y' },
      confirmadas: { 'auditoria.turnos.x': '2026-10-27', 'auditoria.turnos.y': 'ayer' },
      nuevas: [{ key: 'auditoria.turnos.2026-10-27-a', modulo: 'turnos', tipo: 'tarea', titulo: 'A', foco: 'Foco de A', quien: 'Mateo', fecha: '2026-10-27', informe: 'x' }, { key: 'otra', modulo: 'tienda' }],
      horizonte: { turnos: '1m', tienda: '1m', gimnasio: '3m' },
    })
    expect(s.tildadas).toEqual({ 'turnos.t1': true })
    expect(s.vinculos).toEqual({ 'turnos.t3': 'auditoria.turnos.x' })
    expect(s.confirmadas).toEqual({ 'auditoria.turnos.x': '2026-10-27' })
    expect(s.nuevas.map((e) => [e.key, e.origen, e.confirmada])).toEqual([['auditoria.turnos.2026-10-27-a', 'navegador', null]])
    expect(s.horizonte).toEqual({ turnos: '1m' })
  })

  it('tildar, confirmar, deshacer, horizonte y una entrada nueva vinculada a su tarea', () => {
    accionesModulos.confirmar(LIB, '2026-10-27', [{ modulo: 'gimnasio', id: 't1' }, { modulo: 'gimnasio', id: 't2' }])
    expect(estadoGuardado().confirmadas[LIB]).toBe('2026-10-27')
    expect(estadoGuardado().tildadas).toEqual({ 'gimnasio.t1': true, 'gimnasio.t2': true })
    accionesModulos.tildar('gimnasio', 't2', false)
    expect(estadoGuardado().tildadas).toEqual({ 'gimnasio.t1': true })
    accionesModulos.desconfirmar(LIB)
    expect(estadoGuardado().confirmadas).toEqual({})
    accionesModulos.horizonte('alquileres', '1m')
    expect(estadoGuardado().horizonte).toEqual({ alquileres: '1m' })
    const nueva: Entrada = { ...ENTRADAS[0], key: 'auditoria.turnos.2026-11-05-rubros', modulo: 'turnos', origen: 'codigo', confirmada: '2026-11-05' }
    accionesModulos.agregar(nueva, { modulo: 'turnos', id: 't9' })
    expect(estadoGuardado().vinculos).toEqual({ 'turnos.t9': nueva.key })
    // Nace pendiente y como cargada en el navegador, diga lo que diga.
    expect(estadoGuardado().nuevas.map((e) => [e.key, e.origen, e.confirmada])).toEqual([[nueva.key, 'navegador', null]])
  })
})

describe('Modulos — se pinta en el servidor', () => {
  const pintar = (query: Record<string, string>) => {
    ruta.query = query
    return renderToStaticMarkup(createElement(TabModulos))
  }

  it('las cuatro tarjetas, con el aviso de que se guarda en el navegador', () => {
    const html = pintar({})
    for (const nombre of ['Tienda', 'Turnos', 'Gimnasio', 'Alquileres']) expect(html).toContain(nombre)
    expect(html).toContain('Se guarda en este navegador')
    expect(html).toContain('Sin plan en este ciclo.')
  })

  it('el plan, la auditoría y el resumen de un módulo', () => {
    expect(pintar({ modulo: 'gimnasio' })).toContain('Semana 1 · Lib de reservas y esqueleto de Módulos')
    const auditoria = pintar({ modulo: 'gimnasio', vista: 'auditoria' })
    expect(auditoria).toContain('Transversal: sección Módulos del superadmin')
    expect(auditoria).toContain('Abierta · la decide Ale')
    expect(auditoria).toContain('Pendiente de confirmación')
    const resumen = pintar({ modulo: 'turnos', vista: 'resumen' })
    expect(resumen).toContain('Decisiones abiertas')
    expect(resumen).toContain('Turnos todavía usa piezas de Tienda y de la landing')
  })
})
