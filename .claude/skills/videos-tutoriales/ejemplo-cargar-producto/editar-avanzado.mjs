// Corte corto para marketing (~45 s): "Cargá un producto con una foto" —
// solo lo del PAQUETE AVANZADO: escaneo con Orbi + quitar fondo + llamado a la acción.
//   node editar-avanzado.mjs                            → compose/tl-avanzado.json (sin voz)
//   node editar-avanzado.mjs --voz voz-avanzado.json    → compose/tl-avanzado-voz.json
import fs from 'node:fs'
import { crearEdicion } from './herramientas/lib/edicion.mjs'

const iv = process.argv.indexOf('--voz')
const voz = iv > 0 ? JSON.parse(fs.readFileSync(process.argv[iv + 1], 'utf8')) : null
const E = crearEdicion({
  tomas: [{ nombre: 'toma-orbi', offset: 2000 }, { nombre: 'toma1' }],
  esperas: { 'quitar-fondo': 2.4, 'o-encuadre': .6, scan: 2.0 },
  voz,
})
const { M, F, C, S, HL, centro } = E
const O = n => M(n, 'toma-orbi')
const inicioFondo = C('preview-siguiente').t - 1.0

const sDlg = O('dialogo-abre') + .12
E.clip(O('inicio') + .05, sDlg)
E.dialogoAbrir({ s: sDlg, fotos: ['remera-oversize-negra-1.jpg'], carpeta: 'Imágenes > Remeras' })
E.clip(O('fotos-subidas') - .03, O('fin'))
E.clip(inicioFondo, M('quitar-fondo-fin', 'toma1'), { xf: .45 })
E.capitulo(M('quitar-fondo-fin', 'toma1'), { kicker: 'Paquete Avanzado', titulo: 'Activalo cuando quieras', sub: 'Configuración → Suscripción', xf: .3 })
E.armar()
const [capCta] = E.capitulos

// Cámara
E.camara(F('o-zona-fotos').t + .1, .9, 570, 300, 1.45)
E.camara(O('fotos-subidas') + .05, 1.0, 520, 360, 1.55)
E.camara(O('scan-fin') - .15, 1.1, 770, 440, 1.12)
const hcO = centro(HL('orbi-campos')[0].box)
E.camara(S('o-a-datos').t, 1.0, hcO.x + 40, hcO.y, 1.18)
const pO = centro(F('o-precio').box)
E.camara(F('o-precio').t + .1, .9, pO.x + 180, pO.y + 10, 1.55)
const pubO = centro(F('o-publicar').box)
E.camara(F('o-publicar').t + .1, 1.0, pubO.x - 80, pubO.y - 40, 1.75)
E.camara(inicioFondo + .05, .9, 770, 390, 1.28)
E.camara(M('quitar-fondo-fin', 'toma1') - 1.6, 1.0, 1130, 400, 1.55)
E.camara({ o: capCta.o0 + .05 }, .8, 720, 450, 1)

E.resaltar('orbi-campos', O('oC-fin') - .05)

E.cartel(O('oA') + .1, O('oB'), '✦', 'Subí una foto', 'Con el paquete Avanzado')
E.cartel(O('oB'), O('scan-fin'), '✦', 'Tocá “Completar con esta foto”', 'Orbi la reconoce en segundos')
E.cartel(O('scan-fin'), O('oC'), '✦', 'Orbi completa todo', 'Nombre, categoría, descripción y fotos')
E.cartel(O('oC'), O('oD'), '✦', 'Revisá lo que completó', 'También te sugiere talles y colores')
E.cartel(O('oD'), O('fin'), '✦', 'Solo poné precio y stock', 'Y publicás')
E.cartel(inicioFondo, M('quitar-fondo-fin', 'toma1') - .05, '✦', 'Quitá el fondo con un toque', 'También en el paquete Avanzado')

E.sonido(E.out(O('fotos-subidas') + .1), 'pop', .45)
E.sonido(E.out(O('scan-fin')) - .1, 'sparkle', .6)
E.sonido(E.out(O('scan-visto')) - 2.2, 'pop', .3, { pitch: 1.2 })
E.sonido(E.out(M('quitar-fondo-fin', 'toma1') - .01) - 1.04, 'sparkle', .55)
E.sonido(capCta.o0 + .35, 'success', .5)

E.escribir({ titulo: 'Cargá un producto con una foto', cierre: 'Con Avanzado, Orbi lo hace por vos.', nombre: 'avanzado' })
