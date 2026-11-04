// Los datos de Módulos (plan.ts, entradas.ts y decisiones.ts) son contenido
// escrito a mano: una tarea por día y por persona, un informe por cosa hecha.
// Estos tests atajan lo que el typecheck no ve: una fecha fuera del ciclo o en
// fin de semana, una semana que no coincide con su fecha, una tarea que apunta
// a una entrada que no existe o de otro módulo, un informe sin sus secciones o
// una captura que no está en apps/web/public.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parsearMarkdown } from '../MarkdownInforme'
import { CICLO, PERSONAS, PLANES, semanaDelCiclo } from './plan'
import { AVISO_SESION, ENTRADAS, type Entrada } from './entradas'
import { DECISIONES, avisoAbierta } from './decisiones'
import { CARPETAS_COMPARTIDAS, REGLAS_COMPARTIDO } from './compartido'

const PUBLIC = fileURLToPath(new URL('../../../../public', import.meta.url))
const RAIZ = fileURLToPath(new URL('../../../../../../', import.meta.url))
const RE_ISO = /^\d{4}-\d{2}-\d{2}$/
const RE_KEY = /^auditoria\.(turnos|alquileres|gimnasio)\.\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/
// `ruta:línea` o `ruta:desde-hasta`, desde la raíz del repo.
const RE_ARCHIVO = /^- `(apps|packages)\/[^`\s]+:\d+(-\d+)?`$/
const diaSemana = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 = domingo
const fechaValida = (iso: string) => RE_ISO.test(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso
const TODAS: Entrada[] = [...ENTRADAS, ...DECISIONES]
const archivosDe = (informe: string) => (informe.split('## Archivos')[1] ?? '').trim().split('\n\n')[0].split('\n')
const imagenesDe = (informe: string) => Array.from(informe.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g), (m) => ({ alt: m[1], src: m[2] }))

describe('Módulos — plan', () => {
  it('un plan por módulo con plan (Turnos, Alquileres y Gimnasio), con su responsable', () => {
    expect(PLANES.map((p) => p.modulo)).toEqual(['turnos', 'alquileres', 'gimnasio'])
    expect(PLANES.map((p) => p.responsable)).toEqual(['Mateo', 'Alan', 'Ale'])
    for (const p of PLANES) {
      expect(p.foco.trim().length).toBeGreaterThan(10)
      expect(p.semanas).toHaveLength(8)
      // El ciclo de 1 mes tiene sus propios títulos: las semanas 1 y 2 son las
      // mismas y la 3 y la 4 absorben las tareas de la 5 a la 8.
      expect(p.semanas1m).toHaveLength(4)
      expect(p.semanas1m.slice(0, 2)).toEqual(p.semanas.slice(0, 2))
      for (const s of [...p.semanas, ...p.semanas1m]) expect(s.trim().length).toBeGreaterThan(3)
    }
  })

  it('los ids de las tareas son por posición (t1, t2…): lo tildado en cada navegador se guarda con ellos', () => {
    for (const p of PLANES) expect(p.tareas.map((t) => t.id)).toEqual(p.tareas.map((_, i) => `t${i + 1}`))
  })

  it('toda tarea tiene fecha hábil dentro del ciclo, dueño, criterio y semanas coherentes', () => {
    for (const p of PLANES) {
      expect(p.tareas.length).toBeGreaterThan(0)
      for (const t of p.tareas) {
        expect(fechaValida(t.dia)).toBe(true)
        expect(t.dia >= CICLO.inicio && t.dia <= CICLO.fin2m).toBe(true)
        expect(diaSemana(t.dia)).toBeGreaterThanOrEqual(1)
        expect(diaSemana(t.dia)).toBeLessThanOrEqual(5)
        expect(PERSONAS).toContain(t.quien)
        expect(t.texto.trim().length).toBeGreaterThan(5)
        expect(t.criterio.trim().length).toBeGreaterThan(5)
        // La semana sale de la fecha: si alguien edita una sin la otra, esto lo ve.
        expect(t.semana).toBe(semanaDelCiclo(t.dia))
        expect(t.semana).toBeGreaterThanOrEqual(1)
        expect(t.semana).toBeLessThanOrEqual(8)
        // Semanas 1 a 4: el ciclo de 1 mes es igual (o la tarea queda afuera).
        if (t.semana <= 4) expect(t.semana1m === t.semana || t.semana1m === null).toBe(true)
        // Semanas 5 a 8: se comprimen a la 3 o la 4, o quedan afuera.
        else expect(t.semana1m === null || t.semana1m === 3 || t.semana1m === 4).toBe(true)
      }
    }
  })

  it('el ciclo de 1 mes deja afuera la estadía de Alquileres y nada más', () => {
    for (const p of PLANES) {
      const afuera = p.tareas.filter((t) => t.semana1m === null)
      if (p.modulo === 'alquileres') {
        expect(afuera.length).toBeGreaterThan(0)
        for (const t of afuera) expect(t.texto).toMatch(/^Estadía/)
        expect(p.tareas.filter((t) => /^Estadía/.test(t.texto)).every((t) => t.semana1m === null)).toBe(true)
      } else {
        expect(afuera).toEqual([])
      }
    }
  })

  it('las tareas transversales de Ale viven en Gimnasio con el prefijo "Transversal: "', () => {
    for (const p of PLANES) {
      const transversales = p.tareas.filter((t) => t.texto.startsWith('Transversal: '))
      if (p.modulo === 'gimnasio') {
        expect(transversales.length).toBeGreaterThan(0)
        for (const t of transversales) expect(t.quien).toBe('Ale')
      } else {
        expect(transversales).toEqual([])
      }
    }
  })

  it('los textos no se repiten dentro de un plan, cada semana tiene tareas y ningún día más de tres', () => {
    for (const p of PLANES) {
      const textos = p.tareas.map((t) => t.texto)
      expect(new Set(textos).size).toBe(textos.length)
      const porDia = new Map<string, number>()
      for (const t of p.tareas) porDia.set(t.dia, (porDia.get(t.dia) ?? 0) + 1)
      for (const n of porDia.values()) expect(n).toBeLessThanOrEqual(3)
      const semanas = new Set(p.tareas.map((t) => t.semana))
      for (let s = 1; s <= 8; s++) expect(semanas.has(s)).toBe(true)
    }
  })

  it('toda tarea documentada apunta a una entrada de su mismo módulo, que no es una decisión abierta', () => {
    const porKey = new Map(TODAS.map((e) => [e.key, e]))
    for (const p of PLANES) {
      for (const t of p.tareas.filter((x) => x.auditoria)) {
        const e = porKey.get(t.auditoria!)
        expect(e, `${p.modulo} ${t.id} → ${t.auditoria}`).toBeDefined()
        expect(e!.modulo).toBe(p.modulo)
        expect(e!.abierta).toBe(false)
      }
    }
  })

  it('el ciclo 2 arranca limpio: el jueves 05/11, sin tareas documentadas ni antes del inicio, y sin feriados', () => {
    expect(CICLO).toEqual({ inicio: '2026-11-05', lunes: '2026-11-02', fin2m: '2026-12-23', fin1m: '2026-11-27' })
    expect(semanaDelCiclo(CICLO.inicio)).toBe(1)
    expect(semanaDelCiclo(CICLO.fin2m)).toBe(8)
    for (const p of PLANES) {
      expect(p.tareas.every((t) => !t.auditoria)).toBe(true)
      expect(p.tareas[0].dia).toBe('2026-11-05')
      for (const t of p.tareas) expect(['2026-11-20', '2026-12-08', '2026-12-24', '2026-12-25']).not.toContain(t.dia)
      expect(p.foco).toMatch(/Ciclo 2/)
    }
  })
})

describe('Módulos — entradas y decisiones', () => {
  it('keys auditoria.<modulo>.<fecha>-<slug>, únicas, con una fecha que existe', () => {
    expect(ENTRADAS.length).toBeGreaterThan(0)
    const keys = TODAS.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of TODAS) {
      expect(e.key).toMatch(RE_KEY)
      expect(e.key.split('.')[1]).toBe(e.modulo)
      expect(e.key.split('.')[2].slice(0, 10)).toBe(e.fecha)
      expect(fechaValida(e.fecha)).toBe(true)
    }
  })

  it('cada entrada tiene título, foco de una línea, responsable y lo transversal en Gimnasio con su prefijo', () => {
    for (const e of TODAS) {
      expect(e.titulo.trim().length).toBeGreaterThan(5)
      expect(e.titulo.length).toBeLessThanOrEqual(160)
      expect(e.foco.trim().length).toBeGreaterThan(10)
      expect(e.foco).not.toMatch(/\n/)
      expect(PERSONAS).toContain(e.quien)
      expect(e.origen).toBe('codigo')
      expect(e.transversal).toBe(e.titulo.startsWith('Transversal: '))
      if (e.transversal) expect(e.modulo).toBe('gimnasio')
      // Confirmada para todos solo con una fecha desde el día de la entrada.
      if (e.confirmada !== null) expect(fechaValida(e.confirmada) && e.confirmada >= e.fecha).toBe(true)
    }
  })

  it('el informe de una entrada de sesión avisa que es de sesión y trae sus secciones según el tipo', () => {
    for (const e of ENTRADAS) {
      expect(e.abierta).toBe(false)
      expect(e.informe.startsWith(AVISO_SESION)).toBe(true)
      expect(e.informe.length).toBeLessThanOrEqual(80_000)
      for (const s of ['## Qué se hizo', '## Quién', '## Cuándo', '## Archivos']) expect(e.informe).toContain(s)
      expect(e.informe).toContain(`## Quién\n\n${e.quien}`)
      const archivos = archivosDe(e.informe)
      expect(archivos.length).toBeGreaterThan(0)
      for (const a of archivos) expect(a).toMatch(RE_ARCHIVO)
      expect(e.informe).not.toMatch(/undefined|\[object /)
      if (e.tipo === 'diseño') {
        for (const alt of ['Antes · 1280', 'Después · 1280', 'Antes · 390', 'Después · 390']) {
          expect(e.informe).toMatch(new RegExp(`!\\[${alt}\\]\\(/auditoria/modulos/${e.modulo}/[a-z0-9._-]+\\)`))
        }
      } else {
        expect(e.informe).not.toContain('## Antes / Después')
      }
      if (e.tipo === 'decisión') expect(e.informe).toContain('## Decisión y porqué\n\n**Decisión:** ')
      else expect(e.informe).not.toContain('## Decisión y porqué')
    }
  })

  it('una decisión abierta dice quién la decide, trae su propuesta y no se confirma', () => {
    expect(DECISIONES.length).toBeGreaterThan(0)
    for (const e of DECISIONES) {
      expect(e.tipo).toBe('decisión')
      expect(e.abierta).toBe(true)
      expect(e.confirmada).toBeNull()
      expect(e.informe.startsWith(avisoAbierta(e.quien))).toBe(true)
      for (const s of ['## Propuesta', '## Por qué está abierta', '## De dónde sale', '## Archivos']) expect(e.informe).toContain(s)
      expect(e.informe).not.toContain('## Decisión y porqué')
      expect(e.informe).not.toContain(AVISO_SESION)
      for (const a of archivosDe(e.informe)) expect(a).toMatch(RE_ARCHIVO)
      expect(e.informe.length).toBeLessThanOrEqual(80_000)
    }
    // Las de Mateo van en Turnos; las de Ale que cruzan módulos, en Gimnasio.
    expect(DECISIONES.filter((e) => e.modulo === 'turnos').every((e) => e.quien === 'Mateo')).toBe(true)
  })

  it('toda captura de un informe existe en apps/web/public y dice su ancho', () => {
    let capturas = 0
    for (const e of TODAS) {
      for (const { alt, src } of imagenesDe(e.informe)) {
        capturas += 1
        expect(src.startsWith(`/auditoria/modulos/${e.modulo}/`), `${e.key}: ${src}`).toBe(true)
        expect(existsSync(`${PUBLIC}${src}`), `${e.key}: falta ${src}`).toBe(true)
        // MarkdownInforme reserva la proporción por el ancho del alt o del archivo.
        expect(/(^|\D)(1280|390)(\D|$)/.test(`${alt} ${src.split('/').pop()}`)).toBe(true)
      }
    }
    expect(capturas).toBeGreaterThan(0)
  })

  it('cada informe se lee entero: tablas, código y capturas no quedan como texto suelto', () => {
    for (const e of TODAS) {
      const bloques = parsearMarkdown(e.informe)
      const textos = bloques.flatMap((b) => (b.tipo === 'p' || b.tipo === 'quote' ? [b.texto] : b.tipo === 'ul' || b.tipo === 'ol' ? b.items : []))
      for (const t of textos) {
        expect(t, `${e.key}: imagen suelta`).not.toContain('![')
        expect(t, `${e.key}: bloque de código suelto`).not.toContain('```')
        expect(t.startsWith('|'), `${e.key}: tabla suelta`).toBe(false)
      }
      expect(bloques.filter((b) => b.tipo === 'code').length).toBe((e.informe.match(/^```/gm) ?? []).length / 2)
      expect(bloques.filter((b) => b.tipo === 'table').length).toBe((e.informe.match(/^\|---/gm) ?? []).length)
    }
  })

  it('cada módulo con plan tiene al menos una entrada', () => {
    for (const p of PLANES) expect(TODAS.some((e) => e.modulo === p.modulo)).toBe(true)
  })
})

describe('Módulos — lo compartido', () => {
  it('cada carpeta compartida existe en el repo, con su archivo de reglas, y dice qué es, quién la usa y cómo se prueba', () => {
    expect(CARPETAS_COMPARTIDAS.length).toBeGreaterThanOrEqual(4)
    expect(new Set(CARPETAS_COMPARTIDAS.map((c) => c.ruta)).size).toBe(CARPETAS_COMPARTIDAS.length)
    for (const c of CARPETAS_COMPARTIDAS) {
      expect(c.ruta, c.ruta).toMatch(/^apps\/[A-Za-z0-9/_-]+\/$/)
      expect(existsSync(`${RAIZ}${c.ruta}`), `falta la carpeta ${c.ruta}`).toBe(true)
      expect(existsSync(`${RAIZ}${c.reglas}`), `${c.ruta}: falta ${c.reglas}`).toBe(true)
      for (const texto of [c.nombre, c.que, c.usan, c.probar]) expect(texto.trim().length).toBeGreaterThan(10)
    }
  })

  it('las reglas son varias, cada una de una frase o dos, y la primera dice que un cambio es para los tres', () => {
    expect(REGLAS_COMPARTIDO.length).toBeGreaterThanOrEqual(4)
    for (const r of REGLAS_COMPARTIDO) expect(r.trim().length).toBeGreaterThan(40)
    expect(REGLAS_COMPARTIDO[0]).toMatch(/Turnos, Alquileres y Gimnasio a la vez/)
  })
})
