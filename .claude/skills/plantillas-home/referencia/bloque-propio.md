# Plantillas con bloque propio

Las dieciséis primeras: cada una escribe su `if (p.layout === ...)` en
`homes.tsx` y declara su esquema a mano en `secciones.ts`. Esto es lo que hay
que saber para tocar una, o para escribir una nueva cuando la receta no
alcanza (ver SKILL.md § Cuándo un bloque propio).

## Cómo se aplica a una tienda real

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

**Solo Vidriera y Escaparate van con `soloCuerpo`** (la tienda les pone el
header, el hero y el pie). Las otras veinticuatro marcan
`headerPropio`/`heroPropio`/`piePropio` y se dibujan enteras, con las acciones
reales enchufadas adentro.

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

## Checklist

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

## El header lateral de Circuito

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

