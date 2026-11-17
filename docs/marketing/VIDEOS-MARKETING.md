# Videos de marketing de Órbita — qué hacemos y cómo lo hacemos bien

Guía viva de los videos que venimos produciendo (noviembre 2026): qué hay hecho, el estándar de calidad que funcionó y los
errores que ya resolvimos. Sirve para seguir la serie de TikTok, los videos del home y cualquier tutorial nuevo.

---

## 1. Lo que ya está hecho

| Video | Formato | Dónde está | Para qué |
|---|---|---|---|
| Reel de venta v2 (subtitulado) | 9:16, 41 s | `docs/marketing/orbita-venta-9x16-v2-subtitulado.mp4` · Escritorio → *Videos TikToks* | TikTok / Reels |
| Serie TikTok #1 «¿Precio?» (+ Vidriera) | 9:16, 31 s | `docs/marketing/tiktok-serie/01-precio.mp4` · *Videos TikToks* | TikTok |
| Serie TikTok #2 «¿Quién me pagó?» | 9:16, 37 s | `docs/marketing/tiktok-serie/02-quien-me-pago.mp4` · *Videos TikToks* | TikTok |
| LinkedIn «qué es Órbita» v4 | 16:9, 62 s | `docs/marketing/orbita-explica-16x9-v4.mp4` | Presentación de la empresa |
| Tutorial «Cómo crear tu espacio» | 16:9, 2:22 | YouTube `VLpCXDsma94` · botón «Ver tutorial» del alta | Alta de nuevos clientes |
| «WhatsApp en tu panel» | 16:9, 1:01 | R2 `demo/videos/` (demo) y `tutoriales/` (panel) | Demo pública + «Ver tutorial» de Mensajes |
| «Difusión: tu Instagram desde Órbita» | 16:9, 1:08 | R2 `demo/videos/` (demo) y `tutoriales/` (panel) | Demo pública + «Ver tutorial» de Difusión |

Guiones: `docs/marketing/tiktok-serie/GUIONES.md` (serie de 10) y `GUIONES-DEMO-WHATSAPP-DIFUSION.md`.
Proyectos de trabajo (local, no en git): `~/orbita-videos/` → `crear-tu-espacio`, `tiktok-serie/v01…`, `demo-whatsapp`,
`demo-difusion`, `motion/orbita-reel-v2`, `motion/orbita-explica-v4`.

**Próximo:** «Un pedido, de punta a punta» (16:9, ~2:30): una misma venta vista de los dos lados a la vez, pantalla partida
(celular del cliente | panel del dueño), en capítulos: la tienda → el pedido en el panel → vender más (Orbi, Difusión,
promos) → manejar el negocio → cierre. Con link para compartir (R2) y candidato para el home. Después: videos en el home
de orbita.site para reemplazar parte del texto.

---

## 2. El estándar: lo que funcionó

### Guion
- **El problema primero.** El gancho es una situación que la persona vive («Te escriben "¿precio?" cuarenta veces por día»,
  «Diez transferencias y no sabés cuál es de quién»), no una función ni un «descubrí…». En el primer segundo y medio, el
  problema escrito en pantalla y dicho por la voz.
- **Habla una persona, no un aviso.** Voseo rioplatense, frases cortas, como alguien que te lo cuenta: «Me pasó un montón»,
  «re feo», «y listo». Nada de «No es solo X, es Y», tríadas de adjetivos ni frases de folleto.
- **Una historia, no un catálogo.** Seguir una venta o un caso concreto (Lucía pregunta por los auriculares, el pedido #1183)
  aburre mucho menos que enumerar funciones.
- **Nada que no exista.** Antes de afirmar algo, se verifica en el código. Ejemplos reales de esta tanda: no hay prueba gratis
  (solo con un código del 100 %) → el cierre es «Mirá la demo»; el mensaje de Vidriera se copió de `consultarPorWpp`; que
  Mercado Pago confirma solo el pedido se confirmó en `mercadopago.service.ts`; Orbi en WhatsApp es del paquete Avanzado.
- **Precios reales de producción.** Se leen del endpoint público `GET /subscription/offer` (hoy: «Primeros 30 comercios»,
  $10.000 / $15.000 por 3 meses). Dev no tiene la campaña: al grabar en local se sirve esa respuesta al navegador.
- **Nombres y datos de ejemplo**, nunca de clientes reales. Lo recreado (p. ej. la página de Mercado Pago) va **marcado**
  en pantalla («Recreación ilustrativa»).
- **Cierre según quién mira:** a quien no es cliente, «Mirá la demo / Creá tu espacio en orbita.site»; a quien ya es cliente
  (tutorial del panel), «Ya está en tu panel».

### Imagen
- **Pantallas reales** del producto: la demo pública (Nébula Moda / Nébula Tech) o el panel en local. Para mostrar algo que
  necesita una cuenta conectada (WhatsApp, Instagram) se graba en local con **datos de ejemplo servidos solo al navegador
  de la grabación** (`fixtures.mjs`): nada se conecta, publica ni guarda.
- **Animación con intención:** cada cosa que nombra la voz se marca en ese momento (recuadro + etiqueta «Precio», «Talles»,
  «Stock»), los toques tienen su onda, y la cámara se acerca a lo que importa. Ningún plano quieto de más de 5–6 s.
- **Zonas seguras.** En 9:16 el contenido va entre y≈200 y y≈1400 (arriba están las pestañas de TikTok, abajo los botones y
  la descripción). Los carteles y etiquetas nunca tapan lo que se está mostrando: se revisa cuadro por cuadro.
- **Marca:** el logo de Órbita es el del home (planeta + anillo + satélite), con anillos de órbita detrás (no rayos de sol).
  Tipografía Sora (títulos) y Geist (texto). Color solo donde es el dato o se toca (ver `feedback_diseno_menos_ia`).
- **Limpieza de la grabación:** sin el indicador de Next.js, sin el aviso de cookies («Solo necesarias»), sin la franja
  «Demo de Órbita» ni la pestaña de juegos, sin el atajo de desarrollo del alta.

### Sonido
- **Voz:** ElevenLabs, voz `htFfPSZGJwjBv1CL0aMD` a **1,04×** (modelo `eleven_v4`). Cada frase se verifica con
  speech-to-text (`scribe_v1`) y se rehace si suena rara (p. ej. «Creás» que sonaba «Creas», una frase que sonaba a pregunta).
  La «ll» porteña («tashes») está bien; en los subtítulos va escrito «talles».
- **Subtítulos** en todos los videos de redes (la mayoría mira sin sonido): Sora 800, 2–3 palabras por vez, la palabra que se
  dice en el azul de Órbita, sin cortar «Mercado Pago» ni dejar palabras sueltas («a», «de», «tu») al final de un grupo.
  Tiempos sacados palabra por palabra de la voz.
- **Mezcla:** música baja (≈0,2) que se aparta cuando habla la voz (sidechain), efectos **limpios** (clics, pops suaves,
  «aire»; nada de bocinas ni risers sintéticos) y normalización a **−14 LUFS** (−16 en tutoriales).

### Control de calidad (antes de entregar)
1. Hoja de imágenes fijas del montaje → corregir solapamientos, textos cortados, cuadros en blanco.
2. Render → cuadros de control del video final con subtítulos.
3. Scrolls: salto máximo entre cuadros < 2–4 px (`herramientas/qa/scroll.mjs`).
4. Audio: LUFS y pico (`herramientas/qa/audio.mjs`); transcripción del audio final completa y en orden.
5. Entregar en **Escritorio → Videos TikToks** con su `.txt` (descripción + hashtags) y copia en `docs/marketing/`.

---

## 3. Dónde viven los videos
- **Redes (TikTok/Reels):** los sube el equipo a mano desde *Videos TikToks*. Nada se publica solo.
- **Demo pública y tutoriales del panel:** **Cloudflare R2**, bucket de producción `orbita` (`demo/videos/`, `tutoriales/`),
  URL pública `pub-4c59…r2.dev`. Reproductor propio (portada, play, duración); si un archivo no carga, no se muestra nada roto.
  No van a YouTube (decisión de la dirección).
- **Tutorial del alta:** YouTube (`VIDEO_TUTORIAL_ALTA` en `onboarding/alta/TutorialAlta.tsx`).
- Para el home conviene R2 + reproductor propio (rápido, sin marca de YouTube) y una versión web liviana (1080p, CRF 22,
  `faststart`, ~10–12 MB por minuto).

---

## 4. Problemas que ya resolvimos (para no repetirlos)
- **Chromium de Playwright bloqueado por Windows** → grabar con el Chrome del sistema (`CHROME_PATH`).
- **Subdominios locales** sin tocar el archivo hosts → `--host-resolver-rules=MAP *.orbita.local 127.0.0.1`.
- **Captura en alta:** el screencast sale a 1x; se captura con `Page.captureScreenshot` a escala 1,5 (`CAPTURA=shot`),
  con tope por cuadro y recorte que sigue el scroll (si no, franja en blanco).
- **Scroll trabado en el alta:** el fondo de estrellas es fijo; medir el scroll solo sobre el formulario
  (`MEDIR='{"x":420,"w":600}'`) y sacar cuadros «rotos» (`limpiar-scrolls.py`).
- **Puerto 3000 ocupado** por otro proyecto (Paperlux): la API local puede quedar en otro puerto; el frontend apunta a
  ella con `NEXT_PUBLIC_API_URL`.
- **Difusión en «Cargando…» en local:** era la ref `montado` con el modo estricto de React; arreglado en `main` (aec21280).
- **Clics que no pegan:** usar el botón exacto (`button.pub-producto`, nombres exactos como «Sugerir con Orbi»), no un texto
  que puede repetirse en la pantalla.
- **Claves:** la de ElevenLabs va solo por variable de entorno (nunca en archivos ni en el chat; las que se pegaron en el chat
  hay que rotarlas). Las de R2 de producción se leen de Secret Manager a variables de entorno, sin imprimirlas.
