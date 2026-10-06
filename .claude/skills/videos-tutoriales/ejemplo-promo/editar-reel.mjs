// Reel 9:16 (~28 s): gancho A (precio + sin comisión) o B (rubros), y el mismo cuerpo:
// tienda → panel (pedido + stock) → Orbi → Avanzado (juego + oferta relámpago) → cierre.
// TODO dentro del celular: la tienda y también el panel (en su versión para teléfono,
// toma 'panelm'), siempre entero, sin recortes.
//   node editar-reel.mjs A|B
import fs from 'node:fs'
import { crearPromo } from './herramientas/lib/promo.mjs'

const VAR = (process.argv[2] ?? 'A').toUpperCase()
const voz = JSON.parse(fs.readFileSync('voz-promo.json', 'utf8'))
const musica = fs.existsSync('out/musica.json') ? JSON.parse(fs.readFileSync('out/musica.json', 'utf8')) : null
const P = crearPromo({ formato: 'reel', tomas: ['tienda', 'juego', 'rubros', 'panelm'], voz })
const F = id => voz.frases.find(f => f.id === id)
const d = id => P.dur(id)
const ENTERO = { x: 195, y: 422, z: 1 }   // el teléfono completo, sin zoom

// ── gancho ──────────────────────────────────────────────────────────────────
let finGancho
if (VAR === 'A') {
  const a1 = P.plano({ toma: 'tienda', desde: .2, hasta: 3.4, dur: d('a1') + .3, cam0: { x: 195, y: 420, z: 1 }, cam: [{ en: .2, d: d('a1'), x: 195, y: 420, z: 1.06 }] })
  P.frase('a1', a1.o0 + .1, { estilo: 'gancho' })
  // "y sin comisión por venta" sobre el gráfico de ventas del panel en el celu
  const a2 = P.plano({ toma: 'panelm', desde: 'grafico', hasta: 'grafico+1.4', dur: d('a2') + .55, entra: 'escala', cam0: ENTERO })
  P.flash(a2.o0)
  P.frase('a2', a2.o0 + .08, { estilo: 'gancho' })
  finGancho = a2.o1
} else {
  // "¿Ferretería? ¿Pet shop? ¿Ropa? ¿Librería?": una portada por palabra
  const b1 = F('b1'), t0 = .1
  const ids = ['corralon', 'patitas', 'escaparate', 'papeleria']
  const cortes = b1.tramos.map(([a]) => t0 + a)
  ids.forEach((id, i) => {
    const o1 = i < ids.length - 1 ? (cortes[i + 1] ?? t0 + b1.dur * (i + 1) / 4) - .02 : t0 + b1.dur + .12
    P.plano({ toma: 'rubros', desde: `p-${id}+0.15`, dur: o1 - P.o, vel: .8, entra: 'corte', cam0: { x: 195, y: 380, z: 1.04 } })
  })
  P.frase('b1', t0, { estilo: 'rubro' })
  const t2 = P.o + .05
  for (const id of ['glow', 'bodega', 'crecer', 'circuito']) P.plano({ toma: 'rubros', desde: `p-${id}+0.2`, dur: id === 'circuito' ? Math.max(.5, d('b2') - 1.3) : .48, vel: .9, entra: 'corte', cam0: { x: 195, y: 380, z: 1.04 } })
  P.frase('b2', t2, { estilo: 'gancho' })
  P.chip(.25, P.o - .1, 'Portadas · Paquete Avanzado')
  finGancho = P.o
}

// ── tienda: comprar desde el celu y pagar con Mercado Pago ──────────────────
const c1 = P.o
P.plano({ toma: 'tienda', desde: 5.5, hasta: 'clic:producto+0.3', dur: .9, cam0: { x: 195, y: 330, z: 1.1 } })
// la ficha quieta con un zoom suave: el scroll de esa toma tiene huecos sin cuadros (la página cargaba imágenes)
P.plano({ toma: 'tienda', desde: 8.45, hasta: 8.52, dur: .75, cam0: { x: 195, y: 330, z: 1 }, cam: [{ en: 0, d: .75, x: 195, y: 330, z: 1.06 }] })
P.plano({ toma: 'tienda', desde: 11.3, hasta: 12.5, dur: .6, cam0: { x: 195, y: 270, z: 1.2 } })
P.plano({ toma: 'tienda', desde: 'metodo-0.25', hasta: 'metodo+1.3', dur: 1.0, cam0: { foco: 'metodo', dy: 110, z: 1.25 } })
const conf = P.plano({ toma: 'tienda', desde: 33.25, hasta: 35.4, dur: 1.25, entra: 'fundido', cam0: { x: 195, y: 330, z: 1.06 } })
P.sonido(conf.o0 + .12, 'success', .55)
P.frase('c1', c1 + .1)

// ── panel en el celu: el pedido llega y el stock se actualiza solo ──────────
const c2 = P.o
P.plano({ toma: 'panelm', desde: 'pedidos+0.2', hasta: 'clic:abrir-pedido+0.15', dur: 1.15, entra: 'escala', cam0: ENTERO })
const ped = P.plano({ toma: 'panelm', desde: 'detalle', hasta: 'clic:confirmar-pedido+0.9', dur: 1.4, cam0: ENTERO })
P.sonido(P.salida(ped, P.src('panelm', 'clic:confirmar-pedido')) + .18, 'success', .45)
P.plano({ toma: 'panelm', desde: 'productos+0.15', hasta: 'productos+0.25', dur: Math.max(1.0, c2 + d('c2') + .45 - P.o), cam0: ENTERO })
P.frase('c2', c2 + .1)

// ── Orbi en el celu ─────────────────────────────────────────────────────────
const c3 = P.o
P.plano({ toma: 'panelm', desde: 'clic:orbi-0.3', hasta: 'orbi+0.3', dur: 1.0, cam0: ENTERO })
P.plano({ toma: 'panelm', desde: 'clic:orbi-sugerida-0.4', hasta: 'orbi-enviado+0.5', dur: .95, cam0: ENTERO })
const resp = P.plano({ toma: 'panelm', desde: 42.6, hasta: 46.2, dur: Math.max(2.2, c3 + d('c3') + .45 - P.o), entra: 'fundido', cam0: ENTERO })
P.sonido(P.salida(resp, 44.3), 'sparkle', .5)
P.frase('c3', c3 + .1)

// ── Avanzado: juego con premio + oferta relámpago ───────────────────────────
const c4 = P.o
P.plano({ toma: 'juego', desde: 'tiro1-1.2', hasta: 'tiro1+1.5', dur: 1.5, cam0: { x: 195, y: 420, z: 1.12 } })
const premio = P.plano({ toma: 'juego', desde: 'resultado-0.7', hasta: 'resultado+0.6', dur: 1.15, entra: 'fundido', cam0: { x: 195, y: 420, z: 1.12 } })
P.sonido(premio.o0 + .1, 'sparkle', .55)
P.plano({ toma: 'tienda', desde: 'ofertas', hasta: 'ofertas+1.0', dur: Math.max(1.2, c4 + d('c4') + .4 - P.o), cam0: { x: 195, y: 250, z: 1.25 } })
P.chip(c4 + .1, P.o - .1, 'Paquete Avanzado')
P.frase('c4', c4 + .1)

// ── cierre: el inicio del panel en el celu y el logo ────────────────────────
P.plano({ toma: 'panelm', desde: .2, hasta: 2.2, dur: 1.6, entra: 'escala', cam0: ENTERO })
// "¡Sin comisión por venta!" (último tramo de la frase) justo cuando aparece en el cierre
const c5v = F('c5'), finP = P.o
P.frase('c5', finP + 1.75 - (c5v.tramos.at(-1)?.[0] ?? c5v.dur * .6), { estilo: null })

if (musica) P.alinear(musica)
const { tl } = P.escribir({ nombre: 'reel-' + VAR.toLowerCase(), cierre: 'Tu tienda y tu negocio, en un solo lugar.', subCierre: 'Sin comisión por venta' })
// marca chica durante el gancho
const j = JSON.parse(fs.readFileSync(tl, 'utf8')); j.marca = { o0: 0, o1: finGancho }; fs.writeFileSync(tl, JSON.stringify(j))
