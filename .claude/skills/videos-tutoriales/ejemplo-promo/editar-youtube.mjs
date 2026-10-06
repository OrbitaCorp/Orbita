// Video 16:9 para YouTube / landing (~65 s): rubros + precio → catálogo que se
// adapta → la compra en el celu → envío → pedido y stock → inventario →
// clientes y mensajes → cupones y dominio → inicio → Orbi → Avanzado → cierre.
// Texto a la izquierda, dispositivo a la derecha. El panel se ve ENTERO en la
// ventana de computadora (sin zoom ni recortes).
//   node editar-youtube.mjs
import fs from 'node:fs'
import { crearPromo } from './herramientas/lib/promo.mjs'

const voz = JSON.parse(fs.readFileSync('voz-promo.json', 'utf8'))
const musica = fs.existsSync('out/musica.json') ? JSON.parse(fs.readFileSync('out/musica.json', 'utf8')) : null
const P = crearPromo({ formato: 'ancho', tomas: ['tienda', 'juego', 'rubros', 'panel', 'panel2'], voz })
const F = id => voz.frases.find(f => f.id === id)
// comienzo del tramo k de una frase (o una fracción de la frase si tiene menos pausas)
const T = (id, k, frac) => F(id).tramos[k]?.[0] ?? F(id).dur * frac
const AIRE = .42
const resto = (g, id, extra = 0) => g + F(id).dur + AIRE + extra - P.o
const PANEL = { x: 720, y: 450, z: 1 }   // la página completa
const rubro = (id, dur, extra = {}) => P.plano({ toma: 'rubros', desde: `p-${id}+0.15`, dur, vel: .8, entra: 'corte', cam0: { x: 195, y: 420, z: 1 }, ...extra })
const panel = (toma, desde, hasta, dur, extra = {}) => P.plano({ toma, desde, hasta, dur, cam0: PANEL, ...extra })

// ── 1. rubros: una portada por palabra ──────────────────────────────────────
const y1 = F('y1'), t1 = .12
const ids = ['corralon', 'patitas', 'escaparate', 'papeleria']
ids.forEach((id, i) => rubro(id, (i < 3 ? t1 + T('y1', i + 1, (i + 1) / 4) - .02 : t1 + y1.dur + .15) - P.o))
P.frase('y1', t1, { estilo: 'rubro' })
P.chip(.2, P.o - .1, 'Portadas · Paquete Avanzado')

// ── 2. precio + sin comisión ───────────────────────────────────────────────
const g2 = P.o
P.plano({ toma: 'tienda', desde: .1, hasta: 3.6, dur: F('y2').dur + .6, entra: 'escala', cam0: { x: 195, y: 420, z: 1 }, cam: [{ en: .2, d: 3, x: 195, y: 420, z: 1 }] })
P.flash(g2)
P.frase('y2', g2 + .12, { estilo: 'gancho' })
const finGancho = P.o

// ── 3. el catálogo se adapta: variantes + otros rubros ─────────────────────
const g3 = P.o, k3 = T('y3', 1, .3)
P.plano({ toma: 'tienda', desde: 8.45, hasta: 8.52, dur: k3 + .1, cam0: { x: 195, y: 330, z: 1 }, cam: [{ en: 0, d: k3 + .1, x: 195, y: 330, z: 1 }] })
P.plano({ toma: 'tienda', desde: 11.0, hasta: 13.4, dur: F('y3').dur * .72 - k3, cam0: { x: 195, y: 330, z: 1 } })
rubro('corralon', .72)
rubro('bodega', resto(g3, 'y3', .1))
P.chip(g3 + F('y3').dur * .72, P.o - .1, 'Portadas · Paquete Avanzado')
P.frase('y3', g3 + .1)

// ── 4. la compra en el celu ────────────────────────────────────────────────
const g4 = P.o
P.plano({ toma: 'tienda', desde: 5.3, hasta: 'clic:producto+0.35', dur: 1.5, entra: 'escala', cam0: { x: 195, y: 330, z: 1 } })
P.plano({ toma: 'tienda', desde: 'datos-0.4', hasta: 'clic:continuar+0.3', dur: 1.4, cam0: { x: 195, y: 420, z: 1 } })
P.plano({ toma: 'tienda', desde: 'metodo-0.25', hasta: 'metodo+1.4', dur: resto(g4, 'y4'), cam0: { x: 195, y: 422, z: 1 } })
P.frase('y4', g4 + .1)

// ── 4b. cómo lo reciben ─────────────────────────────────────────────────────
const g4b = P.o
P.plano({ toma: 'tienda', desde: 19.96, hasta: 20.03, dur: resto(g4b, 'y4b', .1), entra: 'fundido', cam0: { x: 195, y: 330, z: 1 }, cam: [{ en: .3, d: 2.5, x: 195, y: 400, z: 1 }] })
P.frase('y4b', g4b + .1)

// ── 5. el pedido llega al panel y se confirma ──────────────────────────────
const g5 = P.o
const conf = P.plano({ toma: 'tienda', desde: 33.25, hasta: 34.9, dur: 1.2, entra: 'fundido', cam0: { x: 195, y: 330, z: 1 } })
P.sonido(conf.o0 + .12, 'success', .55)
panel('panel', 11.3, 'clic:abrir-pedido+0.15', 1.2)
const ped = panel('panel', 15.8, 19.6, 2.0, { entra: 'corte' })
P.sonido(P.salida(ped, P.src('panel', 'clic:confirmar-pedido')) + .18, 'success', .45)
panel('panel', 19.6, 21.6, resto(g5, 'y5', .1), { entra: 'corte' })
P.frase('y5', g5 + .1)

// ── 6. inventario y ganancia ───────────────────────────────────────────────
const g6 = P.o
panel('panel', 28.0, 32.9, resto(g6, 'y6', .1))
P.frase('y6', g6 + .1)

// ── 6c. clientes y mensajes ────────────────────────────────────────────────
const g6c = P.o
panel('panel2', 'clientes', 'clientes-fin', T('y6c', 1, .5) + .1)
panel('panel2', 'clic:conversacion-0.4', 'conversacion', resto(g6c, 'y6c', .1))
P.frase('y6c', g6c + .1)

// ── 6d. cupones y dominio propio ───────────────────────────────────────────
const g6d = P.o
panel('panel2', 'cupones', 'cupones-fin', T('y6d', 1, .45) + .1)
panel('panel2', 'dominios', 'fin', resto(g6d, 'y6d', .1))
P.frase('y6d', g6d + .1)

// ── 7. el inicio: ventas, alertas, lo más vendido ──────────────────────────
const g7 = P.o
panel('panel', .2, 5.1, resto(g7, 'y7', .1))
P.frase('y7', g7 + .1)

// ── 8. Orbi ────────────────────────────────────────────────────────────────
const g8 = P.o
panel('panel', 'clic:orbi-0.3', 40.4, 2.2)
const resp = panel('panel', 43.2, 48.6, resto(g8, 'y8', .35), { entra: 'fundido' })
P.sonido(P.salida(resp, 44.6), 'sparkle', .5)
P.frase('y8', g8 + .1)

// ── 9. Avanzado: juego, oferta relámpago, portadas ─────────────────────────
const g9 = P.o
P.plano({ toma: 'juego', desde: 'tiro1-1.4', hasta: 'tiro1+1.6', dur: 1.9, cam0: { x: 195, y: 420, z: 1 } })
const premio = P.plano({ toma: 'juego', desde: 'resultado-0.7', hasta: 'resultado+0.8', dur: 1.4, entra: 'fundido', cam0: { x: 195, y: 420, z: 1 } })
P.sonido(premio.o0 + .1, 'sparkle', .55)
P.plano({ toma: 'tienda', desde: 'ofertas', hasta: 'ofertas+1.2', dur: 1.4, cam0: { x: 195, y: 250, z: 1 } })
rubro('patitas', .55); rubro('crecer', .55)
rubro('glow', Math.max(.5, resto(g9, 'y9', .2)))
P.chip(g9 + .1, P.o - .1, 'Paquete Avanzado')
P.frase('y9', g9 + .1)

// ── 10. cierre ─────────────────────────────────────────────────────────────
const y10 = F('y10')
panel('panel', .3, 2.6, 1.9, { entra: 'desliza' })
// "¡Sin comisión por venta!" (último tramo) cuando aparece en el cierre
P.frase('y10', P.o + 1.75 - (y10.tramos.at(-1)?.[0] ?? y10.dur * .7), { estilo: null })

if (musica) P.alinear(musica)
const { tl } = P.escribir({ nombre: 'youtube', cierre: 'Tu tienda y tu negocio, en un solo lugar.', subCierre: 'Sin comisión por venta' })
const j = JSON.parse(fs.readFileSync(tl, 'utf8')); j.marca = { o0: 0, o1: finGancho }; fs.writeFileSync(tl, JSON.stringify(j))
