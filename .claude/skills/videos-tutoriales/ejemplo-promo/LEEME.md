# Ejemplo: promo de Órbita (reel 9:16 con ganchos A/B + video 16:9)

Montaje sobre la **demo pública** (`demo.orbita.site`, sin login) y las portadas
públicas de las plantillas (`www.orbita.site/plantillas/<id>`). Las tomas de
referencia están en `~/orbita-videos/promo-orbita/` (si existe en esta máquina).
Criterio completo en `../referencia/promo.md`. Se arma con
`preparar.mjs <slug> --promo`.

| Archivo | Qué hace |
|---|---|
| `sonda.mjs` | Reconocimiento con navegador limpio: `node sonda.mjs <nombre> [--movil] pasos.json` (goto, click, clickRol, type, key, scroll, shot, eval, texto). |
| `grabar-tienda.mjs` | Celular: portada → oferta → ficha → color → Comprar ahora → datos → Mercado Pago → pago simulado → "¡Pedido confirmado!". |
| `grabar-juego.mjs` | Celular: "Juegos y anuncios" → "Encestá y ganá" → 5 tiros (toca cuando el aro pasa por el centro: zona de acierto 38–62 %) → premio. |
| `grabar-rubros.mjs` | Celular: 8 portadas de plantillas por rubro (vista "Celular", barra de vista previa oculta). |
| `grabar-panel.mjs` | Computadora: inicio → pedido nuevo → "Confirmar pedido" → productos (inventario) → Orbi responde "¿Qué fue lo que más vendí este mes?". |
| `grabar-panel-movil.mjs` | Celular: el panel en su versión para teléfono (inicio, pedido + Confirmar, productos, Orbi con pregunta sugerida). Es lo que usa el reel. |
| `grabar-panel2.mjs` | Computadora: clientes, una conversación de mensajes, cupones, dominios (navega directo por URL). |
| `guion-promo.json` | Frases: ganchos A (`a1`, `a2`: precio + sin comisión) y B (`b1`, `b2`: rubros), cuerpo del reel (`c1`–`c5`) y versión 16:9 (`y*`). |
| `editar-reel.mjs` | `node editar-reel.mjs A|B` → `compose/tl-reel-a.json` / `tl-reel-b.json` (~27 s). |
| `editar-youtube.mjs` | → `compose/tl-youtube.json` (~64 s). |

El reel muestra TODO en el celular (tienda y panel, sin recortes); la versión 16:9 muestra el panel completo en la ventana de computadora.

Cadena completa:
```
node grabar-*.mjs ; node herramientas/scrolls.mjs tienda ; node herramientas/scrolls.mjs rubros
GEMINI_KEY_FILE=… node herramientas/tts.mjs guion-promo.json
node herramientas/limpiar-voz.mjs voz-promo.json
node herramientas/tramos-voz.mjs voz-promo.json --tempo 1.08
SOLO=b1,y1 node herramientas/tramos-voz.mjs voz-promo.json --achicar 0.15
SOLO=b1,y1 node herramientas/tramos-voz.mjs voz-promo.json --pausa 0.1
node herramientas/beats.mjs musica/<tema>.mp3          # cuando la persona eligió la música
node editar-reel.mjs A ; node editar-reel.mjs B ; node editar-youtube.mjs
node herramientas/sfx.mjs out/sfx-reel-a.json ; node herramientas/mezclar-promo.mjs reel-a   (ídem reel-b, youtube)
TL=compose/tl-reel-a.json PAGE=compose/promo.html WAV=out/audio-reel-a.wav node herramientas/render.mjs out/reel-a.mp4
```
