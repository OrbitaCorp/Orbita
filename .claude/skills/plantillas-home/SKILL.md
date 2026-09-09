---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, mejorar o revisar los diseños alternativos de la PORTADA de una tienda, y el trabajo de enganchar cada una con la tienda real (hoy Vidriera y Escaparate lo tienen). Usar cuando el pedido sea agregar plantillas nuevas, rehacer una existente, sumar fotos, enganchar una plantilla a datos reales, o verificar que las plantillas anden. Cubre la arquitectura (tipos/datos/piezas/homes/PlantillasConfig), el contrato de aplicación real (plantillaReal.ts, StorefrontChrome.tsx, PLANTILLAS_ENGANCHADAS, heroPropio/heroGrande), el estándar visual, de dónde salen las fotos, y el chequeo automático de las dieciséis en escritorio y celular. Palabras clave: plantilla, plantillas, home, portada, template, theme, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer, circuito, vera, cobijo, nítida, enganchar, aplicar."
---

# Plantillas de Home

Diseños alternativos **para la portada** de una tienda de Órbita. El dueño las elige
desde el panel: Avanzado → Plantillas de Home → Configurar. Hoy hay **dieciséis**,
todas del módulo tienda; **Vidriera** y **Escaparate** son las únicas que además se
pueden activar de verdad en un negocio (ver § Cómo se aplica una plantilla, más
abajo).

## Las cinco reglas que no se negocian

1. **La ESTRUCTURA de catálogo, ficha de producto, carrito, checkout y perfil no
   cambia con ninguna plantilla** — mismos filtros, mismo carrito, misma
   navegación. Si una propuesta es "una grilla con filtros distinta", eso es el
   catálogo, no una portada — no va. Lo que SÍ cambia en esas páginas, cuando la
   plantilla está enganchada de verdad (hoy Vidriera y Escaparate): la paleta y la
   tipografía se heredan a todo el sitio vía `StorefrontChrome.tsx` — es una
   decisión aparte y explícita (ver § Cómo se aplica), no una excepción a esta
   regla. La ESTRUCTURA sigue siendo la de siempre en todas partes menos el home.
2. **Una plantilla por vez pertenece a UN módulo.** Hoy las dieciséis son del
   módulo **tienda**. Gastronomía, turnos y el resto van a tener las suyas. No
   mezclar una carta de restaurante entre las de tienda.
3. **Solo secciones que Órbita realmente genera.** El home real (ver
   `cliente/inicio/Inicio.tsx`) tiene: cartel, hero, barra de stats,
   categorías, filas de productos, banner de WhatsApp y pie. **No hay
   newsletter, ni testimonios, ni planes por suscripción** — una plantilla que
   los muestre promete algo que después la tienda no puede cumplir. Pedido
   explícito del dueño: *"eso no lo ofrecemos"*. Mismo criterio para
   `AccionesTienda`: el header real no tiene un ícono aparte de "Mis pedidos"
   (vive adentro del menú de cuenta, junto con "Mi perfil" y "Mis direcciones")
   — la maqueta no puede prometer un ícono que la tienda real no tiene.
4. **Tienen que verse MUY distintas entre sí**, no la misma página repintada.
   Lo que las diferencia de verdad: header propio, forma propia de mostrar el
   producto, proporción propia de imagen y al menos una sección que las otras
   no tengan. (Se probó unificarlas todas bajo el esqueleto de Vidriera y el
   dueño lo volvió atrás: quiere variedad. Más tarde se agregó una tanda de
   ocho nuevas mitad-y-mitad —cuatro con esqueleto propio, cuatro reusando
   `tienda`— y las cuatro que reusaban `tienda` terminaron dándose de baja por
   parecerse demasiado a Vidriera: **de acá en más, una plantilla nueva escribe
   su propio esqueleto en `homes.tsx`**, salvo pedido explícito de lo
   contrario.) `tienda` es el esqueleto de Vidriera, sigue disponible como tipo
   por si hiciera falta, pero no es el default.
5. **Las acciones de tienda son iguales en todas.** Ingresar / cuenta con "Mis
   pedidos" adentro / Carrito con contador (`AccionesTienda`). Cambia la
   portada, no la forma de entrar a la cuenta ni de comprar.

## Dónde vive todo

```
apps/web/src/modules/ventas/panel/avanzado/plantillas/
  tipos.ts             Tema, Layout, Producto, Slide, Plantilla, IMG, sans/serif/ar
  datos.tsx            PLANTILLAS[] — marca, tagline, tema, slides y productos de muestra
  piezas.tsx           CSS + componentes compartidos + marcos Notebook/Celular
  homes.tsx            Home({p, movil, soloCuerpo, acciones}) — un bloque
                       `if (p.layout === '...')` por plantilla; soloCuerpo/acciones
                       son el enganche con la tienda real (ver más abajo)
  PlantillasConfig.tsx Pantalla del panel: galería → detalle. También el editor de
                       apariencia de la plantilla ENGANCHADA (ver PLANTILLAS_ENGANCHADAS)
apps/web/public/plantillas/   129 fotos JPG locales, ~20 MB (SÍ van a git desde
                              que esto es una pantalla del panel, no una demo)

apps/web/src/modules/ventas/cliente/inicio/
  Inicio.tsx           Home real. Con plantilla activa, dibuja PlantillaHome
                       (el MISMO Home() de arriba) con datos reales
  plantillaReal.ts     Adaptador: catálogo/categorías/stats reales → forma `Plantilla`
apps/web/src/components/storefront/
  StorefrontChrome.tsx Envoltorio de TODAS las páginas del storefront: header +
                       anuncio + paleta/tipografía de la plantilla activa
  StorefrontHeader.tsx El header real. Prop `centrado` = layout de Vidriera
                       (logo centrado, buscador a la izquierda, nav debajo)
  ProductCard.tsx      La tarjeta de producto real. Con `tema` (Tema de la
                       plantilla) se dibuja en SU vocabulario visual; sin
                       `tema`, con el de Apariencia de siempre
```

`Avanzado.tsx` la engancha con `vista === 'plantillas'` (mismo patrón que
`JuegosConfig`), sin ruta propia: el dueño nunca sale de la pantalla.

## Cómo se aplica una plantilla a una tienda real (hoy: Vidriera y Escaparate)

Esto NO es una vitrina que no aplica nada — dejó de serlo. Vidriera y
Escaparate tienen el camino completo armado; las otras catorce todavía no.
Antes de tocar nada de esta sección, ver primero § El plan: enganchar las que
quedan.

**El interruptor.** `PlantillasConfig.tsx`:

```ts
// Únicas plantillas con lógica real detrás (ver businesses.service.ts
// setHomeTemplate) — el resto del catálogo de abajo sigue siendo vitrina.
const PLANTILLAS_ENGANCHADAS = new Set(['vidriera', 'escaparate'])
```

Solo si `p.id` está en ese `Set` aparece el botón "Usar esta plantilla". Activarla
llama a `panelSetHomeTemplate(id)`, que guarda `homeTemplate` en
`storefront_config` (backend: `businesses.service.ts#setHomeTemplate`).

**El render compartido.** `homes.tsx` exporta `Home({p, movil, soloCuerpo,
acciones})` — la MISMA función dibuja el preview del panel (con datos de
muestra) y el home real (con datos reales). Dos props hacen la diferencia:

- `soloCuerpo?: boolean` — si es `true`, el bloque de la plantilla NO dibuja su
  propio header/footer (porque `StorefrontChrome` ya puso el header real
  arriba, y el home real trae su propio footer/WhatsApp). Sin esto, activar la
  plantilla dibuja DOS headers superpuestos. **Ojo**: `soloCuerpo` gatilla el
  header y el footer, pero NO necesariamente el hero — ver `heroPropio` más
  abajo, Escaparate es el primer caso donde el hero se queda adentro de
  `Home()` a propósito.
- `acciones?: AccionesHome` — funciones reales para navegar (`irACatalogo`,
  `irACategoria`, `irAProducto`, `abrirWhatsapp`, `irALink`) y sobre todo
  `renderProducto(x, i, opts)`, que Inicio.tsx usa para dibujar la
  `ProductCard` REAL (con carrito, variantes, stock) en vez de la tarjeta de
  maqueta (que no tiene ninguna de esas cosas y siempre manda `precio: ''`).

**Hoy `soloCuerpo`/`acciones`/`renderProducto` están conectados en los bloques
`tienda` y `escaparate`** — el resto de los bloques de `homes.tsx` todavía
ignora esas props. Activar cualquier otra plantilla hoy dibujaría el header de
la maqueta encima del real, y productos sin precio — por eso no está en
`PLANTILLAS_ENGANCHADAS` todavía.

**El hero, cuando no es el carrusel genérico.** `HeroCarousel` (el real, en
`Inicio.tsx`) es UN slide rotando a pantalla completa — no sabe dibujar nada
estructuralmente distinto (dos campañas partidas, un muro sin hero, lo que
sea). Dos flags en `Plantilla` (`tipos.ts`) resuelven esto sin hardcodear el id:

- `heroGrande?: boolean` — pide el modo "grande" del `HeroCarousel` (tipografía
  editorial 132/62px, CTA subrayado). Solo tiene sentido si la plantilla usa el
  `HeroCarousel` genérico (como Vidriera). Reemplaza el viejo hardcode
  `homeTemplate === 'vidriera'`.
- `heroPropio?: boolean` — la plantilla dibuja SU PROPIO hero adentro de
  `Home()`, no gateado por `soloCuerpo` (a diferencia del header/footer, sí se
  sigue dibujando con datos reales). `Inicio.tsx` saltea su `HeroCarousel`
  genérico para esa plantilla (`!plantilla?.heroPropio`), para no terminar con
  dos heros superpuestos. Escaparate lo usa: sus "dos campañas partidas" leen
  `p.slides.slice(0, 2)` — los MISMOS dos primeros slides que el dueño ya edita
  en Apariencia (mismo editor, mismo dato, ninguna pantalla nueva) — y navegan
  con `s.link` (el `ctaLink` real) vía `acciones.irALink`. Sin `kicker`:
  Apariencia no tiene ese campo (es de la maqueta nomás), así que se dibuja
  solo si vino de datos de muestra (`{s.kicker && (...)}`).

**El adaptador.** `plantillaReal.ts` arma el objeto `Plantilla` con el que se
dibuja el home real, a partir del catálogo/categorías/stats/cupón/hero de ESE
negocio:

- `definicionPlantilla(id)` — busca la entrada en `PLANTILLAS` por id.
- `plantillaReal({ base, productos, destacados, masVendidos, categorias, stats,
  cupon, heroSlides })` — devuelve `{ ...base, confianza, categorias, cupon,
  productos, productosSecundarios }` con los datos reales pisando los de
  muestra, y ADEMÁS pisa `slides` con los `heroSlides` reales SOLO si
  `base.heroPropio` (si no, el campo se ignora — esas plantillas dibujan su
  hero con `HeroCarousel` aparte, no con `p.slides`). Todo lo visual (tema,
  tipografía, radios, sombras) sale de `base` sin tocar.
- `headerCentrado(id)` — `true` si la plantilla marca `headerCentrado: true` en
  su entrada de `datos.tsx`. Lo consume `StorefrontChrome` para decidir la
  FORMA del header real en TODA la tienda (no solo el home) — a propósito,
  pedido explícito: *"solamente quiero que el header cambie... en las otras
  vistas"*. Hoy solo Vidriera lo marca (Escaparate usa el header por defecto,
  no necesitó una forma nueva).
- `variablesDeTema(tema)` — traduce el `Tema` de la plantilla a las variables
  CSS del storefront (`--color-primary`, `--font-heading`, etc.).

**El envoltorio único.** `StorefrontChrome.tsx` reemplaza el `<div>` raíz que
antes cada página del storefront (Catálogo, Categoría, Producto, Carrito,
Perfil, cupones, pedido/\*) copiaba a mano. Aplica `variablesDeTema(tema)` en su
`<div>` raíz — se heredan a TODO lo de adentro — y decide la forma del header
con `headerCentrado`. Por esto una plantilla enganchada repinta colores y
tipografía en TODA la tienda, no solo el home; es intencional (pedido con
capturas: *"no entiendo por qué no aplicás como componente?"*) y no contradice
la regla 1 — la ESTRUCTURA de esas páginas no cambia, solo el color y la
fuente.

**La tarjeta de producto real.** `ProductCard.tsx` tiene DOS ramas de render:
con `tema` (un `Tema` de plantilla) dibuja su propio vocabulario visual —radio,
sombra, layout a sangre—; sin `tema`, la de siempre. Es el estándar para toda
plantilla futura: **una plantilla define su tema y sus altos de grilla, la
tarjeta real se adapta sola — nunca se escribe una tarjeta por plantilla.**

**Cuando una funcionalidad de la maqueta no existe de verdad, se saca en el
camino real, no se finge.** Escaparate tenía "Agregar" (agrega directo, sin
pasar por el picker de variante) y "Agregar los 3 · $446.000" (combo de tres
productos distintos de un tilde) — ninguna de las dos existe en el carrito de
Órbita. Con `acciones` presente, "Agregar" pasa a decir "Ver" y navega a la
ficha (ahí sí hay picker real), y el botón de combo directamente no se
dibuja. Mismo criterio que newsletter/testimonios (regla 3), aplicado a
interacciones, no solo a secciones.

## El plan: enganchar las catorce que quedan, una por una

Objetivo: que activar cualquiera de las dieciséis se sienta exactamente como
activar Vidriera o Escaparate hoy — mismo botón, mismo editor de apariencia, la
tienda real usando SU catálogo con la estructura de esa plantilla. Se hace de a
una, agregando su id a `PLANTILLAS_ENGANCHADAS` recién cuando quede lista —
nunca antes, porque hasta ese momento sigue siendo pura vitrina y no hay ningún
apuro.

**Una generalización que sigue pendiente y bloquea a cualquier plantilla con
header propio no estándar:**

`StorefrontHeader.tsx` solo sabe dibujar DOS formas de header: la de siempre, y
`centrado` (la de Vidriera). Una plantilla cuyo header real no sea ninguna de
esas dos (por ejemplo Circuito, con panel lateral fijo) no puede engancharse
sin sumar una tercera forma ahí — y cada forma nueva es trabajo real, no una
casilla que se tilda sola. Con `HeaderLateral` ya armado como pieza de maqueta
en `piezas.tsx`, esa sería la segunda forma candidata si el orden de trabajo la
toca temprano. (La otra generalización que bloqueaba esto —el hardcode de
`'vidriera'` en el hero— ya se resolvió con `heroGrande`/`heroPropio`, ver
arriba.)

**Checklist por plantilla** (repetir para cada una, en el orden que se decida —
Escaparate lo siguió completo, usarlo de referencia junto con `tienda`):

1. En `homes.tsx`, en el bloque `if (p.layout === '...')` de esa plantilla:
   envolver el header propio en `{!soloCuerpo && (...)}`, e igual el footer si
   dibuja uno propio (`Pie`). El hero NO va necesariamente adentro de ese
   mismo `{!soloCuerpo}` — depende de si el `HeroCarousel` genérico le sirve
   (entonces sí, se saca, como `tienda`) o no (entonces se queda, con
   `heroPropio: true`, como `escaparate`).
2. Reemplazar cada grilla de productos por el patrón de `renderProducto` (ver
   el bloque `tienda` o `escaparate` como referencia): si
   `acciones?.renderProducto` está, usarlo; si no, caer a la `Card` de maqueta
   de siempre. El helper `producto(x, i, opts)` ya está definido una sola vez
   arriba de todos los bloques, en el cuerpo de `Home()` — no hace falta
   reescribirlo.
3. Los links/CTAs que hoy son `<a>` o `<span>` sin handler pasan a llamar
   `acciones?.irACatalogo` / `irACategoria` / `irAProducto` / `abrirWhatsapp` /
   `irALink` cuando estén disponibles.
4. Cualquier interacción de la maqueta que no exista de verdad (agregar sin
   variante, combos, lo que sea) se saca o se cambia por una real cuando
   `acciones` está presente — no se finge (ver el caso de Escaparate arriba).
5. Decidir la forma de header real: ¿alguna de las dos que ya existen en
   `StorefrontHeader.tsx` le sirve? Si es que sí, marcar `headerCentrado: true`
   en su entrada de `datos.tsx` SOLO si además necesita esa forma en TODA la
   tienda (Escaparate no lo marcó: su header mock ya es la forma por defecto).
   Si no le sirve ninguna, es la generalización pendiente de arriba — hacerla
   ahí, no de apuro adentro del checklist de una sola plantilla.
6. Confirmar en `plantillaReal.ts` que `plantillaReal()` cubre todo lo que esa
   plantilla necesita mostrar (¿usa alguna sección que el adaptador no arma
   todavía? ¿necesita `heroSlides` porque tiene `heroPropio`?).
7. Sumar el id a `PLANTILLAS_ENGANCHADAS` en `PlantillasConfig.tsx`.
8. Probar en una tienda real (o de prueba) con catálogo de verdad: categorías
   sin foto, sin cupón cargado, sin stats, hero con menos slides de los que la
   plantilla espera — los casos límite que `plantillaReal.ts` ya resuelve para
   Vidriera/Escaparate (foto → producto → degradé; cupón vacío → no se
   dibuja; grilla que se acomoda al número real de items) tienen que seguir
   andando igual acá.
9. `npx tsc --noEmit`, `npx eslint`, y el chequeo de `referencia/verificacion.js`
   de siempre — enganchar no exime de verificar la vitrina.

## Piezas compartidas (usarlas antes de escribir una nueva)

`Reveal` (scroll-reveal), `Foto` (con segunda imagen al hover, y fondo degradé
si `src` es un `linear-gradient(...)` en vez de una URL — así se ve la tienda
real sin fotos cargadas), `Estrellas` (sin uso en la tarjeta de producto real:
Órbita no tiene valoraciones, ver regla 3), `Card`, `Boton`, `Titulo`,
`Marquee`, `AccionesTienda`, `HeaderCentrado`, `HeaderLateral`, `Carrusel`,
`Beneficios`, `Resenas`, `Newsletter`, `Pie`, `Notebook`, `Celular`, `TONOS`,
`CSS`, `cargarFuentes`.

`Tira` (fila horizontal con snap) vive en `homes.tsx`, no en `piezas.tsx`.

## El estándar visual

Referencia del dueño: **travistrend.com.ar**, y el nivel de las theme stores de
Shopify/Tiendanube. Lo que separa esto de un wireframe:

- **Detalle en la tarjeta de producto**: segunda foto al hover, swatches de
  color, aviso de stock, precio con transferencia y cuotas. Sin estrellas ni
  reseñas — ver regla 3.
- **Movimiento**: reveals al scrollear, zoom lento en las fotos, carrusel que
  avanza solo, marquee.
- **Profundidad**: sombras propias del tema (`tema.sombra`), no una sombra
  genérica para todas.
- **Fotos reales**, nunca bloques de color (salvo el degradé de respaldo, ver
  `Foto` arriba).
- Cada plantilla trae **su tipografía** (`fh` títulos / `fb` cuerpo) y **su
  radio** (`radio: 0` para las duras, 10–16 para las amables).

## Tipografías

`loadFont()` de `lib/fonts.ts` NO sirve acá: solo conoce las siete familias que
el dueño puede elegir en Apariencia y, para cualquier otra, arma un `<link>`
roto (`family=undefined`). Las plantillas tienen su propio cargador,
`cargarFuentes()` en `piezas.tsx`, con la lista `FUENTES_PLANTILLAS` y los pesos
exactos que se usan (varias piden 800/900, que los specs de Apariencia no
traen). Fuente nueva → agregarla ahí, no en `lib/fonts.ts`, y chequear que
exista antes de usarla:

```bash
curl -o /dev/null -w "%{http_code}\n" "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700"
```

Y al revés: si una plantilla se da de baja, sacar su fuente de la lista SI
ningún otro la usa (`grep` el nombre en `datos.tsx` antes de tocar
`FUENTES_PLANTILLAS`).

## Fotos

Son **locales a propósito**: con URLs remotas la pantalla se ve rota sin
internet y depende de un tercero.

- Fuente que funciona: `https://images.unsplash.com/photo-{id}?w=1400&q=80`.
  `picsum.photos` está bloqueado y `source.unsplash.com` devuelve 503.
- **De dónde salen los ids**: `curl` a `unsplash.com/s/photos/{búsqueda}` está
  bloqueado. Lo que sí anda: abrir esa URL en el navegador del Browser pane y
  sacarlos del DOM, que además trae el `alt` traducido y dice qué es cada foto
  antes de bajarla:
  `[...document.querySelectorAll('figure img')].filter(i => i.src.includes('images.unsplash.com')).map(i => ({ id: (i.src.match(/photo-([0-9a-f-]+)/)||[])[1], alt: i.alt }))`
  El filtro por host no es opcional: las de `plus.unsplash.com` son de pago y
  bajan un `<html>404</html>` con extensión `.jpg` (7 de 48 en una tanda).
- Bajarlas a `apps/web/public/plantillas/` con nombre por rubro:
  `joya-collar.jpg`, `tech-teclado.jpg`, `moda-mujer-invierno.jpg`.
  Prefijos en uso: `vidriera- casa- tech- moda- belleza- comida- joya- local-
  editorial- relato- libre- ferre- dep- masc- vino- bebe-`.
- **Verificar cada id con curl antes de asignarla** y mirarlas todas juntas en
  una hoja de contactos (ver `referencia/fotos.md`) — bajar a ciegas termina en
  una foto que no tiene nada que ver. El `alt` tampoco alcanza solo: una foto
  de "frasco de vidrio con líquido marrón" resultó ser un frasco de páprika con
  la etiqueta a la vista, que se iba a vender como miel.
- **Que no desentonen con la paleta.** Una hoja verde tropical adentro de una
  joyería carbón y dorado arruina la fila entera.
- **Sin repetir la misma foto dos veces en pantalla** (una en el mosaico de
  categorías y otra en la fila de productos se nota y se lee como vagancia).
- **Chequear duplicados por hash**, no de memoria: dos ids distintos de Unsplash
  pueden traer el mismo archivo.
  `md5sum *.jpg | awk '{print $1}' | sort | uniq -d`

## Agregar una plantilla nueva

1. **Fotos primero.** Bajar 8–12 del rubro, verificarlas, hoja de contactos.
2. `tipos.ts`: sumar el id al `type Layout`.
3. `datos.tsx`: entrada nueva con `id`, `nombre`, `para`, `queCambia`,
   `secciones[]`, `marca`, `tagline`, `layout`, `tema`, `slides[]`, `productos[]`.
   `queCambia` se muestra en el panel: que diga qué la hace distinta, no adjetivos.
4. `homes.tsx`: bloque `if (p.layout === 'nuevo') { ... }` con esqueleto
   **propio** (ver regla 4 — reusar `tienda` es la excepción, no el default).
   Empezar por el header (con `<AccionesTienda t={t} movil={movil} />`, y
   envuelto en `{!soloCuerpo && (...)}` si de entrada se piensa engancharla),
   seguir por el hero y después las secciones.
5. Todo bloque que no sea header ni hero va envuelto en `<Reveal>`.
6. Cada medida con su variante `movil ? x : y`. Usar el helper `cols(d, m)`.
7. Actualizar el conteo de plantillas en la bajada y el comentario de arriba de
   `PlantillasConfig.tsx`. Y cuidado con las comparaciones que envejecen dentro
   de `queCambia` ("la más sobria de las X" miente en cuanto entra una más).
8. `npx tsc --noEmit` y `npx eslint src/modules/ventas/panel/avanzado/plantillas`.
   Los warnings de `no-img-element` son esperados (ver Convenciones).
9. Correr el chequeo de `referencia/verificacion.js` en las dos vistas, y
   **mirar la nueva con los ojos**: el script no dice si una foto miente ni si
   el hero se lee.

Si además se va a enganchar con la tienda real desde el arranque, seguir
también el checklist de § El plan de acá arriba.

### Ocultar o dar de baja una plantilla

`oculta: true` en la entrada la saca de la galería sin borrar nada (para
guardarla "por si se pide de vuelta"). **Dar de baja de verdad** (como pasó con
cuatro plantillas que se parecían demasiado a Vidriera) es otra cosa: sacar la
entrada de `datos.tsx`, sacar sus fotos de `apps/web/public/plantillas/` SI son
exclusivas (`grep` el prefijo en `datos.tsx` antes de borrar — puede estar
compartido), sacar su fuente de `FUENTES_PLANTILLAS` SI nadie más la usa, y
actualizar el conteo en `PlantillasConfig.tsx` y esta skill. Si la plantilla
llegó a estar en `PLANTILLAS_ENGANCHADAS`, sacarla de ahí primero y coordinar
con cualquier negocio que la tuviera activa antes de borrar sus datos.

## Verificación (obligatoria antes de decir que está listo)

Pegar `referencia/verificacion.js` en la consola del panel, en
`/admin/{negocioId}/ventas/avanzado?vista=plantillas`. Va de a una plantilla
(`__chequear(0..15)`) porque varias juntas pasan el timeout de CDP (45 s): de a
tres entra, de a cinco+ se corta o da falsos positivos (ver más abajo).

Tiene que dar, en **escritorio y celular**: `rotas: 0`, `desborda: false`,
`ocultas: 0`. Cualquier otra cosa es un bug, no un detalle.

**La pestaña tiene que estar ADELANTE mientras corre.** En una pestaña de fondo
Chrome congela los timers y el IntersectionObserver: el reveal no dispara nunca
y `ocultas` da distinto de cero aunque no haya nada roto. El script avisa —
chequear `document.visibilityState === 'visible'` antes de creerle al número.

**Ni siquiera con la pestaña adelante, de a cinco o más seguidas da confiable**:
un `__chequear` puede devolver "sin marco" o `ocultas` de más por una
condición de carrera entre clicks — antes de reportar un bug real, repetir esa
plantilla SOLA.

**Sin backend a mano**, la pantalla corre sola: una página temporal en
`apps/web/src/pages/` que devuelva `<PlantillasConfig onVolver={() => {}} />`
alcanza — no llama a la API con éxito, y `useAuth`/`panelGetAppearance` fallan
en silencio (la vitrina sigue andando, solo no hay ninguna enganchada). Borrarla
antes de commitear.

**Con el Browser pane oculto la página no hace layout**: el primer `.click()`
programático no hace nada y `getBoundingClientRect()` da todo en cero. Frontear
la pestaña y sacar un screenshot una vez destraba el layout; después el resto
del chequeo corre igual con el pane escondido.

**Para sacar capturas**, apagar el movimiento primero, si no el screenshot se
corta por timeout y el carrusel aparece a mitad del fade:

```js
const s = document.createElement('style')
s.textContent = '.pl-slide{animation:none!important;opacity:1!important}.pl-marquee-track{animation-play-state:paused!important}.pl-reveal{opacity:1!important;transform:none!important;transition:none!important}'
document.head.appendChild(s)
```

Y para que entre la página entera en una captura, `document.documentElement.style.zoom = '0.62'`.

## Errores ya cometidos — no repetirlos

| Error | Por qué pasó | Qué hacer |
|---|---|---|
| Las seis se veían iguales | Se reusó `StorePreview` del panel, que arma siempre la misma página | Cada plantilla tiene su propio bloque de JSX |
| Secciones invisibles en la vista previa | El `IntersectionObserver` con `root: null` mira el viewport, no el marco que scrollea | `scrollParent(el)` como root **y** un `setTimeout` de respaldo que revela sí o sí |
| Una plantilla "Catálogo" | Es otra página del sitio, no una portada | Ver regla 1 |
| Una plantilla de gastronomía entre las de tienda | Se perdió de vista el módulo | Ver regla 2 |
| Hero ilegible en celular | El degradé estaba pensado para el ancho de escritorio | Degradé propio para `movil`, más opaco y más alto |
| Fotos que desentonan | Se asignaron sin mirarlas | Hoja de contactos antes de asignar |
| La tipografía no se aplicaba | `loadFont()` solo conoce las fuentes de Apariencia | Usar `cargarFuentes()` de `piezas.tsx` |
| Fotos repetidas entre plantillas | Dos ids de Unsplash devolvían el mismo archivo | Comparar por `md5sum`, no de memoria |
| El marco mostraba un UUID | El primer segmento de `/admin/{id}/...` es el id, no el subdominio | Sacar el subdominio de la sesión (`useAuth`) |
| Newsletter, testimonios y suscripciones | Se copiaron de tiendas de referencia sin chequear qué genera Órbita | Ver regla 3 |
| El título del hero desbordaba | El carrusel lo dibuja a 132 px, pensado para `3x1` | Título corto; la frase va en `bajada` |
| Hero lavado en las plantillas oscuras | El velo del `Carrusel` era blanco fijo y el título va con `t.text`, casi blanco: sobre una foto clara no se leía | El velo sale de `t.oscuro` (negro para las oscuras, blanco para las claras) |
| Un panel lateral que desbordaba en celular | El contenedor quedó en `flex` row para las dos vistas y los dos hijos no entran en 390 px | Toda estructura de dos columnas necesita su `flexDirection: movil ? 'column' : 'row'` |
| `ocultas: 5` con el reveal andando bien | Se medía `getComputedStyle(...).opacity`, y con la ventana sin pintar Chrome no avanza la transición CSS | Medir la clase `pl-on`, que no depende del compositor |
| Media docena de fotos bajadas como HTML | Eran de `plus.unsplash.com` (Unsplash+), que devuelve 404 en `images.unsplash.com` | Filtrar por host al sacar los ids, y `file --mime-type` después de bajar |
| Cuatro plantillas nuevas de baja al toque | Reusaban `tienda` (mismo esqueleto que Vidriera) y terminaron pareciéndose demasiado — el dueño las dio de baja apenas las vio | Ver regla 4: de acá en más, esqueleto propio por default |
| Casi se enganchó Escaparate asumiendo que `HeroCarousel` real le servía igual que a Vidriera | `HeroCarousel` es UN slide rotando a pantalla completa — Escaparate necesita dos campañas partidas fijas, algo que ese componente no sabe dibujar | `heroPropio: true`: el hero se queda adentro de `Home()` con datos reales, e `Inicio.tsx` saltea su `HeroCarousel` para esa plantilla |
| El hero editable de Escaparate casi termina con un campo nuevo en Apariencia | Se pensó en agregar un "kicker" propio para la maqueta antes de mirar qué campos tiene de verdad `StorefrontHeroSlide` | Reusar el `heroSlides` que YA edita el dueño (mismo editor de Vidriera): sin `kicker` porque Apariencia no lo tiene, y el bloque lo trata como opcional |
| Esta skill decía "es una vitrina, no aplica nada" mientras Vidriera ya se podía activar en producción | El enganche real se hizo en otra sesión/rama y nadie volvió a esta skill a corregirla | Cuando se toque el enganche real, actualizar esta skill en el mismo commit — no en uno aparte |
| `datos.tsx` quedó con `{ {` duplicado al borrar un bloque a mano con `sed`/Python por rango de líneas | El límite superior de un corte incluía la llave de apertura del bloque que se quería sacar, y el límite inferior del otro corte también traía la suya | Después de cualquier borrado por rango de líneas, correr `tsc` antes de dar por terminado — un error de sintaxis en un objeto grande a veces apunta a una línea lejos del problema real |

## Convenciones del repo

- Los archivos son **CRLF** (`core.autocrlf=true`). Un script de Python que
  edite con `\n` rompe los matches: leer con `.replace('\r\n','\n')` y escribir
  con `.replace('\n','\r\n')`.
- Comentarios en **castellano rioplatense**, explicando el *por qué* (sobre todo
  cuando algo costó llegar), no el *qué*.
- Estilos **inline**, como el resto del panel. Solo van al string `CSS` las
  cosas que necesitan clase: hover, animaciones y el reveal.
- Nada de `next/image` acá: son fotos de muestra, `<img>` está bien.
