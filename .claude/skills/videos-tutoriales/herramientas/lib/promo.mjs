// Editor de PROMOS (reel 9:16 o video 16:9): arma la línea de tiempo del
// compositor de promos (compose/promo.html) a partir de las tomas.
// A diferencia del tutorial (una sola ventana que sigue la toma), una promo es
// un MONTAJE: planos cortos de varias tomas, cada uno en un dispositivo
// (celular o navegador), con la voz primero y los cortes sobre el ritmo.
//
//   const P = crearPromo({ formato: 'reel', tomas: ['tienda', 'panel'], voz })
//   P.plano({ toma: 'tienda', desde: 'portada', hasta: 'categorias', dur: 2.4, disp: 'celular', cam: [...] })
//   P.frase('a1', P.o0 + .1, { estilo: 'gancho' })      // voz + texto en pantalla
//   P.alinear({ bpm, offset })                          // cortes al pulso de la música
//   P.escribir({ nombre: 'reel-a', cierre: '…' })
//
// Tiempos de FUENTE: segundos desde la marca 'inicio' de cada toma. Se pueden
// dar como número o como marca ('ficha', 'clic:comprar', 'foco:metodo') con
// desplazamiento ('ficha+0.4').
import fs from 'node:fs'

export const FORMATOS = { reel: { W: 1080, H: 1920 }, ancho: { W: 1920, H: 1080 } }

export function crearPromo({ formato = 'reel', tomas, voz = null, dir = '.', outro = 3.4 }) {
  const { W, H } = FORMATOS[formato]
  const T = {}
  for (const nombre of tomas) {
    const L = JSON.parse(fs.readFileSync(`${dir}/tomas/${nombre}/log.json`, 'utf8'))
    const t0 = L.log.find(e => e.type === 'mark' && e.name === 'inicio').t
    const v = t => t - t0
    const log = L.log.map(e => ({ ...e, t: v(e.t), ...(e.t1 ? { t1: v(e.t1) } : {}), ...(e.chars ? { chars: e.chars.map(v) } : {}) }))
    const vista = L.log.find(e => e.type === 'vista') ?? { w: 1440, h: 900, movil: false }
    const frames = L.frames.map(f => ({ s: +v(f.s).toFixed(4), f: `../tomas/${nombre}/${f.f}` })).sort((a, b) => a.s - b.s)
    // scrolls medidos (scrolls.mjs) y CONSISTENTES: los demás se muestran tal cual
    const fsc = `${dir}/out/scrolls-${nombre}.json`
    const scrolls = fs.existsSync(fsc) ? JSON.parse(fs.readFileSync(fsc, 'utf8'))
      .filter(x => x.Y > 5 && Math.abs(x.escala - 1) < .06)
      .map(x => ({ label: x.label, sStart: x.sStart, sEnd: x.sEnd, Y: x.Y, zona: x.zona, frames: x.frames.map(f => ({ f: f.f, P: f.P })).sort((a, b) => a.P - b.P) })) : []
    const urls = log.filter(e => e.type === 'url').map(e => ({ s: e.t, u: e.u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '') }))
    T[nombre] = { nombre, log, vista: { w: vista.w, h: vista.h, movil: !!vista.movil }, frames, scrolls, urls }
  }
  const fraseVoz = id => { const f = voz?.frases.find(f => f.id === id); if (!f) throw new Error('Falta la frase ' + id + ' en la voz'); return f }

  // ── referencias de fuente ──────────────────────────────────────────────
  function src(toma, r) {
    if (typeof r === 'number') return r
    const [base, off] = String(r).split(/(?=[+-]\d)/)
    const n = off ? Number(off) : 0, L = T[toma].log
    let e
    if (base.startsWith('clic:')) e = L.find(x => x.type === 'click' && x.label === base.slice(5))
    else if (base.startsWith('foco:')) e = L.find(x => x.type === 'mark' && x.foco === base.slice(5))
    else if (base.startsWith('scroll:')) e = L.find(x => x.type === 'scroll' && x.label === base.slice(7))
    else e = L.find(x => x.type === 'mark' && x.name === base)
    if (!e) throw new Error(`Falta la referencia "${base}" en la toma ${toma}`)
    return e.t + n
  }
  const caja = (toma, r) => {
    const L = T[toma].log, [tipo, nombre] = r.split(':')
    const e = tipo === 'foco' ? L.find(x => x.type === 'mark' && x.foco === nombre) : L.find(x => x.type === 'click' && x.label === nombre)
    if (!e?.box) throw new Error(`Sin caja para ${r} en ${toma}`)
    return e.box
  }
  const centro = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

  // ── planos ─────────────────────────────────────────────────────────────
  const planos = [], textos = [], vozEv = [], sfx = [], flashes = [], chips = []
  let o = 0
  const E = {
    W, H, formato, T,
    get o() { return o }, set o(v) { o = v },
    src, caja, centro,
    // duración y tramos de una frase de la voz
    dur: id => fraseVoz(id).dur,
    // Un plano: tramo [desde, hasta] de una toma, en `dur` segundos de salida
    // (o a velocidad `vel`). cam: [{ en: s desde el inicio del plano | 'fin', d, x, y | foco/clic, z }]
    // entra: 'corte' | 'desliza' | 'fundido' | 'escala' (por defecto: desliza si cambia el dispositivo)
    plano({ toma, desde, hasta, dur, vel, disp, cam = [], entra, d: dTr, id, cam0, tocar = true }) {
      const s0 = src(toma, desde), s1 = hasta != null ? src(toma, hasta) : null
      if (s1 == null && !dur) throw new Error('plano: falta hasta o dur')
      const D = dur ?? (s1 - s0) / (vel ?? 1)
      const S1 = s1 ?? s0 + D * (vel ?? 1)
      disp = disp ?? (T[toma].vista.movil ? 'celular' : 'navegador')
      const prev = planos.at(-1)
      const tipo = entra ?? (prev && prev.disp !== disp ? 'desliza' : 'corte')
      const p = { id: id ?? `p${planos.length + 1}`, toma, disp, o0: o, o1: o + D, s0, s1: S1, entra: { tipo, d: dTr ?? (tipo === 'desliza' ? .42 : tipo === 'fundido' ? .25 : tipo === 'escala' ? .35 : 0) }, tocar }
      const k = (S1 - s0) / D
      if (k > 3.2) console.warn(`⚠ plano ${p.id}: velocidad ×${k.toFixed(1)} (muy rápido)`)
      p.cam = cam.map(c => {
        const t = c.en === 'fin' ? p.o1 - (c.d ?? .8) : p.o0 + (c.en ?? 0)
        let x = c.x, y = c.y
        if (c.foco || c.clic) ({ x, y } = centro(caja(toma, c.foco ? 'foco:' + c.foco : 'clic:' + c.clic)))
        return { t: +t.toFixed(3), d: c.d ?? .8, x: x + (c.dx ?? 0), y: y + (c.dy ?? 0), z: c.z ?? 1 }
      })
      if (cam0) { let { x, y } = cam0; if (cam0.foco || cam0.clic) ({ x, y } = centro(caja(toma, cam0.foco ? 'foco:' + cam0.foco : 'clic:' + cam0.clic))); p.cam0 = { x: x + (cam0.dx ?? 0), y: y + (cam0.dy ?? 0), z: cam0.z ?? 1 } }
      planos.push(p); o = p.o1
      return p
    },
    // fuente → salida dentro de un plano
    salida(p, s) { return p.o0 + (s - p.s0) / (p.s1 - p.s0) * (p.o1 - p.o0) },
    // Voz + texto en pantalla. estilo: 'gancho' (grande, palabra por palabra),
    // 'sub' (subtítulo por grupos de palabras), 'rubro' (una palabra gigante por
    // tramo de voz), null (sin texto)
    frase(id, t, { estilo = 'sub', hasta, pantalla } = {}) {
      const f = fraseVoz(id)
      vozEv.push({ id, t: +t.toFixed(3), dur: f.dur })
      if (estilo) textos.push({ tipo: estilo, o0: +t.toFixed(3), o1: +(hasta ?? t + f.dur + .35).toFixed(3), ...palabras(pantalla ?? f.pantalla ?? f.texto, f, t, estilo) })
      return { t, fin: t + f.dur }
    },
    // Texto suelto (sin voz)
    texto({ o0, o1, tipo = 'gancho', texto }) { textos.push({ tipo, o0, o1, ...palabras(texto, null, o0, tipo, o1 - o0) }) },
    // Etiqueta chica arriba del dispositivo ("PAQUETE AVANZADO")
    chip(o0, o1, texto) { chips.push({ o0: +o0.toFixed(3), o1: +o1.toFixed(3), texto }) },
    flash(t) { flashes.push(+t.toFixed(3)) },
    sonido(t, kind, gain = 1, extra = {}) { sfx.push({ t: +t.toFixed(4), kind, gain, ...extra }) },
    // Corre cada corte entre planos al pulso más cercano (±tol s): los cortes
    // caen sobre la música. La voz y los textos no se mueven.
    alinear({ bpm, offset = 0, tol = .2, sub = 2 } = {}) {
      if (!bpm) return
      const paso = 60 / bpm / sub
      for (let i = 1; i < planos.length; i++) {
        const c = planos[i].o0, q = offset + Math.round((c - offset) / paso) * paso
        if (Math.abs(q - c) <= tol && q > planos[i - 1].o0 + .25 && q < planos[i].o1 - .25) {
          const dq = q - c
          planos[i - 1].o1 = q; planos[i].o0 = q
          for (const k of planos[i].cam) if (k.t < q) k.t = q
          void dq
        }
      }
    },
  }

  // palabras con su momento de aparición (proporcional a los tramos con voz)
  // "pantalla" admite '|' para marcar a mano los grupos del subtítulo: si hay
  // tantos grupos como tramos de voz, cada grupo cae en su tramo.
  function palabras(texto, f, t0, estilo, durSinVoz = 1.5) {
    const partes = texto.split('|').map(s => s.trim()).filter(Boolean)
    const ws = []
    let enf = false
    partes.forEach((parte, gi) => {
      for (const w of parte.split(/\s+/)) {
        const abre = w.startsWith('*'), cierra = /\*[.,:;?!]*$/.test(w)
        if (abre) enf = true
        ws.push({ w: w.replace(/\*/g, ''), enf, g: gi })
        if (cierra) enf = false
      }
    })
    const tramos = f?.tramos?.length ? f.tramos : [[0, f ? f.dur : durSinVoz]]
    const repartir = (lista, trs) => {
      const voz = trs.reduce((s, [a, b]) => s + (b - a), 0)
      const pos = u => { let r = u * voz; for (const [a, b] of trs) { if (r <= b - a) return a + r; r -= b - a } return trs.at(-1)[1] }
      const total = lista.reduce((s, x) => s + x.w.length + 1, 0)
      let acc = 0
      for (const x of lista) { x.t = +(t0 + pos(acc / total)).toFixed(3); acc += x.w.length + 1 }
    }
    if (partes.length > 1 && partes.length === tramos.length) partes.forEach((_, gi) => repartir(ws.filter(x => x.g === gi), [tramos[gi]]))
    else repartir(ws, tramos)
    if (estilo === 'rubro' && f?.tramos?.length) {
      // un grupo por tramo de voz: "¿Ferretería?" "¿Pet shop?"…
      const grupos = texto.split(/(?<=\?)\s+/)
      return { grupos: grupos.map((g, i) => ({ texto: g.replace(/\*/g, ''), t: +(t0 + (f.tramos[i]?.[0] ?? 0)).toFixed(3) })) }
    }
    if (estilo === 'sub') {
      // 1) un grupo por tramo de voz (las pausas reales de la frase)
      const porTramo = []
      for (const x of ws) {
        const k = tramos.findIndex(([a], i) => i === tramos.length - 1 || x.t - t0 < tramos[i + 1][0] - .02)
        ;(porTramo[k] ??= []).push(x)
      }
      // 2) los largos se parten en el mejor lugar: equilibrado, nunca después de
      //    una palabra débil ("al", "de", "y"…), mejor en la puntuación o antes de "y/o/con"
      const largo = a => a.reduce((s, y) => s + y.w.length + 1, 0) - 1
      const debil = /^(al|del|de|el|la|los|las|y|o|con|por|en|tu|tus|a|un|una|que|para|sin|se|te)$/i
      const trocear = a => {
        if (a.length <= 5 && largo(a) <= 26) return [a]
        let best = null
        for (let i = 1; i < a.length; i++) {
          let c = Math.abs(largo(a.slice(0, i)) - largo(a.slice(i))) / 8
          if (debil.test(a[i - 1].w.replace(/[.,:;?!]/g, ''))) c += 6
          if (/[.,:;?!]$/.test(a[i - 1].w)) c -= 3
          if (/^(y|o|con|que|para|sin)$/i.test(a[i].w)) c -= 2
          if (!best || c < best.c) best = { i, c }
        }
        return [...trocear(a.slice(0, best.i)), ...trocear(a.slice(best.i))]
      }
      const grupos = partes.length > 1
        ? partes.map((_, gi) => ws.filter(x => x.g === gi))
        : porTramo.filter(Boolean).flatMap(trocear)
      return { grupos: grupos.map(g => ({ t: g[0].t, palabras: g })) }
    }
    return { palabras: ws }
  }

  // ── salida ─────────────────────────────────────────────────────────────
  E.escribir = ({ nombre = formato, cierre = 'Tu tienda y tu negocio, en un solo lugar.', subCierre = 'Sin comisión por venta', marca = true } = {}) => {
    const fin = o, D = +(fin + outro).toFixed(3)
    // toques/clics y cursor desde el registro de cada plano
    const toques = [], cursores = [], teclas = []
    for (const p of planos) {
      const L = T[p.toma].log
      const enP = s => s >= p.s0 - 1e-6 && s <= p.s1 + 1e-6
      if (p.tocar) for (const e of L) if (e.type === 'click' && enP(e.t)) toques.push({ t: +E.salida(p, e.t).toFixed(4), x: e.x, y: e.y, p: p.id, disp: p.disp })
      for (const e of L) if (e.type === 'type') for (const c of e.chars) if (enP(c)) teclas.push(+E.salida(p, c).toFixed(4))
      if (p.disp === 'navegador') {
        // posición del mouse al empezar el plano + movimientos dentro del plano
        let pos = { x: T[p.toma].vista.w / 2, y: T[p.toma].vista.h / 2 }
        for (const e of L) if (e.type === 'move' && (e.t1 ?? e.t + e.d) <= p.s0) pos = { x: e.x, y: e.y }
        const ks = [{ t: p.o0, d: .01, x: pos.x, y: pos.y }]
        for (const e of L) if (e.type === 'move' && enP(e.t)) ks.push({ t: +E.salida(p, e.t).toFixed(4), d: +Math.max(.05, E.salida(p, Math.min(p.s1, e.t1 ?? e.t + e.d)) - E.salida(p, e.t)).toFixed(4), x: e.x, y: e.y })
        cursores.push({ p: p.id, keys: ks })
      }
    }
    const tomasTL = {}
    for (const n of new Set(planos.map(p => p.toma))) {
      const t = T[n], usados = planos.filter(p => p.toma === n)
      const lo = Math.min(...usados.map(p => Math.min(p.s0, p.s1))) - .5, hi = Math.max(...usados.map(p => Math.max(p.s0, p.s1))) + .5
      tomasTL[n] = { vista: t.vista, frames: t.frames.filter(f => f.s >= lo && f.s <= hi), scrolls: t.scrolls.filter(s => s.sEnd >= lo && s.sStart <= hi), urls: t.urls }
    }
    const tl = { W, H, formato, duration: D, fin, outro, endTitle: cierre, endSub: subCierre, marca, tomas: tomasTL, planos, textos, chips, flashes, toques, cursores, voz: vozEv }
    fs.writeFileSync(`${dir}/compose/tl-${nombre}.json`, JSON.stringify(tl))

    // sonidos automáticos
    const add = E.sonido
    for (let i = 1; i < planos.length; i++) {
      const p = planos[i]
      if (p.entra.tipo === 'desliza') add(p.o0 - .06, 'whoosh', .55, { dur: .5 })
      else if (p.entra.tipo === 'escala') add(p.o0 - .04, 'swoosh', .35, { dur: .45 })
      else if (p.entra.tipo === 'corte') add(p.o0, 'tick', .18)
    }
    for (const q of toques) add(q.t, q.disp === 'celular' ? 'pop' : 'click', q.disp === 'celular' ? .32 : .8, q.disp === 'celular' ? { pitch: 1.45 } : { pan: 0 })
    let last = -1; for (const k of teclas.sort((a, b) => a - b)) if (k - last >= .045) { add(k, 'key', .45); last = k }
    for (const x of textos) {
      if (x.tipo === 'gancho') { let n = 0; for (const w of x.palabras) if (w.enf && n++ < 3) add(w.t, 'pop', .28, { pitch: 1.2 }); add(x.o0, 'swoosh', .25, { dur: .35 }) }
      if (x.tipo === 'rubro') for (const g of x.grupos) add(g.t, 'thump', .5)
    }
    for (const c of chips) add(c.o0, 'pop', .3, { pitch: 1.5 })
    for (const f of flashes) add(f - .05, 'whoosh', .5, { dur: .6 })
    add(fin + .05, 'swoosh', .4, { dur: .7 }); add(fin + .35, 'whoosh', .5, { dur: .9 })
    add(fin + .95, 'thump', .7); add(fin + 1.1, 'shimmer', .5, { dur: .9 }); add(fin + 1.6, 'success', .6)
    sfx.sort((a, b) => a.t - b.t)
    fs.writeFileSync(`${dir}/out/sfx-${nombre}.json`, JSON.stringify({ duration: D, events: sfx }, null, 1))
    fs.writeFileSync(`${dir}/out/voz-tiempos-${nombre}.json`, JSON.stringify(vozEv, null, 1))
    let prev = null
    for (const f of [...vozEv].sort((a, b) => a.t - b.t)) { if (prev && prev.t + prev.dur > f.t + .02) console.warn(`⚠ la frase ${f.id} se pisa con ${prev.id} (${(prev.t + prev.dur - f.t).toFixed(2)} s)`); prev = f }
    console.log(`${nombre}: ${D.toFixed(1)} s · ${planos.length} planos · ${textos.length} textos · ${toques.length} toques · ${sfx.length} sonidos → compose/tl-${nombre}.json`)
    for (const p of planos) console.log(`  ${p.o0.toFixed(2).padStart(6)}–${p.o1.toFixed(2).padStart(6)}  ${p.disp.padEnd(9)} ${p.toma}:${p.s0.toFixed(1)}→${p.s1.toFixed(1)} (×${((p.s1 - p.s0) / (p.o1 - p.o0)).toFixed(2)}) ${p.entra.tipo}`)
    return { tl: `compose/tl-${nombre}.json`, D }
  }
  return E
}
