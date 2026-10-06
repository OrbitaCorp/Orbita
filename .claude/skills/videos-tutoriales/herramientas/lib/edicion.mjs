// Editor: arma la línea de tiempo del compositor (compose/tl.json) y la lista de
// efectos (out/sfx.json) a partir de las tomas. Cada video tiene su editar.mjs
// que declara clips, cámara, carteles y resaltados; lo genérico vive acá.
//
//   const E = crearEdicion({ tomas: [{ nombre: 'toma1' }, { nombre: 'toma1b', offset: 1000 }], voz })
//   E.clip(E.M('inicio'), E.M('tarjeta') + 2)          // tramos de fuente a usar
//   E.dialogoAbrir({ s: E.M('dialogo-abre') + .12, fotos, nombres, carpeta })  // opcional, uno por subida
//   E.capitulo(s, { kicker: 'Opción 1', titulo: 'Con Orbi, en segundos', sub })  // placa entre caminos
//   E.armar()                                          // velocidades + pausas por voz
//   E.camara(E.C('nombre').t, 1, 600, 570, 1.55)       // cámara, carteles, resaltados…
//   E.escribir({ titulo, cierre })
//
// Tiempo "virtual" de fuente: cada toma se corre a su propio rango (offset) para
// mezclar cuadros de varias tomas en una sola lista ordenada.
import fs from 'node:fs'

export function crearEdicion({ tomas, intro = 3.6, outro = 5.4, velocidad = { base: 1.2, tipeo: 1.9 }, esperas = {}, scrolls = 'out/scrolls', voz = null, dir = '.' }) {
  // ── tomas ──────────────────────────────────────────────────────────────
  const T = tomas.map(({ nombre, offset = 0 }) => {
    const L = JSON.parse(fs.readFileSync(`${dir}/tomas/${nombre}/log.json`, 'utf8'))
    const t0 = L.log.find(e => e.type === 'mark' && e.name === 'inicio').t
    const v = t => t - t0 + offset
    const log = L.log.map(e => ({ ...e, toma: nombre, t: v(e.t), ...(e.t1 ? { t1: v(e.t1) } : {}), ...(e.chars ? { chars: e.chars.map(v) } : {}) }))
    const frames = L.frames.map(f => ({ s: v(f.s), f: `../tomas/${nombre}/${f.f}` }))
    // scrolls analizados (scrolls.mjs) de esta toma, si existen
    const fsc = `${dir}/${scrolls}-${nombre}.json`
    const sc = fs.existsSync(fsc) ? JSON.parse(fs.readFileSync(fsc, 'utf8')).filter(x => x.Y > 5).map(x => ({ ...x, sStart: x.sStart + offset, sEnd: x.sEnd + offset })) : []
    return { nombre, offset, log, frames, sc }
  })
  const log = T.flatMap(t => t.log)
  const SCR = T.flatMap(t => t.sc)
  const deToma = n => n ? T.find(t => t.nombre === n).log : T[0].log
  // Marca por nombre. Sin toma: la primera toma; si no está ahí pero sí en UNA sola de las otras, esa.
  const M = (name, toma) => {
    let e = deToma(toma).find(e => e.type === 'mark' && e.name === name)
    if (!e && !toma) { const en = T.filter(t => t.log.some(x => x.type === 'mark' && x.name === name)); if (en.length === 1) e = en[0].log.find(x => x.type === 'mark' && x.name === name); else if (en.length > 1) throw new Error(`La marca ${name} está en varias tomas (${en.map(t => t.nombre).join(', ')}): indicá cuál, p. ej. M('${name}', '${en[0].nombre}') o '${en[0].nombre}:${name}'`) }
    if (!e) throw new Error('Falta la marca ' + name + (toma ? ' en ' + toma : ''))
    return e.t
  }
  const F = foco => { const e = log.find(e => e.type === 'mark' && e.foco === foco); if (!e) throw new Error('Falta el foco ' + foco); return e }
  const C = label => { const e = log.find(e => e.type === 'click' && e.label === label); if (!e) throw new Error('Falta el clic ' + label); return e }
  const S = label => { const e = log.find(e => e.type === 'scroll' && e.label === label); if (!e) throw new Error('Falta el scroll ' + label); return e }
  const HL = name => log.filter(e => e.type === 'mark' && e.hl === name)
  // Referencias de texto para el guion de voz: 'marca', 'toma2b:marca', 'clic:x',
  // 'foco:x', 'scroll:x', 'hl:x', con desplazamiento opcional ('+0.3', '-0.4')
  function ref(r) {
    const [base, off] = r.split(/(?=[+-]\d)/)
    const n = off ? Number(off) : 0
    if (!base.includes(':')) return M(base) + n
    const [tipo, nombre] = base.split(':')
    if (tipo === 'clic') return C(nombre).t + n
    if (tipo === 'foco') return F(nombre).t + n
    if (tipo === 'scroll') return S(nombre).t + n
    if (tipo === 'hl') return HL(nombre)[0].t + n
    return M(nombre, tipo) + n      // 'toma:marca'
  }

  // ── clips y velocidades ───────────────────────────────────────────────
  const clips = []
  const waits = log.filter(e => e.type === 'wait' && e.t1 && e.t1 - e.t > .9)
  const types = log.filter(e => e.type === 'type')
  const scrollDur = sc => Math.max(.6, (sc.ms ?? 850) / 1000 * .92)
  function tramos(a, b) {
    const cortes = new Set([a, b])
    const add = (x) => { if (x > a && x < b) cortes.add(x) }
    for (const w of waits) { add(w.t); add(w.t1) }
    for (const ty of types) { add(ty.t); add(ty.t1) }
    for (const sc of SCR) { add(sc.sStart); add(sc.sEnd) }
    const pts = [...cortes].sort((x, y) => x - y), out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const s0 = pts[i], s1 = pts[i + 1], mid = (s0 + s1) / 2
      const iSc = SCR.findIndex(sc => mid > sc.sStart && mid < sc.sEnd)
      if (iSc >= 0) { out.push({ s0, s1, dur: scrollDur(SCR[iSc]) * ((s1 - s0) / (SCR[iSc].sEnd - SCR[iSc].sStart)), scroll: iSc }); continue }
      const w = waits.find(w => mid > w.t && mid < w.t1), ty = types.find(t => mid > t.t && mid < t.t1)
      const objetivo = w ? esperas[w.label] : undefined
      const dur = w && objetivo ? objetivo * ((s1 - s0) / (w.t1 - w.t)) : ty ? (s1 - s0) / velocidad.tipeo : (s1 - s0) / velocidad.base
      out.push({ s0, s1, dur, ...(w && objetivo ? { ease: true } : {}) })
    }
    return out
  }
  const pausas = new Map()
  let segs = [], fin = 0, D = 0
  function construir() {
    segs = []
    let o = intro - .15
    const primero = clips.find(c => c.a != null)
    segs.push({ o0: 0, o1: o, s0: primero.a, s1: primero.a })
    for (const c of clips) {
      if (c.hold != null) { segs.push({ o0: o, o1: o + c.dur, s0: c.hold, s1: c.hold, hold: true, ...(c.id ? { id: c.id } : {}), ...(c.xf ? { xf: c.xf } : {}) }); o += c.dur; continue }
      let first = true
      const extras = [...pausas.entries()].filter(([s]) => s > c.a && s <= c.b).sort((x, y) => x[0] - y[0])
      const flags = (tr) => ({ ...(tr.ease ? { ease: true } : {}), ...(tr.scroll != null ? { scroll: tr.scroll } : {}), ...(first && c.xf ? { xf: c.xf } : {}) })
      for (const tr of tramos(c.a, c.b)) {
        let s0 = tr.s0
        for (const [sp, extra] of extras) {
          if (sp > s0 && sp <= tr.s1) {
            const f = (sp - s0) / (tr.s1 - tr.s0)
            segs.push({ o0: o, o1: o + tr.dur * f, s0, s1: sp, ...flags(tr) }); o += tr.dur * f; first = false
            segs.push({ o0: o, o1: o + extra, s0: sp, s1: sp, hold: true }); o += extra
            s0 = sp
          }
        }
        const f = (tr.s1 - s0) / (tr.s1 - tr.s0)
        if (f > 1e-6) { segs.push({ o0: o, o1: o + tr.dur * f, s0, s1: tr.s1, ...flags(tr) }); o += tr.dur * f }
        first = false
      }
    }
    fin = o
  }
  // fuente (virtual) → salida
  function out(s) {
    for (const g of segs) {
      if (g.s1 === g.s0) continue
      if (s >= g.s0 - 1e-6 && s <= g.s1 + 1e-6) {
        const u = (s - g.s0) / (g.s1 - g.s0)
        if (g.ease) { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (m * m * m * (m * (m * 6 - 15) + 10) < u) lo = m; else hi = m } return g.o0 + (g.o1 - g.o0) * lo }
        return g.o0 + (g.o1 - g.o0) * u
      }
    }
    return null
  }
  const enClip = s => clips.some(c => c.a != null && s >= c.a && s <= c.b)

  // ── cámara, cursor, carteles, resaltados, diálogo, sonidos ────────────
  const cam = [], cur = [], curVis = [], clicks = [], caps = [], hl = [], sfx = []
  const dialogDefs = [], dialogos = [], capDefs = [], capitulos = []
  const oDe = s => { const t = typeof s === 'object' ? s.o : out(s); if (t == null) throw new Error('Tiempo fuera de los clips: ' + JSON.stringify(s)); return t }

  const E = {
    log, M, F, C, S, HL, ref, out: s => out(s), oDe,
    get segs() { return segs }, get fin() { return fin }, get D() { return D },
    get capitulos() { return capitulos }, get dialogos() { return dialogos },
    centro: b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }),
    // Clip de fuente [a, b]; xf = fundido cruzado al entrar (segundos)
    clip(a, b, { xf } = {}) { clips.push({ a, b, ...(xf ? { xf } : {}) }); return E },
    // Pausa en un cuadro fijo (p. ej. mientras aparece el diálogo "Abrir")
    pausa(s, dur, id, { xf } = {}) { clips.push({ hold: s, dur, id, ...(xf ? { xf } : {}) }); return E },
    // Diálogo "Abrir" de Windows 11 (recreación: el navegador headless no muestra
    // el nativo). Se inserta como pausa en `s` y mueve el cursor por el diálogo.
    // Se puede llamar varias veces (un diálogo por subida de archivos).
    dialogoAbrir({ s, fotos, nombres, carpeta = 'Imágenes' }) {
      const varios = fotos.length > 1
      const rel = varios ? { abre: .7, c1: 1.45, c2: 2.3, c3: 3.3, cierra: 3.42, fin: 3.65 } : { abre: .7, c1: 1.45, c2: null, c3: 2.35, cierra: 2.47, fin: 2.7 }
      const def = { id: 'dialogo-' + (dialogDefs.length + 1), s, fotos, nombres, carpeta, rel }
      dialogDefs.push(def)
      E.pausa(s, rel.fin, def.id)
      return E
    },
    // Placa de capítulo ("Opción 1 · Con Orbi, en segundos"): pausa en el cuadro s
    // con el panel oscurecido y el título al centro. Con voz, dura lo que la
    // frase anclada a 'cap:N' (N = orden del capítulo, desde 1) + aire.
    capitulo(s, { kicker, titulo, sub, dur = 2.6, xf = .5 } = {}) {
      const n = capDefs.length + 1
      const fr = voz?.frases.find(f => f.desde === 'cap:' + n)
      const d = fr ? Math.max(dur, fr.dur + (fr.offset ?? .35) + .55) : dur
      capDefs.push({ id: 'cap-' + n, kicker, titulo, sub })
      E.pausa(s, d, 'cap-' + n, { xf })
      return E
    },
    // Calcula los tramos (y las pausas para que entre cada frase si hay voz)
    armar() {
      construir()
      if (voz) {
        for (let it = 0; it < 5; it++) {
          let cambio = false
          for (const fr of voz.frases) {
            if (!fr.hasta || fr.desde === 'intro' || fr.desde === 'cierre' || String(fr.desde).startsWith('cap:')) continue
            const o0 = out(ref(fr.desde)) + (fr.offset ?? 0), o1 = out(ref(fr.hasta))
            // ancla mal puesta (p. ej. una marca en el borde de un clip que out() ubica en otro clip)
            if (!(o1 > o0 - .01) || o1 - o0 > 60) { if (it === 0) console.warn(`⚠ frase "${fr.id}": 'hasta' (${fr.hasta}) cae antes que 'desde' (${fr.desde}) o muy lejos: revisá las anclas (sumá +0.1 si la marca está en el borde de un clip)`); continue }
            const falta = (fr.dur + .45) - (o1 - o0)
            if (falta > .05) { const sp = ref(fr.pausaEn ?? fr.hasta) - .02; pausas.set(sp, (pausas.get(sp) ?? 0) + falta); cambio = true }
          }
          if (!cambio) break
          construir()
        }
      }
      D = fin + outro
      const ultimo = [...clips].reverse().find(c => c.a != null)
      segs.push({ o0: fin, o1: D, s0: ultimo.b, s1: ultimo.b })
      for (const def of dialogDefs) {
        const H0 = segs.find(g => g.hold && g.id === def.id).o0, r = def.rel
        dialogos.push({ o0: H0 + r.abre, click1: H0 + r.c1, click2: r.c2 != null ? H0 + r.c2 : null, click3: H0 + r.c3, close: H0 + r.cierra, H0,
          fotos: def.fotos.map(f => `../fotos/${f}`), nombres: def.nombres ?? def.fotos, carpeta: def.carpeta })
        // cámara a plano general mientras se abre el diálogo
        cam.push({ t: +H0.toFixed(3), d: .65, x: 720, y: 450, z: 1 })
      }
      for (const def of capDefs) {
        const g = segs.find(g => g.hold && g.id === def.id)
        capitulos.push({ o0: +g.o0.toFixed(3), o1: +g.o1.toFixed(3), kicker: def.kicker, titulo: def.titulo, sub: def.sub })
        curVis.push({ t: g.o0 + .05, v: 0 }, { t: g.o1 - .15, v: 1 })
      }
      // cursor y clics desde el registro
      for (const e of log) {
        if (!enClip(e.t)) continue
        if (e.type === 'move') { const a = out(e.t), b = out(e.t1 ?? e.t + e.d); if (a != null && b != null) cur.push({ t: +a.toFixed(4), d: +Math.max(.05, b - a).toFixed(4), x: e.x, y: e.y }) }
        if (e.type === 'click') clicks.push(+out(e.t).toFixed(4))
      }
      for (const dialog of dialogos) {
        // geometría del diálogo en coordenadas de mundo (ver compositor: DLG)
        const item = i => ({ x: 520 + 196 + 22 + i * 148 + 68 - 240, y: 250 + 120 + 18 + 60 - 112 })
        const abrir = { x: 520 + 880 - 132 - 48 - 240, y: 250 + 560 - 104 + 58 + 16 - 112 }
        const ult = dialog.fotos.length - 1
        cur.push({ t: dialog.click1 - .55, d: .45, ...item(0) })
        if (dialog.click2 != null) cur.push({ t: dialog.click2 - .6, d: .5, ...item(ult) })
        cur.push({ t: dialog.click3 - .62, d: .5, ...abrir })
        clicks.push(dialog.click1, ...(dialog.click2 != null ? [dialog.click2] : []), dialog.click3)
      }
      cur.unshift({ t: intro - .4, d: .01, x: 760, y: 520 })
      curVis.push({ t: intro + .05, v: 1 })
      curVis.push({ t: fin + .2, v: 0 })
      return E
    },
    // Cámara: a los s (fuente) se mueve en d segundos hacia el foco (x, y en px
    // de pantalla) con zoom z. lead adelanta el movimiento (salida).
    camara(s, d, x, y, z, lead = 0) { cam.push({ t: +(oDe(s) - lead).toFixed(3), d, x, y, z }); return E },
    general(s, d = .9, lead = 0) { return E.camara(s, d, 720, 450, 1, lead) },
    // Esconde el cursor alrededor de un corte y lo reaparece en (x, y)
    cursorCorte(o, x = 1040, y = 700) { curVis.push({ t: o - .05, v: 0 }, { t: o + .55, v: 1 }); cur.push({ t: o - .02, d: .01, x, y }); return E },
    // Cartel: dos seguidos con el mismo número son el mismo paso (solo cambia el texto)
    cartel(s0, s1, n, txt, sub) { caps.push({ o0: +oDe(s0).toFixed(3), o1: +oDe(s1).toFixed(3), n, txt, ...(sub ? { sub } : {}) }); return E },
    // Resaltado de un bloque (marcas 'hl' del grabador) hasta `hasta`
    resaltar(nombre, hasta) {
      const ms = HL(nombre)
      hl.push({ id: nombre, o0: +oDe(ms[0].t + .05).toFixed(3), o1: +oDe(hasta).toFixed(3), boxes: ms.filter(m => m.box).map(m => ({ t: +oDe(m.t).toFixed(3), ...m.box })) })
      return E
    },
    // Resaltado con una caja dada a mano (px de pantalla)
    resaltarCaja(id, desde, hasta, box) { hl.push({ id, o0: +oDe(desde).toFixed(3), o1: +oDe(hasta).toFixed(3), boxes: [{ t: +oDe(desde).toFixed(3), ...box }] }); return E },
    sonido(t, kind, gain = 1, extra = {}) { if (t != null && t >= 0 && t <= D) sfx.push({ t: +t.toFixed(4), kind, gain, ...extra }); return E },

    // Escribe tl.json + sfx.json (y los tiempos de voz si hay guion)
    // nombre: para varios cortes en un mismo proyecto (p. ej. 'avanzado' → tl-avanzado.json, sfx-avanzado.json…)
    escribir({ titulo = 'Cómo …', cierre = 'Listo.', nombre = '' } = {}) {
      const n = nombre ? '-' + nombre : '', v = voz ? '-voz' : ''
      const tl = `compose/tl${n}${v}.json`, sfxArchivo = `out/sfx${n}${v}.json`
      const urls = log.filter(e => e.type === 'url').map(e => ({ s: e.t, u: e.u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '') })).sort((a, b) => a.s - b.s)
      const frames = T.flatMap(t => t.frames).sort((a, b) => a.s - b.s)
      const scrollsTL = SCR.map(sc => ({ label: sc.label, Y: sc.Y, zona: sc.zona, frames: [...sc.frames].sort((a, b) => a.P - b.P).map(f => ({ f: f.f, P: f.P })) }))
      cam.sort((a, b) => a.t - b.t); cur.sort((a, b) => a.t - b.t); curVis.sort((a, b) => a.t - b.t); clicks.sort((a, b) => a - b); caps.sort((a, b) => a.o0 - b.o0)
      fs.writeFileSync(`${dir}/${tl}`, JSON.stringify({ duration: +D.toFixed(3), intro, outro, title: titulo, endTitle: cierre, frames, segs, urls, cam, cur, curVis, clicks, caps, hl, dialogos, capitulos, scrolls: scrollsTL }))

      // sonidos automáticos
      const add = E.sonido, pan = x => Math.max(-.35, Math.min(.35, (x - 720) / 720 * .35))
      add(.05, 'thump', .8); add(.15, 'shimmer', .55, { dur: .9 }); add(.62, 'pop', .35); add(1.0, 'pop', .3)
      add(2.25, 'whoosh', .7, { dur: 1.0 }); add(2.65, 'swoosh', .35, { dur: .7 })
      const OUT = D - outro
      add(OUT + .05, 'swoosh', .45, { dur: .8 }); add(OUT + .4, 'whoosh', .6, { dur: 1.0 })
      add(OUT + 1.05, 'thump', .7); add(OUT + 1.2, 'shimmer', .5, { dur: .9 }); add(OUT + 1.7, 'success', .7); add(OUT + 2.15, 'pop', .3)
      for (const e of log) {
        if (!enClip(e.t)) continue
        if (e.type === 'click') add(out(e.t), 'click', 1, { pan: pan(e.x) })
        if (e.type === 'type') { let last = -1; for (const c of e.chars) { const t = out(c); if (t != null && t - last >= .045) { add(t, 'key', .55, { pan: -.05 }); last = t } } }
      }
      const sm = m => m * m * m * (m * (m * 6 - 15) + 10)
      for (const g of segs.filter(g => g.scroll != null)) {
        const n = Math.max(6, Math.round(SCR[g.scroll].Y / 45))
        for (let k = 0; k < n; k++) { const target = (k + .5) / n; let lo = 0, hi = 1; for (let j = 0; j < 30; j++) { const m = (lo + hi) / 2; if (sm(m) < target) lo = m; else hi = m } add(g.o0 + (g.o1 - g.o0) * lo, 'tick', .42, { pan: .1 }) }
      }
      for (const dialog of dialogos) { for (const c of [dialog.click1, dialog.click2, dialog.click3]) if (c != null) add(c, 'click', 1, { pan: .05 }); add(dialog.o0 - .05, 'swoosh', .2, { dur: .35 }) }
      for (const c of capitulos) { add(c.o0, 'whoosh', .5, { dur: .9 }); add(c.o0 + .3, 'pop', .3, { pitch: 1.15 }); add(c.o1 - .35, 'swoosh', .25, { dur: .5 }) }
      for (const h of hl) add(h.o0, 'pop', .16, { pitch: 1.6 })
      let zPrev = 1
      for (const k of cam) { if (Math.abs(Math.log(k.z / zPrev)) > .22 && k.d > .5) add(k.t, 'swoosh', .14, { dur: k.d * .9 }); zPrev = k.z }
      caps.forEach((c, i) => { const p = caps[i - 1]; if (!(p && p.n === c.n && Math.abs(p.o1 - c.o0) < .05)) add(c.o0, 'pop', .22, { pitch: 1.35 }) })
      sfx.sort((a, b) => a.t - b.t)
      fs.writeFileSync(`${dir}/${sfxArchivo}`, JSON.stringify({ duration: D, events: sfx }, null, 1))

      if (voz) {
        const tCap = d => { const c = capitulos[Number(String(d).slice(4)) - 1]; if (!c) throw new Error('No hay capítulo ' + d); return c.o0 }
        const tiempos = voz.frases.map(fr => ({ id: fr.id, t: fr.desde === 'intro' ? (fr.offset ?? .55) : fr.desde === 'cierre' ? OUT + (fr.offset ?? 1.5) : String(fr.desde).startsWith('cap:') ? tCap(fr.desde) + (fr.offset ?? .35) : out(ref(fr.desde)) + (fr.offset ?? 0), dur: fr.dur }))
        let prev = null
        for (const f of tiempos) { if (prev && prev.t + prev.dur > f.t + .05) console.warn(`⚠ la frase "${f.id}" se pisa con "${prev.id}" (${(prev.t + prev.dur - f.t).toFixed(2)} s): ajustá offset`); prev = f }
        fs.writeFileSync(`${dir}/out/voz-tiempos${n}.json`, JSON.stringify(tiempos, null, 1))
      }
      const extra = [...pausas.values()].reduce((a, b) => a + b, 0)
      console.log(`Duración ${D.toFixed(1)} s · ${segs.length} tramos · ${frames.length} cuadros · ${cam.length} cámaras · ${caps.length} carteles · ${hl.length} resaltados · ${sfx.length} sonidos${voz ? ` · pausas por voz ${extra.toFixed(1)} s` : ''}`)
      for (const c of caps) console.log(`  ${c.o0.toFixed(1).padStart(6)}–${c.o1.toFixed(1).padStart(6)}  ${c.n} ${c.txt}`)
      console.log(`→ ${tl} · ${sfxArchivo}${voz ? ` · out/voz-tiempos${n}.json` : ''}`)
      return { tl, sfx: sfxArchivo }
    },
  }
  return E
}
