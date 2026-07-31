# Pendientes — apps/api

Registro vivo de decisiones sin especificación clara, conflictos detectados, funcionalidad
a medio construir, deuda técnica y preguntas abiertas para el equipo. Ver convención completa
en `apps/api/CLAUDE.md`.

No es una bitácora de lo que ya quedó bien implementado y verificado — eso vive en el resumen
de cada tarea, no acá.

---

## Fase 3 — Storefront público + Apariencia real + Productos destacados

### [2026-07-29] `dtoToAp()` rompía en producción cuando heroSlides/headerLinks venían `null`
**Estado:** RESUELTO (2026-07-29)
`heroSlides`/`headerLinks` son `Json?` nullable — un negocio que nunca los guardó los trae en
`null`, no `[]`. El mapper del frontend (`apariencia.mapper.ts`) hacía `.length` directo sobre
ese valor y explotaba con un `TypeError`, que el `catch` de `Apariencia.tsx` mostraba como "No
se pudo cargar la apariencia" — el usuario lo reportó en producción. Corregido con un chequeo
de null antes de `.length`, verificado contra la API real antes y después del fix.

### [2026-07-29] Footer real: se sacó la dirección hardcodeada, no hay campo real detrás
**Estado:** ABIERTO — decisión de producto. El footer mostraba "Buenos Aires, Argentina" fijo
para cualquier negocio, dato inventado sin campo real en `BusinessConfig`. Se sacó esa línea
en vez de inventar un valor — si se quiere mostrar una dirección real, hace falta agregar un
campo (ej. `BusinessConfig.address`) primero.

### [2026-07-29] Nuevo toggle `showSocialFooter` en vez de granularidad por cada elemento del footer
**Estado:** RESUELTO (2026-07-29) — decisión de alcance
El pedido fue "opciones de activado a desactivado" para el footer. Se agregó un solo toggle
nuevo (`showSocialFooter`, gatea la fila de íconos de Instagram/TikTok/Facebook) en vez de un
toggle por cada elemento (horario, email, etc.) — esos ya se muestran automáticamente solo
cuando el dato real existe (mismo criterio "si se asigna, aparece" ya usado en el resto de
Apariencia), sin necesitar un toggle aparte. Si el usuario quería control más granular por
elemento, es una extensión chica sobre esta misma base.

### [2026-07-29] Íconos de Instagram/TikTok/Facebook: SVG propios, no vienen en lucide-react
**Estado:** RESUELTO (2026-07-29)
`lucide-react` (versión instalada) no trae íconos de marca — se agregaron como SVG simplificados
en `apps/web/src/components/storefront/SocialIcons.tsx`, mismo criterio ya usado para el ícono
de WhatsApp existente en el proyecto.

### [2026-07-29] Personalización del hero: interpretación de "en el medio o en algún otro lado"
**Estado:** ABIERTO — el usuario pidió posicionar las figuras geométricas de fondo "en el medio
o en algún otro lado". Se interpretó como la posición de la IMAGEN centrada
(`imagePosition: left/center/right`), no la posición del patrón decorativo (que va fijo por
preset, ver `bgPattern` en `heroPatterns.tsx`). Si la intención real era poder mover el patrón
decorativo en sí, es un ajuste sobre esta misma base — confirmar con el usuario al mostrar el
resultado.

### [2026-07-29] Quitar fondo: se descartó `@imgly/background-removal-node` por licencia AGPL-3.0
**Estado:** RESUELTO (2026-07-29)
Esa librería es AGPL-3.0 — usarla en un SaaS comercial obligaría a publicar el código fuente
de Órbita a quien lo use. El usuario pidió explícitamente una alternativa 100% self-hosted sin
ese riesgo legal: se implementó con `onnxruntime-node` (MIT, bindings oficiales de Microsoft)
corriendo el modelo `u2netp.onnx` (~4.6MB, Apache-2.0, mismo checkpoint que usa el proyecto
`rembg`, bajado de sus releases oficiales en GitHub y commiteado en
`apps/api/src/background-removal/models/`). Corre 100% en el propio servidor, sin llamadas a
APIs externas. Ver `BackgroundRemovalService`.

### [2026-07-29] Bug real encontrado y corregido en el pipeline de quitar fondo (sharp `joinChannel`)
**Estado:** RESUELTO (2026-07-29)
Dos problemas de `sharp` detectados con una imagen sintética de prueba (no una foto real —
generada localmente, sin descargar nada) antes de conectar la UI: (1) `.resize()` sobre una
entrada raw de 1 canal la promueve en silencio a 3 canales, corrompiendo cualquier lectura por
índice — hace falta `.toColourspace('b-w')` después del resize para mantenerla en escala de
grises; (2) `joinChannel()` sobre una imagen recién decodificada de PNG/JPEG (sin pasar por
`.raw()` primero) descarta el canal unido en silencio, sin tirar error — el resultado queda con
3 canales y `hasAlpha:false` en vez de 4/true. Verificado el fix con una prueba end-to-end real
contra el endpoint HTTP completo (`upload-image` con `removeBackground=true`): la imagen
resultante en Supabase Storage es webp con `hasAlpha:true` y la máscara tiene la forma
espacialmente correcta (confirmado pixel por pixel).

### [2026-07-29] Normalización del modelo u2netp: constantes tomadas del código fuente oficial, no inventadas
**Estado:** RESUELTO (2026-07-29)
Se confirmó contra `xuebinqin/U-2-Net`'s `data_loader.py` (`ToTensorLab`, flag=0): la imagen se
escala por su propio valor máximo de píxel (no una constante fija `/255`) y luego se normaliza
por canal RGB con mean=[0.485,0.456,0.406] / std=[0.229,0.224,0.225] (estadísticas de
ImageNet). El postprocesado de la máscara (`(d-min)/(max-min)`) también sigue exactamente
`normPRED()` de `u2net_test.py` del mismo repo.

### [2026-07-29] Riesgo de despliegue: `sharp` y ahora `onnxruntime-node`, sin confirmar en Railway real
**Estado:** ABIERTO — ver la entrada de `sharp` del 2026-07-28 (más abajo en este documento),
que ya señalaba que nunca se confirmó funcionando en el contenedor real de Railway, solo local.
`onnxruntime-node` es una segunda dependencia nativa (empaqueta binarios prearmados para
linux/x64, win32/x64, darwin/arm64 dentro del mismo paquete — confirmado localmente, no como
`optionalDependencies` separados como hace `sharp`) sobre el mismo riesgo sin confirmar. Se
agregó `"engines": {"node": ">=22"}` a `apps/api/package.json` (no existía ningún campo
`engines` ni `.nvmrc`) para que Nixpacks elija la versión de Node correcta y reducir el riesgo
de mismatch. **Falta confirmar ambas dependencias nativas contra el deploy real de Railway**
antes de dar esta funcionalidad por 100% cerrada — no alcanza con la verificación local (que sí
se hizo completa: build, `nest build` copiando el `.onnx` a `dist/`, y una subida real de
extremo a extremo contra Supabase Storage).

### [2026-07-29] Verificación visual del storefront bloqueada por el entorno de este agente (no es un bug del código)
**Estado:** DIFERIDO — el navegador de este entorno no resuelve `router.query.slug` en rutas
dinámicas de Next.js (`/tienda/[slug]/...` y `/admin/[negocioId]/...`), algo confirmado
también en páginas que nunca se tocaron (ej. el carrito, 100% mock). No es una regresión de
este trabajo. El usuario debería probar visualmente en su propio navegador: los estilos de
hero (imagen completa/centrada, cada `bgPattern`, cada `imagePosition`), el checkbox de quitar
fondo con una foto real, y el footer/WhatsApp flotante con datos reales cargados.

### [2026-07-29] Storefront público muestra PUBLISHED y OUT_OF_STOCK, oculta solo DRAFT
**Estado:** ABIERTO — decisión de producto tomada sin especificación del contrato.
`StorefrontService.listProducts()`/`getProduct()` filtran `status: { in: ['PUBLISHED',
'OUT_OF_STOCK'] }`. Se decidió mostrar "sin stock" como información útil para el comprador
(como cualquier catálogo real) en vez de esconderlo. Si el criterio de negocio es distinto
(ej. ocultar también OUT_OF_STOCK), es un cambio de una línea en el `where`.

### [2026-07-29] Detalle público de producto no expone `cost` ni stock exacto
**Estado:** RESUELTO (2026-07-29)
`GET /storefront/:slug/products/:id` omite `cost` (margen privado) y reduce el stock de cada
variante a un booleano `inStock` en vez de la cantidad exacta — verificado con un test contra
la API real (ver script descartable, ya borrado). Aplica el mismo criterio a
`listProducts()`.

### [2026-07-29] 9 campos nuevos en StorefrontConfig para que Apariencia sea "100% funcional"
**Estado:** RESUELTO (2026-07-29)
El formulario de Apariencia (`apps/web/.../Apariencia.tsx`) tenía ~9 toggles/textos
(`mostrarStockBajo`, `mostrarBadgeOferta`, `mostrarBuscador`, `mostrarCategorias`,
`mostrarFooter`, `textoCTA`, `textoEnvio`, `textoWhatsapp`, `fuenteBody`) sin columna
correspondiente en `StorefrontConfig` — el formulario nunca guardaba nada en absoluto
(`guardar()` era un no-op local). Se agregaron como columnas nuevas (migración
`20260729045906_product_featured_and_storefront_fields`, aditiva, sin backfill) en vez de
sacarlas de la UI, para que el submódulo quede realmente completo. Ver
`MODELO_DATOS_DEFINITIVO.md` § 3.4 actualizado en consecuencia.

### [2026-07-29] Upload de imágenes de Apariencia (favicon, slides del hero): endpoint genérico nuevo
**Estado:** RESUELTO (2026-07-29)
`ImgUploader.tsx` guardaba las imágenes como dataURL en memoria — nunca se subían a Storage,
ni siquiera el logo (que sí tenía un endpoint funcional pero no se llamaba desde esta
pantalla). Se agregó `POST /business/storefront-config/upload-image` (genérico, devuelve
`{url}` sin escribir ningún campo) para favicon e imágenes de slides; el endpoint existente
`POST /business/storefront-config/logo` (usado también por el wizard de onboarding) queda
intacto.

### [2026-07-29] `Product.isFeatured` — estrella de "destacado" en la grilla, no en el wizard
**Estado:** RESUELTO (2026-07-29)
Nuevo campo `isFeatured` (migración `20260729045906_...`) + `PATCH /products/:id/featured`
(mismo patrón que `reorderImages`). Deliberadamente separado de `create()`/`update()`: el
wizard nunca envía este campo, así que un guardado normal de producto no lo resetea — se
agregó un comentario explícito en `ProductsService.update()` y se verificó con un test
end-to-end real (toggle → PUT completo del producto → GET → `isFeatured` seguía en `true`).

### [2026-07-29] `pickPrimaryImageUrl`/`orderedImageUrls` extraídos a util compartido
**Estado:** RESUELTO (2026-07-29)
Estaban duplicados en `products.service.ts` y `reports.service.ts`; con `storefront.service.ts`
como tercer consumidor se extrajeron a `apps/api/src/common/utils/product-image.util.ts`
(funciones puras) y se actualizaron los tres call sites.

### [2026-07-29] Alcance de esta fase: checkout/carrito/pedidos/cupones/reseñas/login de cliente NO se tocaron
**Estado:** DIFERIDO — son módulos separados, ya stubbeados (`StorefrontController`'s
checkout/tracking/coupons/exclusive-discount, `MeController`, y todas las páginas de
`apps/web/.../cliente/{checkout,cupones,pedido,perfil,auth}`), y el pedido del usuario fue
específicamente "que la apariencia y el catálogo de productos se reflejen en la tienda real"
— no mencionó estos flujos. Siguen sobre datos mock. Cuando se aborde esa fase, el patrón de
`resolveBusiness(slug)` en `StorefrontService` y `apps/web/src/lib/storefront/api.ts` ya están
listos para extenderse.

### [2026-07-29] `STATS` (contadores decorativos) en la home del storefront sigue mock
**Estado:** DIFERIDO — ("+1.200 ventas realizadas", etc. en `Inicio.tsx`) no tiene modelo de
datos real detrás (requeriría agregaciones de `Order`, que no está en el alcance de esta
fase). Queda como contenido de marketing hardcodeado hasta que se decida si vale la pena
calcularlo de verdad.

## Fase 13 bis — Mail: migración de SMTP a Resend

### [2026-07-30] Servicio central de emails (Fase 3): registro de envíos en `email_logs` — corrige una decisión del contrato
**Estado:** RESUELTO (2026-07-30) — CONTRATO_API.md corregido en consecuencia
El contrato decía que V1 no persistía envíos (trazabilidad delegada al historial de Resend),
pero mi tarjeta de Fase 3 pide "registrar cada envío realizado" y la pestaña Actividad del
perfil de cliente (tarjeta de la misma fase) necesita esos datos para mostrar algo. Decidí
crear la tabla `email_logs` (migración aditiva, no toca nada existente): businessId/customerId/
memberId opcionales, destinatario, asunto, plantilla (null = personalizado) y resultado
`SENT | FAILED | SIMULATED` (SIMULATED = modo stub sin RESEND_API_KEY, así en dev también se
puede probar la pestaña Actividad). El log lo escribe `MailService` en forma transversal y es
best-effort: si el INSERT falla, el envío no se rompe. `memberId` va como columna simple sin
relación, mismo criterio que ya usa `audit_logs`. Si el equipo prefiere volver al criterio
anterior (sin tabla), es solo sacar `registrar()` — los call sites no dependen de que exista.

### [2026-07-30] Plantillas nuevas del servicio central + aviso de contraseña cambiada
**Estado:** RESUELTO (2026-07-30)
Se sumaron 4 plantillas que pedía la tarjeta: `order-ready-pickup` (listo para retirar),
`thanks-for-purchase` (gracias por tu compra), `member-access-reminder` (recordatorio de
acceso, con contraseña temporal opcional — la va a usar "Resetear contraseña" de Config:
Equipo en F4) y `password-changed` (aviso de seguridad). Esta última quedó conectada:
`resetPassword()` ahora avisa por email al dueño de la cuenta cuando la contraseña cambia
(best-effort, nunca rompe el reset). Las otras tres quedan expuestas en `MailService` para
que las consuman la cola de preparación (listo para retirar), el modal de email del pedido
(gracias por tu compra) y Config: Equipo (recordatorio) en sus tarjetas correspondientes.
PREGUNTA ABIERTA para el equipo: "listo para retirar" hoy no se dispara solo — ¿lo dispara
el cambio de estado del pedido cuando el envío es retiro en local (cuando exista ese dato
del checkout de Mateo), o solo manual desde el modal? Por ahora solo manual.

### [2026-07-30] Diseño de marca real para todos los emails (antes salían en HTML crudo)
**Estado:** RESUELTO (2026-07-30) — decisión tomada con Ale: colores y logo completos por
negocio (no un diseño único fijo de Orbita)
Probé el servicio en vivo y el mail de texto libre (Email masivo) llegaba sin ningún diseño
— literalmente el texto tal cual, con `<br/>` en vez de saltos de línea. Los demás templates
(bienvenida, pedido confirmado, etc.) tampoco tenían diseño real: cada `.hbs` era su propio
`<html><body style="font-family: sans-serif; padding: 20px;">`, sin marca ni estructura.

Cambio: cada plantilla (las 10 que ya existían + las 4 nuevas de esta misma fase) dejó de ser
un documento HTML completo — ahora es solo el fragmento de contenido (título + párrafos).
`MailService.sendOrLog()`/`sendCustomEmail()` renderizan ese fragmento y lo envuelven en un
layout nuevo y compartido (`email-layout.hbs`): header con el logo o el nombre de la tienda
sobre su color de marca, tarjeta blanca de contenido, footer "Enviado por {negocio} a través
de Órbita". El logo/colores salen de `StorefrontConfig` (Apariencia) por `businessId` — si un
negocio no cargó nada todavía, cae en un azul neutro de Orbita por default, nunca rompe el
envío. Los botones/links de cada plantilla (reset de contraseña, invitación, etc.) también
pasaron a usar el color de marca del negocio (`{{colorPrimary}}`) en vez de un azul fijo
hardcodeado — los recuadros de advertencia (contraseña cambiada, suscripción por vencer)
quedaron con colores fijos (ámbar/rojo) a propósito, para que se lean como alerta sin importar
el color de marca de cada uno.

Excepción deliberada: `subscription-payment-failed` y `subscription-suspended` (avisos de
Orbita al dueño sobre SU PAGO a Orbita, no sobre su tienda) siempre usan el branding de Orbita,
nunca el del negocio — no tendría sentido que un aviso de "se suspendió tu tienda" viniera
con los colores de esa misma tienda.

Alcance no cubierto todavía (a propósito, para no sobre-extender esto): no usa
`colorSecondary`/`colorAccent` de Apariencia (solo `colorPrimary` y `colorBackground`), no usa
la tipografía (`fontFamily`) del negocio (las fuentes web no cargan de forma confiable en la
mayoría de los clientes de mail, así que se dejó una fuente segura fija), y no se probó
pixel a pixel contra Outlook de escritorio (el layout es con tablas, debería degradar bien,
pero no se verificó ahí puntualmente).

De paso, a pedido de Ale: el modal "Email masivo" (`EmailMasivoModal.tsx`) pasó de una sola
columna (vista previa al final, abajo de todo) a dos columnas — formulario a la izquierda,
vista previa fija a la derecha que se actualiza en vivo sin scrollear — y el recuadro de
mensaje se agrandó bastante (antes 6 filas, ahora 14) para ver el texto completo sin
scrollear adentro tampoco.

### [2026-07-30] Bug real: "Email masivo enviado a 0 clientes" — plantilla nueva sin copiar a dist/ + catch que tragaba el error en silencio
**Estado:** RESUELTO (2026-07-30)
Al probar el envío real después de agregar `email-layout.hbs`, Ale reportó que "Email masivo"
siempre decía "enviado a 0 clientes". Encontré DOS problemas, uno que causó el síntoma y otro
que lo hizo invisible:

1. **Causa raíz:** `email-layout.hbs` es un archivo NUEVO (no una edición de uno existente).
   Confirmé en el server real que `dist/mail/templates/` tenía los 14 templates existentes
   (con su fecha de modificación actualizada) pero **no** `email-layout.hbs` — el watcher de
   `nest start --watch` recompila `.ts` y copia assets *editados*, pero no corrió el paso de
   copia de assets para un archivo agregado en caliente. Cualquier envío intentaba leer un
   archivo que no existía en `dist/` → excepción `ENOENT`.
2. **Por qué no se veía ningún error:** en `MailService.sendOrLog()`/`sendCustomEmail()`, la
   compilación de la plantilla y del layout estaba **afuera** del `try/catch` que rodea el
   envío por Resend — un error ahí no quedaba registrado en `email_logs` como `FAILED`, se
   escapaba del método sin más. Y en `CustomersService.sendEmail()`, el loop por cliente
   atrapa cada envío en su propio `try/catch { }` completamente silencioso (a propósito, para
   que un cliente sin problema no bloquee a los demás) — pero eso significaba que un fallo
   *sistémico* (no de un cliente puntual) desaparecía sin dejar ningún rastro, ni en
   `email_logs` ni en la consola del server. El resultado: `{sent: 0}` sin ninguna pista.

**Fix:** en ambos métodos de `MailService`, la compilación del branding/plantilla/layout ahora
pasa a estar DENTRO del `try` — un fallo ahí queda registrado en `email_logs` como `FAILED` con
el error real, igual que un fallo de Resend. En `CustomersService.sendEmail()`, el catch por
cliente sigue sin frenar el loop (eso no cambió — un cliente con problema no debe bloquear a
los demás), pero ahora deja un `logger.error()` con el email y el error real en vez de
tragárselo en silencio.

**Importante:** esto necesita un **reinicio completo** de `pnpm dev` de `apps/api` (Ctrl+C y
`pnpm dev` de nuevo, no alcanza con esperar el hot-reload) — el problema de fondo es justamente
que el archivo nuevo nunca se copió a `dist/`, y solo un restart completo vuelve a correr ese
paso desde cero. Corrijo acá algo que dije antes en esta misma sesión (que no hacía falta
reiniciar nada): eso vale para *editar* un `.hbs` ya existente, pero no para agregar uno nuevo.

### [2026-07-30] Email masivo: loading → éxito → cierre automático
**Estado:** RESUELTO (2026-07-30)
A pedido de Ale, al confirmarse el envío el modal ya no espera un clic manual en "Cerrar":
cierra solo a los 2.5s (se mantiene el botón "Cerrar" para quien prefiera salir antes o revisar
el resultado con calma). El estado de error (`errorEnvio`) NO auto-cierra — si algo falla, se
queda abierto para poder leer el mensaje y reintentar.

### [2026-07-31] Email masivo: se sacó el spinner del botón — nuevo componente `Loader` chico y reutilizable (no el PageLoader de pantalla completa)
**Estado:** RESUELTO (2026-07-31)
Primer intento (mismo día, ya reemplazado): reusar `PageLoader` tal cual — tapaba toda la
pantalla mientras mandaba, y Ale pidió algo más chico, con mensaje, que no tape todo.

Versión final: nuevo componente **`apps/web/src/design-system/components/Loader.tsx`** — el
mismo dibujo de marca (arco orbital + satélite + hub) que `PageLoader`, pero a escala chica
(prop `size`: `sm`/`md`/`lg`) y con un mensaje de texto al lado (prop `message`), pensado desde
el vamos como EL loader chico estándar del panel — no uno puntual para este modal. La idea,
como pidió Ale, es reusarlo en cualquier carga puntual de cualquier módulo (`<Loader
message="Cargando pedidos…" />`, `<Loader message="Guardando…" />`, etc.) en vez de que cada
pantalla arme su propio spinner suelto. No reemplaza a `PageLoader` (ese sigue para
transiciones de página completa, a nivel app) ni a `Skeleton` (placeholders de contenido) —
es un tercero para el caso intermedio: "esta sección puntual está resolviendo algo".

En `EmailMasivoModal.tsx`: mientras `enviando` es `true`, el contenido del modal (las dos
columnas de formulario/preview) se reemplaza por `<Loader message="Enviando mails…" />`
centrado dentro del modal (no tapa nada fuera de él); el header y el footer del modal siguen
visibles, con los botones deshabilitados. Al terminar (éxito o error) vuelve a mostrarse el
contenido normal — el mensaje de éxito con auto-cierre, o el error para reintentar, tal cual
ya funcionaba.

**Nota para más adelante:** `ModalEmailMiembro.tsx` y `ModalEmail.tsx` (Pedidos) todavía no
tienen un envío real conectado (ver entrada anterior), así que no tienen este loading todavía
— cuando se conecten de verdad, deberían usar este mismo `Loader` (no un spinner nuevo) para
mantener la consistencia. Lo mismo vale para cualquier otra pantalla del panel que hoy solo
muestra un texto suelto tipo "Cargando pedidos…" (`Categorias.tsx`, `ProductoLista.tsx`, etc.)
— quedan como están por ahora (no se tocó nada fuera de esta tarjeta), pero son candidatas
naturales para migrar a este componente cuando se retomen esas pantallas.

### [2026-07-30] Mismo tratamiento (dos columnas + mensaje más grande) aplicado a las otras modales que redactan email con plantillas
**Estado:** RESUELTO (2026-07-30)
Ale pidió extender el layout nuevo de "Email masivo" (formulario a la izquierda + vista previa
fija a la derecha, recuadro de mensaje agrandado) "a todas las modales que hacen lo mismo".
Revisé las modales de email del panel:
- **`ModalEmailMiembro.tsx`** (Config: Equipo → Miembros) y **`ModalEmail.tsx`** (Pedidos/
  Clientes, el de email individual) tienen exactamente el mismo patrón (plantillas + asunto +
  cuerpo) → recibieron el mismo tratamiento: `maxWidth` 900, layout de dos columnas, textarea
  de 14 filas. Las dos siguen siendo stubs de UI (no mandan un email real todavía —
  `ModalEmailMiembro` es de Fase 5; `ModalEmail` de Pedidos muestra el toast "el envío de
  emails individuales llega en una fase más adelante") — se tocó solo la presentación, no se
  conectó ningún envío nuevo.
- **`ModalInvitar.tsx`** (Config: Equipo) — revisado y descartado: es un formulario de alta de
  miembro (nombre/email/rol/contraseña temporal), no redacta un email con plantillas. Sin
  cambios.
- **`LinkCompartibleModal.tsx`** (Descuentos → link compartible de un cupón) — revisado y
  descartado: su sección "Enviar a un cliente" manda un mensaje fijo (no editable, sin
  plantillas/asunto/cuerpo propios) a un solo cliente elegido por búsqueda. No es "lo mismo"
  que las otras modales, así que se dejó sin tocar.

### [2026-07-31] Rediseño visual completo de los emails: "Cálido con íconos y tarjetas" (Opción B)
**Estado:** RESUELTO (2026-07-31)
Ale pidió "hacer mucho más lindo" el diseño visual de las plantillas de mail. Se armaron 3
propuestas completas (mockups renderizados, no descripciones) para que eligiera: A) Minimalista
moderno, B) Cálido con íconos y tarjetas, C) Corporativo estructurado. Eligió la **B, para todos
los emails, como plantilla reutilizable para toda Orbita** (no un rediseño puntual de un negocio).

Se reescribió `email-layout.hbs` (el layout compartido que envuelve el contenido de las 14
plantillas + el email masivo/custom) y las 14 plantillas de contenido (`welcome`, `reset-password`,
`password-changed`, `member-invitation`, `member-access-reminder`, `order-confirmation`,
`order-shipped`, `order-ready-pickup`, `order-delivered`, `thanks-for-purchase`, `review-request`,
`return-approved`, `subscription-payment-failed`, `subscription-suspended`).

Piezas nuevas en `mail.service.ts`:
- **`darken(hex, factor=0.72)`** y **`toRgba(hex, alpha)`**: derivan, a partir del `colorPrimary`
  que ya se sacaba de Apariencia, el resto de la paleta que necesita el diseño nuevo —
  `colorPrimaryDark` (degradé del header), `colorPrimaryGlow` (sombra del botón, alpha 0.35) y
  `colorPrimaryTint` (fondo de las "tarjetas" de datos, alpha 0.08). Nada de esto se carga a mano
  por negocio: sale todo del mismo color que ya elegían en Apariencia.
- **`TEMPLATE_ICON`**: mapa de nombre-de-plantilla → emoji (👋🔑🔒👥✅📦📍🎉🙏⭐↩️⚠️⏸️), para la
  insignia circular del header — un vistazo alcanza para saber de qué es el mail. El email
  masivo/custom (que no tiene nombre de plantilla) cae en `DEFAULT_ICON` (✉️).
- **Partial `cta-button`**: un solo botón (píldora, color de marca, sombra con el glow) registrado
  una vez en el constructor (`Handlebars.registerPartial`) y usado desde 5 plantillas
  (`reset-password`, `member-invitation`, `member-access-reminder`, `review-request`,
  `subscription-suspended`) como `{{> cta-button this url=... label="..."}}`. **Ojo con el `this`
  inicial**: sin él el partial no hereda `colorPrimary`/`colorPrimaryGlow` del contexto de quien lo
  invoca y esas dos variables quedan `undefined`.

Diseño de cada plantilla de contenido: encabezado centrado siempre; una "tarjeta" con tinte del
color de marca (`colorPrimaryTint`) SOLO donde hay datos estructurados que destacar (código de
seguimiento, items + total, contraseña temporal, monto de reembolso, dirección de retiro) — no en
todas, para no sobrecargar los mails que son puramente un mensaje corto. Los avisos de seguridad
(`password-changed`, `subscription-payment-failed`) mantienen su caja ámbar fija en vez de usar el
tinte de marca — un alerta tiene que leerse urgente sin depender del color que haya elegido el
negocio (mismo criterio que ya regía antes de este rediseño).

Decisiones de robustez para clientes de mail (no solo navegador):
- El degradé del header se declara con `background` DOS VECES (sólido primero, degradé después) —
  los clientes que no soportan degradés en el shorthand (Outlook de escritorio, algunos) se quedan
  con el sólido en vez de romper.
- La insignia circular del ícono va en su PROPIA fila de tabla debajo del header, no superpuesta
  con margen negativo — se sacrifica un poco de parecido con el mockup del navegador a cambio de
  que no se vea rota en clientes que manejan mal ese truco.
- Íconos: emoji en vez de SVG dibujado a mano — mismo criterio que el resto de la interfaz (ya se
  usan emoji en textos existentes), sin riesgo de path mal formado.

Esto es automático para **todos los negocios** (nada de esto es por-negocio: el layout y las 14
plantillas son compartidas, y cada negocio sigue viendo SU propio `colorPrimary`/logo de Apariencia
insertados en el mismo diseño) y también aplica al **email masivo y al email individual/custom**
(`sendCustomEmail`), que se envuelven en el mismo `email-layout.hbs` con el ícono default.

Se actualizaron además las 3 vistas previas del panel (`EmailMasivoModal.tsx`, `ModalEmail.tsx`,
`ModalEmailMiembro.tsx`) para que el mockup que Ale ve mientras redacta coincida visualmente con el
mail real (degradé, insignia circular) — antes tenían un header sólido plano "a mano" que ya no se
parecía al diseño real.

**Ajuste same-day:** a pedido de Ale se sacó el footer "Enviado por {tienda} a través de Órbita" /
"Órbita" (píldora al final de cada mail) — quedó mejor sin esa marca de agua. Se borró ese bloque
entero de `email-layout.hbs` y se repartió su espacio como padding inferior del contenido; el
`isPlatform` que llega desde `mail.service.ts` queda sin uso dentro del `.hbs` (el header ya
resuelve solo el branding de plataforma vs. negocio vía `storeName`), así que no hacía falta tocar
`mail.service.ts` para este cambio — se dejó `isPlatform` en la firma por si hace falta para algo
más el día de mañana. Se replicó el mismo recorte (sin footer) en las 3 vistas previas del panel.

**Importante (mismo problema que el bug de "0 clientes"):** este cambio vuelve a tocar
`email-layout.hbs` y agrega/reescribe archivos `.hbs`, así que otra vez hace falta un **reinicio
completo** de `pnpm dev` de `apps/api` (no alcanza con el hot-reload) para que se vuelvan a copiar
a `dist/mail/templates`.

**Descartado (31/07):** lo de arriba (íconos editables sin tocar código) — Ale decidió no hacerlo.
Se queda con `TEMPLATE_ICON` fijo en código como está. En cambio pidió algo más simple: "si
requiere ícono lo pongo, si no lo requiere no lo pongo" — es decir, que la insignia no se fuerce
en envíos que no tienen un tipo real. Implementado: `icon` ahora puede llegar vacío (`''`) —
`email-layout.hbs` la vuelve condicional (`{{#if icon}}`) y, cuando no hay ícono, el contenido gana
un poco más de padding superior (`contentTopPad`, 16 con ícono / 30 sin él) para que no se sienta
apretado contra el header. Se sacó `DEFAULT_ICON` (el ✉️ de relleno): el email masivo/individual
(`sendCustomEmail`) ahora no muestra insignia — no tiene un "tipo" real, es texto libre — y las 3
vistas previas del panel se actualizaron para reflejar eso (sin el círculo del ícono). Las 14
plantillas fijas conservan su ícono de siempre, sin cambios.

**Reconciliación con `origin/main` (31/07, antes del primer push a producción de este rediseño):**
antes de comitear, Ale corrió `git fetch` y encontró su `main` local 14 commits atrás de
`origin/main` (todos de Mateo, salvo un merge). De esos 14, dos tocaban archivos de este mismo
rediseño:
- **`46f8c` (MAIL_FROM):** corrige el remitente default a `"Órbita" <no-reply@orbita-corp.com>`
  (dominio verificado en Resend — ver entrada del 27/07 más abajo, que ya dejaba esto como
  pendiente). Se absorbió directo en `mail.service.ts`: mismo valor exacto que su commit.
- **`469a9` (reset de contraseña por código):** cambió todo el flujo de "link con token" a
  "código de 6 dígitos" — `PasswordResetToken` ahora guarda el hash de un código numérico (no
  único, se busca por email + `createdAt desc`), TTL 1h→15min, contador de intentos
  (`MAX_RESET_CODE_ATTEMPTS = 5`), nuevo endpoint `POST /auth/verify-reset-code`, y
  `ResetPasswordDto` pasó de `{token, newPassword}` a `{email, code, newPassword}`. La página
  universal `/reset-password` (adónde apuntaba el link) se borró — es decir, el botón que tenía
  mi plantilla ya apuntaba a una página inexistente.
  Se reescribió `reset-password.hbs`: se sacó el botón `cta-button` (ya no hay link al que ir) y
  en su lugar el código va grande, en una tarjeta con el mismo tinte de marca que usa
  `member-invitation.hbs` para la contraseña temporal (32px, monoespaciado, con letter-spacing,
  para que se lea como un código de verificación). El texto de expiración pasó de "este link
  expira" a "este código expira". `sendPasswordReset()` en `mail.service.ts` cambió su firma de
  `{ resetUrl, expiresIn }` a `{ code, expiresIn }` — quien lo llama (`auth.service.ts`, ya
  actualizado por Mateo en `469a9`) tiene que mandar el código, no una URL.

No se tocó `reset-password.dto.ts` — ese ya viene resuelto en `469a9`, no es un archivo de este
rediseño. El resto de los 14 commits no tocan nada de `mail.service.ts` ni de las plantillas
(verificado archivo por archivo antes de reescribir nada).

**Hallazgo al revisar `git status` completo (31/07):** lo que parecían "archivos misteriosos de
un compañero" (`auth.service.ts`, `schema.prisma`, `members.service.ts`, `orders.service.ts`,
`CONTRATO_API.md`) en realidad son propios — es la funcionalidad de **`EmailLog`** (historial de
cada email enviado, para la pestaña Actividad del cliente: modelo `EmailLog` +
`EmailSendStatus` en `schema.prisma`, su migración `20260730180033_email_logs`, y el
`meta?: MailMeta` (businessId/customerId/memberId) que se pasa desde `auth.service.ts` /
`members.service.ts` / `orders.service.ts` en cada llamada a `MailService`) — trabajo que ya
estaba terminado de una tarea anterior pero que nunca se había comiteado. Esto **no es opcional
separarlo del commit de hoy**: `mail.service.ts` (el que estamos comiteando con el rediseño) ya
tiene el `registrar()` que llama a `this.prisma.emailLog.create(...)` desde antes de hoy, así que
si se comitea sin el `EmailLog` de `schema.prisma`, el build de Railway se rompe (la propiedad
`emailLog` no existiría en el cliente de Prisma generado). Los dos trabajos —EmailLog y el
rediseño— quedan atados en un solo commit por esta dependencia real de código, no por
conveniencia.

**Segundo hallazgo, más grande — "falso positivo" de línea de final en TODO el repo (31/07):**
`git status` mostraba ~640 archivos modificados (prácticamente todo el repo — componentes de
descuentos, landing, onboarding, tests e2e, hasta archivos `.csv` de skills, nada relacionado a
mail). Se verificó con `git diff --stat -w` (ignora fin de línea/espacios) que la enorme mayoría
son idénticos byte a byte a lo comiteado — es el mismo problema CRLF/LF que ya había aparecido
con `mail.module.ts` (ver más arriba en esta sesión), pero a nivel de repo entero, no un archivo
suelto. Con `-w` el diff real baja de ~640 a **21 archivos con cambios de verdad** — exactamente
los de esta tarea + los de `EmailLog` (ningún archivo ajeno). No hay `.gitattributes` en el repo
y `core.autocrlf` no está seteado ni local ni globalmente, así que probablemente sea un resabio de
cómo se guardaron los archivos en algún punto anterior (Windows), no algo que haya que
"arreglar" activamente hoy.

Esto sí importa para el `git pull`: si se deja ese ruido sin resolver, el pull probablemente se
traba con "your local changes would be overwritten" en archivos que nadie tocó. Plan: comitear
primero los 28 archivos reales (los de arriba), después `git restore .` para descartar el resto
del ruido (ya inofensivo una vez que lo real está comiteado, porque `restore` no toca lo que ya
coincide con HEAD), y recién ahí `git pull`. Con `reset-password.hbs`/`mail.service.ts` ya
reescritos para el flujo nuevo de Mateo, el único conflicto de merge esperable es ese, y es
manejable a mano si aparece.

**Resolución de los 3 conflictos de merge (31/07):** el `git pull` de Ale trajo los 14 commits y
efectivamente marcó conflicto en los 3 archivos esperados. Resueltos así:
- **`reset-password.hbs`:** todo el archivo era el conflicto (Mateo tenía su propia versión, un
  documento HTML completo con `<html><body>`, escrita ANTES de que existiera el layout
  compartido). Se descartó esa versión entera y se dejó la nuestra (el fragmento "cálido" con
  `{{code}}` en tarjeta) — ya tenía todo lo que la de Mateo necesitaba (el código, el texto de
  expiración) pero en el formato correcto para `envolverEnLayout()`.
- **`mail.service.ts`:** un solo conflicto en `sendPasswordReset`/`sendPasswordChanged`. Se quedó
  con nuestra versión completa — ya incluía la firma de Mateo (`{ code, expiresIn }`) más el
  `meta?: MailMeta` y el método `sendPasswordChanged` (aviso de seguridad), ninguno de los cuales
  existía todavía en su commit. Superset limpio, nada que perder de su lado.
- **`auth.service.ts`:** el más grande, 5 conflictos dentro de `forgotPassword`/
  `issuePasswordResetToken`/`resetPassword`. Acá SÍ hubo que combinar de verdad, no solo elegir un
  lado: se sacó el parámetro `slug`/`businessSlug` que `issuePasswordResetToken` ya no necesita
  (era solo para armar el `resetUrl` del flujo viejo, que Mateo eliminó), pero se conservó
  `destinatario` (el `meta` para EmailLog, que su commit no tiene). El conflicto grande de
  `issuePasswordResetToken` combinó nuestro envío con `meta` + el `verifyResetCode`/
  `findValidResetCode` enteros de Mateo (funciones nuevas que `resetPassword()` ya llama, así que
  sacarlas hubiera roto el build). El último conflicto combinó nuestro aviso de
  `sendPasswordChanged` con el `return` de Mateo al final de `resetPassword()` — sin ese `return`
  la función se queda sin devolver nada, pese a que su firma promete `{ userType }`.

Verificado antes de que Ale comiteara: sin marcadores de conflicto restantes, sintaxis TypeScript
válida (parseo con el compilador real del proyecto, 0 errores en ambos archivos), llaves/paréntesis
balanceados, indentación prolija.

**Nota aparte, no relacionada al merge:** un par de veces durante esta tarea quedó un
`.git/index.lock` viejo trabado (de un intento anterior que no se limpió solo) bloqueando
`git add`/`git status`. Si vuelve a pasar, es inofensivo — hay que borrar ese archivo puntual
(no el resto de `.git/`) y reintentar.

**Íconos: de emoji a SVG de línea, color de marca (31/07, ajuste post-feedback de Ale sobre lo de
arriba):** con las 14 plantillas ya en producción, Ale probó los emails reales y pidió mejorar los
íconos: "se nota que es re IA" — el criterio de arriba (emoji, "mismo que el resto de la interfaz")
quedó **superado por esta entrada**, no es el estado final. Se armaron 2 propuestas reales
(mismo layout/insignia, no mockups sueltos): A) emoji curados a mano (menos genéricos que el set
por default, pero seguían siendo emoji) y B) íconos de línea SVG estilo lucide-react (la librería
que ya usa el resto del panel), con el trade-off explícito de que el soporte de SVG inline en
Outlook de escritorio (no Outlook.com) es pobre/inconsistente — ahí puede no verse el ícono (queda
el círculo blanco vacío, no se rompe el email). Eligió **B para las 14 plantillas**, aceptando ese
trade-off: "hacemos todo b, osea la idea es que no parezca ia... quiero algo como profesional".

Implementación en `mail.service.ts`:
- **`svgIcon(inner: string)`**: helper privado que envuelve el path/circle de cada ícono en un
  `<svg stroke="currentColor" ...>` común (26px, trazo fino, sin relleno, puntas/uniones
  redondeadas — mismo look que lucide-react). `currentColor` en vez de un hex fijo es la clave:
  el color real lo pone quien use el SVG vía la propiedad CSS `color` de un contenedor, no este
  archivo.
- **`TEMPLATE_ICON`** pasó de `Record<string, string>` de emoji a `Record<string, string>` de SVG
  (`this.svgIcon('<path .../>...')` por entrada) — mismas 14 claves, sin cambios en los call sites
  (`envolverEnLayout`/`renderTemplate` siguen recibiendo un string, ahora es HTML en vez de emoji).
  Cada ícono elegido por semántica del tipo de mail (ver comentario por entrada en el código):
  Sparkles/bienvenida, Key/reset y recordatorio de acceso, Lock/contraseña cambiada,
  Users/invitación de miembro, CircleCheck/pedido confirmado, Package/despachado,
  MapPin/retiro en local, PackageCheck/entregado, HeartHandshake/gracias por tu compra,
  Star/pedido de reseña, Undo2/devolución aprobada, TriangleAlert/pago de suscripción fallido,
  Pause/suscripción suspendida.

Implementación en `email-layout.hbs` (la insignia circular de 56px que ya existía):
- El `<td>` de la insignia pasó de `font-size:24px; line-height:56px;` (para centrar el emoji como
  texto) a **`color:{{colorPrimary}}`** — ese `color` es lo que hereda el `stroke="currentColor"`
  del SVG, así cada negocio ve el ícono en SU color de marca sin que `mail.service.ts` tenga que
  saber de colores por negocio (lo mismo que ya hacían `colorPrimaryDark`/`Glow`/`Tint`, pero por
  herencia CSS en vez de por template).
- `{{icon}}` (texto escapado, servía para emoji) pasó a **`{{{icon}}}`** (triple-stash, sin
  escapar) porque ahora `icon` es marcado HTML/SVG, no texto plano — con el escapado normal
  Handlebars convertía los `<`/`>` del SVG en `&lt;`/`&gt;` y no se veía nada.

**Verificado antes de dar por buena la implementación** (no alcanza con que compile):
- Sintaxis: parseo TypeScript real, 0 errores de sintaxis en `mail.service.ts` (los únicos
  diagnósticos son de módulos/tipos no instalados en el entorno de verificación, no del código).
- Handlebars: `email-layout.hbs` sigue compilando en modo `strict: true` sin variables faltantes.
- **Herencia de color con 2 marcas distintas** (el punto que más importaba, porque toda la gracia
  del rediseño es "cada negocio ve SU color"): se renderizó `order-confirmation` para "Zapatos
  Lorena" (`colorPrimary` #2563eb, azul) y "Casa Verde" (`colorPrimary` #16a34a, verde) y se leyó
  el `color` computado del `<svg>` en cada uno — dio exactamente `rgb(37, 99, 235)` y
  `rgb(22, 163, 74)` respectivamente, es decir cada ícono hereda el color de marca correcto, no un
  color fijo compartido. Confirmado también a simple vista con capturas de pantalla lado a lado.
- Las 3 vistas previas del panel (`EmailMasivoModal.tsx`, `ModalEmail.tsx`,
  `ModalEmailMiembro.tsx`): no necesitaron cambios — ninguna de las 3 dibuja la insignia de ícono
  (son para el email masivo/individual custom, que no tiene un "tipo" fijo y por lo tanto nunca
  tuvo ícono, ver la entrada de arriba "si requiere ícono lo pongo, si no lo requiere no lo pongo").
  El único `icon` que aparece en esos 3 archivos es el ícono de Lucide de un botón ("Enviar"), sin
  relación con `TEMPLATE_ICON`.

**Trade-off aceptado, no un bug si aparece:** en Outlook de escritorio un ícono puede no
renderizarse (círculo blanco vacío en vez del trazo) — es soporte de SVG inline del motor de
renderizado de Outlook de escritorio (basado en Word), no algo que dependa de este código. Gmail,
Apple Mail y Outlook nuevo (outlook.com/Outlook para Mac) lo muestran bien. Decisión explícita de
Ale, con el trade-off ya explicado antes de elegir.

### [2026-07-27] Se reemplazó @nestjs-modules/mailer (SMTP) por el SDK de Resend
**Estado:** RESUELTO (2026-07-30) — verificado con un envío real de punta a punta (cayó en
spam por dominio sin verificar, ver detalle abajo)
El proyecto usaba `@nestjs-modules/mailer` + `nodemailer` con transporte SMTP
(`MAIL_HOST/PORT/USER/PASS`). El usuario decidió usar Resend en su lugar. Se evaluaron dos
caminos: apuntar `MAIL_HOST` al relay SMTP de Resend (cero cambios de código) o usar el SDK
oficial. **Eligió el SDK.**

Cambios:
- `mail.module.ts` ya no registra `MailerModule` — `MailService` es autosuficiente.
- `mail.service.ts` reemplaza el adapter Handlebars de `@nestjs-modules/mailer` por
  `handlebars` compilado a mano (`Handlebars.compile(source, { strict: true })`), cacheando
  cada plantilla ya compilada. La API pública del servicio (`sendWelcome`, `sendOrderShipped`,
  etc.) **no cambió** — los 4 consumidores (`auth`, `customers`, `members`, `orders`) no
  necesitaron tocarse.
- Nueva env: `RESEND_API_KEY` (reemplaza `MAIL_HOST/PORT/USER/PASS`). `MAIL_FROM` se mantiene.
- Se sacaron `@nestjs-modules/mailer`, `nodemailer` y `@types/nodemailer`; se agregó `resend`.
- `nest-cli.json` ya copiaba los `.hbs` a `dist/mail/templates` (config `assets` preexistente)
  — se verificó que sigue funcionando con el build real, no solo en dev con `ts-node`.

**Verificado (2026-07-27):** las 10 plantillas renderizan sin error con `strict: true` y datos
de muestra; `pnpm run build` copia los `.hbs` a `dist/mail/templates`; `node dist/main.js` (el
comando que corre Railway) levanta `MailModule` sin excepciones.

**Verificado (2026-07-30) — envío real de punta a punta:** la nota anterior de esta entrada
decía que la `RESEND_API_KEY` circulada estaba comprometida — no era así, sigue siendo la
misma key vigente del documento original. La probé en dev local: creé un cliente de prueba y
mandé un email real por `POST /customers/email`. Llegó a la casilla destino con el asunto y el
cuerpo correctos, y quedó registrado en `email_logs` (`status: SENT`). **Cayó en la carpeta de
spam** — esperable, no es un bug: hoy se manda desde `onboarding@resend.dev` (remitente
compartido de Resend para cuentas sin dominio propio verificado), sin SPF/DKIM/DMARC que le den
reputación al mensaje. Falta verificar el dominio `orbita-corp.com` en el dashboard de Resend y
recién ahí cambiar `MAIL_FROM` a una dirección de ese dominio (ej. `noreply@orbita-corp.com`)
— hasta entonces cualquier envío, local o de Railway, va a seguir cayendo en spam aunque se
entregue bien. Repetir esta misma prueba contra Railway una vez que el dominio esté verificado
ahí.

## Infraestructura / Entorno de desarrollo

### [2026-07-18] Error intermitente: "new row violates row-level security policy" al subir a Storage — sin causa raíz confirmada, autoresuelto
**Estado:** ABIERTO — no reproducible actualmente, causa raíz sin confirmar. Investigación
extensa documentada acá para no repetirla desde cero si reaparece.
`POST /business/storefront-config/logo` falló de forma reproducible con `400 "new row violates
row-level security policy"` durante ~40 minutos de pruebas (tanto en la sesión de desarrollo
como en el navegador real del usuario), y después empezó a funcionar de forma estable (6/6
intentos seguidos) sin ningún cambio de código de por medio. Hipótesis descartadas, una por una,
con evidencia:
- **¿Service role key incorrecta/mal resuelta por NestJS?** No — se comparó el fingerprint
  (largo, prefijo, sufijo) de la key resuelta por `ConfigService` dentro de la app corriendo
  contra la del `.env` leído directo: idénticas.
- **¿`AuthGuard` "contamina" el `adminClient` compartido llamando `auth.getUser(token)` antes de
  cada request, degradando llamadas de Storage subsiguientes a "usuario autenticado" en vez de
  "service role"?** No — se reprodujo el mismo patrón (`getUser(token)` seguido de
  `.storage.upload()` sobre el mismo cliente) en un script aislado y no falló.
- **¿Cliente "frío" en la primera llamada real a Storage tras un restart?** No — se probó
  "precalentar" el cliente en `onModuleInit()` con un upload+delete real (no alcanza con
  `listBuckets()`, que no toca el mismo path que un insert en `storage.objects`) y el error
  siguió apareciendo en la primera request real de todos modos. Se revirtió el intento (no
  demostró ningún efecto).
- **¿Diferencia en las opciones del cliente (`auth: { autoRefreshToken: false, persistSession:
  false }`) entre el `SupabaseService` real y los scripts de prueba?** No — se replicaron esas
  opciones exactas en un script aislado contra el mismo bucket y subió sin problema.
- **¿Iba y venía con cada restart del servidor?** Tampoco de forma consistente — hubo restarts
  limpios donde el primer intento fallaba, y llamadas repetidas sobre el mismo proceso (mismo
  negocio, mismo token) que siguieron fallando 2 veces seguidas antes de, más tarde, empezar a
  funcionar sin ningún cambio identificable.

**Hipótesis más plausible, sin poder confirmarla desde acá**: algo transitorio del lado de
Supabase específico al bucket `business-logos` (creado ese mismo día, a diferencia de
`product-images` que nunca mostró este problema y tiene varios días de antigüedad) — posible
demora de propagación de metadata/políticas para un bucket nuevo, o flakiness puntual de su
infraestructura de Storage. **Si reaparece**: (a) confirmar si coincide con un bucket recién
creado, (b) revisar el dashboard de Supabase (Storage → Logs, o el status page de Supabase) por
si hay incidentes reportados, (c) como mitigación pragmática (no implementada — se decidió no
agregar retries especulativos para un bug que no se pudo reproducir de forma confiable),
envolver el upload en un retry con backoff corto (1-2 reintentos) ya que empíricamente los
reintentos eventualmente funcionaron.

### [2026-07-13] Bug de infraestructura: `@supabase/supabase-js` no funciona en Node 20 sin polyfill de WebSocket
**Estado:** RESUELTO (2026-07-13)
Al correr la guía de prueba manual (fases 1 y 2) contra la base real de Supabase por primera
vez, **todos** los logins devolvían `401 "Credenciales inválidas"` — incluso con contraseñas
correctas y una `SERVICE_ROLE_KEY` válida (confirmado probando la misma request directo contra
`POST /auth/v1/token?grant_type=password` de Supabase, que respondía `200` sin problema).

Causa real: `SupabaseService.adminClient` llama a `createClient()` de `@supabase/supabase-js`
(v2.110.2), que en su constructor intenta inicializar un `RealtimeClient` y ese busca
`WebSocket` nativo del entorno — disponible recién desde Node 22. El proyecto corre en Node
20.19.6, así que `createClient()` **tiraba una excepción síncrona** apenas se llamaba, incluso
aunque este cliente admin no usa canales realtime en ningún lado. El bug quedó invisible porque
`AuthService.login()` envuelve la llamada a Supabase en un `try/catch` genérico que convierte
*cualquier* excepción (de red, de config, o de credenciales) en el mismo `401 "Credenciales
inválidas"` — ver entrada siguiente.

Fix: se instaló `ws` (+ `@types/ws`) y se le pasa explícitamente como `realtime.transport` en
`createClient()` (`src/supabase/supabase.service.ts`). Con eso `RealtimeClient` deja de intentar
resolver un `WebSocket` nativo. Verificado: los 10 pasos de Auth (1.1–1.10) y los 13 de
Negocio/Sucursales (2.1–2.13) de la guía de prueba manual ahora pasan de punta a punta.
**Alternativa a futuro:** si el equipo migra a Node 22+, este polyfill deja de ser necesario y
se puede quitar.

### [2026-07-13] `pnpm add` en un subproyecto pnpm puede podar dependencias de otro `pnpm install` previo
**Estado:** RESUELTO (2026-07-13)
Después de instalar las dependencias del módulo de mail (`pnpm add @nestjs-modules/mailer ...`),
el siguiente `pnpm dev` falló con `Cannot find module '@supabase/supabase-js'` pese a que seguía
listado en `package.json`. La carpeta `node_modules/@supabase` había quedado vacía. Se resolvió
corriendo `pnpm install` (sin argumentos) para resincronizar el lockfile con `node_modules`. Si
vuelve a pasar después de un `pnpm add`, correr `pnpm install` antes de asumir que es un bug de
código.

---

## Seed / Fixtures

### [2026-07-13] `apps/api/scripts/reset-unlinked-customer.ts` no existe
**Estado:** RESUELTO (2026-07-18)
Ya no se necesita el script: con auth propio, el seed resetea `passwordHash: null` en los
customers "sin cuenta" automáticamente en cada corrida (`pnpm seed`). No hay Supabase Auth
que limpiar externamente.

### [2026-07-12] GUIA_PRUEBA_MANUAL_FASES_1_2.md no existe en apps/api
**Estado:** RESUELTO (2026-07-13)
Se pidió actualizar la sección 1.9 de `GUIA_PRUEBA_MANUAL_FASES_1_2.md` para reflejar el nuevo
fixture `sinregistrar2@zapatoslorena.test`. En esta sesión se confirmó que el archivo sí existe,
como `apps/api/Guia prueba manual fases 1 2.md` (con espacios y mayúscula distinta al nombre
buscado antes) — la búsqueda anterior no lo encontró por diferencia de nombre. Ya menciona
ambos fixtures y por qué existe el segundo. Se corrió la guía completa en esta sesión (1.1–1.10
y 2.1–2.13, todos ✅) y se actualizó la tabla de estado y los resultados reales del archivo.

## Fase 3 — Descuentos y Cupones (RBT-613/614/615)

> NOTA (2026-07-31): varias entradas de esta sección se habían perdido en un merge de
> PENDIENTES.md (un `git pull` resolvió el archivo a favor de la versión remota y descartó las
> entradas de descuentos que había agregado en commits anteriores — el CÓDIGO no se perdió, solo
> la doc). Se re-agregan acá las decisiones vigentes.

### [2026-07-31] Cupones: módulo CRUD construido (RBT-615)
**Estado:** RESUELTO (2026-07-31).
No existía backend de cupones (panel 100% mock). Se construyó el módulo `coupons`
(`apps/api/src/coupons/`): controller + service + DTOs, con crear/editar/eliminar/toggle y
listado por negocio, código único por tienda. Cupones = filas de `discounts` con `code ≠ null`;
todo query filtra `code: { not: null }` + `businessId`. Los 3 helpers comunes (`estadoDe`,
`whereDeEstado`, `resumenesDeAlcance`) se extrajeron a `discounts/discount-status.util.ts` y los
comparten ambos services. Frontend: `couponApi.ts` (adaptador ES↔EN) + 6 hooks conectados a
`/coupons` (antes mock). e2e: `test/coupons.e2e-spec.ts` (12 verde); descuentos sigue 22 verde.

### [2026-07-31] El código de un cupón dado de baja NO se puede reusar
**Estado:** ABIERTO — decisión tomada, conviene que negocio confirme.
El `@@unique([businessId, code])` es un constraint duro que incluye las filas soft-deleted. Como
la baja es soft-delete (la fila se conserva por `DiscountRedemption`), el `code` queda tomado para
siempre. El service lo chequea sin filtrar `deletedAt` para devolver 400 legible en vez del 500 del
constraint. Para permitir reuso haría falta un índice único parcial (`WHERE deleted_at IS NULL`),
que Prisma no soporta declarativamente. Se dejó así por no meter una migración raw en esta tanda.

### [2026-07-31] Cupones/Descuentos: features que siguen mock/stub
**Estado:** DIFERIDO.
- **Duplicar** (cupón y descuento) — no hay endpoint `duplicate`.
- **Link compartible / envío por email** (cupón) — el estado del link se persiste vía el upsert;
  los endpoints de toggle/envío siguen stub.
- **Métricas por-ítem** (`/discounts/:id/metrics`) y **auditoría** (`/:id/audit`) — stub.
- **Canje real (RBT-616):** `validate`/`apply` + escritura de `DiscountRedemption` al confirmar la
  orden. Sin esto, `usesConsumed` nunca sube y las métricas dan cero.

### [2026-07-30] Descuentos: estado 'agotado' derivado
**Estado:** RESUELTO (2026-07-30) — re-agregada tras el merge.
`estadoDe()` deriva 'agotado' cuando `usesConsumed >= maxUsesTotal` (el motor ya lo excluía). No
es filtrable en SQL (comparación de columnas): el DTO de filtro sigue con 4 estados, el dropdown
no ofrece 'agotado', se muestra solo como badge.

### [2026-07-30] EvaluateDiscountsDto dejó de arrastrar el POS
**Estado:** RESUELTO (2026-07-30) — re-agregada tras el merge.
Se eliminaron `channel` ('POS'|'STOREFRONT', muerto: el service nunca lo leyó) y `unitPrice` (el
motor usa el precio de la base; mandarlo era un footgun). Se agregó `@Min(1)` a `quantity`. El
`ValidationPipe` usa `whitelist` sin `forbidNonWhitelisted`, así que un caller viejo no rompe.

## Tests E2E

### [2026-07-20] Throttler real activo en tests — deshabilitado explícitamente vía skipIf
**Estado:** RESUELTO (2026-07-20)
Se verificó con un test empírico que el `ThrottlerGuard` global funciona correctamente en
producción (5 requests → 201, 6to → 429, confirmado por headers `X-RateLimit-*`). La suite de
`forgot-password` (5 tests) nunca lo disparaba porque hace exactamente 5 requests HTTP totales
— justo el límite, sin pasarlo. No era un bug de rate-limiting en producción. Se agregó
`skipIf: () => true` overrideando `THROTTLER:MODULE_OPTIONS` en `test/helpers/test-app.ts`
(con comentario en el código) para que las suites e2e prueben lógica de negocio sin que el
throttle interfiera — necesario porque `@Throttle()` a nivel de handler overridea el límite
del módulo, así que `skipIf` es la única forma de saltearlo sin tocar código de producción.

### [2026-07-20] Suite e2e corre contra una base Supabase compartida real, no una DB de test efímera
**Estado:** ABIERTO
`DATABASE_URL` apunta a un pooler de Supabase real (`aws-1-sa-east-1.pooler.supabase.com`), no
a una base local/efímera. Esto genera dos problemas observados en esta sesión: (1) los
customers `test-e2e-*@example.com` creados por `register()` en corridas pasadas del suite se
acumulan indefinidamente (no hay cleanup automático); (2) al correr **todos** los archivos
`.e2e-spec.ts` en paralelo (comportamiento default de Jest), se detectó una condición de
carrera entre `auth-isolation.e2e-spec.ts` y `auth.e2e-spec.ts`: el test "forgot-password sin
slug + email de owner → MEMBER" a veces lee `userType: 'CUSTOMER'` porque la query de
verificación (`passwordResetToken.findFirst` ordenado por `createdAt desc`) no está scopeada
por negocio, y ambos archivos escriben filas para el mismo email (`dueno@zapatoslorena.test`,
reusado como fixture en ambos suites) contra la misma tabla compartida. Workaround usado en
esta sesión: `jest --runInBand`. Pendiente evaluar: (a) DB de test dedicada/efímera por CI run,
(b) `--runInBand` permanente en `test:e2e`, o (c) scopear las queries de verificación de los
tests por negocio para que no dependan del orden global de inserción.

### [2026-07-12] Tests e2e crean usuarios reales en Supabase que no se limpian
**Estado:** RESUELTO (2026-07-18)
Con la migración a auth propio, los tests ya no tocan Supabase Auth. Los customers de test
se crean en la DB local y se limpian con el seed (que ahora resetea `passwordHash: null` en
los fixtures "sin cuenta").

### [2026-07-12] Login de member enviando header X-Business-Slug: prioriza member
**Estado:** RESUELTO (2026-07-12)
El `AuthGuard` usaba `if (slug)` como primera condición, lo que hacía que un token de member
fuera resuelto como customer si la request incluía el header `X-Business-Slug`. Corregido:
ahora el guard busca siempre en `members` primero (por `authUserId`), sin importar si el
header está presente. Solo si no se encuentra member se procede a buscar como customer (ahí
sí se requiere el header). La prioridad member > customer es ahora incondicional. Test de
regresión agregado en `auth.e2e-spec.ts`.

### [2026-07-12] POST /auth/accept-invitation y POST /auth/reset-password sin test e2e
**Estado:** ABIERTO — cobertura parcial (ahora factible sin Supabase)
Ambos endpoints funcionan pero no tienen test e2e automatizado. Con auth propio, el
blocker técnico (necesitaban estado en Supabase) desapareció: `accept-invitation` solo
requiere un member PENDING con `hasTempPassword: true` en la DB local;
`reset-password` requiere un PasswordResetToken creado directamente en la DB.

---

## Fase 1 — Auth

### [2026-07-18] Migración de Supabase Auth a sistema propio completada
**Estado:** RESUELTO (2026-07-18) — cierre final (2026-07-20)
Se eliminó Supabase Auth como proveedor de autenticación. Cada negocio ahora gestiona
credenciales independientemente: argon2id para hashing, JWT HS256 con `JWT_SECRET` propio,
refresh token con rotación (SHA-256 hash en DB). Migración SQL aplicada:
`20260718223824_own_auth_system`. El campo `authUserId` se conservó temporalmente (nullable,
sin uso funcional) tras esa migración.

**Actualización (2026-07-20):** se confirmó que `authUserId` no se leía ni escribía en ningún
flujo activo (grep completo sobre `src/` y `prisma/`, cero referencias funcionales fuera de la
población de `ctx.authUserId` en `AuthGuard`, que a su vez nadie consumía). Se eliminó la
columna de `Member`, `Customer` y `PlatformAdmin` (migración
`20260720000000_drop_auth_user_id`, `DROP COLUMN` + `DROP INDEX` de los `@unique`), junto con
el campo en `MemberContext`/`CustomerContext` (`auth-context.type.ts`) y su población en
`auth.guard.ts`. Se perdieron 15 valores huérfanos (3 members + 12 customers) que apuntaban a
`auth.users` de Supabase y ya no tenían ningún consumidor. **La migración de Supabase Auth a
auth propio está 100% completa — no quedan resabios de la coexistencia temporal.**

### [2026-07-18] `SupabaseService` aún existe pero ya no se usa en auth
**Estado:** ABIERTO
`SupabaseService` sigue existiendo (`src/supabase/supabase.service.ts`) y se importa en
`onboarding.service.ts` (import residual — ya no se usa funcionalmente). Queda pendiente:
(a) eliminar el import no-utilizado, (b) evaluar si `SupabaseService` se sigue necesitando
para Storage (product-images, business-logos) y si no, remover el módulo completo.

### [2026-07-18] Swagger/OpenAPI pendiente de actualizar para nuevos endpoints auth
**Estado:** ABIERTO
Los endpoints de auth cambiaron comportamiento: `register` ya no devuelve token (solo message),
`login` devuelve `refreshToken` adicional, `logout` es público y recibe `refreshToken` en body,
`forgot-password` requiere `X-Business-Slug`. Se agregó `POST /auth/refresh`. Falta actualizar
la documentación OpenAPI/Swagger para reflejar el nuevo contrato.

### [2026-07-18] Frontend no actualizado para el nuevo flujo de auth
**Estado:** ABIERTO — bloqueante para deploy a producción
El frontend sigue usando el flujo anterior (espera token en register, no envía refreshToken en
logout, no usa el endpoint /refresh). Hay que actualizar: (a) flujo de login para almacenar
y rotar refreshToken, (b) flujo de register para redirigir a login después del mensaje de
éxito, (c) interceptor axios para renovar token automáticamente cuando expire.

### [2026-07-13] `AuthService.login()` enmascara cualquier excepción como "Credenciales inválidas"
**Estado:** RESUELTO (2026-07-18)
Con la migración a auth propio, el login ya no envuelve llamadas a un servicio externo.
Los errores de argon2/Prisma no se enmascaran — solo se devuelve "Credenciales inválidas"
cuando la contraseña es incorrecta o el usuario no existe (comportamiento deliberado de
no-enumeración).

### [2026-07-12] Validación de JWT vía llamada a Supabase, no localmente
**Estado:** RESUELTO (2026-07-18)
Con la migración a JWT HS256 propio, la validación es local (`jwt.verify` con secret
simétrico). No hay más llamada de red por request. Los refresh tokens se almacenan
hasheados en DB con revocación explícita, lo que reemplaza la detección de tokens
revocados que antes proveía Supabase.

### [2026-07-12] `accept-invitation` usa `memberId` como token, sin expiración ni secreto
**Estado:** RESUELTO (2026-07-14)
Se agregaron `invitationToken` (único, 32 bytes aleatorios en hex) e `invitationTokenExpiresAt`
(7 días) a `Member` — migración `20260715013513_add_member_invitation_token` (columnas
nullable, aditiva, no tocó filas existentes). `members.invite()` genera el token y lo manda en
`panelUrl` en vez del `memberId`; `auth.acceptInvitation()` busca por `invitationToken` (no por
`id`), valida expiración y lo quema (`null`) al aceptar — de un solo uso. `AcceptInvitationDto.
token` pasó de `@IsUUID()` a `@Length(64,64)`, así que un `memberId` viejo ya ni siquiera pasa la
validación del DTO. Verificado en vivo: invite → token de 64 hex ≠ memberId → accept 201 → reuso
del mismo token 400 "ya aceptada" → memberId como token 400 (longitud inválida).

### [2026-07-12] Email de recovery duplicado de Supabase
**Estado:** RESUELTO (2026-07-18)
Con la migración a auth propio, `forgot-password` ya no llama a Supabase Auth. El email de
recuperación solo se envía desde `MailService.sendPasswordReset` — no hay duplicación posible.

---

## Fase 2 — Businesses/Branches

### [2026-07-20] Política de suscripción vencida / eliminación de espacio (decisión de producto)
**Estado:** ABIERTO — política refinada y documentada; la lógica se implementa con el módulo Subscriptions
Política acordada (refinada por Alex el 2026-07-20 — mapea 1:1 a los estados del schema):
1. **Vencimiento**: 5 días de gracia para volver a pagar (PAST_DUE — coincide con
   `gracePeriodDays` del schema y la "política B" del plan técnico). La tienda sigue
   funcionando durante la gracia y se avisa por email.
2. **Sin pago tras la gracia**: la tienda se **pausa** automáticamente (SUSPENDED), con
   aviso por email, y el dueño tiene **30 días** para renovar el pago y reactivarla.
3. **Pasados los 30 días**: borrado definitivo del espacio y sus datos (CANCELLED — esto
   responde el punto abierto del checklist de MODELO_DATOS sobre cuándo SUSPENDED pasa a
   CANCELLED y libera el subdominio).
4. **"Eliminar espacio" con suscripción activa**: la tienda se pausa hasta el fin del
   período ya pagado; después corren los mismos 30 días para arrepentirse (recuperarla
   exige volver a pagar la suscripción); recién ahí, borrado definitivo.
En UI: los textos de "Pausar tienda" y "Eliminar espacio" de Configuración general explican
la política en lenguaje simple dentro de cada acción (se quitó el recuadro de aviso general
por decisión de Alex). El enforcement (crons de gracia y borrado, emails, bloqueo)
corresponde a Subscriptions + preapproval de MP (fase 13 del plan técnico, todavía sin
tarjetas asignadas en Jira — pendiente de repartir en el equipo).
Además se ajustó el lenguaje de la zona peligrosa para usuarios no técnicos (sin
"storefront") y se agregó validación numérica en los campos de envíos (los montos ya no
aceptan texto).

### [2026-07-18] Panel `ConfigGeneral` integrado con la API real — sesión provisoria por localStorage
**Estado:** RESUELTO (2026-07-20) — adaptado al auth real (useAuth + authedFetch)
Actualización 2026-07-20: con la migración de auth (JWT propio + AuthContext + BFF), la
pantalla dejó el workaround de localStorage. Ahora toma la sesión de `useAuth` (exige
`type === 'member'`), llama al backend con `authedFetch` (token en memoria + refresh
automático) vía funciones `panel*` nuevas en `lib/api.ts`, y sin sesión muestra un botón
al login real (`/login`). Pendiente menor anotado: las llamadas de datos del panel van
directo al backend (API_BASE) — en dev con localhost CORS lo permite; bajo subdominios
reales convendrá pasarlas por el BFF (mismo origen), como ya hace auth.
Texto original de la entrada (historial):
La vista General de `apps/web/src/modules/ventas/panel/configuracion/ConfigGeneral.tsx` dejó
de usar datos hardcodeados: carga con `GET /business` + `GET /business/config` y guarda por
card con `PUT /business`, `PUT /business/config` y `POST /business/pause` (con modal de
confirmación). Para autenticarse reutiliza el token de `localStorage` que ya usa el
onboarding (`lib/api.ts`); si no hay token, la pantalla muestra un aviso claro en lugar de
romperse. Cuando Alan implemente el login del panel, reemplazar ese origen del token.
"Eliminar espacio" quedó deshabilitado en la UI con nota de diferido (depende de
Subscriptions — ver entrada `DELETE /business`). Detalle asumido: un campo de email vacío se
omite del PUT (no "borra" el valor guardado) para no chocar con `@IsEmail()` sobre string
vacío. En `lib/api.ts` se extendieron de forma aditiva `UpdateBusinessConfigInput` y el tipo
de respuesta de `getBusinessConfig()` (campos de contacto/envíos/redes que el DTO del
backend ya aceptaba); ojo: `shippingBase`/`freeShippingFrom` llegan serializados como string
(Decimal de Prisma) y la UI los convierte con `Number()`.

### [2026-07-12] `PUT /business` no acepta el campo `mode`
**Estado:** RESUELTO (2026-07-12)
El contrato original permitía editar `mode` (FULL/SHOWCASE) junto con name/industry/description
en `PUT /business`. Se decidió excluirlo de este endpoint: cambiar de modo afecta todo el
comportamiento del storefront (checkout, carrito, cupones, mensajes, opiniones) y necesita
validación propia (ej. no permitir el cambio si hay pedidos pendientes sin resolver). Falta
diseñar e implementar el endpoint dedicado para cambiar `mode` — ver entrada siguiente.
`CONTRATO_API.md` corregido para reflejar esto.

### [2026-07-12] Endpoint dedicado para cambiar `business.mode` — no implementado
**Estado:** RESUELTO (2026-07-18) — implementado `POST /business/mode`
No existía ninguna forma de cambiar `mode` vía API para un negocio ya activo (el onboarding
puede setearlo vía `PUT /onboarding/business`, pero solo mientras `isActive === false`).
Se implementó `POST /business/mode` en el módulo Businesses (tarea de Alex, Fase 1 —
"definir cómo se cambia el modo"):
- Body `{ mode: 'FULL' | 'SHOWCASE' }` (`ChangeModeDto`), restringido a `@Roles('owner')`
  por ser zona peligrosa (mismo criterio que `POST /business/pause`).
- Idempotente: pedir el modo ya vigente devuelve el negocio sin tocar nada.
- Regla de negocio: para pasar a SHOWCASE no puede haber pedidos ONLINE en curso
  (PENDING/CONFIRMED/PREPARING/SHIPPED, no borrados) → `422` con mensaje. Con la base
  actual sin órdenes el chequeo pasa trivialmente, pero queda listo para cuando Orders
  esté implementado. `PUT /business` sigue excluyendo `mode` a propósito.

### [2026-07-12] Rol mínimo para operaciones de sucursal
**Estado:** RESUELTO (2026-07-12)
El contrato decía owner/admin para `POST/PUT/DELETE /branches`. Se decidió owner únicamente por
ser una operación estructural (afecta stock, caja y reportes de todo el negocio) — más cerca de
"zona peligrosa" que de gestión operativa. `CONTRATO_API.md` corregido en consecuencia, y se
documentó también el endpoint `DELETE /branches/:id` (no estaba en el contrato original).

### [2026-07-12] Endpoint `POST /businesses` (creación de negocio) no implementado
**Estado:** DIFERIDO — hasta diseñar `BusinessOnboardingService` compartido
`CONTRATO_API.md` no documenta ningún endpoint de creación de negocio (el módulo Businesses
solo opera sobre el negocio ya existente del token). La transacción completa (business + branch
default + 4 roles + catálogo de permissions si no existe + business_config + storefront_config
+ notification_config + member owner + subscription inicial) hoy solo existe duplicada a mano
en `apps/api/prisma/seed.ts`. Antes de construir el endpoint real de onboarding, extraer esa
lógica a un servicio compartido (`BusinessOnboardingService` o similar) que tanto el endpoint
como el seed script invoquen — para no mantener dos copias de la misma transacción.

### [2026-07-12] `DELETE /business` (eliminar negocio) sigue sin implementar
**Estado:** DIFERIDO — hasta que exista el módulo Subscriptions
El stub de `DELETE /business` sigue tirando `NotImplementedException`. Interactúa con
`subscriptions` (cancelación) y con cascadas de borrado que dependen de módulos que todavía no
existen (Orders, Payments, etc. con datos reales del negocio). Implementar cuando el módulo de
Subscriptions esté construido.

### [2026-07-12] `assertMemberContext()` agregado en Businesses/Branches
**Estado:** ABIERTO
Se detectó que los endpoints sin `@Roles()` declarado (ej. los `GET`) no bloqueaban tokens de
tipo `customer` — un cliente del storefront que mandara el header `X-Business-Slug` podía
llamar `GET /business`, `GET /branches`, etc., porque `RolesGuard` solo actúa cuando hay roles
declarados. Se agregó un helper `assertMemberContext()` (en
`common/utils/assert-member-context.ts`) que se invoca manualmente al inicio de cada handler de
Businesses y Branches. PENDIENTE: decidir si este chequeo debería moverse al `AuthGuard` global
(aplicado automáticamente a cualquier ruta que no sea explícitamente storefront) en vez de
repetirlo módulo por módulo a medida que se implementen Members, Roles, Categories, etc.

### [2026-07-12] Catálogo de eventos de notificación hardcodeado
**Estado:** ABIERTO/DIFERIDO
La validación de `notification_config.matrix` en `BusinessesService` usa una lista fija de 8
eventos (`nuevo_pedido`, `pedido_cancelado`, `stock_critico`, `devolucion`, `pago_confirmado`,
`resumen_diario`, `cliente_nuevo`, `reporte_semanal`) y 3 canales (`panel`, `email`, `whatsapp`)
definida como constante en el código, no en una tabla. Si en el futuro se necesitan eventos
nuevos, o eventos configurables por negocio/vertical, hay que revisar este diseño (podría
requerir una tabla `notification_events` en vez de un catálogo hardcodeado).

### [2026-07-12] Bug de infraestructura: `tsconfig.build.json` compilaba `prisma/`
**Estado:** RESUELTO (2026-07-12)
Al agregar `apps/api/prisma/seed.ts` en Fase 1, `tsconfig.build.json` —que sobreescribe (no
mergea) el `exclude` de `tsconfig.json`— empezó a incluir `prisma/` en la compilación de `nest
build`. Esto rompía la inferencia de `rootDir` de TypeScript: en vez de `dist/main.js`, el
build generaba `dist/src/main.js`, lo que hubiera roto silenciosamente `pnpm start` (que
apunta a `dist/main.js`) recién en el primer deploy. Se agregó `"prisma"` al array `exclude` de
`tsconfig.build.json`. Verificado: `pnpm build` y `pnpm prisma db seed` funcionan correctamente
después del fix.

---

## Fase 3 — Equipo (Roles/Permissions/Members)

### [2026-07-20] Pestaña Roles del panel Equipo integrada con la API real (+fix del modal)
**Estado:** RESUELTO (2026-07-20)
`Equipo.tsx` (pestaña Roles) dejó los mocks: lista con `GET /roles`, catálogo con
`GET /permissions` (ahora incluye el grupo Catálogo en la UI), y crear/editar/eliminar
contra `POST/PUT/DELETE /roles/:id`, con validación en el modal (nombre + al menos un
permiso) y errores del backend visibles (roles default protegidos, borrado con miembros →
422). Se arregló el bug de diseño del modal de rol: era más alto que la pantalla y el
título/nombre quedaban inaccesibles — ahora el contenido scrollea adentro con header y
footer fijos. Los nombres de los roles default se muestran localizados (owner→Dueño, etc.).
La pestaña **Miembros sigue con datos de muestra** a propósito (tarjeta "Config: Equipo" de
F5 — invitaciones dependen del servicio de email de F3).

### [2026-07-18] "PUT /roles/:id/permissions" cubierto por el reemplazo completo en `PUT /roles/:id`
**Estado:** RESUELTO (2026-07-18) — aclaración, no cambio de código
La tarjeta de Fase 1 ("Crear y editar roles") menciona `PUT /roles/:id/permissions` como ruta
aparte. `RolesService.update()` ya reemplaza la matriz completa de permisos dentro del mismo
`PUT /roles/:id` (deleteMany + create, validando codes contra el catálogo), así que el
comportamiento pedido existe sin ruta extra — no se agregó una ruta no documentada en
CONTRATO_API.md. Las validaciones de la tarjeta ya estaban implementadas: los roles default
(owner incluido) no se editan ni se borran (422), y borrar un rol con miembros asignados da
422 (P2003). El catálogo de permisos del seed ya incluye `catalog.view/manage` y
`config.team.view` (resuelto por el equipo en commits previos).

### [2026-07-13] Autorización por rol (`@Roles()`), no por permiso, pese a lo que dice el contrato
**Estado:** RESUELTO (2026-07-14) — para los módulos de Fases 3-5
Se construyó `PermissionsGuard` + `@RequirePermission(code)` (`common/guards/permissions.guard.ts`,
`common/decorators/require-permission.decorator.ts`), registrado como `APP_GUARD` global junto a
`RolesGuard`. Se migraron todos los controllers de Roles/Members/Categories/Tags/Products/
Inventory/Suppliers siguiendo literalmente lo que dice `CONTRATO_API.md` por endpoint:
- Donde el contrato solo pide un permiso (`catalog.manage`, `catalog.view`, `inventory.manage`,
  `inventory.view`) se dejó **solo** `@RequirePermission()`, sin `@Roles()` — así un rol custom
  con ese permiso puede operar, que era el objetivo de la migración.
- Donde el contrato pide explícitamente "permiso + rol owner/admin" (crear/editar/eliminar
  roles, invitar miembros) o "rol owner" (eliminar miembro) — operaciones que pueden escalar
  privilegios de otros — se mantuvo `@Roles()` **además** de `@RequirePermission()`, a propósito:
  un rol custom con `config.team.manage` no debe poder crear otros roles/miembros.
- Los roles default (`cajero`, `empleado`) sumaron los `*.view` que antes tenían de facto (los
  GET no chequeaban nada más que membership) para no perder acceso de lectura al migrar — ver
  entrada siguiente y `prisma/seed.ts` → `ROLE_PERMISSIONS`.
Verificado en vivo: owner sigue con acceso total; cajero ahora puede ver catálogo/inventario/
roles (antes accesible a cualquier member sin permiso) y sigue bloqueado (403 con el permiso
faltante en el mensaje) en las mutaciones. No se tocó ningún otro módulo (Orders, Cash, etc.) —
siguen en `@Roles()` puro, fuera del alcance de este fix.

### [2026-07-13] Catálogo de permisos seed no incluye `catalog.*` ni `config.team.view`
**Estado:** RESUELTO (2026-07-14)
Se agregaron `catalog.view`, `catalog.manage` (grupo nuevo "Catálogo") y `config.team.view`
(grupo "Configuración") a `PERMISSIONS` en `prisma/seed.ts`, y se sumaron a `ROLE_PERMISSIONS`
de `cajero`/`empleado` (además de `inventory.view` para cajero, que no lo tenía). `owner`/`admin`
los reciben automáticamente (mapean todo el catálogo). Seed re-corrido (upsert, no destructivo):
`GET /permissions` ahora devuelve 22 permisos en 8 grupos, verificado contra el server real.

### [2026-07-13] `AppRole` usa 'cashier'/'employee' (inglés) pero los roles seedeados son 'cajero'/'empleado' (español)
**Estado:** RESUELTO (2026-07-14)
`common/decorators/roles.decorator.ts` → `AppRole` ahora es `'owner' | 'admin' | 'cajero' |
'empleado'`, alineado con los `name` reales de `prisma/seed.ts`. Ningún código usaba los valores
en inglés (confirmado por grep antes del cambio), así que no hubo que tocar ningún `@Roles(...)`
existente — el fix es puramente el tipo, para que el compilador rechace `@Roles('cashier')` en
vez de dejarlo pasar silenciosamente como antes.

### [2026-07-13] Al eliminar un miembro no se borra su usuario de Supabase Auth
**Estado:** ABIERTO
`MembersService.remove()` borra la fila de `members` pero no llama a
`supabase.adminClient.auth.admin.deleteUser()`. Consecuencia: el email queda "reservado" en
Supabase Auth para siempre — si más adelante alguien quiere reinvitar a esa misma persona (o
alguien más con el mismo email), el `admin.createUser()` de `invite()` va a fallar. Se decidió
no borrarlo automáticamente porque no hay indicación clara en el contrato de que corresponda, y
borrar usuarios de Auth es una acción con más superficie de riesgo que dejarla pendiente de
confirmación explícita del equipo.

---

## Fase 4 — Catálogo (Categories/Tags/Products)

### [2026-07-13] Producto sin variantes: variante default con stock inicial en 0
**Estado:** RESUELTO (2026-07-13) — decisión tomada por ambigüedad del contrato
El contrato dice: *"Si `variants` viene vacío... el backend crea una variante `isDefault` que
hereda `basePrice` **y el stock inicial**"* — sin especificar de dónde sale ese "stock inicial"
cuando el array viene vacío (no hay ningún objeto variant del que leerlo). Se decidió: variante
única con `price = basePrice`, `comparePrice` del producto, `initialStock: 0`, `stockMin: 0`. El
stock real se carga después desde el módulo de Inventario (Fase 5). Verificado funcionando.

### [2026-07-13] Matching de `variant.optionValues` con las opciones es posicional, no por nombre
**Estado:** RESUELTO (2026-07-13) — decisión tomada por ambigüedad del contrato
El contrato define `variant.optionValues: string[]` (ej. `["M","Negro"]`) sin decir qué opción
corresponde a qué posición del array. Se implementó **matching posicional**: el índice *i* de
`optionValues` se resuelve contra `options[i]` (mismo orden en que vino `options[]` en el
request). Si `options.length !== variant.optionValues.length` para alguna variante → `400`. Se
verificó con Talle+Color en ese orden y funcionó correctamente. Si el frontend arma el array en
otro orden (o por nombre de opción), esto va a resolver mal — avisar si el frontend no controla
el orden explícitamente.

### [2026-07-13] `PUT /products/:id` no reconcilia variantes/opciones/stock — solo campos escalares y tags
**Estado:** RESUELTO (2026-07-14) — parcial, a propósito (ver alcance abajo)
Se agregó `id?: string` (UUID opcional) a `ProductVariantInput`. `update()` ahora reconcilia
variantes: las que traen `id` y matchean una variante existente del producto se actualizan
(`sku`/`barcode`/`price`/`comparePrice`); las que no traen `id` se crean, resolviendo
`optionValues` posicionalmente contra las **opciones ya persistidas** del producto (mismo
criterio posicional que `create()`). Si un `id` no pertenece al producto → `400`. Si una
variante nueva no trae la cantidad exacta de `optionValues` que el producto tiene opciones →
`400`.
**Alcance deliberado, sigue sin resolver:**
- **No se borran variantes** ausentes del body — se mantuvo la protección contra
  delete-and-recreate (mismo riesgo de `orderItems`/`stockMovements` sin cascade que motivó
  esta entrada originalmente). Sacar una variante del array simplemente no la toca.
- **El árbol de opciones (`options`) sigue sin reconciliarse** — una variante nueva solo puede
  usar valores de opciones que YA existen en el producto; no se pueden agregar/editar opciones
  vía `PUT`. Sigue pendiente si el panel necesita eso.
Verificado en vivo contra un producto con 3 variantes: actualicé precio de una existente (sin
duplicarla), agregué una variante nueva con combinación de opciones inédita, y confirmé los dos
`400` (id ajeno, optionValues con cantidad incorrecta).

### [2026-07-13] No existe endpoint separado `PUT /products/:id/tags`
**Estado:** RESUELTO (2026-07-13) — aclaración, no bug
`BACKEND_IMPLEMENTACION.md` (checklist interno) lista "4.6 products/tags — PUT
/products/:id/tags" como ítem aparte, pero ni `CONTRATO_API.md` ni el controller ya
scaffoldeado por el CTO tienen esa ruta. `CreateProductDto` ya trae `tagIds?: string[]` y tanto
`create()` como `update()` lo procesan. Se interpretó que 4.6 describe *comportamiento* (los
tags se asignan vía el body de create/update), no una ruta HTTP nueva — no se agregó ninguna
ruta no documentada en el contrato.

### [2026-07-13] Bug de infraestructura: no existía el bucket de Supabase Storage `product-images`
**Estado:** RESUELTO (2026-07-13)
`POST /products/:id/images` subía correctamente el archivo vía `supabase.adminClient.storage`,
pero devolvía `400 Bucket not found` porque el bucket `product-images` nunca se había creado en
este proyecto de Supabase. Se creó manualmente vía `supabase.storage.createBucket()` (público,
5MB máx., solo `image/png|jpeg|webp|gif`). **Importante para el equipo**: este bucket vive en
*este* proyecto de Supabase (dev/test) — si existe un proyecto separado de staging/producción,
también va a necesitar el mismo bucket creado antes de que la subida de imágenes funcione ahí.

### [2026-07-13] `totalStock` en `GET /products` suma todas las sucursales, no solo la default
**Estado:** DIFERIDO — hasta que exista multi-sucursal real
El listado de productos calcula `totalStock` sumando `variant_stock.quantity` de **todas** las
filas de la variante, sin filtrar por `branch_id`. Con una sola sucursal (V1) da el mismo
resultado que filtrar por la sucursal Principal, así que no se nota. Cuando el negocio tenga
más de una sucursal esto va a mostrar stock combinado de todas — revisar si se necesita
filtrar por sucursal del miembro logueado o agregar `branch_id` como query param opcional
(la convención "Multi-branch" de `CONTRATO_API.md` ya prevé esto para otras tablas).

---

## Fase 5 — Inventario (Inventory/Suppliers)

### [2026-07-13] Bug propio detectado y corregido en el momento: protección de borrado de Supplier basada en un supuesto incorrecto sobre el FK
**Estado:** RESUELTO (2026-07-13)
Implementé `removeSupplier()` copiando el patrón de `BranchesService.remove()` (try/catch de
`P2003` → `422 "tiene registros asociados"`), asumiendo que `stock_movements.supplier_id` era
`RESTRICT` como `branches`. Al probarlo manualmente, el borrado de un proveedor **con
movimientos asociados devolvió `200 ok` en vez del `422` esperado** — reveló que el FK real
(`migration.sql`) es `ON DELETE SET NULL`, no `RESTRICT`: el schema ya decidió que borrar un
proveedor debe conservar el historial de `stock_movements` y solo desvincular la referencia.
Se corrigió el código para no fingir una protección que la base de datos no aplica (el
try/catch nunca se iba a disparar — código muerto). Verificado: al borrar un proveedor con
movimientos, estos quedan con `supplierId: null` y el resto de los datos intactos. **Lección
para los próximos módulos**: no asumir el mismo `onDelete` que otro módulo solo porque el
patrón de código se parece — confirmar contra `migration.sql` o `schema.prisma` antes de
escribir el catch, sobre todo en relaciones opcionales (`String?`).

### [2026-07-13] Filtro `lowStock` y paginación de `GET /inventory/stock` se resuelven en memoria
**Estado:** ABIERTO — deuda de performance, no de corrección
`isLowStock` es `quantity <= stockMin`, una comparación entre dos columnas de la misma fila que
Prisma no expresa directamente en un `where` (no hay `field <= field` en el query builder). Se
resolvió trayendo todas las filas de `variant_stock` de la sucursal y filtrando/paginando en
JS. Funciona correctamente pero no escala: con catálogos grandes (miles de variantes) esto trae
todo a memoria antes de paginar. Alternativas si se vuelve un problema real: `$queryRaw` con SQL
crudo, o agregar una columna calculada/generada en Postgres.

### [2026-07-13] `POST /inventory/adjustment` bloquea si el resultado da stock negativo
**Estado:** RESUELTO (2026-07-13) — decisión tomada por ambigüedad del contrato
El contrato no dice explícitamente qué pasa si un ajuste (`quantity` puede ser negativo) deja el
stock por debajo de cero. Se decidió bloquear con `422` en vez de permitir stock negativo —
criterio de negocio (no tiene sentido operativo vender/ajustar por debajo de lo que hay). Mismo
criterio no se aplicó a `entry` (siempre suma, no puede dar negativo por diseño).

---

## Fase 1 — Auth (corrección crítica)

### [2026-07-29] CAUSA RAÍZ del relogin en cada recarga: dos refresh concurrentes sobre un token de un solo uso
**Estado:** RESUELTO (2026-07-29) — verificado con 4 pruebas contra la API real y la base real (ver abajo)
El fix del 2026-07-28 (no borrar la cookie ante errores transitorios) era correcto pero atacaba
otra cosa: el error real **sí era un 401 legítimo del backend**. La causa verdadera:

1. `AdminLayout` NO exigía sesión — las pantallas del panel se montaban de entrada y disparaban
   sus queries **antes** de que el `AuthProvider` terminara de recuperar la sesión.
2. Entonces, en cada recarga del panel salían DOS refresh casi simultáneos con la misma cookie:
   el del bootstrap del `AuthProvider`, y el que dispara `authedFetch` al comerse un 401 de esa
   primera query sin token.
3. El refresh token es de **un solo uso** (`AuthService.refresh()` lo revoca y emite otro). El
   primer pedido lo consumía; el segundo lo encontraba revocado → `UnauthorizedException` (401)
   → el BFF, correctamente, borraba la cookie. **Sesión destruida.**

Encaja con todos los síntomas reportados: pasaba justo tras cada deploy (que es cuando uno
recarga), recargar de nuevo NO lo arreglaba (la cookie ya no existía), y solo revivía cerrando e
iniciando sesión.

Fix en tres capas:
- **`authClient.ts`** — `tryRefresh()` de-duplica: si ya hay un refresh en vuelo, los demás
  llamadores esperan esa misma promesa en vez de disparar otro. Mata la carrera en el origen.
- **`AdminLayout.tsx`** — el panel entero va dentro de `<RequireAuth type="member">`: ninguna
  pantalla se monta (ni pide datos) antes de que la sesión esté resuelta. Además arregla el UX
  que reportó el usuario: si la sesión venció de verdad, ahora **redirige al login** en vez de
  dejar el panel dibujado con un "Token requerido" colgado en el medio.
- **`AuthService.refresh()` + `RefreshToken.replacedAt`** (migración
  `20260729041937_refresh_token_replaced_at`) — ventana de gracia de 30s para tokens revocados
  **por rotación**, que cubre el caso multi-pestaña (dos pestañas recargando a la vez son
  contextos JS separados, la de-duplicación del cliente no las alcanza). `replacedAt` se setea
  SOLO al rotar, nunca en un logout: por eso cerrar sesión sigue siendo inmediato y definitivo.

**Verificado** con 4 pruebas contra la API y la base reales: (1) dos refresh concurrentes con la
misma cookie → ambos 201; (2) refresh después de un logout → 401; (3) token rotado hace 5 min →
401 (la gracia es angosta de verdad, no un bypass); (4) determinista — rotar un token y después
reusar el viejo → 201, imposible sin la ventana de gracia. **ABIERTO menor:** esas 4 pruebas se
corrieron con un script descartable, no quedaron en la suite `test/*.e2e-spec.ts`. Vale la pena
sumarlas ahí para que la regresión no vuelva sin que nadie se entere.

### [2026-07-28] Un deploy de Railway forzaba relogin a todos los usuarios — el BFF borraba la cookie de refresh ante CUALQUIER error, no solo un token inválido
**Estado:** RESUELTO (2026-07-28) — diagnosticado con Insomnia contra producción, confirmando primero que el `Set-Cookie` del login (`Domain=.orbita.site`, `HttpOnly`, `SameSite=Lax`, `Max-Age=2592000`) está perfecto — no era un problema de dominio/cookie como se sospechaba en un primer momento.
`pages/api/auth/refresh.ts` trataba CUALQUIER respuesta no-2xx (o fallo de red) de
`callBackend('/auth/refresh', ...)` como "el refresh token es inválido" y llamaba
`clearRefreshCookie()` — destruyendo la sesión del usuario. Pero `AuthService.refresh()`
(`auth.service.ts:249`) solo tira `UnauthorizedException` (401) cuando el token realmente está
revocado/expirado/no existe; cualquier OTRO código (500 de un bug transitorio, o sobre todo
502/503 durante los pocos segundos que Railway tarda en apagar el contenedor viejo y levantar el
nuevo en cada deploy) no significa nada sobre la validez del token — pero el código lo trataba
igual, matando una sesión perfectamente válida.

Fix:
- `refresh.ts`: solo borra la cookie si el backend responde exactamente `401`. Cualquier otro
  código, cuerpo inválido, o excepción de `fetch` (backend inalcanzable) devuelve `503
  BACKEND_UNAVAILABLE` sin tocar la cookie — un reintento más tarde con la MISMA cookie puede
  funcionar perfecto.
- `authClient.ts` → `tryRefresh()`: si la respuesta es `503`, reintenta una vez después de 1.5s
  antes de rendirse — para que la ventana de unos segundos de un deploy sea invisible para
  cualquiera que esté navegando justo en ese momento, en vez de mostrarle "Token requerido".

Pendiente de verificar en el próximo deploy real (no se pudo reproducir el timing exacto de un
deploy en curso desde esta sesión) que efectivamente ya no fuerza relogin.

### [2026-07-17] Aislamiento multi-tenant en AuthGuard y login/register
**Estado:** RESUELTO (2026-07-17)
Se detectó que `AuthGuard` y `AuthService.login()` buscaban en `members` por `authUserId` sin
filtrar por `businessId` cuando el header `X-Business-Slug` estaba presente. Esto permitía que
un miembro de negocio A fuera resuelto como miembro autenticado al acceder al subdominio de
negocio B — vulnerabilidad de cross-tenant.

Cambios:
- **`auth.guard.ts`**: reescrito con branching por slug. Con slug: resuelve el business, busca
  member y luego customer filtrados por ESE `businessId`. Sin slug: busca member globalmente
  (acceso al panel, `authUserId` es `@unique`).
- **`auth.service.ts` → `login()`**: misma lógica de branching. Con slug: devuelve
  `ForbiddenException({ error: 'NO_ACCOUNT_IN_BUSINESS' })` si el usuario no es ni member ni
  customer de ese negocio. Sin slug: devuelve `ForbiddenException({ error: 'NO_BUSINESS' })`
  si no es member de ningún negocio.
- **`auth.service.ts` → `register()`**: nuevo helper `getOrCreateSupabaseUser()` que reutiliza
  usuarios de Supabase Auth existentes en vez de fallar con "email ya registrado". Permite que
  el dueño de negocio A se registre como cliente en negocio B.
- **Guards downstream** (`RolesGuard`, `PermissionsGuard`, `BusinessModeGuard`): verificados
  limpios — no hacen queries propias a la BD, solo leen de `req.user`.
- **Auditoría del codebase**: grep de `findFirst|findUnique|findMany` sobre `member`/`customer`
  — todos los demás usos filtran por `businessId` o usan IDs ya resueltos por el guard.

### [2026-07-17] `register()` verifica la contraseña implícitamente al hacer `signInWithPassword`
**Estado:** ABIERTO
Cuando un usuario de Supabase Auth ya existente (ej. dueño de negocio A) se registra como
cliente en negocio B, `getOrCreateSupabaseUser()` reutiliza su `authUserId` correctamente. Pero
al final de `register()`, se llama `signInWithPassword(email, dto.password)` para obtener un
token de sesión — y esto falla si la contraseña que el usuario puso en el formulario de registro
del negocio B no coincide con la que ya tiene en Supabase (la del negocio A). El spec original
decía "NO verificar la contraseña" en este caso. Opciones: (a) usar `admin.generateLink()` para
emitir un token sin verificar contraseña, (b) saltear el signIn y usar otro mecanismo para
devolver una sesión, (c) dejar como está y documentar que el usuario debe usar la misma
contraseña. **Pendiente de decisión del equipo.**

---

## Fase 6 — Clientes (Customers/Addresses)

### [2026-07-14] Análisis pre-implementación: 7 fallas detectadas, 4 resueltas
**Estado:** PARCIALMENTE RESUELTO (2026-07-14)
Se comparó el código contra `CONTRATO_API.md` (Fase 4), `BACKEND_IMPLEMENTACION.md` (Fase 6) y
el schema de Prisma. Estado de cada falla:
- **F1**: RESUELTO — `@Roles('owner','admin')` + `assertMemberContext()` agregados a `findAll()`
  y `findOne()` en `CustomersController`.
- **F2**: DESCARTADO — el usuario decidió no implementar `DELETE /customers/:id`. No tiene sentido
  borrar un cliente.
- **F3**: RESUELTO — agregado `sendCustomEmail(to, subject, htmlBody)` a `MailService` para envío
  libre (sin template).
- **F4**: ABIERTO — `AddressesController` sigue sin chequeo de contexto customer. Se resolverá
  al implementar la lógica de negocio del módulo (crear `assertCustomerContext()` y aplicarlo).
- **F5**: RESUELTO — `@CurrentBusiness()` y `@Query()` inyectados en todos los handlers de
  `CustomersController`.
- **F6**: NO APLICA — `MailModule` es `@Global()`, ya está disponible sin import explícito.
- **F7**: RESUELTO (decisión) — se sigue el contrato: solo `/me/addresses` (storefront, scoped al
  token). No se implementa `/customers/:id/addresses` como ruta separada; las addresses del panel
  vienen embebidas en `GET /customers/:id`.

### [2026-07-14] Módulo completo sin implementar — `CustomersService` es un stub
**Estado:** ABIERTO
`customers.controller.ts` y `addresses.controller.ts` devuelven `{"message":"not implemented"}`
en todos los handlers; `CustomersService` solo tiene un método privado que lanza
`NotImplementedException` sin usar. Pendiente: implementar `CustomersService` (CRUD con
vinculación por email `@@unique([businessId, email])`, calculados `orderCount/totalSpent/
avgTicket/lastOrderAt` desde `orders`, y `/me/addresses` scoped a customer) siguiendo el mismo
patrón usado en Fases 3-5. Ver orden sugerido en `Guia prueba manual fase 6.md`.

---

## Fase 4 — Catálogo (Productos) — RBT-301/302/303/304/305

### [2026-07-28] Lista de productos: vista en grilla + export a Excel + limpieza de navegación
**Estado:** RESUELTO (2026-07-28) — verificado con `tsc`; la vista en grilla NO se pudo probar
autenticada end-to-end (sin credenciales reales disponibles en esta sesión para el navegador de
prueba) — solo se confirmó que la app compila y bootea sin errores de consola.
- **`GET /products` ahora devuelve `images: string[]`** (todas las fotos del producto, la
  elegida por `pickPrimaryImageUrl()` primero) además de `primaryImageUrl` — lo necesita el
  carrusel de la vista en grilla. Nuevo helper `orderedImageUrls()`, reusa las imágenes que ya se
  traían para el fallback de imagen principal (no es una query nueva).
- **Vista en grilla (default) + tabla** en `ProductoLista.tsx`: cada card permite navegar entre
  las fotos del producto (flechas + contador "i/n") si tiene más de una — algo que la tabla no
  puede ofrecer. Cae al placeholder de color si no tiene ninguna foto.
- **Export a Excel real** (`exceljs`, agregado a `apps/web`): botón "Exportar Excel" en la lista,
  trae TODAS las páginas que matchean el filtro activo (no solo la visible), con encabezado con
  color/negrita, bordes, filas alternadas y formato de moneda en la columna Precio.
- **`CatalogoTabs` eliminado**: el sidebar del panel ya tiene exactamente la misma navegación
  (Lista de productos / Crear producto / Categorías / Reporte de productos) — el tab-bar propio
  del módulo era redundante y le sacaba espacio a la página. Se sacó de las 4 páginas que lo
  usaban y se borró el componente (quedaba sin ningún uso).
- **Fix de filtros**: no se encontró bug en el filtrado en sí (se probó `status=DRAFT` contra el
  backend real y filtra bien) — pero si el fetch fallaba por cualquier motivo (ej. un 401
  transitorio, algo recurrente esta sesión por el tema de la cookie cross-subdominio, ver más
  abajo), la tabla se quedaba mostrando los resultados VIEJOS sin ningún aviso claro, dando la
  sensación de que el filtro "no funciona". Ahora un error de carga limpia la lista en vez de
  dejar datos desactualizados.

### [2026-07-28] `create()`/`update()` de productos: creación de opciones/valores/variantes en paralelo
**Estado:** RESUELTO (2026-07-28) — verificado con `tsc`
Cada opción, cada valor dentro de una opción, y cada variante son independientes entre sí (no se
referencian unas a otras dentro de la misma request) pero se creaban con un `await` secuencial
uno por uno — con 2-3 opciones y varias variantes esto sumaba varios segundos reales al guardar
un producto. Se cambió a `Promise.all()` en los tres niveles (opciones, valores de cada opción,
variantes), preservando el orden posicional del array de entrada (necesario para
`resolveOptionValueIds()`). Mismo criterio ya aplicado antes en
`SubscriptionsService.confirmAndCreate()`. La subida de imágenes del wizard
(`ProductoNuevo.tsx`) también pasó de secuencial a `Promise.allSettled()` por el mismo motivo.

### [2026-07-28] CAUSA RAÍZ: `bffFetch` pisaba el Content-Type de los uploads multipart — las fotos de producto NUNCA se subieron
**Estado:** RESUELTO (2026-07-28) — diagnosticado con el mensaje de error real en pantalla
`bffFetch()` (`apps/web/src/lib/auth/authClient.ts`) seteaba `Content-Type: application/json`
en toda request que no lo trajera explícito. Pero `panelUploadProductImage()` manda un
`FormData`, y ahí el Content-Type lo tiene que poner el **browser**: incluye el `boundary`
(`multipart/form-data; boundary=----WebKitFormBoundary...`) que el server necesita para separar
las partes. Al pisarlo, el backend recibía un body multipart etiquetado como JSON e intentaba
parsearlo → `SyntaxError: Unexpected token '-', "------WebK"... is not valid JSON`.

**Esto explica retroactivamente TODA la cadena de errores de esta sesión**, que se veían como
bugs distintos pero eran el mismo:
- `PayloadTooLargeError` (el body multipart de varios MB chocaba contra el límite de 100kb del
  `json()` parser, que nunca debió haberlo tocado).
- El `400 Bad Request` genérico.
- El `SyntaxError` de JSON que finalmente lo delató (visible recién después de subir el límite
  de body y arreglar el orden de CORS — los dos fixes anteriores no eran la causa, pero fueron
  necesarios para poder VER el error real).

Notar que `uploadLogo()` en el mismo `api.ts` nunca tuvo el problema: usa `fetch` directo, no
`authedFetch`/`bffFetch`. **El upload de imágenes de producto estuvo roto desde siempre**, no
fue una regresión reciente.

**Fix adicional de robustez** (`ProductoNuevo.tsx`): un fallo al subir una foto ya no tira abajo
todo el guardado. El producto ya existe en ese punto y no se puede deshacer, así que reventar
hacía que el usuario viera "no se pudo guardar", reintentara, y creara duplicados (ver entrada
de abajo). Ahora se avisa cuántas fotos fallaron y se sigue.

### [2026-07-28] Nombre de producto duplicado — sin validación, se creaban copias idénticas
**Estado:** RESUELTO (2026-07-28) — 4 duplicados reales de producción limpiados (soft-delete) además del fix
El bug de la subida de fotos (entradas de abajo) hacía que el usuario reintentara "Publicar
producto" varias veces creyendo que había fallado — cada reintento era un `POST /products`
nuevo (no una edición), así que se creaban productos duplicados idénticos ("Remera Oversize
negra" x4 en el negocio `jaja`). Se agregó `ProductsService.validateUniqueName()`: rechaza
`create()`/`update()` con 409 si ya existe un producto con el mismo nombre (case-insensitive,
sin espacios al borde) en el mismo negocio, excluyendo soft-deleted y, en `update()`, excluyendo
el propio producto que se está editando. Se limpiaron a mano (soft-delete, mismo criterio que
`remove()`) los 4 duplicados reales encontrados en `jaja` — no se tocó un 5to producto con el
mismo nombre en OTRO negocio distinto (de una sesión de prueba anterior, sin relación).

**No resuelve la causa raíz** (por qué la subida de fotos fallaba en primer lugar, forzando el
reintento) — ver entradas de abajo, investigación en curso.

### [2026-07-28] `app.use(json(...))` quedó ANTES de `enableCors()` — tapaba errores reales con "blocked by CORS"
**Estado:** RESUELTO (2026-07-28)
Al agregar el límite de body más grande (entrada de abajo), los nuevos `app.use(json(...))` /
`app.use(urlencoded(...))` quedaron antes de `app.enableCors(...)` en `main.ts`. Si algo fallaba
en esos middlewares (o en cualquier guard/pipe que corriera antes de que Express llegue a
`cors()`), la respuesta de error salía sin los headers de CORS — el browser reportaba "blocked
by CORS policy" en vez de mostrar el error real, y como el body de una respuesta bloqueada por
CORS no es legible desde JS, el frontend solo podía mostrar su mensaje genérico ("No se pudo
guardar el producto") aunque el backend sí hubiera mandado un mensaje útil. Se movió
`enableCors()` a ser el PRIMER middleware — así cualquier respuesta, incluida una de error
temprano, siempre lleva los headers de CORS.

### [2026-07-28] Límite de tamaño de body de Express demasiado chico — bloqueaba subir fotos reales
**Estado:** RESUELTO (2026-07-28) — reproducido con el stack trace real en producción (gracias al logging agregado), verificado con `tsc` + `nest build`
`POST /products/:id/images` tiraba `PayloadTooLargeError: request entity too large` (500, sin
mensaje útil para el usuario) al subir una foto real de varios MB — el límite default de
Express/`body-parser` es demasiado chico para fotos de cámara/celular reales. Es un problema
GLOBAL de la app (no específico de este endpoint): también afecta a cualquier body JSON grande,
como el `logoDataUrl` en base64 que manda el onboarding en `POST /subscription/checkout` — mismo
riesgo, mismo fix. Se subió el límite a 10mb en `main.ts`
(`app.use(json({limit:'10mb'})); app.use(urlencoded({limit:'10mb'}))`). Se agregaron `express` y
`@types/express` como dependencias directas (antes solo transitivas vía
`@nestjs/platform-express`) porque el import directo `from 'express'` no resolvía con pnpm sin
declararlas explícitamente.

### [2026-07-28] `PUT /products/:id` tiraba "Transaction not found" en producción — timeout de Prisma
**Estado:** RESUELTO (2026-07-28) — reproducido con el stack trace real en producción, verificado con `tsc`
Al editar un producto real (`PUT /products/:id`) con variantes, el request tiraba 500
`INTERNAL_ERROR` sin causa visible para el usuario. Se pudo diagnosticar recién después de
arreglar `HttpExceptionFilter` (ver entrada de abajo) para que loguee el stack real — apareció:
```
PrismaClientKnownRequestError: Transaction API error: Transaction not found. Transaction ID is
invalid, refers to an old closed transaction Prisma doesn't have information about anymore...
```
Causa: `create()`/`update()`/`duplicate()` reconcilian opciones, valores y variantes con un
round-trip a la base POR CADA UNO (secuencial, no en batch, ver comentarios en el código) dentro
de una única `$transaction`, sin timeout explícito — Prisma cierra la transacción a los 5s por
default. Con productos de varias opciones/variantes (o latencia de red más alta de lo normal),
esto supera el default y la transacción se cierra a mitad de camino. Mismo tipo de problema que
ya se había resuelto antes en `OnboardingService.registerBusiness()` (ver Onboarding —
RBT-291/292 más abajo) — se aplicó el mismo fix acá: `{ timeout: 15000 }` explícito en las
3 transacciones de `create()`, `update()` y `duplicate()`. `reorderImages()` no se tocó (loop
acotado al número de imágenes de un producto, riesgo mucho menor).

### [2026-07-28] El filtro global de excepciones no logueaba nada — imposible diagnosticar un 500
**Estado:** RESUELTO (2026-07-28)
`HttpExceptionFilter` formateaba CUALQUIER excepción no controlada como
`{error:'INTERNAL_ERROR', statusCode:500}` antes de responder, pero nunca llamaba a un logger —
un 500 real no dejaba ningún rastro en los logs de Railway, haciendo imposible diagnosticar nada
sin reproducir el bug localmente contra la base real (lo cual no siempre es posible). Se agregó
`this.logger.error(mensaje, stack)` para el caso no-HttpException, incluyendo método y URL del
request. Esto fue justo lo que permitió diagnosticar la entrada de arriba.

### [2026-07-28] Fotos de producto se convierten a WebP al subir — se agregó `sharp`
**Estado:** RESUELTO (2026-07-28) — verificado con tsc y una conversión real local, sin probar contra Storage de producción todavía
`ProductsService.addImage()` ahora convierte cualquier imagen subida a WebP (`sharp(...).webp({quality:82})`)
**antes** de subirla a Supabase Storage — nunca se persiste el archivo original, así que no hace
falta un paso aparte de "borrarlo": simplemente nunca se sube. Nueva dependencia: `sharp` (nativo,
requiere el binario prebuildeado correcto para el runtime de Railway — no verificado todavía en
ese entorno, solo local). Si Railway no logra resolver el binario nativo de `sharp` para su
arquitectura, esto rompería la subida de imágenes — vale la pena confirmarlo con el primer deploy.
Si falla, alternativa sin binarios nativos: `@squoosh/lib` o mover la conversión a un Edge Function
de Supabase.

### [2026-07-28] Imagen principal: fallback cuando nadie la marcó a mano
**Estado:** RESUELTO (2026-07-28)
`primaryImageUrl` en `GET /products` y en el reporte de productos (`ReportsService.products()`)
devolvía `null` si el producto no tenía ninguna imagen con `isPrimary:true` — típico en productos
puramente de variantes (ej. solo talles, sin fotos generales) donde el dueño nunca pasó por el
picker de "principal". Se agregó `pickPrimaryImageUrl()` (duplicado en ambos servicios, es una
función de una línea, no se justificaba un módulo compartido): orden de preferencia (1) la
marcada `isPrimary`, (2) la primera foto GENERAL (`optionValueId: null`), (3) la primera foto de
variante que exista. Es un fallback de LECTURA (se computa en cada query), no escribe nada en la
base — se evaluó escribirlo al terminar de subir imágenes en el wizard, pero las imágenes se
suben una por una vía llamadas async separadas sin un paso de "finalizar" claro, así que el
fallback de lectura es más robusto.

### [2026-07-28] SKU autogenerado: más coherente, pero sigue siendo solo frontend
**Estado:** PARCIAL — algoritmo mejorado, decisión de fondo sigue ABIERTA
`generarSKU()` en `ProductoNuevo.tsx` (frontend) ahora saca acentos, descarta artículos/preposiciones
("de", "la", "el"...) y da más largo a nombres de una sola palabra, para que la base del SKU sea
más legible. Pero **nada de esto cambió del lado del backend**: `CreateProductDto`/`products.service.ts`
siguen sin validar formato ni unicidad de SKU — cualquier string llega y se guarda tal cual (incluso
duplicado entre productos del mismo negocio). Sigue abierto si el equipo quiere unicidad de SKU
por negocio (requeriría constraint en Prisma + manejo de conflicto en el service).

### [2026-07-28] Variantes "ancladas": combinaciones parciales + una sola dimensión visual
**Estado:** RESUELTO (2026-07-28) — planificado con el usuario (plan mode) y construido; verificado con `tsc`, SIN probar en vivo contra el navegador (no se llegó a crear un producto real de punta a punta en esta sesión)
El usuario pidió que las combinaciones de variantes no sean siempre el producto cartesiano completo
(hoy: 2 colores × 3 talles = 6 combinaciones siempre) — ej. que "azul" solo esté disponible en
L/M mientras "negro" tenga los 3 talles. También señaló que se podía asignar fotos a CUALQUIER
valor de opción (incluido "Talle"), lo cual no tenía sentido si "Talle" no es la dimensión visual.

Implementado:
- **`ProductVariant.isActive`** (default `true`): en vez de intentar evitar generar la combinación
  desde el origen, el wizard sigue generando el cartesiano completo pero cada fila de la tabla de
  precio/stock (paso 3) tiene un `ToggleConfirmacion` (componente ya existente en
  `_shared/components/`) para "dejar de ofrecer" una combinación puntual. La fila nunca se borra —
  se conserva stock/historial, consistente con el criterio ya existente en `update()` de no borrar
  variantes con `orderItems`/`stockMovements`.
- **`ProductOption.isVisual`** (default `false`, a lo sumo una `true` por producto, validado en
  `products.service.ts`): con una sola opción definida se asume visual sola (sin preguntar); con
  2+, el wizard (paso 2) pide explícitamente "¿Cuál opción define la apariencia?" con chips de
  selección única. "Fotos por variante" ahora solo ofrece slots para los valores de la opción
  elegida — ya no se puede (ni desde el wizard ni desde un body armado a mano, `addImage()`
  también lo valida server-side) asociar una foto a un valor de una opción no-visual.
- **Migración con backfill** (`20260728073557_product_option_visible_variant_active`): además de
  agregar las columnas, un `UPDATE` marca `is_visual=true` en la opción de cada producto EXISTENTE
  que ya tenía fotos asociadas a alguno de sus valores — sin esto, productos ya creados con fotos
  por color habrían dejado de poder gestionarlas tras el cambio. Verificado contra la base
  compartida: 1 de 18 opciones existentes se backfillió (coincide con el único producto de prueba
  que ya tenía fotos por color), las 56 variantes existentes quedaron `isActive:true` (sin cambio
  de comportamiento para lo que ya existía).

**Explícitamente fuera de alcance** (documentado, no un olvido): el storefront (cara del cliente)
está 100% sin implementar todavía — `storefront.service.ts`/`storefront.controller.ts` son stubs
(`NotImplementedException`) y la página de producto del cliente usa datos mockeados, no el modelo
real. Cuando se implemente el storefront de verdad, va a necesitar filtrar por
`variant.isActive:true` para no ofrecer combinaciones desactivadas — el modelo de datos ya está
listo para eso, pero construir el storefront en sí es un proyecto aparte mucho más grande.

**Pendiente de verificación real**: no se llegó a crear un producto de punta a punta contra el
navegador en esta sesión (solo `tsc` + revisión manual del diff) — recomendado probar el flujo
completo (2 opciones, elegir visual, desactivar una combinación, editar y confirmar que precarga
bien) antes de darlo por definitivamente cerrado.

### [2026-07-27] Reconciliación de variantes en PUT /products/:id — criterio definido
**Estado:** RESUELTO (2026-07-27)
RBT-301 y RBT-302 dejaban explícitamente abierto "cómo se reconcilian las variantes existentes"
y "cómo se matchean los optionValues con las opciones". Antes, `update()` no reconciliaba **ni**
el árbol de opciones **ni** el stock: no se podía agregar un talle nuevo ni corregir stock desde
la edición. Criterio implementado:

- **Opciones y valores se matchean por NOMBRE / VALOR**, no por id. El wizard del panel trabaja
  con strings (`"Talle" → ["S","M"]`) y no arrastra ids. Reusar el registro existente además
  preserva el vínculo de las imágenes ya asociadas a ese valor (`ProductImage.optionValueId`).
- **Nunca se borra algo con historial.** Una variante ausente del body se borra **solo si** no
  tiene `orderItems` ni `stockMovements`; si tiene, se conserva (queda huérfana de opciones pero
  no rompe pedidos ni reportes viejos). `ProductVariant` no cascadea desde esas tablas.
- **El stock no se pisa a mano**: si cambia la cantidad de una variante existente se registra un
  movimiento de `AJUSTE` con el delta y el `memberId` de quien editó, replicando lo que hace
  `inventory.service.ts → applyMovement()`. Así Inventario y Productos no se desincronizan.
  Por eso `update()` ahora recibe `memberId` desde el controller.
- Las variantes que llegan con `id` **no** necesitan reenviar `optionValues` (su combinación ya
  está persistida); las nuevas sí. Un `id` que no pertenece al producto se rechaza con 400 en
  vez de caer silenciosamente en "crear nueva" (`validateVariantOwnership`).

**Abierto:** el campo `initialStock` quedó con doble semántica — en POST es "stock con el que
nace", en PUT es "stock al que debe quedar". Funciona, pero el nombre engaña; convendría
renombrarlo a `stock` a secas cuando se toque el contrato.

### [2026-07-27] Códigos de barras eliminados del producto
**Estado:** RESUELTO (2026-07-27) — decisión de producto del usuario
Se eliminó todo el submódulo: `GET /products/barcodes`, el método `barcodes()` del service y el
campo `barcode` de DTOs y respuestas (además de la pantalla del panel). El usuario confirmó que
esa lógica no se va a usar.

**La columna `ProductVariant.barcode` se conservó en el schema** a propósito: es nullable, no
molesta, y borrarla es una migración destructiva sin beneficio. Si en algún momento se decide
que no vuelve nunca, se puede sacar en una migración aparte.

### [2026-07-27] Valor de inventario a costo, con fallback a precio
**Estado:** RESUELTO (2026-07-27) — criterio elegido por el usuario
`GET /products/stats` suma `stock × costo` (criterio contable: lo que hay invertido en
mercadería). Para productos **sin costo cargado** se usa el precio de la variante como
aproximación, para no subestimar el total — el seed incluye a propósito un producto sin costo
("Gorra trucker") para que este caso se vea. El mismo criterio se usa en el desglose por
categoría de `GET /reports/products`.

### [2026-07-27] Duplicar producto: qué se copia y qué no
**Estado:** RESUELTO (2026-07-27)
`POST /products/:id/duplicate` (RBT-302) clona producto, opciones, valores, variantes, imágenes
y tags. Decisiones tomadas sin especificación:
- Nace siempre como **DRAFT** (el dueño lo revisa antes de publicarlo).
- **Stock en 0**: es un producto nuevo, no una copia del inventario del original.
- SKUs con sufijo `-COPIA` para no duplicar códigos internos.
- Las imágenes **se reusan por URL**, no se copia el archivo en Supabase Storage. Son públicas e
  inmutables, así que alcanza. **Ojo:** `removeImage()` borra el archivo del bucket, así que
  borrar una imagen de la copia dejaría rota la del original. **ABIERTO** — si esto molesta, la
  solución es copiar el archivo en el duplicado o dejar de borrar del bucket.

### [2026-07-27] Panel de productos: decisiones de la UI
**Estado:** RESUELTO (2026-07-27)
Al conectar el módulo del panel a la API real (antes era 100% mock) hubo que decidir cosas que
el contrato no cubría:

- **"Sin stock" es un estado de la UI, no del producto.** El dueño piensa en publicado /
  borrador / sin stock, pero en la base `ProductStatus` solo tiene PUBLISHED y DRAFT. El
  filtro `status=OUT_OF_STOCK` (que el DTO ya declaraba pero el service **pasaba crudo a
  Prisma**, lo que hubiera reventado el enum) ahora se traduce a "todas las variantes con todo
  su stock en cero". En la lista, "sin stock" tiene prioridad visual sobre "publicado".
- **El wizard reordenó los pasos**: Info → Variantes e imágenes → Precio y stock → Revisión.
  Las variantes se definen ANTES que las imágenes porque cada foto se asocia a un valor de
  opción, y no se puede elegir el color si todavía no existe.
- **Las imágenes se suben después de guardar el producto.** Los `optionValueId` no existen
  hasta que el POST/PUT responde, así que el wizard mantiene los archivos en memoria (`File`)
  y recién después los sube resolviendo cada uno contra los ids devueltos. Mismo patrón que el
  logo del onboarding.
- **Etiquetas**: RESUELTO (2026-07-27). El wizard trabaja con nombres libres y la API pide
  `tagIds` (uuid), así que al guardar se resuelve nombre → id creando las que no existan
  (comparando sin distinguir mayúsculas, porque `@@unique([businessId, name])` en Postgres sí
  las distingue y "Verano"/"verano" entrarían dos veces). Si el alta falla por una carrera con
  otro usuario, se reintenta buscándola.
  `GET /tags` ahora devuelve además `usageCount` y `createdAt`, y viene ordenado por uso
  descendente: el wizard ofrece las etiquetas ya usadas como sugerencia para reutilizarlas con
  un click, en vez de tipearlas de nuevo (pedido del usuario).

### [2026-07-27] Mock del catálogo eliminado y buscador del sidebar conectado
**Estado:** RESUELTO (2026-07-27)
Se borró `apps/web/src/modules/ventas/panel/catalogo/mock/catalogo.mock.ts`. Las constantes de
UI que vivían ahí (paleta de íconos y colores de categoría, `slugify`) se movieron a
`catalogo/catIcons.ts` — no eran datos de prueba.

**Fuera del módulo:** el buscador global del `Sidebar` usaba `PRODUCTOS_DB` de ese mock, así
que se conectó a `/products` (con debounce). Los resultados de **pedidos y clientes de ese
mismo buscador siguen usando mocks** (`MOCK_PEDIDOS`, `MOCK_CLIENTES`) — son de otro módulo y
quedaron fuera de alcance.

### [2026-07-27] GET /reports/products implementado (el resto de reports sigue stub)
**Estado:** RESUELTO (2026-07-27)
`reports.service.ts` era un stub entero. Se implementó **solo** el reporte de productos (el panel
lo necesitaba para dejar de usar mocks); `dashboard`, `sales`, `customers` e `inventory` siguen
devolviendo `not implemented`. Criterios elegidos:
- Ventana por defecto **30 días** (`?days=` la cambia, tope 365). El panel todavía no expone
  selector de rango.
- **Cuentan todos los estados menos `CANCELLED`**: un pedido pendiente ya es intención de compra.
- El importe usa `unitPrice` congelado del `OrderItem`, no el precio actual del producto.
- **"Sin rotación"** = publicado, sin ventas en la ventana, **y con stock > 0**. Si no tiene
  stock no vendió porque no había, no por falta de demanda (ese caso ya lo cubre "sin stock").

## Fase 13 — Suscripciones (cobro negocio → Órbita)

### [2026-07-28] `confirmAndCreate()` tardaba varios segundos — pasos independientes en paralelo
**Estado:** RESUELTO (2026-07-28) — verificado con `tsc`, no verificado con medición real de latencia
Al probar el pago real contra producción, `/onboarding/pago-retorno` tardó notoriamente más de
lo esperado en confirmar ("suscripción activa" tardó bastante en aparecer). Causa: el nuevo
`confirmAndCreate()` concentra en un solo request TODO lo que antes pasaba repartido en varios
pasos del wizard (`registerBusiness` + `updateDraft` + `updateConfig` + `branch.update` +
`uploadLogo` + `publish` + alta de `Subscription` + `preapproval.update` + `issueSession`), y
los primeros 4 de esos corrían `await` uno detrás del otro pese a ser independientes entre sí
(todos solo necesitan el `businessId`/`branchId` que ya existen). Se cambió a
`Promise.allSettled()` para que corran en paralelo. **No es (solo) el plan de Railway** — es
este cuello de botella estructural del rediseño; paralelizar lo mitiga pero el trabajo total
(incluida la llamada a MP, el upload de logo a Supabase Storage si hay logo, y el upsert de
`Subscription`) sigue siendo más que lo que hacía la vieja `activateFromPreapproval()` (que solo
tocaba `Subscription` + `Business.isActive`). Si sigue sintiéndose lento, el próximo sospechoso
es el loop de upsert de `Permission` (18 upserts secuenciales) dentro de
`OnboardingService.registerBusiness()` — no se tocó en esta pasada por estar fuera del alcance
de este archivo y por tener cobertura e2e que depende de su comportamiento actual.

### [2026-07-28] Subdominios reales (`{slug}.orbita.site`) devuelven 404 `DEPLOYMENT_NOT_FOUND` de Vercel
**Estado:** ABIERTO — requiere acción del usuario en el dashboard de Vercel, no es un bug de código
Al confirmar el pago de prueba, el redirect a `https://asdasd.orbita.site/panel` (subdominio real
del negocio recién creado) devolvió la página de error propia de Vercel `404: NOT_FOUND` /
`DEPLOYMENT_NOT_FOUND`, no nuestra app. Se revisó `middleware.ts` y `lib/tenant.ts`: la lógica de
subdominios está bien — `/panel` ya es passthrough para cualquier subdominio (no se reescribe a
storefront), así que el código no es el problema. El error viene de la capa de Vercel: o el
dominio comodín `*.orbita.site` no está agregado como Wildcard Domain en el proyecto (Settings →
Domains — requiere plan Pro de Vercel), o está agregado pero sin un deployment de producción
correctamente asociado.

Se intentó diagnosticar con las herramientas MCP de Vercel conectadas a esta sesión, pero la
cuenta conectada no incluye el proyecto de Órbita (aparecen otros proyectos del usuario —
`petty-joyas`, `gv-store`, `turnero-app`, etc. — pero no uno que corresponda a
`orbita-frontend`/`www.orbita.site`), así que no se pudo inspeccionar ni corregir la
configuración de dominio directamente. **Pendiente que el usuario:**
1. Confirme en qué proyecto/cuenta de Vercel está desplegado `orbita.site`.
2. Agregue `*.orbita.site` como Wildcard Domain en ese proyecto (Settings → Domains).
3. Verifique el registro DNS comodín (`*.orbita.site` → Vercel) en el proveedor de DNS.

El pedido de "por ahora que cualquier subdominio muestre el panel por default" ya está
resuelto por el middleware existente para el path `/panel` específicamente (no hace falta
cambiar código) — el bloqueo es puramente la resolución del dominio antes de llegar a Next.js.

### [2026-07-28] La cuenta ahora se crea recién cuando MP confirma el pago — revierte otra vez la decisión del 2026-07-20
**Estado:** RESUELTO (2026-07-28) — decisión explícita del usuario, construida en esta sesión
El criterio "crear el negocio ANTES del pago con `isActive:false`" (ver entrada del 2026-07-20
más abajo) generó en la práctica el problema que reportó el usuario: cada intento de pago que
fallaba, se cancelaba, o directamente no se completaba dejaba una cuenta real creada — email y
subdominio "ocupados" para cualquier reintento, hasta que alguien la borraba a mano (pasó 3
veces en la sesión del 27/28-07, con las cuentas `mateorojasarce2003@gmail.com`,
`raviolo05@gmail.com`, `bucicardi05@gmail.com`, eliminadas manualmente de producción).

**Nuevo flujo:** nada se crea en `Business`/`Member` hasta que MP confirma el pago (`authorized`).
Mientras tanto:
1. `POST /subscription/checkout` (ahora `@Public()`) recibe la cuenta + todo el wizard, valida
   que el email esté libre, crea el preapproval en MP y guarda el payload completo en una tabla
   nueva `PendingSignup` (`preapprovalId` único, `payload` JSON, TTL). Devuelve el `initPoint` de
   MP — no crea nada más.
2. `POST /subscription/confirm` (ahora `@Public()`, la llama tanto el webhook como
   `/onboarding/pago-retorno` vía el BFF `pages/api/onboarding/confirm-payment.ts`) —
   `SubscriptionsService.confirmAndCreate()`: busca el `PendingSignup`, le pregunta a MP el
   estado real, y solo si es `authorized` llama a `OnboardingService.registerBusiness()` +
   `updateDraft()` + `BusinessesService.updateConfig()`/`publish()` +
   `BranchesService.update()` (si aplica) + sube el logo si vino + emite sesión real con
   `AuthService.issueSession()` (access+refresh, no el token de un solo uso que usa el
   endpoint público de registro) + borra el `PendingSignup`.
3. Es **idempotente entre webhook y browser-return**: si el `PendingSignup` ya no existe
   (consumido por el otro caller), devuelve `{activated:false}` sin error. Si ambos llegan a
   crear la cuenta casi en simultáneo (ventana de milisegundos), `registerBusiness()` rechaza
   al segundo por email duplicado y `confirmAndCreate()` lo atrapa: busca el negocio ya creado
   por email y devuelve éxito igual — pero **sin sesión nueva** (no se re-emite `issueSession`
   en esa rama), así que ese caller puntual no deja la cookie de refresh seteada. Caso de borde
   de baja probabilidad (webhook y vuelta del navegador casi al mismo milisegundo), no
   verificado end-to-end — si se detecta en la práctica, la solución más simple es emitir sesión
   también en esa rama buscando el `Member` por email.
4. Reemplaza al viejo `sweepAbandonedBusinesses()` (ver entrada del 2026-07-27 más abajo,
   ahora sin efecto — no quedan drafts que barrer) un cron nuevo, `cleanupExpiredPendingSignups()`
   (`PENDING_SIGNUP_TTL_HOURS`, default 48h), que borra filas de `PendingSignup` — bajo riesgo,
   esa tabla no tiene relaciones ni cascada.

**Trade-offs aceptados, sin resolver:**
- **Contraseña en texto plano temporal:** `PendingSignup.payload` guarda la contraseña del
  wizard sin hashear (no se hashea antes porque `registerBusiness()` ya hashea internamente y
  no valía la pena tocar su firma). Ventana típica: minutos; TTL duro: 48h. Vive en la misma
  base que ya guarda `passwordHash` — mismo perímetro de confianza, no un endpoint nuevo
  expuesto.
- **Ventana de carrera del subdominio más ancha:** el usuario elige el subdominio en el wizard,
  pero recién se reserva (vía `updateDraft()`) cuando MP confirma — minutos u horas después, no
  segundos. Si alguien más lo toma en el medio, `confirmAndCreate()` atrapa el conflicto y
  sigue con el subdominio auto-generado por `registerBusiness()` (silencioso — el dueño no se
  entera en el momento). Aceptado: no se agregó un lock/reserva de subdominio, mismo criterio
  de no sobre-ingenierizar para una escala que no existe todavía.
- **`external_reference` del preapproval, sin verificar contra un cobro recurrente real:** se
  seteaba al crear el preapproval (con el `businessId`, que en el flujo viejo ya existía). Ahora
  el `businessId` no existe hasta la confirmación, así que `confirmAndCreate()` lo setea recién
  ahí con `preapproval.update({id, body:{external_reference}})` (no bloqueante si falla — solo
  loguea). **Pendiente de confirmar empíricamente** que MP propaga ese `external_reference`
  actualizado post-creación a los cobros recurrentes futuros (`recordPayment()` depende de esto
  para saber a qué negocio corresponde cada cobro) — se verifica con el cobro real de los 3 días
  que el usuario va a probar en producción.

### [2026-07-20] Se usa preapproval (Suscripciones de MP), no Checkout API/Orders
**Estado:** RESUELTO (2026-07-20) — decisión tomada acá, confirmar con el equipo
El usuario pidió inicialmente "Checkout API en vez de Checkout Pro" y pasó credenciales de una
aplicación de MP configurada como **"Checkout API vía Orders"**. Pero también pidió
explícitamente que la pantalla de pago sea la de MercadoPago ("nosotros no tocamos nada") y
que el cobro sea **recurrente** ($5.000 cada 3 meses; en pruebas $1 cada 3 días).

Esos tres requisitos juntos solo los cumple **preapproval** (producto "Suscripciones" de MP):
Orders/Checkout API son de pago único y obligarían a construir la recurrencia a mano
(guardar el token de tarjeta + cron de cobro), además de exigir capturar los datos de tarjeta.

**Riesgo verificado (2026-07-28):** el riesgo NO se dio — probado contra MP real
(`preapproval.create()` con las credenciales de producción), la app "Checkout API vía Orders"
crea preapprovals sin problema. No hace falta una aplicación separada con el producto
Suscripciones habilitado.

### [2026-07-28] MP rechaza preapproval con monto < $15 ARS — 500 genérico sin motivo visible
**Estado:** RESUELTO (2026-07-28)
Al probar el checkout de producción con `MP_SUBSCRIPTION_AMOUNT=1` (para el test de $1 cada 3
días), `POST /subscription/checkout` devolvía `500 {"error":"INTERNAL_ERROR"}` sin ningún
detalle — ni en la respuesta ni accesible sin ir a buscar los logs de Railway. Se reprodujo
localmente llamando a `preapproval.create()` directo contra la API de MP con el Access Token
real: **"Cannot pay an amount lower than $ 15.00"** — es un piso de MP para suscripciones, no
configurable.

Dos cosas resueltas:
1. **`startCheckout()` ahora atrapa el error del SDK de MP** y lo relanza como
   `BadRequestException` con el mensaje real de MP. Antes, cualquier rechazo de MP (monto,
   moneda, lo que sea) se perdía como 500 sin causa — ahora llega hasta la pantalla de pago.
2. **Para probar el cobro recurrente en $1 no alcanza** — el monto mínimo real es $15 ARS. Para
   la prueba de "cobra de nuevo a los 3 días", usar `MP_SUBSCRIPTION_AMOUNT=15` (o más) en vez
   de `1`.

**[2026-07-28] Sigue ABIERTO en Railway:** al desplegar el rediseño de PendingSignup (ver
entrada de arriba) y probar `POST /subscription/checkout` contra producción con un email
descartable, MP lo sigue rechazando con el mismo mensaje (`Cannot pay an amount lower than $
15.00`) — confirma que `MP_SUBSCRIPTION_AMOUNT` en Railway todavía está en `1`, no se actualizó
a `15`. Falta que el usuario lo cambie en las variables de entorno de Railway antes de probar
el cobro recurrente real de 3 días.

### [2026-07-20] El negocio ahora se crea ANTES del pago — revierte la decisión del 2026-07-17
**Estado:** REEMPLAZADO (2026-07-28) — ver "La cuenta ahora se crea recién cuando MP confirma
el pago" más arriba. Este criterio (crear con `isActive:false` antes de ir a MP) generó el
problema de cuentas/subdominios "ocupados" por intentos de pago fallidos — se volvió al
esquema de no persistir nada hasta la confirmación, esta vez con una tabla temporal
(`PendingSignup`) en vez de sessionStorage, para sobrevivir el cierre de la pestaña.
Se deja el detalle original abajo como historial.
**Estado original:** RESUELTO (2026-07-20) — decisión explícita del usuario
Hasta ahora la regla era "no se persiste nada hasta que el pago se apruebe" (ver
"Diferir creación de cuenta hasta pago aprobado" más abajo). Con el pago real eso se vuelve
inviable: MP se lleva al usuario a su propio dominio, y la contraseña elegida en el wizard
vive **solo en memoria** (`partialize` la excluye de localStorage a propósito), así que se
pierde en el salto y no se puede crear la cuenta cuando vuelve.

Se le plantearon al usuario tres opciones (guardar la clave en sessionStorage durante el
salto / abrir MP en otra pestaña / crear la cuenta antes y activarla al pagar) y **eligió la
tercera**. Flujo actual:
1. `plan.tsx` crea cuenta + negocio con `isActive: false` (no visible para nadie).
2. Pide el `init_point` a `POST /subscription/checkout` y redirige a MP.
3. MP vuelve a `/onboarding/pago-retorno`, que llama a `POST /subscription/confirm`.
4. El backend le pregunta a MP el estado real; si es `authorized`, crea la `Subscription` y
   recién ahí pone `isActive: true`.

**Barrido de abandonados:** RESUELTO (2026-07-27) — ver "Cron de limpieza" más abajo.

### [2026-07-27] Cron de limpieza de negocios draft abandonados
**Estado:** REEMPLAZADO (2026-07-28) — con el nuevo flujo (ver entrada del 2026-07-28 más
arriba) ya no se crean drafts antes del pago, así que este cron no tiene nada que barrer. Se
eliminó del código (`sweepAbandonedBusinesses()`/`deleteDraftBusiness()` ya no existen) junto
con `SUBSCRIPTION_SWEEP_DELETE`/`SUBSCRIPTION_ABANDONED_DAYS`, reemplazado por
`cleanupExpiredPendingSignups()` + `PENDING_SIGNUP_TTL_HOURS`. Se deja el detalle original
abajo como historial.
**Estado original:** RESUELTO (2026-07-27) — verificado local (dry-run), sin borrar todavía
`sweepAbandonedBusinesses()` (cron diario 4 AM) busca negocios `isActive: false`, sin
`Subscription`, más viejos que `SUBSCRIPTION_ABANDONED_DAYS` (default 7) y los borra en una
transacción que limpia los hijos en orden de FK (`Business` no cascadea — Member antes que
Role por el FK `roleId`; `RolePermission` cascadea desde Role; el resto referencia
`businessId`).

**Es una operación destructiva**, así que por defecto **solo loguea lo que borraría**
(dry-run). Borra de verdad únicamente con `SUBSCRIPTION_SWEEP_DELETE=true`. Además tiene una
salvaguarda: si un draft tiene pedidos/productos/clientes (`_count > 0`) lo saltea y avisa,
para no destruir datos reales por un borde inesperado. ABIERTO menor: el equipo debe decidir
cuándo activar el borrado real (recomendado recién con producción estable y el flujo de
onboarding+pago probado end-to-end).

### [2026-07-27] `SubscriptionPayment` + máquina de mora — implementados
**Estado:** RESUELTO (2026-07-27) — codeado y compilando; falta verificación con MP real
- **Historial de cobros:** `recordPayment()` maneja las notificaciones de tipo `payment` del
  webhook: consulta el pago en MP, crea la fila en `subscription_payments` (idempotente por
  `mpPaymentId`), y si fue aprobado renueva el período y saca al negocio de la mora. Ancla el
  pago al negocio por `external_reference` (= businessId, que MP propaga del preapproval a
  cada cobro recurrente).
- **Mora:** `reconcileOverdueSubscriptions()` (cron diario 3 AM) NO decide la mora solo por
  fecha: le re-pregunta a MP el estado real del preapproval (MP reintenta los cobros por su
  cuenta), así no suspende a nadie solo porque no llegó un webhook. Si MP ya no la considera
  `authorized`: dentro de la gracia (`gracePeriodDays`) → `PAST_DUE` (sigue publicado); gracia
  vencida → `SUSPENDED` + `business.isPaused = true` (mismo criterio que la suspensión manual
  del superadmin en `platform.service.ts`).

**PENDIENTE de verificación:** ninguno de los dos se probó contra cobros recurrentes reales de
MP (requiere infra pública para el webhook + una suscripción real corriendo). El mapeo de
campos del pago (`external_reference`, `status`, `date_approved`, `status_detail`) sigue la
doc de MP pero no se validó contra un payload real.

### [2026-07-27] El webhook ahora valida la firma de MercadoPago
**Estado:** RESUELTO (2026-07-27) — gateado por env, sin verificar con MP real
`handleWebhook()` valida la firma HMAC con `WebhookSignatureValidator` del SDK (reconstruye el
manifiesto con `x-signature` / `x-request-id` / `data.id`, no necesita el body crudo) cuando
`MP_WEBHOOK_SECRET` está seteado, con tolerancia de 300s anti-replay. Si la firma es inválida
responde 200 igual (no le da pistas a un atacante ni gatilla reintentos de MP). Si el secret
NO está configurado (dev), no valida — el endpoint sigue abierto pero el handler no confía en
el body. Falta setear el secret real del panel de MP y probar con una notificación firmada.

### [2026-07-20] (histórico) El webhook no validaba la firma de MercadoPago
**Estado:** RESUELTO (2026-07-27) — ver entrada de arriba
`POST /webhooks/mercadopago/preapproval` aceptaba cualquier request sin verificar que venga
realmente de MP. El riesgo estaba acotado porque el handler **no confía en el body**: solo saca
el id y va a consultarle el estado real a MP con nuestro Access Token. Aun así, permitía que un
tercero nos haga consultar ids arbitrarios. El SDK ya trae `WebhookSignatureValidator`;
falta configurar el secret del webhook en el panel de MP y engancharlo.

### [2026-07-20] Periodicidad: la documentación dice mensual, el producto es trimestral
**Estado:** RESUELTO (2026-07-20) — se tomó lo que dice la UI
`BACKEND_IMPLEMENTACION.md` (Fase 13.5) habla de "cada cobro mensual", pero la pantalla de
onboarding (`plan.tsx`) muestra **$5.000 cada 3 meses** desde hace tiempo. Se implementó
trimestral, que es lo que ve el usuario final. La periodicidad no está hardcodeada: sale de
`MP_SUBSCRIPTION_FREQUENCY` / `MP_SUBSCRIPTION_FREQUENCY_TYPE` para poder probar con ciclos
cortos. Alguien debería corregir `BACKEND_IMPLEMENTACION.md`.

### [2026-07-20] Atajo para entrar al panel sin pagar
**Estado:** RESUELTO (2026-07-20)
El link "Explorar el panel primero" de `plan.tsx` no creaba nada — dejaba al usuario en un
panel sin negocio. Se reemplazó por **"Omitir pago y entrar al panel"**, que crea la cuenta y
publica el negocio salteando el cobro. Solo se renderiza si
`NEXT_PUBLIC_ALLOW_SKIP_PAYMENT === 'true'`, así que en producción no queda expuesto.

## Onboarding — RBT-291/292 (registro de negocio + rubros)

### [2026-07-18] `registerBusiness()` bloquea el email de forma GLOBAL, no por negocio — inconsistente con el modelo de aislamiento de auth
**Estado:** RESUELTO (2026-07-18) — decisión de producto explícita para V1
Auditoría del flujo de onboarding tras la migración de auth (Supabase → argon2id/JWT propio,
ver "Fase 1 — Auth" más abajo) encontró que `registerBusiness()` (y su contraparte de
verificación en vivo, `checkEmail()`) chequean si el email ya existe con
`prisma.member.findFirst({ where: { email } })` **sin `businessId`** — es decir, contra
*todos* los negocios de la plataforma, no solo el que se está creando. Esto contradice el
modelo de aislamiento que el resto de auth sí respeta (`login()` sí está scopeado por
`businessId`; el schema soporta `@@unique([businessId, email])`, un unique *compuesto*, no
global sobre `email`).

En la práctica: si `lorena@x.com` ya es member (owner/staff) de un negocio, no puede
autoservirse un **segundo** negocio propio con ese mismo email vía onboarding — recibe `409`
aunque el schema y el resto del sistema permitirían perfectamente que tuviera credenciales
independientes en cada negocio (igual que ya puede ser member de un negocio y customer de
otro con contraseñas distintas).

**Decisión (usuario, 2026-07-18):** se mantiene el comportamiento actual para V1, como regla
de producto deliberada: **un email = un negocio** en el flujo de autoservicio de onboarding
(no una limitación técnica del modelo de datos). Cambios:
- Mensaje de error actualizado de `"Ese email ya tiene una cuenta"` (ambiguo — sugería que el
  problema era la cuenta, no el negocio) a `"Este email ya tiene un negocio registrado en
  Orbita"`, para que quede claro que la restricción es "un negocio por email", no un límite
  del sistema de credenciales.
- Documentado como excepción explícita al modelo de aislamiento multi-tenant en
  `CONTRATO_API.md` (módulo Auth → "Aislamiento multi-tenant"), para que no se lea como una
  inconsistencia sin explicar la próxima vez que alguien audite este flujo.
- Test de regresión que fija este comportamiento en
  `test/onboarding.e2e-spec.ts` ("HALLAZGO: el check de email duplicado es GLOBAL...").
**Si en el futuro se quiere permitir multi-negocio por email** (ej. una persona que administra
varias tiendas independientes), el cambio es sacar el `businessId`-less `findFirst` de
`registerBusiness()`/`checkEmail()` — el schema ya lo soporta sin migración.

### [2026-07-16] `POST /onboarding/register-business` compartía servicio con el seed script — no se hizo
**Estado:** RESUELTO (2026-07-16) — decisión distinta a la prevista en la entrada de Fase 2
La entrada de Fase 2 sobre `POST /businesses` proponía extraer un `BusinessOnboardingService`
compartido con `prisma/seed.ts` para no duplicar la transacción. Al implementar RBT-291 se
mantuvo la duplicación a propósito: `prisma/` está excluido de `tsconfig.build.json` (bug ya
documentado arriba), así que código de `src/` no puede importar desde `prisma/seed.ts` sin
romper el build. `OnboardingService` (`src/onboarding/onboarding.service.ts`) duplica
`PERMISSIONS`/`ROLE_PERMISSIONS` de `prisma/seed.ts` con un comentario explícito señalando la
duplicación. **Riesgo activo**: si el catálogo de permisos cambia, hay que actualizar los dos
archivos a mano — no hay chequeo automático de que sigan sincronizados.

### [2026-07-16] `registerBusiness()` no crea `Subscription`
**Estado:** DIFERIDO — hasta que exista el módulo de Subscriptions/MercadoPago (RBT-295 o
equivalente)
El modelo `Business.subscription` es opcional en el schema. Se decidió no fabricar una
`Subscription` fantasma en el registro (requeriría inventar un plan/estado sin criterio de
negocio real). El wizard de onboarding llega hasta `plan.tsx` (mockeado) sin depender de este
registro; la activación real de suscripción queda para cuando se implemente esa fase.

### [2026-07-16] `Business.industry` se crea vacío (`''`) en el registro
**Estado:** RESUELTO (2026-07-16) — decisión tomada por diseño del flujo, no por ambigüedad
`POST /onboarding/register-business` solo recibe `ownerName/email/password/businessName` (lo
que junta `registro.tsx`). El rubro se elige un paso después, ya autenticado, en
`onboarding/rubro.tsx` vía `PUT /onboarding/business`. Se decidió crear el negocio con
`industry: ''` en vez de `null` (el campo no es nullable en el schema) y confiar en que el
wizard complete ese valor antes de publicar. **No hay validación que bloquee `publish()` si
`industry` sigue vacío** — si el usuario abandona el wizard después de crear cuenta pero antes
de elegir rubro, y de algún modo llega a publicar, el negocio queda publicado sin rubro. Falta
decidir si `BusinessesService.publish()` debería exigir `industry` no vacío.

### [2026-07-16] `Branch` no persiste lat/lng — dirección es solo texto libre
**Estado:** ABIERTO
Confirmado en el schema: `Branch.address` es `String?`, sin columnas de latitud/longitud. El
wizard de onboarding (`SetupUnificado.tsx`) pide una dirección que probablemente el frontend
resuelve con un mapa/autocomplete en algún momento — si en el futuro se necesita geolocalización
real (cálculo de envíos, mapa en storefront, etc.), va a requerir una migración para agregar
esas columnas. No bloqueante para el alcance actual de RBT-291.

### [2026-07-16] Bug de infraestructura: `$transaction` de `registerBusiness()` excedía el timeout (P2028)
**Estado:** RESUELTO (2026-07-16)
La primera versión hacía, dentro de un mismo `$transaction`, 20 `permission.upsert()`
secuenciales (catálogo global) más un loop de 4 roles con `findMany` + `createMany` cada uno —
todo contra la Postgres remota de Supabase. Excedía el timeout default de Prisma (~5s), y
fallaba con `P2028 Transaction not found` recién al llegar a `businessConfig.create()`, sin
mensaje claro en la respuesta HTTP (el `HttpExceptionFilter` global no loguea excepciones no-HTTP).
Diagnosticado agregando un `console.error` temporal en el catch y reproduciendo con un script
Node aislado. Fix: el upsert de `PERMISSIONS` y el `findMany` de permisos por rol se movieron
**fuera** de la transacción (son datos globales/idempotentes, no necesitan atomicidad con la
creación del negocio); dentro del `$transaction` solo queda la creación de business/branch/
roles/rolePermissions/member/configs, con `{ timeout: 15000 }` explícito por las dudas.
Verificado: registro completo funciona de punta a punta contra la base real.

### [2026-07-16] Subdominio temporal con sufijo aleatorio — el "real" se elige después
**Estado:** RESUELTO (2026-07-16) — decisión tomada por diseño del flujo
`registerBusiness()` no puede pedirle un subdominio al usuario todavía (recién se está creando
la cuenta), pero `Business.subdomain` es `@unique` y no nullable. Se decidió generar uno
temporal vía `generateUniqueSubdomain()`: slug del `businessName`, con reintento (hasta 20
intentos) agregando un sufijo aleatorio de 4 caracteres si hay colisión. El usuario elige el
subdominio definitivo después, ya autenticado, vía `PUT /onboarding/business` (que devuelve
`409` si el elegido ya está en uso). Verificado: registro de 3 negocios con el mismo
`businessName` generó `barberia-don-fernando`, luego (tras liberar ese slug al cambiarlo) lo
reusó, y una tercera colisión forzada generó `don-fernando-kble`.

### [2026-07-16] `PUT /onboarding/business` como endpoint separado de `PUT /business`, gateado por `isActive`
**Estado:** RESUELTO (2026-07-16)
`PUT /business` (Fase 2) ya excluye deliberadamente `subdomain`/`mode` por ser "zona peligrosa"
para un negocio en producción (ver entrada de Fase 2). En vez de reabrir esos campos ahí, se
creó `PUT /onboarding/business` (mismo controller `OnboardingController`), que solo permite
escribir `name/industry/description/subdomain/mode` **mientras `business.isActive === false`**
— tira `422` si el negocio ya fue publicado (`POST /business/publish`). Verificado: edición
exitosa con `isActive: false`, y `422` inmediatamente después de publicar el mismo negocio.

### [2026-07-16] RBT-293 — Persistencia completa del wizard de onboarding
**Estado:** RESUELTO (2026-07-16) — backend verificado por curl de punta a punta; frontend
verificado por tipo (TypeScript) y por curl simulando cada request, pero **no se pudo verificar
interactivamente en navegador** (ver entrada de infraestructura más abajo).

Se agregaron los campos que faltaban para guardar cada paso del wizard (antes solo existían
`name/industry/description/subdomain/mode`):
- **Migración `20260716191823_onboarding_wizard_fields`**: `Business.subrubros String[]`,
  `Business.teamSize String?` (informativo: solo/mini/medio/grande, sin lógica de negocio que lo
  consuma todavía), `Business.operatesPhysical/operatesOnline Boolean`, `Branch.latitude/
  longitude Decimal(9,6)?`, `BusinessConfig.acceptsCard Boolean` (el "Tarjeta" del wizard —
  decisión: campo propio, distinto de `acceptsMercadopago`, porque el checkout de MP y una
  tarjeta física en POS son conceptualmente cosas distintas).
- `UpdateOnboardingBusinessDto` extendido con `subrubros/teamSize/operatesPhysical/
  operatesOnline`; `UpdateBranchDto` con `latitude/longitude`; `UpdateBusinessConfigDto` con
  `acceptsCard`. Los servicios de `branches`/`businessConfig` ya hacían `data: dto` genérico, así
  que no hicieron falta cambios ahí. `BusinessesService.getMe()` ahora devuelve los campos nuevos
  (necesario para que el frontend pueda "retomar" el wizard leyendo el estado actual).
- **Bug encontrado durante la verificación**: el paso "Métodos de pago" del wizard no pedía
  alias de transferencia, pero `BusinessesService.updateConfig()` (regla de Fase 2, no tocada)
  exige `transferAlias` no vacío si `acceptsTransfer: true` — el primer intento de guardar
  "Transferencia" sin alias tiraba `400`. Se agregó un campo condicional "Alias o CBU" en
  `StepPagos` (SetupUnificado.tsx) que aparece solo si el usuario tilda "Transferencia", y se
  bloquea el avance del paso hasta completarlo. Verificado con y sin el fix (400 → éxito).
- **Teléfono del wizard → `BusinessConfig.whatsapp`, no un campo nuevo**: decisión — el negocio
  en Órbita usa WhatsApp como canal de contacto principal (`StorefrontConfig.showWhatsapp`,
  modo `SHOWCASE` = "solo WhatsApp"), así que el "Teléfono" que pide `StepNegocio` se guarda como
  `whatsapp`, no se creó un campo `phone` redundante.
- **Logo del wizard (`StepNegocio`) — NO se persiste todavía**: sigue siendo un preview local
  (base64 vía `FileReader`, nunca sale del navegador). `StorefrontConfig.logoUrl` espera una URL,
  no un data-URI — guardar el logo de verdad necesita un endpoint de upload a Supabase Storage
  igual al que ya existe para `POST /products/:id/images` (bucket dedicado, límite de tamaño,
  tipos permitidos). Fuera de alcance de este pase — **DIFERIDO**.
- **Tamaño de equipo (`StepEquipo`) — se guarda como dato informativo, sin validación de negocio**:
  no hay ningún límite de asientos/roles atado a `teamSize` todavía. Si en el futuro se necesita
  (ej. planes con tope de usuarios), revisar acá.
- **Rehidratación para "retomar"**: `SetupUnificado` ahora llama `GET /business` + `GET /business/
  config` al montar y precarga el estado si ya existe una sesión de onboarding guardada
  (localStorage). No se creó ninguna tabla de "progreso de wizard" nueva — como el `Business`
  real ya se crea en el registro (RBT-291) y se completa progresivamente, "retomar" es simplemente
  leer lo que ya está guardado.
- **Limpieza de negocios sin pagar — DIFERIDO, no implementado**: el usuario pidió explícitamente
  contemplar que un negocio que nunca completa el pago no debería "ocupar espacio" indefinidamente
  en la base. No se construyó ningún mecanismo de limpieza automática en este pase porque: (a) no
  existe todavía una señal real de "pagó" — `plan.tsx` sigue simulando el cobro de MercadoPago con
  un `setTimeout`, sin integración real (el módulo de Subscriptions/pagos sigue sin construir, ver
  entradas de Fase 2); (b) sin esa señal, cualquier job de limpieza automática borraría negocios
  indistintamente, sin poder distinguir "recién registrado, todavía completando el wizard" de
  "abandonado hace 3 semanas". **Recomendación para cuando exista el módulo de pagos real**: un
  job programado (`@nestjs/schedule`, no instalado todavía) que borre `Business` con
  `isActive: false` y `createdAt` más viejo que N días (a definir por el equipo) Y sin pago
  confirmado — reutilizando el mismo helper de limpieza usado manualmente en esta sesión
  (`rolePermission` → `member` → `role` → `businessConfig`/`storefrontConfig`/
  `notificationConfig` → `branch` → `business`, en ese orden por las FK).

### [2026-07-16] Bug de infraestructura: `apps/web` nunca tuvo su propio `pnpm install`
**Estado:** RESUELTO (2026-07-16)
Al intentar levantar el frontend para probar el wizard de onboarding, `next dev` fallaba con
`Next.js inferred your workspace root... couldn't find the Next.js package from the project
directory`. Causa: `apps/web/node_modules` no existía — nunca se había corrido `pnpm install`
ahí — mientras que en la raíz del repo (`Orbita-Frontend/`) hay un `node_modules`/`.next`/
`next-env.d.ts` **huérfanos** (sin `package.json` que los acompañe), aparentemente restos de una
versión anterior del proyecto antes de moverse a la estructura `apps/api` + `apps/web`. Turbopack
se confundía intentando resolver `next` desde esos restos. Fix: `pnpm install` dentro de
`apps/web` (crea su propio `node_modules`, consistente con `apps/api`). **Pendiente para el
equipo**: confirmar si los restos en la raíz del repo (`node_modules/`, `.next/`, `next-env.d.ts`,
`tsconfig.tsbuildinfo`) se pueden borrar con seguridad — no se tocaron en esta sesión por las
dudas de que fueran necesarios para algo que no se investigó a fondo.

### [2026-07-17] RBT-293 corrección de flujo — la cuenta se crea AL FINAL del onboarding, no al principio
**Estado:** RESUELTO (2026-07-17) — corrige un error de diseño de la entrega anterior (2026-07-16)
El usuario marcó que la primera versión de RBT-293 estaba mal: el botón "Crear tu espacio" del
header ya apuntaba correctamente a `/onboarding/rubro` (no a `/registro`), pero `ElegirRubro.tsx`
tenía un guard (agregado por error en la entrega anterior) que redirigía a `/registro` si no
había sesión — forzando de hecho la creación de cuenta antes de ver el wizard. El flujo correcto
es: **"Crear tu espacio" → todo el onboarding sin pedir cuenta → recién al final se crea la
cuenta con todo lo ya cargado → después, pago (diferido)**.

Cambios:
- Se sacó el guard de `ElegirRubro.tsx` y el guardado progresivo por paso contra el backend en
  `SetupUnificado.tsx` (ya no hay token durante el wizard).
- Nuevo store `apps/web/src/modules/onboarding/useOnboardingStore.ts` (zustand + `persist` en
  localStorage) acumula todo el wizard (rubro, subrubros, negocio, ubicación, pagos, equipo)
  sin autenticación. Permite retomar el wizard si se recarga la página a mitad de camino, igual
  que antes, pero del lado del cliente en vez de contra la base.
- Nuevo último paso del wizard, **"Tu cuenta"** (`StepCuenta` en `SetupUnificado.tsx`): nombre,
  email, contraseña, términos. Al enviarlo, `apps/web/src/lib/api.ts#completeOnboarding()` llama
  `POST /onboarding/register-business` y ENCADENA de inmediato, con el token recién emitido, los
  mismos tres endpoints que ya existían (`PUT /onboarding/business`, `PUT /business/config`,
  `PUT /branches/:id`) con TODO lo acumulado durante el wizard. No se tocó el backend de
  `registerBusiness()` — se decidió reusar los endpoints ya probados en vez de extender el DTO
  de registro para aceptar el payload completo (menos riesgo, mismo resultado final).
- `pages/registro.tsx` y `pages/signup.tsx` (este último era un stub vacío, `return null`, al
  que apuntaban dos botones "Crear tu espacio" de la landing sin que nadie lo hubiera notado)
  ahora son simples redirects a `/onboarding/rubro`, por compatibilidad con links viejos.
  `pages/login.tsx` ("¿No tenés cuenta?") también se actualizó para apuntar ahí en vez de a
  `/registro`.
- **"Omitir por ahora"** se sacó de la barra de navegación: ya no tiene sentido saltear el
  último paso, porque ahí es donde se crea la cuenta — no hay a dónde "saltear".

### [2026-07-17] RBT-293 — catálogo de rubros/subrubros y validación de subdominio, 100% desde la BD
**Estado:** RESUELTO (2026-07-17)
El usuario pidió explícitamente que no quedara ningún dato mock en el onboarding. Se encontraron
dos casos:
- **`ElegirRubro.tsx`** tenía un array hardcodeado de 23 rubros en 7 categorías (con íconos,
  descripciones y flags `disponible`) que nunca llamaba a `GET /onboarding/rubros` — ese endpoint
  (RBT-292) solo devolvía "tienda", completamente desconectado del selector visual real.
  **Fix**: se extendió el catálogo del backend (`onboarding.service.ts` → `RUBROS`/`CATEGORIAS`)
  para que sea la única fuente de verdad de TODO lo que se muestra (los 23 rubros, con
  `disponible: false` para los 22 que siguen siendo roadmap). Como el backend no puede serializar
  íconos de React, cada rubro manda un string (`icon: "Scissors"`) que el frontend traduce a un
  componente real vía un mapa nuevo, `apps/web/src/modules/onboarding/iconMap.ts` — si se agrega
  un rubro con un ícono nuevo, hay que sumarlo ahí también.
- **`TiendaSetup.tsx`** (`StepTipo`) tenía su propio array hardcodeado de 18 subrubros, duplicado
  del que ya vivía en el backend para RBT-292. **Fix**: ahora pide `GET /onboarding/rubros` y usa
  los `subrubros` del rubro `tienda` que devuelve la API (con su propio `icon`/`tipo`/`descripcion`).
- **Validación de subdominio**: `StepNegocio` chequeaba contra un array hardcodeado
  (`SUBDOMINIOS_OCUPADOS`). Como ahora el wizard corre sin cuenta, no había forma de reusar los
  endpoints autenticados existentes para esto — se agregó `GET /onboarding/check-subdomain?
  subdomain=x` (`@Public()`, sin auth) que valida formato y unicidad contra la base real.

### [2026-07-18] RBT-293 — logo del negocio y verificación de email en tiempo real
**Estado:** RESUELTO (2026-07-18)
Dos huecos que el usuario detectó probando el wizard:

**1. El logo elegido en "Tu negocio" nunca se guardaba** — quedaba como preview local (base64)
que se perdía en cualquier reload, y ni siquiera se mandaba al backend al pagar. Se resolvió
igual que el resto de los datos del wizard: **se sube recién si el pago se aprueba**, no antes.
- Nuevo bucket de Supabase Storage `business-logos` (público, 5MB máx.,
  `image/png|jpeg|webp|gif` — mismos límites que `product-images`).
- Nuevo endpoint `POST /business/storefront-config/logo` (multipart, `@Roles('owner','admin')`,
  mismo patrón que `POST /products/:id/images`: sube el archivo, guarda la URL pública en
  `storefrontConfig.logoUrl`). Se puso en `BusinessesController` (no en `OnboardingController`)
  a propósito — es una operación reutilizable desde el panel de ajustes más adelante, no
  específica de onboarding.
- El wizard sigue guardando el logo como data-URI en el store de zustand mientras se completa
  el onboarding, pero **excluido de `localStorage`** (`partialize`, igual que la contraseña) —
  un data-URI en base64 puede pesar varios MB y no tiene sentido inflar localStorage con eso
  en cada campo que cambia. `plan.tsx` lo convierte a `Blob` y lo sube recién dentro del
  handler de "pagar", encadenado después de `completeOnboarding()` y antes de `publishBusiness()`.
- Al probar el endpoint por primera vez apareció un error intermitente de RLS que no se pudo
  reproducir de nuevo — ver entrada en "Infraestructura / Entorno de desarrollo" más arriba.

**2. No había aviso de email duplicado hasta después de "pagar"** — el subdominio ya se
validaba en vivo mientras se escribía (`GET /onboarding/check-subdomain`, RBT-293 original),
pero el email del dueño (paso "Tu cuenta") solo se validaba al final, vía el `409` que tira
`registerBusiness()` si el email ya tiene cuenta en Supabase Auth — el usuario se enteraba
recién después de completar todo el flujo de pago.
- Nuevo endpoint `GET /onboarding/check-email?email=x` (`@Public()`), mismo patrón visual que
  el subdominio (chequeo mientras escribe, con debounce, ✓/✗ inline).
- **Decisión técnica**: `auth.users` es de Supabase Auth, no está modelada en Prisma. Se
  decidió consultarla con `$queryRaw` (`SELECT EXISTS(... FROM auth.users WHERE lower(email) =
  ...)`) sobre la misma conexión de Postgres que ya usa la app, en vez de iterar
  `admin.listUsers()` (la API de administración de Supabase Auth no expone un filtro por email
  directo). Verificado que la conexión (`DATABASE_URL`) tiene permiso de lectura sobre el
  schema `auth`.
- **Nota de seguridad** (no bloqueante, dejar constancia): esto es enumeración de usuarios por
  diseño — cualquiera puede consultar si un email ya tiene cuenta. Es el mismo patrón que ya
  usan la gran mayoría de formularios de registro (incluido el propio `registerBusiness()`, que
  ya revela lo mismo con el `409 "Ese email ya tiene una cuenta"`), así que no es una superficie
  nueva de riesgo — solo se adelantó el momento en que se informa.
- El check de email, igual que el de subdominio, **no bloquea el avance del paso** si da
  "ocupado" — es feedback visual, no una validación dura. El bloqueo real sigue siendo el `409`
  de `registerBusiness()` al momento de pagar.

### [2026-07-18] RBT-293 corrección #2 — la cuenta se crea recién cuando el pago se aprueba, no en el paso "Tu cuenta"
**Estado:** RESUELTO (2026-07-18) — corrige la entrega anterior del mismo día
El usuario aclaró el criterio real de la Fase 1: **retener todos los datos del onboarding
(incluidas las credenciales del dueño) hasta que el pago con MercadoPago se apruebe — recién
ahí se escribe a la base**. La entrega anterior creaba la cuenta un paso antes de tiempo (en
"Tu cuenta", justo antes de la pantalla de pago) — con eso, un usuario que abandona en la
pantalla de pago ya había creado una cuenta real en Supabase Auth + un `Business` en la base,
exactamente el escenario que se quería evitar.

Cambios:
- El paso "Tu cuenta" (`StepCuenta` en `SetupUnificado.tsx`) ya NO llama al backend — solo
  guarda `ownerName/ownerEmail/ownerPassword` en el wizard store y navega a `plan.tsx`.
- `pages/onboarding/plan.tsx` es ahora el único lugar que llama `completeOnboarding()` (crea
  la cuenta + guarda todo el wizard) seguido de `publishBusiness()` — y solo lo hace dentro del
  handler de "pagar", en paralelo con la demora cosmética del mock de MercadoPago. Si el pago
  nunca se confirma, no se llamó nada de esto — cero filas en la base.
- **Contraseña excluida de `localStorage`**: como el wizard entero (incluida la contraseña)
  ahora vive en el cliente por más tiempo — desde que se completa "Tu cuenta" hasta que se
  aprueba el pago, potencialmente varios minutos — se agregó `partialize` al store de zustand
  (`useOnboardingStore.ts`) para que la contraseña NUNCA se escriba a `localStorage` (queda
  solo en memoria de React). Si el usuario recarga la página entre "Tu cuenta" y "pagar", pierde
  la contraseña cargada y tiene que reescribirla — trade-off aceptado a favor de no dejar una
  contraseña en texto plano en el navegador.
- Con este cambio, la entrada de arriba ("Limpieza de negocios sin pagar — DIFERIDO") queda
  resuelta de raíz por diseño: no hace falta ningún job de limpieza porque nunca se crea el
  registro si no hay pago aprobado. Se puede marcar esa entrada como no aplicable una vez que
  el pago real de MercadoPago esté integrado (hoy sigue mockeado con `setTimeout`).

### [2026-07-17] `RegisterBusinessDto` no acepta el payload completo del wizard — decisión de no extenderlo
**Estado:** DIFERIDO — revisar si conviene atomizar en el futuro
`completeOnboarding()` (frontend) hace 1 POST + hasta 3 PUT en paralelo, todos contra endpoints
ya existentes y probados. Esto significa que si el POST de registro tiene éxito pero alguno de
los PUT posteriores falla (ej. corte de red a mitad de camino), el usuario queda con una cuenta
y un negocio creados pero con datos parcialmente guardados — no es atómico. Mitigación actual:
el negocio real ya existe (`isActive: false`), así que el usuario puede reintentar desde el
panel sin perder lo que sí se guardó. Alternativa más robusta (no implementada): extender
`RegisterBusinessDto`/`OnboardingService.registerBusiness()` para aceptar todo el payload y
hacerlo atómico dentro de la misma transacción de Prisma — se evitó en este pase para no volver
a tocar código de `registerBusiness()` ya extensivamente probado (incluye el fix del bug P2028
de timeout documentado arriba) bajo presión de tiempo. Revisar si vale la pena antes de producción.

### [2026-07-16] Bug de infraestructura: el navegador de prueba (Browser pane) no hidrata NINGUNA página del frontend
**Estado:** ABIERTO — bloqueó la verificación interactiva de RBT-293
Al intentar probar el wizard completo en el navegador integrado de esta sesión, ninguna página
—ni siquiera la landing (`/`), sin tocar en esta tarea— hidrata: los elementos del DOM no tienen
`__reactFiber$`/`__reactProps$`, por lo que ningún handler de React (`onClick`, `onChange`,
`onSubmit`) se dispara y los formularios caen al comportamiento nativo del navegador (`GET` con
query string vacía). La consola muestra un error recurrente de Next.js en modo dev:
`TypeError: Cannot read properties of undefined (reading 'components')` dentro de
`handleStaticIndicator`, disparado por un mensaje HMR (`isrManifest`) que el cliente no sabe
interpretar — plausiblemente esto aborta la hidratación antes de que corra. No se pudo confirmar
si esto es específico del navegador integrado de esta sesión (posible interferencia con el
websocket de HMR) o un bug real de esta versión de Next/Turbopack (`next@16.2.6` — un número de
versión inusualmente alto, posiblemente una build de este entorno). **Recomendación**: probar
`pnpm run dev` de `apps/web` en un Chrome real antes de asumir que el código está roto. Todo lo
construido en RBT-293 del lado del frontend se verificó por: TypeScript (`tsc --noEmit` limpio) +
simulación manual de cada request que dispara el código (vía `curl`, reproduciendo exactamente los
payloads que arma `apps/web/src/lib/api.ts`) — pero no por click real en la UI.

---

## RBT-290 — Auditoría de aislamiento multi-tenant

### [2026-07-20] `PlatformAdminGuard` es un stub que siempre devuelve `true` — sin endpoints que lo usen todavía
**Estado:** ABIERTO — TODO explícito dejado en el código
Confirmado por grep (`PlatformAdminGuard` solo aparece en su propia definición): ningún
endpoint de `platform.controller.ts` lo usa hoy — todos son stubs sin `@UseGuards`. No hay
bypass activo. Se dejó un comentario `TODO(RBT-290)` en
`common/guards/platform-admin.guard.ts` marcando que la implementación real (verificar
`platform_admin` activo en la DB) es un requisito **bloqueante** antes de que cualquier
endpoint le agregue `@UseGuards(PlatformAdminGuard)`.

### [2026-07-20] 15 casos de TOCTOU: `update`/`delete` por `id` sin `businessId` en el where — corregidos
**Estado:** RESUELTO (2026-07-20)
Auditoría de todos los `*.service.ts` encontró 15 mutaciones que validaban `businessId` con un
`findFirst` previo pero después mutaban con `update({where:{id}})` / `delete({where:{id}})`,
sin `businessId` en el where de la mutación en sí — el aislamiento dependía del orden del
código alrededor, no de la query. Corregido en `branches.service.ts`, `tags.service.ts`,
`categories.service.ts`, `inventory.service.ts` (suppliers), `members.service.ts`,
`products.service.ts` (update en tx, soft-delete, `productImage.delete`) y `roles.service.ts`,
usando `updateMany`/`deleteMany({where:{id, businessId}})` + chequeo de `count === 0` → 404.
También se agregó `businessId` a dos `count()` que lo tenían suelto (`categories.service.ts`,
finding productCount/childrenCount de `remove()`).

Caso especial — `roles.service.ts` `update()`: el reemplazo de `rolePermissions` es un nested
write de Prisma, que solo acepta `where` por clave única (no admite `updateMany` con relaciones
anidadas). Se resolvió en dos pasos dentro de la misma `$transaction`: primero un
`updateMany({where:{id,businessId}})` de los campos escalares (que sí garantiza el
aislamiento), y recién después el `update({where:{id}})` anidado para `rolePermissions` —
seguro porque corre en la misma transacción inmediatamente después de confirmar la
pertenencia, y `businessId` de un `Role` nunca se reasigna (ningún endpoint lo modifica).

Caso especial — `products.service.ts` `removeImage()`: `ProductImage` no tiene columna
`businessId` propia (solo `productId`, sin relación directa al tenant en el schema). El
`deleteMany` quedó scopeado por `{id: imageId, productId}` — `productId` ya había sido
validado contra `businessId` por el `findOneRaw()` al inicio del mismo método.

Verificado: `npx tsc --noEmit` limpio y `nest build` sin errores después de cada cambio; suite
e2e completa corrida al final (ver entrada siguiente).

### [2026-07-20] `AuthGuard` no validaba `businessId` del JWT contra la DB — defensa en profundidad agregada
**Estado:** RESUELTO (2026-07-20)
El guard ya usaba el `businessId` de la fila de `member`/`customer` en DB como fuente de
verdad (correcto), pero el lookup por `id` ignoraba el campo `businessId` que también viaja en
el payload del JWT. Se cambió `findUnique({where:{id}})` a `findFirst({where:{id, businessId:
payload.businessId}})` en ambas ramas (member y customer) de `auth.guard.ts` — si algún día se
lograra fabricar un JWT con un `sub` válido pero un `businessId` que no coincide (ej. clave
comprometida), la búsqueda falla directo en vez de devolver el registro real ignorando el
campo. Los 4 `findUnique`/`findFirst` por `id` restantes en `auth.service.ts#getMe()`
(`memberId`/`customerId`) se dejaron como están — confirmado por código que `getMe()` solo se
alcanza vía `GET /auth/me`, sin `@Public()`, siempre después de que `AuthGuard` ya validó
JWT + businessId y pobló `ctx`; se documentó con un comentario en el propio método.

### [2026-07-20] `forgot-password` sin rate limit específico — agregado
**Estado:** RESUELTO (2026-07-20) — limitación documentada
Se agregó `@Throttle({default:{limit:5, ttl:900000}})` (5 intentos / 15 min) a `POST
/auth/forgot-password`, mismo patrón que `login()` (única otra ruta con throttling específico
en el proyecto). **Limitación**: el `ThrottlerGuard` global de este proyecto no tiene un
tracker combinado IP+email — el throttling es por IP únicamente (igual que login). Si en el
futuro se quiere limitar por IP+email (más resistente a un atacante distribuido probando un
solo email desde muchas IPs), hay que implementar un tracker custom extendiendo
`ThrottlerGuard` con un `getTracker()` propio — no existe ese patrón en el proyecto todavía.

### [2026-07-20] Gap de producto: `forgot-password` no tenía modo "sin slug" para dueños — agregado
**Estado:** RESUELTO (2026-07-20)
`forgotPassword()` exigía `X-Business-Slug` siempre (`400` si faltaba) — a diferencia de
`login()`, que sí soporta buscar member globalmente sin slug (flujo panel/apex,
`orbita.com/login`). Un dueño que olvida su contraseña Y no recuerda el subdominio de su
tienda no tenía forma de recuperarla desde `orbita.com`. Se igualó el criterio a `login()`:
sin slug, busca `member` globalmente (nunca `customer` sin slug — un customer siempre
pertenece a un negocio específico, no existe "cuenta de plataforma" para clientes del
storefront). Reusa el mismo mecanismo de token (`passwordResetToken`, ahora extraído a
`issuePasswordResetToken()`); `resetPassword()` no necesitó cambios porque ya resuelve
`businessId` desde el token almacenado, sin importar cuál rama lo creó. Test
`auth.e2e-spec.ts` ("sin header X-Business-Slug → 400") actualizado: ahora afirma `201` (busca
globalmente) en vez de `400`, más un caso nuevo para email inexistente sin slug (sigue sin
filtrar información).

### [2026-07-20] Test e2e preexistente falla por datos de seed no idempotentes — no relacionado a esta sesión
**Estado:** ABIERTO — detectado corriendo la suite completa para verificar los cambios de arriba
`auth.e2e-spec.ts` → "registro con email de customerWithoutAccount vincula al existente (no
duplica)" espera `201` pero recibe `400 "Ya tenés cuenta en esta tienda"`. Causa: el test
registra una contraseña para el fixture `customerWithoutAccount` (que el seed crea sin
`passwordHash`), pero no es idempotente — si el seed no se vuelve a correr entre ejecuciones
del suite, la segunda corrida encuentra el fixture ya con `passwordHash` seteado por la corrida
anterior y `register()` responde `400` (comportamiento correcto: ya no está "sin cuenta"). No
se tocó `register()` en esta sesión — confirmado por diff, el método no cambió. Requiere correr
`pnpm seed` antes de `test:e2e`, o hacer el test idempotente (reset del fixture al final).

---

## RBT-287 — Google OAuth

### [2026-07-20] Librería y decisiones de diseño confirmadas antes de implementar
**Estado:** RESUELTO (2026-07-20)
`google-auth-library@10.9.0` instalada tras chequeo de versión y conflictos (Node >=18 —
cumplido con Node v22.14.0; ninguna de sus dependencias transitivas — `gaxios`, `jws`,
`gcp-metadata`, etc. — colisionaba con algo ya presente en el proyecto). No se usó
`@nestjs/passport`/`passport-google-oauth20` — el proyecto no tiene Passport en ningún lado
(guard custom + JWT propio), agregarlo hubiera metido un segundo paradigma de auth conviviendo
con el existente.

Campo `googleId` agregado como columna (no tabla nueva) en `Member` y `Customer`, con
`@@unique([businessId, googleId])` — mismo criterio que `email`. Migración
`20260720010000_add_google_id` — solo `ADD COLUMN` + `CREATE INDEX`, no destructiva, aplicada
sin requerir confirmación previa (a diferencia del `DROP COLUMN` de `authUserId` en RBT-290).

### [2026-07-20] Decisión: vincular password a cuenta creada por Google, no rechazar el registro
**Estado:** RESUELTO (2026-07-20)
El punto pedía elegir entre (a) rechazar el registro con password si el email ya tiene cuenta
vía Google, o (b) permitir agregarle un password a esa cuenta existente — la que fuera más
simple de implementar. Se eligió **(b)**, y no requirió ningún cambio de código: `register()`
(`auth.service.ts`) ya buscaba `existingCustomer` por `businessId+email` y solo rechazaba si
`existingCustomer.passwordHash` estaba seteado — un customer creado vía Google no tiene
`passwordHash` (igual que un customer "cargado desde POS sin cuenta"), así que cae
naturalmente en la rama que le agrega el password a la fila existente. La vinculación en la
dirección opuesta (Google sobre una cuenta que ya tenía password) sí se implementó
explícitamente en `googleLoginStorefront()`/`googleLoginApex()` — solo setea `googleId` si la
fila no tenía uno ya vinculado (no pisa un vínculo existente).

### [2026-07-20] Exchange code de Google OAuth vive en memoria — asume deployment single-instance
**Estado:** ABIERTO — deuda técnica aceptada conscientemente
El handoff entre `/auth/google/callback` (redirect del browser) y el BFF del frontend
(`POST /auth/google/exchange`) usa un código de un solo uso, vida de 60s, guardado en un
`Map` en memoria (`GoogleOAuthExchangeStore`). Si el proceso de la API reinicia dentro de esa
ventana, el login falla (el usuario reintenta, sin pérdida de datos ni token expuesto) — pero
en un deployment con más de una instancia/réplica, un `code` generado por la instancia A no lo
encontraría la instancia B si el request de exchange cae ahí. Aceptable en la etapa actual del
proyecto (mismo supuesto single-instance que ya tiene el resto del proyecto). Si en algún
momento se escala horizontalmente, este store necesita moverse a algo compartido (Redis, o una
tabla con TTL corto igual que `password_reset_tokens`).

### [2026-07-20] Credenciales de Google OAuth son placeholders — no funciona contra Google real
**Estado:** ABIERTO — requiere que alguien cree el OAuth Client ID real
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` en `.env` son valores de
relleno (documentado en el propio `.env` y `.env.example`). El flujo completo se verificó
manualmente hasta el límite de lo posible sin credenciales reales: `GET /auth/google/start`
arma correctamente la URL de autorización (state firmado incluido) y redirige a
`accounts.google.com`, que responde `invalid_client` — el rechazo esperado de Google por un
`client_id` inexistente, no un error del backend. Falta: crear un OAuth Client ID tipo "Web
application" en Google Cloud Console (APIs & Services → Credentials), con el Authorized
redirect URI configurado ahí IDÉNTICO a `GOOGLE_REDIRECT_URI`, y reemplazar los tres valores en
`.env` (dev) y en las variables de entorno de producción.

### [2026-07-20] `state` de OAuth firmado con el mismo secret que los JWT (`JWT_SECRET`)
**Estado:** RESUELTO (2026-07-20) — decisión de diseño, no pendiente de acción
Se reutilizó `JWT_SECRET` para el HMAC del `state` (en vez de sumar una env var nueva
`GOOGLE_STATE_SECRET`) — ya es un secreto de alta entropía gestionado vía `ConfigService`, y el
`state` no es un JWT (no pasa por `jsonwebtoken`, es HMAC-SHA256 propio sobre
`base64url(JSON)`), así que no hay riesgo de confusión de formato entre ambos usos. Exp corto
(10 minutos) — tiempo de sobra para completar el consent de Google sin dejar una ventana larga
de replay.

### [2026-07-20] Fixtures del seed no reseteaban `googleId` entre corridas — corregido
**Estado:** RESUELTO (2026-07-20)
Al escribir los tests de Google OAuth, el test "vincula a customer existente con password" (test
2) falló en la segunda corrida de la suite completa: `cliente@zapatoslorena.test` ya tenía un
`googleId` vinculado de la corrida anterior, y la lógica de vinculación (correctamente) no pisa
un vínculo existente — así que el test esperaba el `googleId` nuevo de esa corrida y encontraba
el viejo. No era un bug de la lógica de negocio, sino que `prisma/seed.ts` no reseteaba
`googleId: null` en sus `upsert` (mismo patrón que ya aplicaba a `passwordHash` en los fixtures
"sin cuenta"). Agregado a los 5 upserts de member/customer con auth (`dueno`, `cajero`,
`cliente`, `sinregistrar`, `sinregistrar2`) para mantener el seed idempotente.

### [2026-07-20] Tests de Google OAuth cubiertos — 9/9, más los 8 de aislamiento sin regresión
**Estado:** RESUELTO (2026-07-20)
`test/google-auth.e2e-spec.ts` — mockea únicamente `OAuth2Client.getToken`/`.verifyIdToken` (las
dos llamadas de red reales de `google-auth-library`); todo lo demás (firma/verificación de
`state`, resolución de negocio, vinculación/creación, emisión de sesión, exchange store) corre
con el código real. Cubre los 7 casos pedidos (cuenta nueva en A, vincula password existente en
A, aislamiento con mismo `googleId` en B, `state` falsificado, `state` vencido, `id_token` con
`email_verified: false`, JWT nunca en la URL de redirect) más 2 extra (single-use del exchange
code, y split del caso 4 en falsificado/vencido). Suite completa corrida con `--runInBand`:
6/6 suites, 69/70 tests (1 `.todo` preexistente, no relacionado). Los 8 escenarios de
aislamiento multi-tenant originales confirmados por nombre, sin regresión.

---

## 2026-07-24 — Pedidos: modelo y estados (Fase 2, tarjeta 1 — Alex)

Primera tarjeta de Pedidos implementada: `GET /orders/:id`, alta básica (`POST /orders`) y el
motor de estados (`PATCH /orders/:id/status`) con historial en `order_status_history`.
Decisiones tomadas (validadas con el contrato de la API):

- **Transiciones**: online `PENDING → CONFIRMED → PREPARING → SHIPPED → DELIVERED`; se puede
  cancelar solo hasta `PREPARING` inclusive (un pedido enviado no se cancela: eso será una
  devolución, Fase 4). POS nace `COMPLETED` y no transiciona (contrato). Salto inválido → 422
  con mensaje que dice a qué estados sí se puede pasar.
- **Alta básica adelantada** (decisión mía, para poder probar ya): el alta
  manual crea pedidos `ONLINE`/`PENDING` con precios congelados desde la variante y numeración
  correlativa por negocio (reintento ante choque de número). Se rechazan con mensaje claro:
  canal POS, ítems libres (`isConcept`), `editedPrice`, cupones y pagos — cada uno llega con su
  módulo (caja F3, descuentos F3, checkout F4). El descuento de stock al confirmar y la
  validación de stock disponible llegan con la tarjeta "Crear pedido manual".
- **Mails al entregar**: `DELIVERED` dispara `sendOrderDelivered` + `sendReviewRequest` al email
  del comprador (snapshot) o del cliente; nunca rompen la transición (try/catch + log). La
  `reviewUrl` apunta por ahora a la página del pedido en el storefront — revisar cuando exista
  la pantalla de reseñas.
- **Historial sin "quién"**: la tabla `order_status_history` no guarda qué miembro hizo el
  cambio (solo estado + fecha). La tarjeta pedía "quién" — agregar la columna requiere migración
  de schema (no es de esta tarjeta). Anotado para decidir en equipo.
- **Permisos**: `orders.view` para leer, `orders.manage` para crear/cambiar estado (reemplaza el
  `@Roles('owner','admin')` provisorio del esqueleto, según contrato).


---

## 2026-07-24 — Pedidos: lista con filtros (Fase 2, tarjeta 2 — Alex)

`GET /orders` implementado según contrato: paginado (20 por página), filtros por estado, canal,
sucursal, rango de fechas y búsqueda (nombre/email del cliente, comprador manual, o número de
pedido si el texto es numérico). Además del `Paginated<OrderSummary>` del contrato, la respuesta
suma dos campos aditivos que la pantalla necesita: `counts` (pedidos por estado, para los
contadores de las pestañas, calculado con los mismos filtros menos el estado) e `items` resumidos
por fila (la columna "Productos" de la tabla los muestra).

Integración visual (PedidoLista + PedidoDetalle conectados de verdad):
- La lista usa datos reales: pestañas con contadores del backend, filtro de fecha (hoy/7/30 días),
  canal, búsqueda con espera de 350ms, paginación real y estados de carga/vacío/error/sin sesión.
- El detalle carga el pedido real: línea de tiempo desde `order_status_history` (con fecha y hora),
  cambio de estado contra la API mostrando el motivo del backend si rechaza (422), datos del
  comprador, envío (WhatsApp si hay teléfono) y notas. Los botones ofrecen SOLO transiciones
  válidas (mismas reglas que el backend).
- `COMPLETED` (venta POS) se muestra como "entregado" en la UI de lista (no existe todavía como
  estado visual propio; revisar cuando llegue el POS).
- Siguen con datos de muestra (sus tarjetas llegan después): ModalComprobante, ModalEmail,
  Exportar, acciones masivas, historial, cola, devoluciones y notas de crédito.

Gotcha de desarrollo anotado: en Windows, `nest start --watch` a veces NO detecta cambios en los
archivos (se pierden eventos del sistema de archivos) y sigue sirviendo el código viejo — si un
endpoint responde "not implemented" después de un cambio, reiniciar `pnpm dev` a mano. El dev de
Next no tiene este problema: recompila al recargar la página.


---

## 2026-07-24 — Clientes: modelo y lista con métricas (Fase 2, tarjeta 3 — Alex)

`customers` implementado según contrato (6.1): `GET /customers` (búsqueda por nombre/email,
paginado, y los calculados por cliente: `orderCount`, `totalSpent`, `avgTicket`, `lastOrderAt` —
en una sola consulta agrupada por tanda, on-read, sin persistir), `GET /customers/:id` (detalle +
últimos 20 pedidos + direcciones), `POST` y `PUT`. Permisos del contrato: `customers.view` /
`customers.manage` (reemplazan el `@Roles` provisorio del esqueleto).

Decisiones:
- **Los pedidos CANCELADOS no cuentan** en las métricas (ni en cantidad ni en gastado). Los
  pendientes sí (es una compra en curso). Verificado en vivo.
- **Anti-duplicados del contrato**: crear con un email ya existente en el negocio (sin importar
  mayúsculas) actualiza y devuelve el cliente existente. En PUT, chocar con el email de OTRO
  cliente da 409.
- `DELETE /customers/:id` NO se implementó: el contrato no lo define y el controller no tenía la
  ruta (el plan 6.1 lo mencionaba — decidir en equipo si hace falta).
- `POST /customers/email` sigue stub: es la tarjeta "Exportar y email masivo".

Integración visual: ClienteLista con datos reales (total, búsqueda con espera, paginación,
métricas por fila, "Sin compras" para los que nunca compraron, estados de carga/vacío/error/sin
sesión). La flechita de cada fila carga sus últimos pedidos REALES recién al abrirla (y quedan en
memoria). `relTime` ahora usa la fecha real de hoy (estaba clavada en una fecha de muestra). El
"segmento" no existe en backend (contrato): la pantalla lo deriva de los números solo para el
tipado; la lista no lo muestra. ClienteDetalle (perfil completo) sigue mock — tarjeta de Fase 3.

Nota de higiene de la base compartida: los e2e de auth dejaron ~40 clientes basura
(TestE2E/google-*/@example.com) — se ve en la lista real. Me armé un SQL de limpieza aparte
(sin commitear, se borra después de usarlo).


---

## 2026-07-24 — Pedidos: crear pedido manual (Fase 2, tarjeta 4 — Alex)

Se completó el alta de pedidos que había dejado básica en la tarjeta 1, y la pantalla "Nuevo
pedido" del panel ya crea pedidos de verdad (3 pasos: cliente real o comprador sin registrar →
productos del catálogo real con variantes y cantidades → revisión con envío y notas).

Reglas de stock que quedaron andando (verificadas de punta a punta):
- **Al crear**: si el producto controla stock en la sucursal, no se puede pedir más de lo que hay
  (422 con el detalle: "hay X, pediste Y"). Si la variante NO tiene stock cargado en esa sucursal,
  se interpreta como "no controla stock" y pasa. OJO: el flag explícito "vender sin stock" que
  menciona la tarjeta necesita un campo en la base que hoy no existe — para decidir en equipo
  (migración compartida).
- **Al confirmar**: se re-chequea el stock adentro de la transacción (pudo cambiar desde que se
  creó el pedido) y recién ahí se descuenta: `variant_stock` baja y queda el movimiento SALIDA
  "Venta #N" en inventario, con el miembro que lo hizo. Probado el caso carrera: dos pedidos que
  entraban con el stock inicial, el segundo no se pudo confirmar cuando el primero se llevó las
  unidades.
- **Al cancelar un pedido ya confirmado o en preparación**: el stock VUELVE solo (ENTRADA
  "Cancelación #N"). Cancelar un pendiente no toca stock porque nunca lo descontó. Esta regla no
  estaba escrita en ninguna tarjeta pero sin ella el stock se perdía para siempre al cancelar.
- Los ítems libres (isConcept) no tocan stock, igual que en la especificación del POS.

En la pantalla: el error de stock del backend se muestra tal cual en el paso de revisión, la
miniatura de producto necesitó una caja de altura fija (el 100% se estiraba y tapaba el texto),
y el cobro NO se registra en el alta (el pedido nace pendiente; el pago llega con la caja o el
pago online, cada uno en su fase).


---

## 2026-07-24 — Pedidos: comprobante y acciones masivas (Fase 2, tarjetas 5 y 6 — Alex)

**Comprobante**: `POST /orders/:id/receipt` implementado según contrato — devuelve la URL del
comprobante (la misma página que verá el cliente en la tienda, Fase 4) y, si le paso `email`,
manda el detalle de la compra con la plantilla `order-confirmation` que ya existía. El modal del
panel ahora carga el pedido real y desde ahí: vista completa reutilizando `ComprobanteBase` (el
componente compartido con el storefront — cero duplicación de diseño), impresión con el diálogo
del navegador (que también sirve para "Guardar como PDF" — decisión: NO metí ninguna librería de
PDF porque package.json es de todos y el navegador resuelve igual; si el equipo quiere PDF
server-side, se charla), y envío por email al cliente con un click. Truco de impresión: cuando la
vista está abierta, un estilo esconde todo lo demás para que salga solo el comprobante.

**Acciones masivas**: la barra de selección de la lista ya funciona.
- Confirmar en lote: va pedido por pedido usando el endpoint de estado (así cada uno valida SU
  stock y SU transición como corresponde) y reporta el resultado: "2 confirmados · no se pudo con
  #4". Decisión: sin endpoint bulk en el backend — la validación por pedido es justamente lo que
  queremos, y un bulk que salta validaciones sería peligroso.
- Etiquetas en lote: hoja imprimible con una etiqueta por pedido (remitente, destinatario,
  teléfono, email, bultos). Sin backend: usa los datos del pedido.
- Email masivo: el botón avisa que llega con el servicio de email (Fase 3). **Contrato que
  propongo para cuando exista**: `POST /orders/bulk-email` con `{ orderIds: string[], subject:
  string, body: string }` → `{ sent: number }`, mandando con `sendCustomEmail` a cada email único
  de comprador (los pedidos sin email se saltean y se informan). A discutir si conviene reusar
  `POST /customers/email` (ya tiene DTO con customerIds) — pero los pedidos de compradores sin
  registrar quedarían afuera; por eso propongo por pedido.


---

## 2026-07-24 — Exportaciones y email masivo (Fase 2, tarjetas 7 y 8 — Alex)

**Exportar pedidos y clientes**: los dos botones "Exportar" ya bajan un archivo real con TODO lo
que cumple los filtros del momento (no solo la página visible: se recorren todas las páginas).
Decisión de formato: **CSV que Excel abre con doble click** (con la marca de codificación para
las tildes y separado con punto y coma, que es lo que espera el Excel de acá) — NO sumé ninguna
librería de Excel porque el repo no tenía y `package.json` es de todos. Si el equipo prefiere
`.xlsx` nativo (colores, anchos de columna), se charla y se agrega la dependencia entre todos.
Columnas: las mismas de cada tabla, más DNI/cuenta/alta en clientes.

**Email masivo real**: `POST /customers/email` implementado según contrato
(`{customerIds, subject, body}` → `{sent}`). El texto admite variables que el backend completa
POR PERSONA: `{nombre}`, `{email}`, `{total_gastado}` y `{ultima_compra}` (con las métricas de
verdad de cada cliente). Los clientes sin email se saltean y no cuentan; si un envío falla, sigue
con los demás. El modal de la pantalla manda a la lista FILTRADA (búsqueda aplicada), reemplaza
la marca de las plantillas por el nombre real del negocio, y muestra cuántos salieron.
En local sin mail configurado cada envío sale como [MAIL STUB] en la consola.

**Arreglo de paso**: el modal de email era más alto que la pantalla en ventanas chicas y el botón
de enviar quedaba inalcanzable — mismo problema que había tenido el modal de roles, mismo
arreglo (el contenido se desliza adentro, título y botones siempre a la vista).

**FASE 2 COMPLETA (8/8)**: modelo y estados, lista con filtros, clientes con métricas, crear
pedido manual con stock, comprobante, acciones masivas, exportar pedidos, exportar clientes +
email masivo. Todo verificado contra el backend real y pendiente de commit.


---

## 2026-07-24 — Auditoría de mis fases + arreglos (Alex)

Me hice una auditoría completa de todo lo mío (F1 + F2) buscando lagunas. Lo que encontré y
arreglé (todo en mis archivos, sin tocar schema ni módulos ajenos):

- **GRAVE — stock esquivable con renglones repetidos** (probado: con stock 27 pedí 15+15 del
  mismo producto en dos renglones → pasaba y el stock quedaba en -3). El control validaba cada
  renglón por separado. Ahora las cantidades se suman POR PRODUCTO antes de comparar, en el alta,
  en la confirmación (y la devolución por cancelación también quedó agrupada). La pantalla nunca
  generaba renglones duplicados, pero la API los aceptaba — y el servidor no debe confiar en la
  pantalla.
- Buscar "#4" con numeral ahora encuentra el pedido 4 (se ignora el #).
- **El permiso `orders.export` por fin se usa**: el botón Exportar de pedidos solo aparece para
  quien lo tiene (dueño/admin). Para clientes NO existe un permiso de exportar en el catálogo —
  anotado acá para decidir en equipo si se agrega al seed.
- **Botones según permisos**: el cajero/empleado ya no ve botones que le daban 403 — "Nuevo
  pedido", "Confirmar" en lote, cambiar estado en el detalle (le dice que su rol no puede) y
  "Email masivo" de clientes se muestran solo con el permiso que corresponde.
- El modal de email individual ya no miente: avisa que ese envío llega en una fase más adelante
  (es la tarjeta "Enviar email al cliente"; no la implementé porque no es de mis fases).
- Email masivo con 0 destinatarios: botón deshabilitado ("Sin destinatarios").
- Email inválido del comprador manual: se avisa en criollo en la pantalla antes de mandar (antes
  llegaba el error del backend en inglés).
- "Hace 3 mes" → "Hace 3 meses" en clientes.

Mejoras visuales que me pedí a mí mismo:
- **Configuración general en dos columnas** en pantallas anchas (la página era un scroll eterno);
  en celular vuelve a una columna.
- **Wizard de Nuevo pedido mejorado**: stock con color en cada tarjeta (gris/amarillo/rojo según
  cantidad), marca "×N" y borde en los productos que ya están en el carrito, total siempre visible
  abajo junto a los botones, se puede volver a un paso anterior tocándolo, catálogo con grilla
  fluida (se acomoda en celular), y aviso "mostrando 9 de N" cuando la búsqueda esconde productos.


Última pasada de validaciones del wizard (mismo día): los productos sin stock quedan bloqueados
desde la tarjeta (el + se apaga, "Sin stock" en rojo) — no tiene sentido dejar armar un pedido
que va a rebotar; el contador del carrito frena en el stock disponible (para productos de una
sola variante; con varias variantes valida el backend al crear); botón para volver a la lista
desde el primer paso; el teléfono del comprador solo acepta números. OJO anotado: un producto
que NO controla stock hoy se ve como "Sin stock" en el wizard y queda bloqueado — cuando el
equipo agregue el campo "vender sin stock" hay que destrabarlo acá también.

## 2026-07-27 — Eliminación completa del módulo POS/Caja (decisión de producto)

**Estado:** RESUELTO (2026-07-27) — módulo eliminado, backend y frontend compilan sin errores.

Se pidió eliminar el módulo POS (venta de mostrador con caja) entero, incluyendo el modelado de
datos, dado que se decidió no seguir con esa línea de producto. El módulo nunca llegó a tener
lógica real: el frontend (`ventas/panel/pos/`) era 100% mock (confirmado en su propia
`docs/arquitectura.md`: "Ningún hook llama a una API real") y el backend (`src/cash/`) eran
controllers/services stub que devolvían `{ message: 'not implemented' }`. Se borró:

- **Frontend**: `apps/web/src/modules/ventas/panel/pos/` completo (types, stores Zustand, hooks,
  componentes, docs). Se sacó la sección "POS" del nav (`Sidebar.tsx`) y del route map
  (`pages/admin/[negocioId]/[moduloPadre]/[seccion].tsx`), y el breadcrumb muerto de `Header.tsx`.
- **Backend**: `apps/api/src/cash/` completo (controller, service, DTOs), desregistrado de
  `app.module.ts`.
- **MercadoPago Point** (lector de tarjeta físico): endpoints `point/*` y sus DTOs en
  `mercadopago.controller.ts`, y los modelos `MpStore`/`MpPos`/`MpDevice`. Se decidió junto con
  el resto porque nunca tuvo pantalla ni flujo que lo use. `MpCredentials` (conexión OAuth de la
  cuenta) se mantuvo intacta porque la usa (o usará) el checkout online.
- **Prisma**: modelos `CashSession`, `CashMovement`, `PosSaleDetails`, `MpStore`, `MpPos`,
  `MpDevice` + enums `CashSessionStatus`/`CashMovementType` — migración
  `20260727001943_remove_pos_module` aplicada contra la base real (Supabase). Se sacaron las
  relaciones inversas en `Business`/`Branch`/`Member`/`Order`/`MpCredentials`.
- **Rol `cajero` y permisos `pos.*`**: se decidió eliminar el rol entero (no solo vaciarlo de
  permisos). Esto tocó bastante más que el propio módulo POS porque `cajero` se usaba como
  fixture genérico de "miembro no-owner/no-admin" en varios tests e2e (`branches.e2e-spec.ts`,
  `business.e2e-spec.ts`, `auth.e2e-spec.ts`) para probar los límites de `RolesGuard`/
  `PermissionsGuard`. Se repuso ese fixture con el rol `empleado` (ya existía en el catálogo,
  antes sin ningún member seedeado) — nuevo member `empleado@zapatoslorena.test` en
  `prisma/seed.ts`, y `SEED_USERS.cashier` renombrado a `SEED_USERS.employee` en
  `test/helpers/test-users.ts`. `AppRole` (`roles.decorator.ts`) quedó como
  `'owner' | 'admin' | 'empleado'`.
- **`OrderChannel.POS`**: el enum y el modelo `Order`/`OrderItem`/`Payment` NO se tocaron — los
  usa activamente el módulo Pedidos (filtro por canal en `PedidoLista.tsx`, columna "Canal:
  Presencial", máquina de estados en `orders.service.ts` para pedidos con canal POS existentes).
  Lo único que se limpió ahí fue el mensaje de error de `create()` (ya no menciona "el módulo de
  caja", que dejó de existir) y el campo `cashSessionId` del DTO de creación de pedido, que
  quedó huérfano.

**Zona gris que quedó fuera a propósito**: `OrderChannel.POS` sigue siendo un valor válido del
enum y `FindOrdersQueryDto.channel` lo sigue aceptando como filtro — no se puede crear un pedido
nuevo con ese canal (la única vía iba a ser el módulo de caja, que ya no existe), pero si en el
futuro aparece otra forma de generar ventas presenciales, el campo ya está ahí. No se consideró
"exclusivo del módulo POS" porque Pedidos depende de él para mostrar/filtrar el canal de
cualquier pedido, pasado o futuro.

## Plataforma / Super admin

### [2026-07-27] Fase A del panel de super admin: autenticación + redirect (Fase B = contenido)
**Estado:** RESUELTO (2026-07-27) — auth end-to-end verificada (`test/platform-auth.e2e-spec.ts`,
7/7). El CONTENIDO del panel (lista de negocios, dueños, métricas) es Fase B, aún no hecho.

Se agregó un **tercer tipo de identidad** (`platform_admin`) a un sistema de auth que hasta ahora
era binario `member | customer`. El modelo `PlatformAdmin` ya existía pero era una cáscara: **no
tenía credenciales** (ni `passwordHash` ni `googleId`), así que un super admin no podía loguearse.

Decisiones tomadas (confirmadas con el usuario):
- **Método de auth: ambos** (password argon2id + Google vinculable). Se agregaron a `PlatformAdmin`:
  `passwordHash`, `googleId @unique`, `emailVerified`, `hasTempPassword`, `failedLoginAttempts`,
  `lockedUntil`, `lastAccessAt` (mismo esquema de seguridad que `Member`).
- **Ruta del panel: `/superadmin`** en el apex (`orbita.site/superadmin`), NO un subdominio. Es
  una identidad cross-tenant, fuera del multi-tenant.
- **Precedencia en el login del apex: super admin PRIMERO, después member.** Un fundador que además
  sea member de un negocio de prueba aterriza en el super panel (no en su negocio). Si eso molesta
  en el futuro, se agrega un "entrar a un negocio" desde el panel.
- **Bootstrap:** se sembró `vegaalanadrian@gmail.com` como `SUPERADMIN` activo en `prisma/seed.ts`
  (password temporal `Test1234!` para dev; Google se vincula solo en el primer login).

Cambios de schema (migración `20260727010000_platform_admin_credentials`, aplicada a Supabase):
- `UserType` suma `PLATFORM_ADMIN`.
- `RefreshToken.businessId` y `PasswordResetToken.businessId` pasan a **nullable** (un admin no
  tiene negocio). Las FKs quedaron `ON DELETE SET NULL`.

Puntos técnicos a tener presentes:
- El JWT ahora lleva `type: 'member' | 'customer' | 'platform_admin'` y `businessId` opcional
  (ausente para admin). `AuthGuard` tiene una rama nueva que no valida slug (cross-tenant).
- `PlatformAdminGuard` (que devolvía `true` siempre) ahora es real y protege todo `/platform/*`.
  Los guards globales (`RolesGuard`/`PermissionsGuard`/`BusinessModeGuard`) hacen early-return sin
  su metadata, así que dejan pasar al admin; `BusinessModeGuard` se ajustó para no leer
  `businessMode` en el contexto de admin (no lo tiene).
- Los endpoints de `platform.controller.ts` siguen siendo **stubs** (`{ message: 'not implemented' }`).
  El guard ya los protege; el contenido es Fase B.

**ABIERTO / DIFERIDO:**
- **Reset de contraseña para admins:** el schema y `resetPassword()` ya lo contemplan, pero
  `forgotPassword()` en el apex solo emite tokens de `MEMBER` — nunca genera un token de admin. No
  se expuso el flujo porque Google es el fallback si un fundador pierde la password. Falta decidir
  si se agrega un "olvidé mi contraseña" para el super panel.
- **Endpoint que asuma businessId sin chequear tipo:** un token de `platform_admin` mandado a un
  endpoint de tenant sin `@Roles`/`@RequirePermission` y sin aserción de member podría entrar con
  `businessId` undefined. Hoy no hay riesgo real (solo nosotros tenemos tokens de admin y el panel
  vive aparte), pero conviene una aserción explícita si se agregan endpoints de tenant "abiertos".

### [2026-07-27] El `/admin/[negocioId]/*` en el apex es un resabio — el panel de negocio vive en el subdominio
**Estado:** ABIERTO — limpieza pendiente, marcada por el usuario.
El shell de panel de negocio en `apps/web/src/pages/admin/[negocioId]/[moduloPadre]/[seccion].tsx`
se puede alcanzar desde el apex (`orbita.site/admin/...`), pero **no debería existir ahí**: el
panel de cada dueño vive en el subdominio de su negocio (`{slug}.orbita.site/panel` → shell de
admin). Pendiente: remover/redirigir el acceso al panel de negocio desde el apex para que la única
cosa "de plataforma" en el apex sea el login y `/superadmin`. No se tocó en esta tarea para no
mezclar alcances.

### [2026-07-27] Fase B del super panel: contenido (negocios, dueños, dominios, métricas)
**Estado:** RESUELTO (2026-07-27) — backend e2e-verificado (`test/platform-panel.e2e-spec.ts`, 8/8);
frontend typecheck-clean. Falta verificación visual en browser (ver caveat abajo).

Se implementó `PlatformService` (eran stubs) con lecturas cross-tenant y acciones auditadas, y el
panel `/superadmin` con tabs (Resumen, Negocios, Dominios, Dueños).

- **Endpoints** (`GET /platform/*`): `overview` (KPIs: negocios por estado/modo/rubro, suscripciones
  por estado/origen, MRR de las pagas activas, subdominios ocupados, dominios vendidos, altas 30
  días), `businesses` (paginada + filtros search/status/mode/subscription), `businesses/:id`
  (detalle con equipo, suscripción + pagos, métricas de ventas, timeline de auditoría), `domains`
  (subdominios + custom), `owners`, `subscriptions`.
- **Acciones** (con `PlatformAdminLog`): `suspend`/`reactivate` negocio, `grant-comp` (licencia
  cortesía), y CRUD de admins (`GET/POST/PUT/DELETE /platform/admins` — soft-delete, sin auto-baja).
- **Frontend**: `lib/platform/api.ts` (cliente sobre `authedFetch`) + `pages/superadmin/index.tsx`
  (panel con tabs y drawer de detalle).

Decisiones/atajos a revisar:
- **Suspender negocio** se implementó como `isPaused=true` + `subscription.status=SUSPENDED`. Reusa
  `isPaused`, que también controla el dueño ("zona peligrosa: tienda pausada"), así que se conflaciona
  la pausa del dueño con la suspensión de plataforma. Si hace falta distinguirlas, agregar un flag
  dedicado `platformSuspended` en `Business`. Hoy alcanza para V1.
- Las **acciones de escritura del panel** (suspend/reactivate/grant-comp/CRUD admins) están en el
  backend y protegidas, pero el **frontend todavía no las expone con botones** — el panel es de solo
  lectura por ahora. Falta cablear los botones + confirmaciones en `/superadmin` (siguiente iteración).
- **OPERATOR vs SUPERADMIN**: hoy ambos roles tienen el mismo acceso (el guard solo exige
  `platform_admin`). Falta acotar OPERATOR (ej. que no pueda dar de baja admins ni otorgar cortesías)
  cuando se definan las políticas.

**Caveat de verificación:** el backend está probado end-to-end contra la DB real (8/8), pero el
render del panel en el browser NO se verificó (requiere dev server + hosts `orbita.local` + sesión
de admin). Typecheck del frontend limpio.
