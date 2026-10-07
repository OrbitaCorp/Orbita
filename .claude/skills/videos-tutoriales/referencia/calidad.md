# Control de calidad (antes de entregar)

Revisar con evidencia, no "a ojo" sobre el video en movimiento: no se puede mirar ni
escuchar el video, así que se miden cuadros, curvas y niveles.

| Qué | Cómo | Umbral |
|---|---|---|
| Cada escena en orden, nada tapado | `node herramientas/hoja.mjs out/<video>.mp4 4` → mirar `out/hoja.jpg`; zonas dudosas: `hoja.mjs <video> 0.5 <desde> <hasta>` | Sin pantallas de error, sin cartel sobre un clic, sin datos sensibles (otros negocios, emails de clientes) |
| Cuadros clave a tamaño completo | `TL=compose/tl.json node herramientas/preview.mjs <t1> <t2> …` (antes de renderizar) | Texto nítido con zoom; resaltado sobre el bloque correcto |
| Temblor de cámara | `node herramientas/qa/temblor.mjs <video> <inicio_zoom> <fin_zoom> 700` (una fila que cruce el borde izquierdo de la ventana sobre el fondo) | RMS < 0,5 px (suave ≈ 0,25) |
| Scroll | Renderizar el tramo con cámara quieta (copiar tl.json con `cam: []`) y `node herramientas/qa/scroll.mjs <video> <desde> <hasta> 700` | Campana suave; salto entre cuadros vecinos ≤ ~2–4 px |
| Medición de scrolls | salida de `scrolls.mjs` | "medido" ≈ "Y" (sin ⚠) |
| Audio | `node herramientas/qa/audio.mjs <video>` | Con voz: −14 a −16 LUFS; pico ≤ −1 dBFS siempre |
| Voz | salida de `tts.mjs` (⚠ si una frase dura de más) y `editar.mjs --voz` (⚠ si dos frases se pisan) | Sin ⚠; pedir a la persona que escuche acento y pronunciación (marcas, siglas) |
| Archivo | `ffprobe`/`ffmpeg -i` | 1920×1080, 60 fps, h264 bt709, aac |

Entregar en una carpeta del proyecto (p. ej. `videos/`, sin commitear) y avisar:
- qué datos quedaron creados/borrados en producción (con ids) y cuánta IA se consumió;
- que el diálogo "Abrir" (si aparece) es una recreación;
- si el archivo supera 30 MB, que solo se ve en la app de escritorio (ofrecer una versión liviana: `ffmpeg -i in.mp4 -c:v libx264 -crf 26 -preset slow -c:a copy out.mp4`);
- las fotos o datos de terceros que aparezcan (derechos).

## Promos (reel / YouTube)
- `qa/huecos.mjs compose/tl-<nombre>.json` sin saltos antes de renderizar.
- Audio: `qa/audio.mjs out/audio-<nombre>.wav` → -14 LUFS ±1, pico ≤ -1,5 dBFS (Instagram, TikTok y YouTube normalizan a ~-14).
- Hoja de cuadros vertical: `ffmpeg -i out/<nombre>.mp4 -vf "fps=1/1.4,scale=216:384,tile=10x2" out/hoja.jpg`: revisar ganchos, textos (que no tapen el dispositivo), carteles de Avanzado y cierre.
- Reportar: duración de cada corte, tema de música (autor, link, licencia, Content ID revisado), ganchos y qué se mostró de la demo.
