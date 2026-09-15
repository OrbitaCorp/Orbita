---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, mejorar o revisar los diseños alternativos de la PORTADA de una tienda, y el trabajo de enganchar cada una con la tienda real (las dieciseis ya se aplican). Usar cuando el pedido sea agregar plantillas nuevas, rehacer una existente, sumar fotos, enganchar una plantilla a datos reales, o verificar que las plantillas anden. Cubre la arquitectura (tipos/datos/piezas/homes/PlantillasConfig), el contrato de aplicación real (plantillaReal.ts, StorefrontChrome.tsx, PLANTILLAS_ENGANCHADAS, heroPropio/heroGrande), el estándar visual, de dónde salen las fotos, y el chequeo automático de las dieciséis en escritorio y celular. Palabras clave: plantilla, plantillas, home, portada, template, theme, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer, circuito, vera, cobijo, nítida, enganchar, aplicar."
---

# Plantillas de Home

Diseños alternativos **para la portada** de una tienda de Órbita. El dueño las elige
desde el panel: Avanzado → Plantillas de Home → Configurar. Hoy hay **dieciséis**,
todas del módulo tienda, y **las dieciséis se pueden activar de verdad** en un
negocio (ver § Cómo se aplica una plantilla, más abajo).

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

   **Y tampoco DATOS que Órbita no tiene.** Esta es la mitad de la regla que se
   escapó más veces, porque no se ve como una sección inventada sino como un
   texto de relleno: un `−40%` sobre una categoría, un "ENVÍO GRATIS
   +$120.000" en el cintillo, "9 sucursales", "4,9 de puntaje", "Algodón
   orgánico certificado", "Retiro en 2 horas". Nada de eso sale de la base: son
   los textos con los que se diseñó la plantilla, y en una tienda real son
   promesas que el dueño nunca hizo.

   Hay que distinguir **etiqueta** de **afirmación**. "Más vendidos" describe
   la sección y su `porDefecto` está perfecto; "3 CUOTAS SIN INTERÉS" dice algo
   del negocio y va marcada `afirmacion: true` en `secciones.ts` — ver el punto
   8 de § Lo que apareció DESPUÉS. La prueba: leer el texto poniéndole adelante
   *"esta tienda garantiza que…"*. Si suena a algo que Órbita no puede saber,
   es una afirmación.
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

## Cómo se aplica una plantilla a una tienda real (las dieciséis)

Esto NO es una vitrina que no aplica nada — dejó de serlo. **Las dieciséis
tienen el camino completo armado.**

**El interruptor.** `PlantillasConfig.tsx`:

```ts
const PLANTILLAS_ENGANCHADAS = new Set(PLANTILLAS.map(x => x.id))
```

El `Set` quedó porque el gateo sigue existiendo —si mañana se agrega una
plantilla a medio hacer, se la saca de acá y no muestra el botón— pero hoy
están todas. **Ojo:** el backend tiene su propia lista
(`HOME_TEMPLATES_DISPONIBLES` en `set-home-template.dto.ts`); si no coinciden,
el panel ofrece una plantilla que la API rechaza con 400.

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

## El plan: dejar fina cada plantilla, una por una

Las dieciséis ya se pueden activar y se dibujan con su diseño intacto (la
inversión está explicada arriba: la maqueta ES el render real). Lo que queda es
pulirlas de a una. **Premium es la referencia**: es la primera que pasó el
checklist completo de abajo, y cada punto salió de un bug real encontrado
probándola aplicada en una tienda con catálogo de verdad.

Las dieciseis ya pasaron por acá (incluida Circuito, ver `headerLateral` abajo)
y las dieciseis tienen su esquema en `secciones.ts`. El checklist queda como
guía para la próxima plantilla que se agregue, y como lo que hay que revisar
cuando se toque una existente.

### Checklist por plantilla

**A. Que funcione con datos reales**

1. El bloque dibuja su header, su hero y su pie: marcarla con
   `headerPropio`/`heroPropio`/`piePropio` en `datos.tsx` (las catorce ya lo
   están). Vidriera y Escaparate son la excepción histórica: van con
   `soloCuerpo` y la tienda real les pone el chrome.
2. Cada grilla de productos usa `producto(x, i, opts)` (que enruta a
   `acciones.renderProducto`), o al menos `abrir(x)` si la plantilla dibuja SU
   propia tarjeta — el diseño de la tarjeta es parte de lo que la distingue, no
   se reemplaza por la de Órbita; lo que se le enchufa es el click a la ficha,
   que es donde vive el carrito real.
3. Los links/CTAs sueltos pasan a llamar `acciones?.irACatalogo` /
   `irACategoria` / `irAProducto` / `abrirWhatsapp` / `irALink` / `irAInicio`.
4. El nav inventado del header pasa por `navDe(p.links ?? [...], acciones)`:
   con tienda real son los enlaces de Apariencia, y en la vitrina siguen los de
   muestra.
5. **Las secciones de categorías usan `p.categorias`, nunca una lista fija.**
   Premium tenía Anillos/Collares/Aros/Relojes clavadas, así que una tienda de
   ropa mostraba categorías que no vende. Las de muestra van en `datos.tsx`
   (`categorias`), que es lo que pisa `plantillaReal()`. Y la sección no se
   dibuja si no hay ninguna.
6. Cualquier interacción que Órbita no tenga (agregar sin variante, combos,
   calculadoras, "armá tu setup") se saca o se cambia por una real cuando
   `acciones` está presente — no se finge.

**B. Que el chrome sea el de la plantilla, en toda la tienda**

7. **El header no es del home: es de la tienda entera.** Separar el encabezado
   del bloque en una variable y devolverlo con `soloHeader`, y sumar el layout
   a `LAYOUTS_CON_HEADER_PROPIO` (homes.tsx). `StorefrontChrome` lo dibuja en
   catálogo, ficha, carrito y perfil. Sin esto, la ficha de producto sale con
   el header clásico de Órbita mientras la portada tiene el de la plantilla
   (bug reportado con captura en Premium).
8. **El buscador del header tiene que buscar de verdad**: `acciones.renderBuscador`
   cuando está, y el dibujito solo en la vitrina. Lo mismo la marca, que con el
   header en todas las vistas es la única forma de volver al inicio
   (`irAInicio`).
9. **La paleta y la tipografía de la plantilla mandan siempre**, en todas las
   vistas y sin importar el modo oscuro del visitante (`variablesDeTema` en
   `StorefrontChrome`, ya sin el viejo `!isDark`).
10. **La `ProductCard` de todas las páginas recibe el tema**
    (`temaDePlantilla(config?.appearance?.homeTemplate)`). Sin eso cae a su
    rama por defecto y, en una plantilla oscura, los íconos flotantes de
    "agregar" y "ver" salen blancos sobre la tarjeta (bug de "También te puede
    gustar" en la ficha).
11. Si el hero dibuja UN slide y Apariencia deja cargar varios, tiene que rotar
    y traer navegación — ver `navHero` e `iActual` en el cuerpo de `Home()`.
    Ojo: el estado va ahí arriba, sin condicionar; los bloques son ramas del
    mismo componente y un hook adentro de un `if` no es válido.

**C. Que el dueño pueda editarla**

12. Declarar sus secciones propias en `secciones.ts`, **en el orden en que se
    ven en la portada**, con su `porDefecto`. Ese texto vive SOLO ahí: lo leen
    la portada (`txt()`) y el editor (que lo muestra precargado), así no se
    desincronizan.
13. Reemplazar los textos, fotos y números clavados del bloque por `txt()` /
    `activo()`. Todo campo vacío tiene que caer a su `porDefecto`: una tienda
    que no editó nada se ve idéntica a su vitrina.
14. **Sacar del editor lo que esa plantilla no dibuja.** Si trae su propio
    cintillo (`headerPropio`), el anuncio de Apariencia no aplica; si trae su
    propia franja, marcar `usaStats: false` (diez ya lo están). Si no queda
    nada, la pestaña "Contenido" no se muestra. Un interruptor que no mueve
    nada es peor que no tenerlo.
15. Si la plantilla tiene una franja de texto, evaluar el campo `switch` de
    cartelera (como el cintillo de Premium) en vez de dejarla siempre fija.

**D. Antes de darla por lista**

16. Confirmar que `plantillaReal()` cubra todo lo que esa plantilla muestra.
17. Probarla en una tienda real con catálogo de verdad y con los casos límite:
    categorías sin foto, sin cupón, sin stats, hero con menos slides de los que
    espera.
18. `npx tsc --noEmit`, `npx eslint` y el chequeo de `referencia/verificacion.js`
    en las dos vistas — enganchar no exime de verificar la vitrina.

### El header lateral de Circuito

`StorefrontHeader.tsx` sigue sabiendo dibujar solo DOS formas (la de siempre y
`centrado`), pero eso ya no importa: con `soloHeader` cada plantilla pone SU
propio header en todas las vistas.

El caso raro es **Circuito**: su header no es una franja arriba sino una
columna al costado, así que el contenido de la página va a su DERECHA y no
debajo. Se resuelve con `headerLateral: true` en `datos.tsx`
— `StorefrontChrome` arma una fila y mete `children` adentro, en vez de
apilarlos. En celular no aplica: ahí el propio bloque dibuja una barra común
arriba y se apila como el resto, por eso `headerLateral` se mira junto a
`useMovilPlantilla()`. Si aparece otra plantilla con panel lateral, marcarla
igual; no hace falta tocar el chrome.

Ojo con `movil`: el chrome lo tenía clavado en `false`, y eso le servía el
navbar de escritorio —columna de 232px incluida— a quien entraba desde el
teléfono al catálogo o a una ficha. Sale de `useMovilPlantilla()`, que arranca
en `false` para que hidrate igual que el SSR.

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

## Lo que apareció DESPUÉS de dar las dieciséis por terminadas

Las dieciséis pasaron el checklist y se aplicaban con su diseño intacto. Aun
así, probándolas en una tienda real con catálogo de verdad salieron estos
bugs. **Todos son de la misma familia**: algo que la maqueta resolvía con un
valor fijo y que en la tienda real tiene que salir de los datos. Revisar los
cinco puntos de acá abajo en cualquier plantilla nueva, antes de darla por
lista.

### 1. Lo que solo estaba en la portada

`Inicio.tsx` inyectaba `PLANTILLA_CSS` y llamaba a `cargarFuentes()`. Las dos
cosas valían **solo en el home**. En el catálogo y en la ficha:

- Sin `.pl-media .pl-b { position: absolute; opacity: 0 }`, la segunda foto de
  la tarjeta no se apilaba sobre la primera: **se dibujaba al lado**, y el
  crossfade del hover no existía. Se reportó como "se ven dos imágenes en el
  product card" en *También te puede gustar*.
- Sin `cargarFuentes()`, las variables CSS decían la tipografía de la
  plantilla pero el archivo de la fuente nunca se bajaba: caía al fallback.

Las dos viven ahora en `StorefrontChrome`, que envuelve TODAS las vistas.
**Regla: lo que la plantilla necesita para verse bien no puede vivir en
`Inicio.tsx`.** Si la plantilla se ve en otra vista, va en el chrome.

### 2. Fondo clavado + tinta del tema (o al revés)

Dos bugs de contraste, el mismo patrón:

- El velo de "Solo compradores verificados" era
  `rgba(var(--color-bg-raw, 255,255,255), 0.72)` — y **`--color-bg-raw` no
  existe en ningún lado del repo**, así que el fallback blanco se aplicaba
  siempre. Sobre una plantilla oscura quedaba un parche gris ilegible.
- Las flechas de la galería son una pastilla blanca fija (correcto: van sobre
  la foto del producto) pero con `color: var(--color-text)`. En plantilla
  oscura: chevron casi blanco sobre blanco.

**Regla: si el fondo va clavado, la tinta también; si la tinta sale del tema,
el fondo también.** Mezclarlas es lo que rompe. Para velos, `color-mix(in
srgb, var(--color-bg) 78%, transparent)` — que ya es convención del repo.
Y antes de usar una variable CSS, `grep` que esté definida: una var
inexistente no falla, cae al fallback en silencio.

### 3. Datos que el adaptador arma y el bloque no dibuja

`plantillaReal.ts` ya calculaba el precio con transferencia y lo dejaba en
`x.transfer`, pero **once plantillas que dibujan SU PROPIA tarjeta nunca lo
pintaban**. Solo Corralón y Nítida lo hacían.

**Regla: si la plantilla arma su propia tarjeta, tiene que dibujar todo lo que
`aProductoPlantilla()` rellena**, no solo `nombre`/`precio`/`img`. Hoy eso es
`antes`, `transfer` y `variantOptions`. Las que van por `producto()` →
`ProductCard` o por la `Card` de `piezas.tsx` lo heredan gratis — preferirlas.
Y guardar siempre (`{x.transfer && ...}`): sin guarda queda un div vacío
metiendo aire cuando la tienda no tiene ese descuento. En los bloques que
parten celular/escritorio, guardar además con `movil &&` o se duplica.

### 4. Enlaces que no son enlaces

En el pie, los ítems de columna se dibujaban como `<div>` — sin `href` ni
`onClick`. **Ningún enlace del footer navegaba a ningún lado**, en las catorce
plantillas.

**Regla: cualquier cosa que parezca clickeable tiene que serlo.** Después de
enganchar una plantilla, `grep` por `accion="` sin `onAccion`, por `<Boton`
sin `onClick` y por columnas de texto que deberían ser `<a>`. En esta pasada
aparecieron **ocho** `<Titulo>` con un "Ver todo →" a la derecha que no hacía
nada.

### 5. El pie es contenido real, no decoración

El pie era la maqueta entera en producción: categorías que la tienda no tiene,
y un `cierre` clavado en `homes.tsx` — **once plantillas** mostraban cosas
como `CUIT 30-71234567-8`, `Local en Av. Rivadavia 4820` o `Vinoteca en
Palermo` en tiendas de verdad. Un CUIT falso.

Peor: al pie de la plantilla le faltaba lo que `StorefrontFooter` tiene **por
obligación legal** — Términos, Política de privacidad y el botón de
Arrepentimiento/Devolución (RBT-683). En el home de esas catorce no estaban,
aunque en el catálogo y la ficha sí.

**Regla: el pie de una plantilla aporta DISEÑO, nunca contenido.** Las
dieciséis llamadas a `<Pie>` eran idénticas — el "pie propio" era solo color y
tipografía. El contenido lo arma `pieReal()` en `plantillaReal.ts` con las
mismas columnas que `StorefrontFooter`. Si mañana se agrega algo legal al pie
normal, hay que agregarlo también acá.

### 6. Los toggles de Apariencia que la plantilla ignora

"Mostrar footer" no lo respetaban las plantillas con `piePropio`: el que lo
chequeaba era `StorefrontFooter`, que ahí ni se dibuja. Ahora va por
`ocultarPie`.

**Regla: cuando una plantilla reemplaza un componente de Órbita, hereda sus
toggles.** Antes de dar por listo el reemplazo, mirar qué banderas de
Apariencia leía el componente original (`showFooter`, `showSocialFooter`,
`showStatsBar`, `showWhatsapp`…) y pasarlas.

### 7. El navbar es contenido real, igual que el pie

Mosaico dibujaba en su header un `☰` decorativo, la marca y las acciones — y
**ningún enlace**. Desde la portada de una tienda real no había forma de llegar
a Catálogo, a Ofertas ni a las categorías.

**Regla: los enlaces del nav son los MISMOS que el header de Órbita.** Salen de
`acciones.nav` (que arma `navRealDe()` con los `headerLinks` de Apariencia,
categorías `cat:<slug>` incluidas). Lo propio de la plantilla es **cómo se
ven**, no cuáles son — igual que el pie. Y "Estilo de header" de Apariencia
vale aunque haya plantilla activa: `minimal` saca el nav en las catorce a la
vez (resuelto adentro de `navDe()`), `standard`/`centered` ubican. La única
excepción es `centrado`, que para Vidriera es identidad.

### 8. `porDefecto` que promete algo es una mentira en producción

El más caro de todos, y el que más se repitió: **46 campos** en las dieciséis.

Mosaico mostraba `−40%`, `−25%` y `−30%` sobre las categorías de una tienda que
nunca cargó esos descuentos. Casi todas prometen algo en el cintillo
(`3 CUOTAS SIN INTERÉS`, `ENVÍO GRATIS +$120.000`, `GARANTÍA OFICIAL 12 MESES`)
y varias inventan cantidades (`+18.000` clientes, `9` sucursales, `4.100`
piezas, `26` años, `4,9` de puntaje), certificaciones, plazos de entrega y
hasta precios (la lista de Papelería).

El problema **no es el texto, es dónde vive**: `porDefecto` se usa en los dos
mundos. Lo que en la vitrina del panel está bien —vende la plantilla— en una
tienda real es una promesa que el dueño nunca hizo.

**Regla: distinguir ETIQUETA de AFIRMACIÓN.**

- *Etiqueta* ("Más vendidos", "Comprá por categoría", "Ambiente 1"): describe
  la sección. Su `porDefecto` está perfecto.
- *Afirmación* (un descuento, un envío gratis, una cuota, un plazo, una
  cantidad, una certificación, un precio): dice algo del negocio. Va marcada
  con `afirmacion: true` en `secciones.ts`.

`txt()` en `homes.tsx` solo cae al ejemplo de una afirmación cuando **no** hay
`acciones` — y `acciones` existe únicamente en la tienda real, así que la
vitrina se sigue viendo completa. En el editor esos campos van como
*placeholder*, no precargados: con el valor puesto, guardar sin tocarlo
alcanzaría para afirmarlo.

**Al marcar una afirmación, guardar el render.** Con el texto vacío no puede
quedar nada colgado: sin cintillo no se dibuja la franja de color, un par
número+etiqueta se filtra entero (un "años" sin el 26 adelante no dice nada,
y ojo con el orden — la ficha de Nocturno es `[etiqueta, valor]` y filtraba por
la etiqueta), y una banda entera que se queda sin su frase se saca completa en
vez de dejar medio fondo con un botón suelto.

**La prueba rápida:** leé el texto en voz alta poniéndole adelante "esta tienda
garantiza que…". Si suena a algo que Órbita no puede saber, es una afirmación.

### 9. Un control decorativo es peor que no tenerlo

El `☰` de Mosaico, Premium, Bodega y `HeaderCentrado` era un glifo dibujado.
En escritorio **sobraba** —los enlaces ya están a la vista— y en celular era
**peor**: el nav se esconde con `!movil`, así que era el único control que
prometía navegación y no hacía nada. Una tienda sin forma de llegar al catálogo
desde el teléfono.

**Regla: el navbar tiene que funcionar en las dos pantallas.** Si el nav se
esconde en celular, hay que poner `MenuMovil` (piezas.tsx) — panel lateral con
los mismos `acciones.nav`, pintado con el tema de la plantilla. Y si un control
no lleva a ningún lado en esa vista, se saca: no se deja "de adorno".

Dos detalles al usarlo:

- **En la vitrina del panel se queda como el glifo.** Un panel con
  `position: fixed` se escaparía del marco del celular dibujado y taparía el
  panel entero. `MenuMovil` lo resuelve solo mirando `acciones`.
- **Dónde ubicarlo lo dice el header.** En las filas inline va donde estaba el
  nav; en los headers centrados (Crecer, Glow) va absoluto a la izquierda,
  espejando las acciones que ya están absolutas a la derecha.

Y los enlaces necesitan **hover**: sin él la única señal de que son clickeables
es el cursor. La clase compartida es `.pl-nav`, y va por **opacidad +
subrayado, no por color** — así sirve igual en las paletas claras y en las
oscuras sin pedirle a cada plantilla un tono de hover que hoy no define.

### 10. "Rellenar con lo primero que haya" tampoco es contenido real

Al enganchar una plantilla, la tentación es que ninguna sección quede vacía. El
atajo de siempre: tomar las primeras N categorías o los primeros N productos.
Pasó en Nocturno con "Armá tu setup" —los tres pasos eran
`p.categorias.slice(0, 3)`— y **no significa nada**: qué va en un recorrido de
tres pasos es una decisión del dueño, no el orden en que tenga cargadas las
categorías.

**Regla: `slice(0, n)` sirve para una FILA, no para una SELECCIÓN.**

- *Fila* ("Más vendidos", "Destacados"): mostrar los primeros N está bien, el
  criterio es la fila misma.
- *Selección* (tres pasos, un antes/después, una pieza del mes, un combo): lo
  elige el dueño, con el tipo de campo `seleccion`.

`seleccion` (`TipoCampo` en tipos.ts) guarda `cat:<slug>` o `prod:<id>` —con
prefijo, igual que los `headerLinks`, para que una categoría y un producto no
choquen nunca— y el panel dibuja un desplegable con el catálogo real agrupado.
Lo resuelve `elegido()` en `homes.tsx` contra `p.categorias` y `p.catalogo`; si
lo elegido se borró después devuelve `null`, y la tarjeta se saltea en vez de
romperse.

**Pero "no elegido" NO significa "no dibujar la sección".** Ese fue el primer
intento en Nocturno y salió mal: la portada perdía una sección entera y se
reportó como si la hubieran borrado. Una tienda recién configurada tiene TODOS
los campos vacíos — si cada sección elegible desaparece hasta que el dueño la
complete, la plantilla que eligió no se parece a la que vio en la vitrina.

Lo correcto es `lugares(n, seccion, clave)`: lo elegido manda, y los lugares
sin elegir se llenan con el catálogo igual que cualquier otra fila. Ni se
rellena "porque sí" con las primeras N categorías, ni desaparece.

Esto convive con la regla de las afirmaciones (punto 8) sin contradecirla: un
texto que promete algo se calla hasta que lo escriban, porque decirlo sin que
sea cierto es peor que no decirlo. Un lugar de una grilla no promete nada —
mostrar un producto del catálogo ahí es verdad igual. **Callarse aplica a las
afirmaciones, no al layout.**

### 11. Una sección que el dueño tiene que llenar a mano no es una función

La comparativa de Nocturno ("¿Cuál te conviene más?") era una tabla de tres
modelos con sus specs y sus precios, inventada. Al sacarle los datos falsos
quedó como cinco campos de texto libre con formato `etiqueta | col1 | col2 |
col3`. Se sacó entera.

**Regla: si al quitarle lo inventado una sección queda en "escribí vos una
tabla de 5×4", la sección no va.** Órbita no tiene con qué llenarla, y pedirle
eso al dueño para que se vea algo no es una función: es un formulario. Antes de
pelear por conservar una sección, preguntarse qué dato REAL la llena.

### 12. Un número es una afirmación cuando su etiqueta lo vuelve una

El barrido del punto 8 marcó 46 campos pero se salteó dos: los números `12` y
`12` de Nocturno. Vistos solos parecen inocuos —es un número— pero sus
etiquetas decían "meses de garantía" y "cuotas sin interés".

**Regla: en un par valor+etiqueta, mirar los DOS juntos antes de decidir.** Y
marcar el par completo: si solo se marca el valor, la etiqueta queda huérfana
y se dibuja sola.

### 13. Una fila se corta por el ancho de su grilla, no por el largo del array

Ninguna de las trece filas cortaba: se dibujaba `p.productos.map(...)` entero
contra un `cols(4)`. Con cinco destacados quedaba **uno colgado** en una
segunda fila; con tres, **un hueco** a la derecha.

**Regla: `cols(d, m)` y `cuantos(d, m)` van SIEMPRE de a pares.** Si se toca
uno hay que tocar el otro — son el mismo número escrito dos veces, y la única
forma de que la fila cierre.

Ojo con los atajos que tapan el síntoma en vez de arreglarlo: Mosaico hacía
`[...p.productos, p.productos[0]]` para llenar el quinto hueco —el mismo
producto dos veces en la misma fila— y Circuito dibujaba
`[...p.productos].reverse()` para que su segunda fila pareciera otra. Las dos
cosas se ven, y se ven mal.

### 14. `p.productos` son los DESTACADOS, no el catálogo

Rellenar toda la portada con `p.productos` hace que la tienda muestre siempre
los mismos cinco productos, sección tras sección.

**Regla: solo salen de destacados las secciones que lo DICEN.** El "Destacados"
y el "Más vendidos" de Vidriera, sí. El resto sale de `fila(n, clave)`, que
toma del catálogo (`p.catalogo`) en un orden barajado, y la `clave` de sección
desplaza el arranque para que dos secciones de la misma portada no muestren lo
mismo.

**El barajado no puede usar `Math.random()`.** Tiene que dar lo mismo en el
servidor y en el cliente —si no, React se queja al hidratar— y no puede
rebarajarse en cada render. Se ordena por un hash del slug: da un orden
estable para esa tienda, distinto para cada una, y sobrevive al `useMemo`.

Las listas verticales y los carruseles quedan afuera: ahí no hay hueco que
tapar y el largo es parte del diseño (Escaparate lista tres productos porque
son los tres puntos sobre la foto).

### 15. Un dato que el dueño escribe a mano se desactualiza solo

La lista escolar de Papelería eran cinco renglones `producto | precio`
escritos a mano. El precio queda **pegado en la portada**: el dueño cambia el
precio del producto y la home sigue mostrando el viejo.

**Regla: si el dato ya vive en el catálogo, no se escribe — se elige.** Campo
`seleccion`, y el nombre y el precio salen del producto. Vale para cualquier
sección que muestre productos "de ejemplo": listas sugeridas, combos,
recomendados, pasos.

Corolario: un campo de texto con formato (`producto | precio`, `etiqueta |
col1 | col2`) casi siempre es señal de que falta un tipo de campo. Si hay que
explicar una sintaxis en el `help`, revisar si no debería ser un selector.

### 16. Las categorías son las que son: la grilla se reparte, no se rellena

Papelería dibujaba `cols(6)` con cuatro categorías: **dos huecos a la
derecha**. Y al revés también — un `.map()` sin cortar manda la quinta a una
segunda fila a medio llenar. Pasaba en NUEVE plantillas.

**Regla: `colsDe(max, cuantas, movil)` para toda grilla de categorías**, y un
`.slice(0, max)` que la acompañe.

La diferencia con los productos importa: una fila de productos siempre se
puede llenar —`fila()` toma del catálogo— pero **las categorías no se
inventan**. Si hay cuatro, la fila se reparte entre cuatro. Escaparate ya lo
resolvía a mano con `Math.min(cats.length, N)`; ahora es un helper y vale para
todas.

### 17. Si el dato ya está en Configuración, no se pide de nuevo

El botón "Mandar mi lista" del banner de campaña era un `<span>` sin
`onClick`. Lo que corresponde es que abra el WhatsApp del negocio — y el
número **no se carga en la plantilla**: ya está en Configuración.

**Regla: la plantilla edita CONTENIDO propio, nunca datos del negocio.** El
texto del botón sí es de la plantilla y va editable; el número de WhatsApp, el
email, el horario y el CUIT no — tenerlos en dos lados garantiza que un día no
coincidan. Lo mismo que ya vale para el pie (punto 5).

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

| Dos fotos a la vez en la tarjeta, y el hover sin efecto | `PLANTILLA_CSS` se inyectaba solo en `Inicio.tsx`: fuera del home, `.pl-b` no era `absolute` ni `opacity: 0` | El CSS y `cargarFuentes()` van en `StorefrontChrome`, que envuelve todas las vistas |
| Un parche gris ilegible sobre las plantillas oscuras | El velo usaba `var(--color-bg-raw, 255,255,255)` y esa variable NO EXISTE en el repo: caía siempre al blanco | `grep` que la variable esté definida antes de usarla; para velos, `color-mix` sobre `var(--color-bg)` |
| Chevrons blancos sobre pastilla blanca | Fondo clavado (`rgba(255,255,255,0.92)`) con tinta del tema (`var(--color-text)`) | Si el fondo va clavado, la tinta también; si la tinta sale del tema, el fondo también |
| Once plantillas sin el precio con transferencia | El adaptador ya lo dejaba en `x.transfer`, pero las que dibujan SU tarjeta nunca lo pintaban | Una tarjeta propia debe dibujar TODO lo que `aProductoPlantilla()` rellena, guardado con `{x.campo && ...}` |
| Ocho "Ver todo →" que no hacían nada | `<Titulo>` con `accion` pero sin `onAccion` — el enlace se dibuja igual | `grep` por `accion="` sin `onAccion` y por `<Boton` sin `onClick` después de enganchar |
| Un CUIT falso en el pie de tiendas reales | El `cierre` estaba clavado en `homes.tsx` (once plantillas), y las columnas eran las de la maqueta con `<div>` en vez de `<a>` | El pie aporta diseño, nunca contenido: lo arma `pieReal()` en `plantillaReal.ts` |
| Faltaban Términos, Privacidad y Arrepentimiento en el home | Con `piePropio` no se dibuja `StorefrontFooter`, que es quien los traía por obligación legal | Al reemplazar un componente de Órbita, replicar lo legal Y heredar sus toggles de Apariencia |

| Mosaico sin ningún enlace en el header | Dibujaba el `☰` decorativo, la marca y las acciones, pero nunca `p.links` | El nav sale de `acciones.nav`, igual que el pie: la plantilla aporta cómo se ve, no cuáles son |
| "Estilo de header" de Apariencia sin efecto con plantilla activa | `navCentrada`/`sinNav` se forzaban a false cuando había `homeTemplate` | El ajuste vale siempre; solo `centrado` lo puede pisar una plantilla que lo declare |
| −40% / −25% / −30% sobre categorías de una tienda sin descuentos | El `porDefecto` de la maqueta se usa igual en la vitrina y en la tienda real | Marcar el campo con `afirmacion: true`: `txt()` deja de caer al ejemplo cuando hay `acciones` |
| Una franja de color vacía arriba de todo | Al vaciarse el cintillo el `<div>` contenedor seguía dibujándose | Toda afirmación necesita su guarda: sin texto, la sección entera no va |

| Una hamburguesa que no abría nada | Se dibujó el `☰` como parte del diseño del header, sin menú detrás | `MenuMovil` de piezas.tsx; y si no lleva a ningún lado en esa vista, se saca |
| Sin navegación en celular | El nav va con `!movil` en casi todas y no había reemplazo | El navbar tiene que funcionar en las dos pantallas — es parte del checklist |
| Enlaces del nav sin hover | Los estilos van inline y el hover necesita una clase | `.pl-nav`, por opacidad y subrayado (no por color: tiene que servir en paletas claras y oscuras) |

| "Armá tu setup" con las tres primeras categorías | Al enganchar, se rellenó la sección con `slice(0, 3)` para que no quedara vacía | Campo `seleccion` para elegirlo, y `lugares()` para llenar lo que no se eligió |
| Una sección elegible que desaparecía de la portada | Se escondió "hasta que el dueño elija", y una tienda nueva tiene todo vacío | Callarse es para las AFIRMACIONES, no para el layout: `lugares()` llena con el catálogo |
| Una sección que pedía escribir una tabla de 5×4 a mano | Se le quitó el contenido inventado pero se quiso conservar la sección igual | Si lo que queda es un formulario, la sección no va — preguntarse qué dato REAL la llena |
| Dos afirmaciones que el barrido no marcó | El valor era `12`, que parece un número inocente; la promesa estaba en la etiqueta | En un par valor+etiqueta, mirar los dos juntos y marcar el par completo |

| Un producto colgado solo en una segunda fila | `p.productos.map()` completo contra un `cols(4)` — la fila no cortaba por el ancho de la grilla | `cols(d, m)` y `cuantos(d, m)` van siempre de a pares |
| El mismo producto dos veces en la misma fila | Mosaico hacía `[...p.productos, p.productos[0]]` para tapar el quinto hueco | Tapar el síntoma se ve; cortar por `cuantos()` lo arregla |
| Toda la portada con los mismos cinco productos | `p.productos` son los destacados, y se usaban para rellenar cada sección | Solo las secciones que dicen "destacados" salen de ahí; el resto, `fila(n, clave)` sobre el catálogo |

| Un precio escrito a mano en la portada | La lista sugerida se cargaba como texto `producto \| precio` | Si el dato vive en el catálogo, se elige (`seleccion`), no se escribe |
| Dos huecos a la derecha en la grilla de categorías | `cols(6)` fijo contra las categorías que el negocio tenga (cuatro) | `colsDe(max, cuantas, movil)` + `.slice(0, max)`: la grilla se reparte entre las que haya |
| Un botón de WhatsApp que no abría nada | Se dibujó como `<span>` decorativo al maquetar la sección | Que abra `acciones.abrirWhatsapp`; el número sale de Configuración, no se pide en la plantilla |

## Convenciones del repo

- Los archivos son **CRLF** (`core.autocrlf=true`). Un script de Python que
  edite con `\n` rompe los matches: leer con `.replace('\r\n','\n')` y escribir
  con `.replace('\n','\r\n')`.
- Comentarios en **castellano rioplatense**, explicando el *por qué* (sobre todo
  cuando algo costó llegar), no el *qué*.
- Estilos **inline**, como el resto del panel. Solo van al string `CSS` las
  cosas que necesitan clase: hover, animaciones y el reveal.
- Nada de `next/image` acá: son fotos de muestra, `<img>` está bien.
