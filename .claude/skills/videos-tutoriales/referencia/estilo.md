# Estilo de la casa: cómo se ve y cómo suena un video tutorial de Órbita

Todo esto ya está implementado en `herramientas/compositor/index.html` (imagen) y
`herramientas/lib/edicion.mjs` + `herramientas/sfx.mjs` (ritmo y sonido). Este
documento es la especificación: si algo se cambia, se cambia en el código y acá.

## Formato
- **1920×1080, 60 fps**, H.264 (CRF 15, `yuv420p`, etiquetado **BT.709**), AAC 192 kbps, `+faststart`.
- Panel en **tema claro**. Contenido capturado a **2×** (2880×1800) para que el zoom de hasta 1,75× quede nítido.
- Duración: intro 3,6 s + contenido + cierre 5,4 s. Un flujo largo da ~1:40 sin voz y ~1:55 con voz; uno corto, 45–70 s.

## La escena: un navegador "de escritorio" flotando sobre el fondo de marca
El panel NO ocupa toda la pantalla: se muestra dentro de una **ventana de navegador
simulada**, como una app abierta en un escritorio, apoyada sobre un fondo de marca.
- **Fondo**: degradé azul marino (`#0C1A3D → #0A1432 → #060B1E`, 158°) con dos halos
  radiales azules (`rgba(37,99,235,.55)` arriba a la izquierda, `rgba(59,130,246,.40)`
  abajo a la derecha), **anillos orbitales** tenues (5 elipses centradas en (1500, 120),
  rotadas −18°, trazo celeste 5–10 %) con dos "satélites" que los recorren despacio, y
  un ruido fino al 5 % (evita bandas en el degradé al comprimir).
- **Ventana**: 1440×944 en (240, 68), esquinas de 14 px, sombra doble profunda
  (`0 60 150 rgba(2,6,23,.62)` + `0 18 40 rgba(2,6,23,.32)`) y borde blanco al 10 %.
- **Barra del navegador** (44 px, `#F8FAFC`, línea inferior `#E2E8F0`): tres puntos de
  ventana (rojo `#FF5F57`, amarillo `#FEBC2E`, verde `#28C840`) y una barra de
  direcciones centrada (`#EEF2F7`, 520–760 px) con candado y la **URL real** de cada
  momento (sin `https://` ni query), Geist 500 14 px `#475569`.
- **Pantalla**: 1440×900, los cuadros reales del panel.
- La escena se dibuja en **canvas con posición subpíxel**: nunca con transformaciones
  CSS (redondean a píxel entero y el zoom "tiembla").

## Intro (3,6 s) — el logo del loader
Recrea `apps/web/src/components/PageLoader.tsx` en grande (viewBox 88 → 220 px), sobre blanco con un halo azul suave:
1. 0,00–0,55 s: aparece el **centro** (`#0F172A`, r 10) con rebote, y su halo (r 18).
2. 0,12–0,85 s: se dibuja el **arco** (r 32, trazo 3, `#3B82F6`, guiones 151/50) mientras gira y acelera hasta 1 vuelta/s.
3. 0,35–0,70 s: aparece el **satélite** (`#2563EB`, r 5,5, halo r 9) en la punta del arco.
4. Desde 0,55 s: dos **anillos pulsantes** (2 s, el segundo desfasado 0,75 s).
5. 0,62 s: "**Órbita**" (Geist 700, 56 px) sube con fundido; 1,0 s: el título del video (Sora 600, 46 px), p. ej. "Cómo cargar un producto".
6. 2,05–2,6 s: el logo se achica y se va; 2,25–3,25 s: un **círculo se abre desde el centro del logo** y revela el fondo de marca.
7. 2,55–3,55 s: la ventana entra (escala 0,9 → 1, sube 90 px, fundido).

## Cierre (5,4 s)
La ventana se achica (0,86) y se desvanece; un círculo blanco se expande desde el centro;
el logo se vuelve a armar; aparece la frase final (Sora 46 px, p. ej. "Listo. Tu producto
ya está a la venta.") y debajo una píldora "**orbita.site**" (fondo `#EFF6FF`, texto `#1D4ED8`).

## Cámara
- Zoom **suave** a cada lugar donde pasa algo: menú 1,6×, campo 1,55–1,6×, bloque 1,35–1,45×, botón final 1,75×; **plano general** (1×) en los cambios de página.
- Transiciones de 0,8–1,1 s con curva quíntica. El rectángulo visible se interpola con el ancho en forma geométrica y el centro con el mismo peso (zoom sobre un punto fijo, sin quiebres). Un movimiento nunca empieza antes de que termine el anterior.
- Con zoom ≥ 1,33× el encuadre se limita a la ventana (no se ve fondo); por debajo, la ventana queda entera a la vista.

## Cursor
- Flecha estilo macOS dibujada encima de todo (negra `#0F172A`, borde blanco 2,2 px, sombra), 34 px de mundo (crece con el zoom).
- Viaja en una curva leve (comba ≤ 60 px) con aceleración suave, siguiendo los movimientos reales registrados.
- **Clic**: la flecha se achica a 0,86 y sale un **anillo azul** (`#3B82F6`, 3 px, relleno 18 %) que crece de 7,5 a 37,5 px en 0,55 s.
- Se oculta al cambiar de sitio (panel → tienda) y reaparece donde va a actuar.

## Carteles de paso
- Píldora blanca (radio 20, sombra profunda) con un **número** en un cuadrado azul degradé (`#3B82F6 → #2563EB`, 48 px, radio 14), **título** Geist 650 30 px `#0F172A` y **subtítulo** Geist 500 19 px `#64748B`. El paso final usa "✓".
- Entra con resorte desde abajo (0,7 s), sale en 0,4 s. Dos carteles seguidos con el **mismo número** son el mismo paso: la píldora se queda y solo cambia el texto (fundido).
- **Esquina automática**: abajo-izquierda por defecto; el compositor elige la esquina que no tape el cursor, los clics, los resaltados ni el diálogo (abajo-izq > abajo-der > arriba-izq > arriba-der).
- Redacción: voseo, imperativo, **título ≤ 30 caracteres**, **subtítulo ≤ 55**. Ej.: "Subí tus fotos" / "Elegilas todas juntas desde tu compu".

## Placas de capítulo (cuando hay más de una forma de hacer algo)
Para separar caminos ("Opción 1 · Con Orbi, en segundos" / "Opción 2 · Paso a paso"):
el panel queda quieto y se oscurece (`rgba(6,11,30,.66)`), y al centro aparece una
etiqueta en mayúsculas (píldora celeste translúcida, Geist 700 22 px, espaciado .16em),
un **título grande** (Sora 600, 78 px, blanco) y un subtítulo (Geist 500, 29 px). Entra con
fundido y leve subida (0,45 s), sale en 0,4 s; whoosh + pop al entrar. Dura 2,6 s (con
voz, lo que la frase anclada a `cap:N` + aire). El corte de una toma a otra queda tapado
por la placa (fundido cruzado debajo).
**Orden**: depende del plan (ver `planes.md`). Si la forma rápida es de un paquete
pago (p. ej. el escaneo con foto es de Avanzado), el tutorial enseña primero el camino
del plan base completo y deja lo pago al final como bonus marcado + placa de llamado a
la acción ("Activalo cuando quieras · Configuración → Suscripción"). Si los dos caminos
son del mismo plan, primero el más rápido (lo vistoso entra en los primeros ~20 s).
Los carteles de lo que hace la IA de pago usan el ícono **✦** en lugar de número
(con "Paquete Avanzado" en el subtítulo) y son un solo cartel que va cambiando de texto.

## Resaltado de bloques (para explicar "qué es cada cosa")
Oscurece el resto de la pantalla (`rgba(15,23,42,.32)`) y marca el bloque con un contorno
azul de 3 px con brillo (radio 12, 10 px de margen). Entra en 0,35 s, sale en 0,4 s; si el
bloque cambia de tamaño (p. ej. al agregar una fila) el contorno se anima.

## Diálogo "Abrir" de Windows 11 (elegir archivos)
El navegador de grabación (headless) no muestra el explorador nativo, así que el
compositor dibuja una **recreación del diálogo "Abrir" de Windows 11** (880×560, estilo
Mica): barra de título "Abrir", ruta "Este equipo › <carpeta>", buscador, panel de
carpetas (Inicio, Galería, Escritorio, Descargas, Documentos, Imágenes, Música, Videos),
íconos grandes con las **miniaturas reales** de los archivos, "Nombre:" y botones
**Abrir** (`#005FB8`) / Cancelar. Secuencia (3,65 s, con la cámara en plano general):
se abre → clic en el primer archivo → **Shift + clic** en el último (aparece una tecla
"⇧ Shift" junto al cursor) → clic en Abrir → se cierra y aparecen las miniaturas reales
del panel (con **un solo archivo**: clic en el archivo → Abrir, sin Shift; 2,7 s).
Puede haber varios diálogos en un video. Es la única pantalla no capturada en vivo:
**decírselo a la persona**.

## Ritmo
- Velocidad base 1,2× (fuera del tipeo), tipeo 1,9×.
- Esperas largas comprimidas: IA 1,5 s, quitar fondo 2,4 s, navegación 0,7–0,9 s.
- Scroll: ~0,8 s con curva suave (compensación de movimiento, ver `tecnica.md`).
- En la grabación: 0,7–0,9 s de pausa después de cada acción y **2,6 s** sobre cada bloque que se explica.
- Ningún plano quieto más de ~2 s en la versión sin voz.

## Sonido (todo sintetizado: sin bancos de terceros ni licencias)
| Efecto | Cuándo |
|---|---|
| clic (presión + soltar, paneo según x) | cada clic |
| tecla (una por letra, ≥ 45 ms entre sí) | tipeo |
| tic de ruedita (repartidos según la distancia) | scroll |
| pop | miniaturas que aparecen; entrada de cartel (más agudo); resaltado (muy suave) |
| whoosh | apertura del intro; cortes entre escenas/sitios |
| swoosh suave | zooms grandes (> ~25 %) |
| sparkle (campanitas) | aparece un resultado de IA (Orbi escribió, fondo quitado, categoría creada) |
| success (dos notas) | algo quedó creado/publicado; final del cierre |
| thump + shimmer | armado del logo (intro y cierre) |
Sin música. Pico normalizado a −4,5 dBFS en la versión sin voz (el AAC agrega ~2 dB de pico: así queda ≤ −1,5 dBFS en el mp4).

## Voz (versión narrada)
- **Gemini Flash TTS estándar** (ni Lite ni Pro: buena calidad sin ser el más caro), voz **Achird** (hombre, cálida) salvo que pidan otra; `languageCode: es-AR`.
- Una frase por paso, en voseo, ≤ ~18 palabras, anclada a una marca de la toma; el editor **estira el paso** (pausa al final) si la frase no entra.
- Mezcla: voz a −16 LUFS con compresión suave; efectos 6 dB abajo y con sidechain; resultado −14 a −16 LUFS, pico ≤ −1,5 dBFS. Los carteles se mantienen.
- Costo de referencia: ~US$0,03 por narración de ~1:30 (Flash TTS a US$9/M tokens de audio, 25 tokens/s; verificar el precio vigente).
