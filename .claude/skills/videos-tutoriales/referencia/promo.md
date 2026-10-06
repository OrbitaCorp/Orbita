# Promos: reel 9:16 y video 16:9 para atraer clientes

Un tutorial enseña una operación de punta a punta; una **promo** vende: es un
**montaje** de planos cortos (1–3 s) de varias tomas, con la **voz primero**, textos
grandes, música y cortes sobre el ritmo. Mismo estilo de la casa (fondo de marca,
logo del loader al cierre, cursor, sonidos), otra estructura. Ejemplo completo en
`../ejemplo-promo/` (reel con ganchos A/B + versión de YouTube).

## Preguntas antes de empezar (además de las del tutorial)
- Formato: reel 9:16 (Instagram/TikTok, 25–35 s) y/o 16:9 (YouTube/landing, 60–75 s).
- De dónde salen las pantallas: la **demo pública** (`demo.orbita.site`, recomendada:
  sin login, datos de muestra, no toca nada real) o un negocio real.
- Qué mostrar (tienda y cobro, panel, Orbi, Avanzado…) y cómo cierra (sin precio /
  con precio / invitar a la demo).
- **Gancho**: proponé 2–3 y grabá UN cuerpo con ganchos intercambiables (los primeros
  3 s) para probarlos en anuncios (A/B). Ver "Ganchos".
- Música: la elige la persona (vos no podés escucharla). Ver "Música".

## Ganchos (los primeros 3 s deciden)
- Funcionan los que **nombran a alguien** ("¿Ferretería? ¿Pet shop?…"), **prometen un
  resultado** o **señalan algo que la persona reconoce**; imagen, voz y texto dicen
  lo mismo desde el primer cuadro (nada de logo de 3,6 s al principio: el logo va al cierre).
- **No nombrar competidores.** Ej.: Tiendanube cobra 0,7–2 % por venta según el plan,
  pero 0 % con Pago Nube: "te cobran comisión" sería atacable. "Sin comisión por venta"
  (Órbita no se queda con nada de lo que vendés) se sostiene solo. La landing tampoco
  los nombra (`Comparativa.tsx`).
- Precio: "por menos de $20.000 al mes" es el plan **Base** (`planesDatos.ts`); lo de
  Avanzado va con su etiqueta ("Paquete Avanzado") para que el precio no confunda.
  Nada de "este mes" (suena a promo con vencimiento y el video queda viejo).
- Gancho por ciudad ("¿Tenés un negocio en Iguazú?") solo si el anuncio se segmenta
  por zona.
- Funciones que no existen todavía (p. ej. turnos) no se muestran.

## Flujo
1. `preparar.mjs <slug>` (trae `compose/promo.html`).
2. Reconocimiento con navegador limpio (sin perfil): copiar `sonda.mjs` del ejemplo
   (`node sonda.mjs <nombre> [--movil] pasos.json`: goto/click/type/shot/eval).
3. Guion de voz (`guion-promo.json`): una frase por bloque, ≤ 15 palabras, voseo.
   `pantalla` = cómo se escribe (con `*énfasis*` y `|` para cortar los subtítulos a mano;
   con tantos grupos como pausas de la voz, cada grupo cae en su pausa).
   `tts.mjs guion-promo.json` → `limpiar-voz.mjs voz-promo.json` →
   `tramos-voz.mjs voz-promo.json --tempo 1.08` (voz un poco más ágil) y, para frases
   tipo lista ("¿Ferretería? ¿Pet shop?…"), `SOLO=id --achicar 0.15` y después
   `SOLO=id --pausa 0.1` (tramos por palabra para sincronizar los cortes).
4. Tomas con `crearGrabador({ sesion: 'limpia', movil: true, dpr: 3, base })` (celular,
   390×844) o `sesion: 'limpia', dpr: 2` (computadora). En la demo no hace falta ensayo:
   las escrituras del visitante quedan en su navegador (DemoGuard). `scrolls.mjs <toma>`.
5. Edición con `lib/promo.mjs` (`editar-reel.mjs`, `editar-youtube.mjs` del ejemplo):
   `P.plano({ toma, desde, hasta, dur, cam0, cam, entra })`, `P.frase(id, t, { estilo })`,
   `P.chip()`, `P.flash()`, `P.sonido()`, `P.alinear(musica)`, `P.escribir({ nombre })`.
   Revisar con `TL=compose/tl-<nombre>.json PAGE=compose/promo.html node herramientas/preview.mjs …`.
6. Música: `beats.mjs musica/<tema>.mp3` → `out/musica.json` (BPM, golpes, arranque) →
   volver a correr la edición (alinea los cortes al pulso).
7. `node herramientas/qa/huecos.mjs compose/tl-<nombre>.json` (saltos: cuadros que faltan donde la imagen cambia) → `sfx.mjs out/sfx-<nombre>.json` → `mezclar-promo.mjs <nombre>` → render con
   `TL=… PAGE=compose/promo.html WAV=out/audio-<nombre>.wav node herramientas/render.mjs out/<nombre>.mp4`.
   (`SIN_VOZ=1 mezclar-promo.mjs` = solo música + efectos.)

## Lo que pidió la persona (feedback de la primera versión)
- **El panel no se recorta.** En el reel va DENTRO DEL CELULAR, en su versión para teléfono (toma con `movil: true`), entero y sin zoom (`cam0: { x: 195, y: 422, z: 1 }`). En el 16:9 va en la ventana de computadora con la página COMPLETA adentro (1300×812, escala 0,903) y sin zoom. Un panel de 1440 px metido en una ventana chica y con zoom se ve "cortado por los bordes".
- **La voz no tiene que sonar a guía.** Lo que más pesa es el texto: tono de anuncio (frases cortas, preguntas que enganchan, exclamaciones: "¿Qué se vende más? Preguntale a Orbi"), no explicación ("Ves tu inventario, cuánto vale…"). La voz la elige la persona: generá la MISMA frase con 4–6 voces (`tts.mjs` con un guion de una frase por voz, ~US$0,002 cada una) y mandáselas en mp3. Acá eligió Achird (la de los tutoriales) con el texto nuevo.

## Diseño (compose/promo.html)
- **Reel 1080×1920**: franja de texto arriba (y 196–588), celular abajo (pantalla 590 px,
  barra de estado "9:41" + isla, marco oscuro) o navegador de 1012 px. Instagram tapa
  ~250 px abajo y una columna a la derecha: lo importante va arriba y al centro.
  Con zoom, el celular crece hacia abajo (nunca invade la franja de texto: `minTop`).
- **16:9 1920×1080**: texto a la izquierda (columna de ~700 px), dispositivo a la derecha.
- Estilos de texto: `gancho` (Sora 800, palabra por palabra, énfasis en bloque azul),
  `sub` (subtítulo por grupos, énfasis celeste), `rubro` (una palabra gigante por tramo
  de voz), `chip` ("✦ PAQUETE AVANZADO"), marca "Órbita" chica durante el gancho.
- Celular: toques como círculo blanco + onda celeste; navegador: cursor del tutorial.
- Transiciones: `desliza` (cambio de dispositivo, automático), `escala` (+ `flash` blanco
  para el remate del gancho), `fundido`, `corte` (mismo dispositivo, sobre el pulso).
- Cierre (3,4 s): círculo blanco, logo del loader, frase final, subtítulo azul y
  píldora orbita.site. La última frase de voz se ancla para que su remate ("Sin
  comisión por venta") coincida con la aparición del subtítulo del cierre.

## Música
- La persona escucha y elige; vos proponés 3 links (estilo, BPM aproximado, duración).
- **Revisá Content ID en la página de cada tema de Pixabay** ("Content ID Registered"):
  los registrados generan reclamos automáticos en YouTube (se disputan con el
  certificado de Pixabay, hasta 96 h) y pueden trabar anuncios pagos. Pixabay no tiene
  filtro: hay que revisar página por página (un agente con WebFetch puede hacerlo).
  Muchos catálogos grandes registran todo. Volvé a revisar justo antes de bajarlo y
  guardá el certificado de licencia.
- Bajar el archivo es una descarga: pedir el ok con nombre, origen y tamaño.
- Mezcla: voz a ~-15 LUFS, música con ducking (baja ~9 dB mientras habla), efectos con
  sidechain, total **-14 LUFS** (lo que normalizan Instagram/TikTok/YouTube), pico ≤ -1,5 dBTP.

## Errores que ya pasaron
| Síntoma | Causa | Arreglo |
|---|---|---|
| Orbi responde "vienen por debajo del mes anterior: -84 %" | Preguntas abiertas sobre la demo dan respuestas negativas o avisos de "datos ficticios" | Probar la pregunta antes (sonda) y elegir una con respuesta positiva ("¿Qué fue lo que más vendí este mes?") |
| Las plantillas se ven cortadas en el celular | `/plantillas/<id>` dibuja la versión de computadora aunque el viewport sea chico | Tocar "Celular" en la barra de vista previa y ocultar esa barra (no es parte de la tienda) |
| `getByText('VENTAS')` no encuentra nada | El texto está en minúsculas y se ve en mayúsculas por CSS | Regex sin mayúsculas: `/^ventas$/i` |
| El clic del menú lateral cae en otro ítem | El menú se despliega al pasar el mouse y corre todo | Navegar directo (`/admin/ventas/<sección>?vista=…`) y usar solo la pantalla ya cargada |
| Orbi en el celular: el campo de texto queda debajo del borde | La hoja se abre a media altura (390×844) | Tocar una pregunta sugerida (visible) y enviar con el botón Enviar |
| El guion nuevo no se guardó y el TTS leyó el viejo (gasto de más) | La herramienta de archivos rechazó el Write (el archivo había cambiado) y el comando siguió igual | Verificar el contenido (`grep`) antes de correr `tts.mjs` |
| WAV roto ("no 'data' tag") después de acelerar la voz | ffmpeg agrega un bloque LIST y el encabezado deja de medir 44 bytes | `tramos-voz.mjs` busca el bloque `data` y reescribe un encabezado canónico |
| Al regenerar una frase se perdieron los tramos de las demás | `tts.mjs` con SOLO rearmaba la voz solo con lo del guion | Ya conserva los campos de las frases que no se regeneran |
| BPM 123,1 en un tema de 124 | Autocorrelación con resolución de cuadro | `beats.mjs` hace un ajuste fino conjunto tempo+fase sobre todo el tema |
| BPM 112 en un tema de 140 | Una preferencia fija por ~118 BPM | Se elige la grilla con más ataque promedio por golpe (70–180) y se corrige la octava (70 → 140) |
| La pelota del juego no aparece: salto de 1 s después del tiro | A dpr 3 la animación pesada frena el screencast | Grabar esa toma a `dpr: 2`; `qa/huecos.mjs` lo detecta antes del render |
| Esqueleto gris al entrar a la ficha de producto | El contenido aparece ~1 s después del toque | Arrancar el plano cuando ya cargó (`tira.mjs <toma> 7.4 7.8 8.2 8.6` para ver cuándo) |
| Scroll a los saltos en un plano | El screencast no mandó cuadros mientras la página cargaba imágenes (huecos de 0,3–0,4 s) | Usar el plano quieto con un zoom suave, o un scroll medido y consistente (`scrolls.mjs`) |
| Un heredoc de Git Bash rompió un script con regex | Se pierden las barras invertidas | Escribir los scripts con la herramienta de archivos |
| El bloque azul del énfasis aparece vacío antes que sus palabras | El fondo era del grupo y las palabras aparecían después | El bloque entra con su primera palabra |
