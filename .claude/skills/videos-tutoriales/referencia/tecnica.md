# Técnica: cómo funciona la cadena y qué ya falló (con su arreglo)

## La cadena
```
login.mjs (la persona entra)  →  recon.mjs (solo lectura)  →  grabar.mjs con ENSAYO=1
→ toma real (grabar.mjs)  [+ toma corta de cierre, grabar-lista.mjs]
→ scrolls.mjs <toma>  →  editar.mjs  →  preview.mjs  →  sfx.mjs  →  render.mjs
→ (voz) tts.mjs → limpiar-voz.mjs → editar.mjs --voz voz.json → sfx.mjs out/sfx-voz.json → mezclar-voz.mjs → render.mjs
```
- **Grabación**: Playwright con Chromium headless, viewport 1440×900 a **2×**, cuadros
  por CDP `Page.startScreencast` (JPEG 88). Cada acción queda en `tomas/<toma>/log.json`
  con tiempo y caja del elemento: `move`, `click`, `type` (tiempo de cada letra),
  `scroll` (con zona y ms), `wait` (esperas a la app), `mark` (marcas, `foco` con caja,
  `hl` = bloque a resaltar), `url`, `cursor`.
- **Edición** (`lib/edicion.mjs`): elige clips de las tomas, comprime esperas, acelera
  tipeo, inserta pausas (diálogo, voz) y traduce todo a tiempo de salida. Declarás
  cámara, carteles y resaltados por marcas (`M`, `F`, `C`, `S`, `HL`); cursor, clics y
  la mayoría de los sonidos salen solos del registro.
- **Compositor** (`compositor/index.html`): una página 1920×1080 con `seek(t)` que
  dibuja el cuadro t en canvas. `render.mjs` abre 2–6 navegadores en paralelo, captura
  cada cuadro y lo pasa por pipe a ffmpeg.

## Reglas técnicas no obvias (cada una costó un error)
| Síntoma | Causa | Arreglo (ya aplicado en las herramientas) |
|---|---|---|
| Se cerraron TODAS las sesiones del usuario en el negocio | El refresh token del panel **rota** en cada uso; reusar una cookie guardada (`storageState`/auth.json) se detecta como robo (`auth.service.ts`, "reuso") | Perfil persistente único `~/orbita-videos/perfil`; nunca `storageState`; nunca dos navegadores con el perfil a la vez |
| — | Un agente no escribe contraseñas en producción | `login.mjs` abre una ventana visible y **la persona** entra; después todo corre headless |
| El zoom "tiembla" | Transformaciones CSS redondean a píxel entero + un "clamp" que cambia con el zoom | Cámara en canvas, posición subpíxel, `imageSmoothingQuality='high'`, interpolación de rectángulos |
| El scroll se ve trabado | `mouse.wheel` salta de a ~80 px; y aun con scroll suave, los cuadros del screencast llegan con demoras **variables** (hasta 20 px de error, y los últimos hasta ~0,5 s tarde) | `scrollSuave()` (rAF con easing) + `scrolls.mjs` mide la posición real de cada cuadro y el compositor arma el scroll con **compensación de movimiento** (desplaza la zona que scrollea entre los dos cuadros vecinos) |
| Subrayado rojo en "Algodón", "Remera" | Corrector ortográfico de Chromium (diccionario en inglés) | `spellcheck=false` en todos los campos (en `sesion.mjs`) |
| El formulario ya trae la categoría de la toma anterior | El alta recuerda preferencias en `localStorage` (`orbita:catalogo:*`) | `g.limpiarMemoria()` antes de iniciar |
| Banner de cookies en la tienda | Primera visita del perfil | `g.cookiesMinimas()` ("Solo necesarias", la opción más privada) en la preparación |
| No aparece el explorador de archivos | Headless intercepta el selector de archivos | `page.waitForEvent('filechooser')` + `setFiles`; el diálogo se dibuja en el video (`E.dialogoAbrir`) |
| La espera "publicando" terminó al instante | `waitForFunction` subía por el DOM hasta la GRILLA (otra tarjeta tenía foto y "Publicado") | Limitar la subida y exigir que el contenedor tenga **una sola** tarjeta; o grabar la lista terminada aparte (`grabar-lista.mjs`) |
| La lista después de publicar muestra "Subiendo fotos… 72 %" | Las fotos suben en segundo plano | Toma corta aparte con la tarjeta terminada, al mismo scroll, enlazada con fundido |
| Clic en el "Valor" equivocado | Hay varios inputs con el mismo `aria-label` | Elegir el campo relativo a su fila (`parentElement.querySelector`) |
| Caja de bloque = solo la fila del título | El primer contenedor ancho es el encabezado | `cajaBloque()` sube hasta un contenedor que además tenga contenido; si falla, `E.resaltarCaja` a mano |
| TTS: frases de 3 s salían de 15 s | El modelo **lee en voz alta** las instrucciones de estilo ("Leé con tono…", "Say warmly:") | Solo el texto; acento con `speechConfig.languageCode: 'es-AR'`. `systemInstruction` no está habilitado |
| Golpecitos al inicio/fin de cada frase | Respiraciones/clics del modelo en los bordes | `limpiar-voz.mjs` |
| La mezcla pega 0 dBFS | `alimiter` "auto-nivela" por defecto | `alimiter=…:level=disabled` |
| Git Bash convierte "/admin/…" en una ruta de Windows | Conversión automática de MSYS | `MSYS_NO_PATHCONV=1` antes del comando |
| `page.goto(…, networkidle)` vence a los 30 s | Con escrituras bloqueadas (ensayo) la página reintenta y nunca queda quieta | `waitUntil: 'domcontentloaded'` + esperar un elemento concreto |
| `getByText('Nombre', { exact: true })` no encuentra el rótulo | El rótulo es "Nombre \*" (asterisco en otro nodo): el texto completo no coincide | Anclar al campo (`textarea[placeholder=…]`) o usar `inputPorLabel` |
| Una frase o cartel cae antes del capítulo que le corresponde | La marca coincide con el borde de un clip (p. ej. `sC` = `form`) y `out()` la ubica en el clip anterior | Anclar con un pequeño desplazamiento (`sC+0.1`) |
| Un cartel/frase de un tramo cae en otro tramo (p. ej. "115,8 → 29,6 s") | El mismo instante de fuente está en dos clips (rangos solapados o pegados) y `out()` devuelve el primero | No solapar rangos de clips de la misma toma (arrancar el segundo +0,02 s después); referencias en el borde, con un pequeño desplazamiento |
| El editor agregó cientos de segundos de pausa | Una frase con `hasta` anterior a `desde` (ancla en el borde de un clip) | Ahora avisa y la saltea (⚠); corregir el ancla (+0,1) |
| "Falta la marca X" con varias tomas | `M('x')` sin toma busca en la primera | Si está en una sola toma la encuentra; si no, `M('x', 'toma1')` o `'toma1:x'` en el guion |
| Un flujo con IA genera un producto distinto en cada toma | El escaneo/la redacción no son deterministas | La toma del camino con IA se graba en **ensayo** (no se guarda nada) y corta al llegar a Publicar; el producto publicado sale de la toma manual |
| Un `node … \| head` dejó datos sin guardar | `head` corta el proceso (EPIPE) antes de escribir | No cortar la salida de scripts que escriben al final; redirigir a un archivo |
| Heredoc con `\\` en Git Bash rompió regex | Se pierden barras invertidas | Escribir scripts con la herramienta de archivos, no con heredoc |

Problemas propios de las promos (demo pública, plantillas, voz acelerada, música, BPM):
`promo.md` § "Errores que ya pasaron".

## Datos y producción
- Cada toma real **crea datos de verdad** (y consume IA de la cuenta: "Redactar con Orbi",
  "Quitar fondo"). Por eso: ensayo primero con `ENSAYO=1` (bloquea escrituras al API),
  y en la toma real solo lo que la persona aprobó.
- Si hay que regrabar algo que crea datos, los duplicados aparecen en las tomas (p. ej.
  dos tarjetas iguales en la lista): pedir permiso para borrar lo anterior **por el
  panel** (no por la base) antes de la toma nueva.
- Alternativa sin tocar producción: grabar contra el panel local (`localhost`, base DEV).
  Ahí sí se pueden usar credenciales de prueba, pero los datos y las funciones de IA
  pueden diferir; decidirlo con la persona.

## Archivos de un video (`~/orbita-videos/<slug>/`)
```
herramientas/      copia congelada de las herramientas del skill
compose/           index.html (compositor) + fonts/ + tl.json / tl-voz.json
fotos/             archivos que se suben en el video
tomas/<toma>/      frames/*.jpg (≈1 GB por toma larga) + log.json
out/               scrolls-<toma>.json, sfx*.json/wav, voz/, audio-voz.wav, videos
grabar.mjs, grabar-lista.mjs, editar.mjs, guion.json, voz.json
```
Se puede volver a editar un video viejo sin regrabar mientras existan sus tomas.
