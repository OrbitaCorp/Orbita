import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { anchoCaptura, inline, parsearMarkdown, srcSeguro } from './MarkdownInforme'
import {
  AVISO_SESION, armarInforme, armarModulo, esDeModulos, estadoSemana, focoDe, informeVisible, proximoHito, slugDe,
} from './Modulos'
import { MODULOS_SEED } from '../../../../api/src/platform/audit/modulos-seed'
import { AVISO_SESION as AVISO_API, ENTRADAS_MODULOS } from '../../../../api/src/platform/audit/modulos-entradas'
import type { AuditItemRow } from '@/lib/platform/api'

// Filas como las devuelve GET /platform/audit, armadas desde el seed real.
function fila(over: Partial<AuditItemRow> & { key: string }): AuditItemRow {
  return {
    id: over.key, area: 'FRONTEND', grupo: '', titulo: over.key, ruta: null, foco: '', severidad: null, estado: 'PENDIENTE',
    checks: [], checksHechos: 0, orden: 0, esPersonalizado: false, responsable: null, informeUrl: null, notas: null, informe: null,
    hechoPor: null, hechoAt: null, actualizadoPor: null, decision: null, decisionNota: null, decisionPor: null, decisionAt: null,
    updatedAt: '2026-10-26T12:00:00.000Z', ...over,
  }
}
function planes(horizonte: '2m' | '1m' = '2m'): AuditItemRow[] {
  return MODULOS_SEED.map((p) => {
    const notas = JSON.parse(p.notas!)
    return fila({
      key: p.key, grupo: p.grupo, titulo: p.titulo, notas: JSON.stringify({ ...notas, horizonte }),
      checks: p.tareas!.map((t, i) => ({ id: `t${i + 1}`, texto: t.texto, hecho: false, dia: t.dia, quien: t.quien, criterio: t.criterio, semana: t.semana, semana1m: t.semana1m, ...(t.auditoria ? { auditoria: t.auditoria } : {}) })),
    })
  })
}
const entradas = () => ENTRADAS_MODULOS.map((e) => fila({ key: e.key, grupo: e.grupo, titulo: e.titulo, foco: e.foco, informe: e.informe ?? null, notas: e.notas ?? null, checks: [{ id: 'c1', texto: e.checks[0], hecho: false }, { id: 'c2', texto: e.checks[1], hecho: false }] }))
const DEF = {
  gimnasio: { slug: 'gimnasio' as const, nombre: 'Gimnasio', persona: 'Ale' as const },
  turnos: { slug: 'turnos' as const, nombre: 'Turnos', persona: 'Mateo' as const },
  alquileres: { slug: 'alquileres' as const, nombre: 'Alquileres', persona: 'Alan' as const },
}
const modulo = (slug: keyof typeof DEF, items: AuditItemRow[], hoy: string | null) =>
  armarModulo(DEF[slug], items, new Map(items.map((i) => [i.key, i])), hoy)

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

  it('la entrada del seed se parsea con su aviso, sus secciones y sus archivos', () => {
    const b = parsearMarkdown(ENTRADAS_MODULOS[0].informe!)
    expect(b[0]).toMatchObject({ tipo: 'quote' })
    const titulos = b.filter((x) => x.tipo === 'h').map((x) => (x as { texto: string }).texto)
    expect(titulos).toEqual(['Qué se hizo', 'Quién', 'Cuándo', 'Archivos'])
    expect(b.some((x) => x.tipo === 'ul')).toBe(true)
  })

  it('el código corta después de cada barra (<wbr>) y el texto no cambia', () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, inline('Ver `apps/web/src/x.tsx:30` y `sin-barras`')))
    expect(html).toBe('Ver <code class="md-code">apps/<wbr/>web/<wbr/>src/<wbr/>x.tsx:30</code> y <code class="md-code">sin-barras</code>')
  })
})

describe('Modulos — aviso de las entradas de sesión', () => {
  it('es el mismo texto que arma la API y al confirmar deja de decir "pendiente"', () => {
    expect(AVISO_SESION).toBe(AVISO_API)
    const informe = ENTRADAS_MODULOS[0].informe!
    expect(informe.startsWith(AVISO_SESION)).toBe(true)
    expect(informeVisible(informe, false)).toBe(informe)
    const confirmada = informeVisible(informe, true)
    expect(confirmada).not.toContain('pendiente de confirmación')
    expect(confirmada.startsWith('> **Generada en sesión y confirmada por el responsable.**')).toBe(true)
    // Solo cambia el aviso (el primer renglón); el resto del informe queda igual.
    expect(confirmada.split('\n').slice(1)).toEqual(informe.split('\n').slice(1))
    expect(parsearMarkdown(confirmada).map((x) => x.tipo)).toEqual(parsearMarkdown(informe).map((x) => x.tipo))
  })
})

describe('Modulos — modelo', () => {
  it('esDeModulos', () => {
    expect(esDeModulos('modulo.turnos.plan')).toBe(true)
    expect(esDeModulos('auditoria.turnos.x')).toBe(true)
    expect(esDeModulos('decision.x')).toBe(false)
    expect(esDeModulos('api.auth')).toBe(false)
  })

  it('2 meses, hoy 28/10: 8 semanas, atrasos desde la tarea más vieja, la documentada no cuenta como atraso', () => {
    const items = [...planes(), ...entradas()]
    const m = modulo('gimnasio', items, '2026-10-28')
    expect(m.semanas).toHaveLength(8)
    expect(m.fin).toBe('2026-12-18')
    expect(m.semanas[0]).toMatchObject({ n: 1, desde: '2026-10-26', hasta: '2026-10-30', titulo: 'Lib de reservas y esqueleto de Módulos' })
    expect(m.semanas[7]).toMatchObject({ desde: '2026-12-14', hasta: '2026-12-18' })
    expect(m.atrasadas.map((t) => [t.check.dia, t.atraso])).toEqual([['2026-10-26', 2], ['2026-10-27', 1]])
    expect(m.diasAtraso).toBe(2)
    const t4 = m.tareas.find((t) => t.check.auditoria)!
    expect(t4.estado).toBe('por-confirmar')
    expect(t4.atraso).toBe(0)
    expect(m.porConfirmar).toBe(1)
    expect(m.entradas.map((e) => e.key)).toEqual(['auditoria.gimnasio.2026-10-26-seccion-modulos'])
    expect(estadoSemana(m.semanas[0], '2026-10-28')).toBe('atrasada')
    expect(estadoSemana(m.semanas[1], '2026-10-28')).toBe('pendiente')
    expect(proximoHito(m, '2026-10-28')?.n).toBe(1)
    // Sin la entrada cargada, la tarea documentada no se puede tildar.
    const sinEntrada = modulo('gimnasio', planes(), '2026-10-28')
    expect(sinEntrada.tareas.find((t) => t.check.auditoria)!.estado).toBe('sin-cargar')
    expect(sinEntrada.entradas).toEqual([])
  })

  it('sin hoy (servidor) no hay atrasos; Tienda no tiene plan', () => {
    const m = modulo('gimnasio', planes(), null)
    expect(m.atrasadas).toEqual([])
    expect(m.diasAtraso).toBe(0)
    const tienda = armarModulo({ slug: 'tienda', nombre: 'Tienda', persona: null }, planes(), new Map(), '2026-10-28')
    expect(tienda.plan).toBeNull()
    expect(tienda.tareas).toEqual([])
  })

  it('1 mes: 4 semanas, lo de 5 a 8 comprimido al mismo día de la semana, la estadía afuera', () => {
    const items = planes('1m')
    const tur = modulo('turnos', items, '2026-10-26')
    expect(tur.semanas).toHaveLength(4)
    expect(tur.fin).toBe('2026-11-20')
    const plan2m = planes('2m').find((p) => p.key === 'modulo.turnos.plan')!
    expect(tur.tareas).toHaveLength(plan2m.checks.length)
    // El martes 01/12 (semana 6) cae el martes de la semana 4.
    const mar = tur.tareas.find((t) => t.check.dia === '2026-12-01')!
    expect([mar.semana, mar.dia]).toEqual([4, '2026-11-17'])
    // Turnos en el alta única (24/11, semana 5) va adelantada a la semana 3, martes.
    const alta = tur.tareas.find((t) => t.check.dia === '2026-11-24')!
    expect([alta.semana, alta.dia]).toEqual([3, '2026-11-10'])
    expect(tur.semanas[3].comprimidas).toEqual([5, 6, 7, 8])
    expect(tur.semanas[2].comprimidas).toEqual([5])
    expect(tur.fuera).toEqual([])

    const alq = modulo('alquileres', items, '2026-10-26')
    expect(alq.fuera.length).toBe(9)
    expect(alq.fuera.every((t) => t.check.texto.startsWith('Estadía') && t.dia === null && t.semana === null)).toBe(true)
    expect(alq.tareas.some((t) => t.check.texto.startsWith('Estadía'))).toBe(false)
    // Todo cae de lunes a viernes dentro del ciclo de 1 mes.
    for (const t of [...tur.tareas, ...alq.tareas]) {
      expect(t.dia! >= '2026-10-26' && t.dia! <= '2026-11-20').toBe(true)
      expect(new Date(`${t.dia}T00:00:00Z`).getUTCDay()).toBeGreaterThanOrEqual(1)
      expect(new Date(`${t.dia}T00:00:00Z`).getUTCDay()).toBeLessThanOrEqual(5)
    }
  })

  it('1 mes: los títulos salen de semanas1m (sin la estadía); sin ellos, los de 2 meses', () => {
    const seed = (slug: string) => JSON.parse(MODULOS_SEED.find((p) => p.key === `modulo.${slug}.plan`)!.notas!)
    for (const slug of ['turnos', 'gimnasio', 'alquileres'] as const) {
      expect(modulo(slug, planes('1m'), '2026-10-26').semanas.map((s) => s.titulo)).toEqual(seed(slug).semanas1m)
      expect(modulo(slug, planes('2m'), '2026-10-26').semanas.map((s) => s.titulo)).toEqual(seed(slug).semanas)
    }
    expect(modulo('alquileres', planes('1m'), '2026-10-26').semanas.some((s) => /estad[ií]a/i.test(s.titulo))).toBe(false)
    // Un plan cargado antes de que existieran (notas sin semanas1m): los de 2 meses.
    const viejos = planes('1m').map((p) => {
      const notas = JSON.parse(p.notas!)
      delete notas.semanas1m
      return { ...p, notas: JSON.stringify(notas) }
    })
    expect(modulo('alquileres', viejos, '2026-10-26').semanas[3].titulo).toBe(seed('alquileres').semanas[3])
  })

  it('notas rotas o sin títulos: valen los defaults', () => {
    const items = planes().map((p) => (p.key === 'modulo.turnos.plan' ? { ...p, notas: 'no es json' } : p))
    const m = modulo('turnos', items, '2026-10-26')
    expect(m.notas.horizonte).toBe('2m')
    expect(m.semanas).toHaveLength(8)
    expect(m.semanas[0].titulo).toBe('Semana 1')
  })

  it('slug, foco e informe del modal', () => {
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
