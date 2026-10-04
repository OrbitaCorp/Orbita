---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, modificar o revisar los diseños alternativos de la PORTADA de una tienda. Usar cuando el pedido sea agregar una plantilla nueva, cambiar el diseño o el editor de una existente, sumar un bloque al vocabulario de recetas, sumar fotos, o verificar que las plantillas anden (modo check). Cubre el modelo (diseño fijo de la plantilla + contenido editable por el dueño), las recetas y su editor generado, el modo check automático (`pnpm test plantillas`), el contrato con la tienda real (plantillaReal.ts, StorefrontChrome.tsx), el estándar visual y las fotos. Palabras clave: plantilla, plantillas, home, portada, template, theme, receta, bloque, check, verificar, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer, circuito, vera, cobijo, nítida, lienzo, pulso, terracota, base, carbón, bloque, sobrio, roble, pétalo, sello."
---

# Plantillas de Home

Diseños alternativos **para la portada** de una tienda de Órbita. El dueño las
elige desde el panel: Avanzado → Plantillas de Home. Hay **veintiséis**, todas
del módulo tienda, y todas se aplican de verdad en un negocio.

## El modelo, en cuatro líneas

1. **El diseño es de la plantilla y es fijo.** Paleta, tipografías, radio,
   sombra, tipo de hero, forma de las categorías, orden de los bloques. El
   dueño no los cambia: eligió la plantilla justamente por eso.
2. **El contenido es el de Apariencia.** Todo lo que el dueño puede prender,
   apagar y cargar en Configuración → Apariencia tiene que poder hacerlo igual
   con una plantilla activa, con los mismos datos. La plantilla decide dónde
   va cada cosa y cómo se ve; no decide qué hay. Ver § El estándar.
3. **La funcionalidad es la de cualquier tienda de Órbita.** Buscador, cuenta,
   carrito, los enlaces del menú, el pie con sus legales. Una plantilla no
   agrega un ícono ni una página que la tienda no tiene, y no saca ninguno.
4. **Una plantilla no está lista hasta que pasa el modo check.** No alcanza
   con que la vitrina se vea bien: ahí siempre se ve bien.

## El estándar

Una plantilla que traía una sola fila de productos, "Top ventas", no le servía
a un negocio que recién empieza: no vendió nada, y no podía cambiarla. De ahí
sale la regla: **toda plantilla ubica todos los bloques de Apariencia**, y el
dueño decide cuáles se ven.

| Bloque | Se prende y se carga en | Cuándo no se dibuja |
|---|---|---|
| Anuncio (fijo o cartelera) | Contenido → Textos de tu tienda | Apagado o sin texto |
| Hero | Hero | Nunca: sin slides, uno neutro con el nombre del negocio |
| Oferta con cuenta regresiva | Avanzado → Oferta relámpago | Sin una activa |
| Barra de estadísticas | Contenido → Barra de estadísticas | Apagada o sin ítems |
| Categorías | Contenido → Sección de categorías | Apagada o sin categorías |
| Destacados | Contenido → Filas de productos | Apagado, o ningún producto con la estrella |
| Nuevos ingresos | ídem | Apagado, o la tienda no tiene productos |
| Recomendados | ídem | Apagado, o nada con reseñas ni en oferta |
| Top ventas | ídem | Apagado, o todavía no hubo ventas |
| Banner parallax | Contenido → Banner con efecto parallax | Apagado o sin foto |
| Marcas | Contenido → Marcas con las que trabajás | Apagado o sin marcas |
| Video | Contenido → Video en tu tienda | Apagado o sin un link válido |
| WhatsApp | Contenido → WhatsApp | Apagado o sin número en Contacto |
| Buscador | Contenido → Barra de búsqueda | Apagado |
| Pie | Pie de página | Nunca: lleva los legales |

Cómo funciona: `plantillaReal()` lee Apariencia y resuelve los interruptores
**antes** del render (`contenidoDeApariencia`). Un estante apagado llega vacío;
un parallax apagado o sin foto no llega. El bloque dibuja lo que hay, y una
plantilla nueva respeta los interruptores sin escribir nada.

- Los cuatro estantes se llenan con lo mismo que el home clásico: los pide
  `Inicio.tsx` y llegan en `p.estantes`. No se barajan: "Top ventas" es un ranking.
- En la **vitrina** no hay Apariencia: se ven Destacados y Nuevos ingresos con
  los productos de muestra, y el `cartel` como anuncio. Parallax, marcas, video
  y estadísticas no se ven ahí (no hay nada cargado), igual que en una tienda nueva.
- Las **secciones propias** siguen existiendo (`franja`, `campana`, "El taller"
  de Premium): son de la plantilla y se editan en la pestaña Secciones. Lo que
  no puede pasar es que una sección propia duplique un dato de Apariencia.
  Las recetas tenían un cintillo y un parallax propios; se unificaron, y lo
  que una tienda ya había cargado ahí se sigue mostrando y se pasa a los
  campos de Apariencia al abrir el editor (`pasarAApariencia`).

### Cómo lo cumple cada tipo de plantilla

**Con receta:** declara todos los bloques en su lista (el check falla si falta
uno). El lugar y el estilo de cada uno son su diseño.

**Con bloque propio:** dibuja con su diseño lo que la distingue, y lo demás
sale de piezas comunes de `Home()`:

- **Su fila de productos no tiene un estante fijo.** La sección se marca con
  `estante: 0` en `secciones.ts` (`1` para una segunda fila, como en Vidriera
  y Circuito). `plantillaReal()` le pasa en `p.productos` el **primer estante
  con productos** —Destacados, si no Nuevos ingresos, si no Recomendados, si no
  Top ventas— y en `p.productosSecundarios` el siguiente. Así la fila que
  distingue a la plantilla nunca queda vacía porque el negocio no marcó
  destacados o todavía no vendió.
- **Su título sale del estante que le tocó** si el dueño no escribió uno
  (`txt()` lo resuelve solo con `estante`). En el editor esos dos campos van
  vacíos, con la aclaración, en vez de precargar "Top ventas".
- **`{resto(n)}`** antes del cupón o del pie dibuja lo que el bloque no tiene:
  los estantes que sobran (`n` es cuántas filas propias tiene), el parallax,
  las marcas y el video, con el tema de la plantilla. `resto(n, true)` suma las
  categorías, para la que no tiene una sección propia (Glow).
- **`aviso` / `avisoCartelera`** en lugar de un cintillo propio: es el anuncio
  de Apariencia. `{barraAnuncio}` para la que no tenía cintillo.
- **`{buscador()}`** debajo del header: el buscador en celular.
  `buscador(true)` si la barra tampoco lo trae en computadora.
- **`hayFila`, `hayFila2`, `(p.categorias ?? []).length > 0`, `!sinWpp`**
  delante de cada sección: sin productos, sin categorías o sin WhatsApp, la
  sección no se dibuja. Un título arriba de una grilla vacía es peor que nada.

**La oferta con cuenta regresiva** (paquete Avanzado) también entra: la dibuja
la tienda (`acciones.renderOferta`) y la plantilla la ubica — pegada al hero en
las recetas, al principio de `resto()` en las de bloque propio.

**Estado:** las veintiséis cumplen el estándar y `PENDIENTES` está vacía.
Sigue afuera la cantidad de productos de "Nuevos ingresos": con plantilla cada
fila es de un renglón. Las filas que agrega `resto()` en un bloque propio
salen con el nombre del estante, sin título editable.

### Nada de la maqueta en una tienda real

La marca, la bajada, los productos, las categorías y el hero de muestra son
para la vitrina. `plantillaReal()` los pisa **siempre**, también cuando el
negocio no cargó los suyos:

- sin bajada, el pie no escribe ninguna (antes quedaba la de la maqueta);
- sin slides, un **hero neutro** con el nombre del negocio, su bajada y un
  botón al catálogo, sobre un degradé del primario de la plantilla
  (`heroNeutro`). Sin hero no se deja: en varias es media portada;
- un texto de muestra que solo tiene sentido en el rubro de la maqueta se
  calla con `afirmacion` (los maridajes de Bodega) o se cambia con
  `porDefectoReal`.

El check busca en la portada de la tienda de prueba cada uno de esos datos de
muestra.

## Las seis reglas que no se negocian

1. **La ESTRUCTURA de catálogo, ficha, carrito, checkout y perfil no cambia.**
   Una plantilla cambia la portada, y hereda su paleta, su tipografía y su
   header al resto de la tienda (`StorefrontChrome.tsx`). Si la propuesta es
   "una grilla con filtros distinta", eso es el catálogo: no va.
2. **Una plantilla pertenece a UN módulo.** Hoy todas son de tienda. No mezclar
   una carta de restaurante entre ellas.
3. **Solo lo que Órbita realmente tiene.** Secciones: cartel, hero, barra de
   stats, categorías, filas de productos, banner de WhatsApp y pie. No hay
   newsletter, testimonios, reseñas ni suscripciones. Y tampoco **datos**
   inventados: un "−40%", un "envío gratis desde $80.000", "9 sucursales", un
   CUIT. En una tienda real son promesas que el dueño nunca hizo.
4. **Tienen que verse MUY distintas entre sí.** No alcanza con cambiar el
   color (ver § Que no se parezca a otra).
5. **Comprar y entrar a la cuenta es igual en todas.** Cuenta con "Mis
   pedidos" adentro y carrito con contador. Cambia cómo se ve, no qué hace.

6. **En celular tiene que quedar tan bien como en computadora.** La mayoría de
   los clientes de una tienda entra desde el teléfono: la versión de celular no
   es la de escritorio achicada, se diseña. Ver § Celular.

## Dónde vive todo

```
apps/web/src/modules/ventas/panel/avanzado/plantillas/
  tipos.ts             Tema, Plantilla, Receta/BloqueReceta, CampoSeccion, AccionesHome
  datos.tsx            PLANTILLAS[]: tema, receta y datos de muestra de cada una
  homes.tsx            Home(): el render. Rama `if (p.receta)` + un bloque por layout propio
  piezas.tsx           CSS, componentes compartidos, FUENTES_PLANTILLAS, marcos Notebook/Celular
  secciones.ts         El editor: esquemaDeReceta() y SECCIONES_POR_PLANTILLA
  plantillas.test.ts   El modo check
  PlantillasConfig.tsx Galería y detalle en el panel
apps/web/public/plantillas/            Fotos de muestra, locales (van a git)

apps/web/src/modules/ventas/cliente/inicio/
  Inicio.tsx           La portada real: dibuja el MISMO Home() con datos reales
  plantillaReal.ts     Adaptador: catálogo/categorías/stats reales → `Plantilla`
apps/web/src/components/storefront/
  StorefrontChrome.tsx Envuelve TODAS las páginas: header, paleta, fuentes y CSS de la plantilla
  ProductCard.tsx      La tarjeta real. Con `tema` se dibuja en el vocabulario de la plantilla
apps/web/src/modules/ventas/panel/configuracion/Apariencia.tsx
                       Con `soloContenido`, es el editor de la plantilla activa
apps/api/src/businesses/dto/set-home-template.dto.ts
                       HOME_TEMPLATES_DISPONIBLES: la lista que acepta la API
```

La pieza central: **el mismo `Home()` dibuja la vitrina del panel y la tienda
real.** Lo único que cambia son los datos (`plantillaReal()` pisa los de
muestra) y `acciones`, que solo existe en la tienda y trae la navegación, el
carrito y la tarjeta de producto de verdad.

## Crear una plantilla

El camino por defecto es **con receta**: la plantilla declara qué bloques
muestra y en qué orden, y el render y el editor ya existen.

### 1. Elegir los bloques

```ts
receta: {
  header: 'centrado',                              // o 'izquierda' (default)
  bloques: [
    { t: 'hero', estilo: 'partido' },
    { t: 'stats' },
    { t: 'categorias', estilo: 'altas', cols: 4 },
    { t: 'fila', id: 'destacados', fuente: 'destacados', cols: 4 },
    { t: 'franja', estilo: 'apilada' },            // propio de esta plantilla
    { t: 'fila', id: 'nuevos', fuente: 'nuevos', estilo: 'tira' },
    { t: 'parallax' },
    { t: 'fila', id: 'recomendados', fuente: 'recomendados', cols: 4 },
    { t: 'fila', id: 'topVentas', fuente: 'topVentas', cols: 4 },
    { t: 'marcas' },
    { t: 'video' },
    { t: 'whatsapp' },
  ],
}
```

| Bloque | Variantes | De dónde sale |
|---|---|---|
| `hero` | `pleno` · `partido` · `minimo` · `tarjeta` | Slides de Apariencia, más un segundo botón propio |
| `stats` | — | Barra de estadísticas de Apariencia |
| `categorias` | `grilla` · `pastillas` · `tira` · `altas` | Las categorías del negocio. El encabezado es editable |
| `porCategoria` | `cuantas`, `porFila` | Productos de cada categoría. Cuenta como `categorias` |
| `fila` | `grilla` · `tira` · `sangre`; `fuente`: uno de los cuatro estantes | El estante. El encabezado es editable |
| `parallax` | — | Banner parallax de Apariencia |
| `marcas` | — | Marcas de Apariencia |
| `video` | — | Video de Apariencia |
| `whatsapp` | — | Título, bajada y botón propios. El número sale de Configuración |
| `franja` | `plena` · `filete` · `cartelera` · `apilada` | **Propio.** Título, bajada y botón. Vacía, no se dibuja |
| `campana` | — | **Propio.** Foto, volanta, título, texto, botón |

**Una receta lleva todos los del estándar:** `hero`, `stats`, `categorias` (o
`porCategoria`), una `fila` por cada estante (`destacados`, `nuevos`,
`recomendados`, `topVentas`), `parallax`, `marcas`, `video` y `whatsapp`. El
check falla si falta uno. Lo que diferencia una receta de otra es el orden, el
estilo de cada bloque y los propios que sume en el medio.

Cada `fila` lleva un `id` distinto: es la clave de su encabezado editable. No
cambiar el `id` de una fila de una plantilla ya publicada: lo que el dueño
escribió se busca por ahí.

### 2. Definir el tema

```ts
tema: {
  bg, surf, soft, text, muted, border,   // fondo, superficie, fondo suave, texto, apagado, borde
  primary, onPrimary, accent,            // botón, texto del botón, acento
  fh: serif('Cormorant Garamond'), fb: sans('Lato'),
  radio: 0, oscuro: false,
  sombra: '0 18px 40px -18px rgba(15,23,42,0.28)',
}
```

- Las fuentes tienen que estar en `FUENTES_PLANTILLAS` (`piezas.tsx`), con los
  pesos que se usan. `loadFont()` de `lib/fonts.ts` NO sirve: solo conoce las
  de Apariencia. Antes de sumar una, comprobar que exista:
  `curl -o /dev/null -w "%{http_code}\n" "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700"`
- Contraste mínimo: texto sobre fondo 4.5, texto del botón sobre el primario 3.
  El check lo mide.

### 3. Que no se parezca a otra

Cuatro plantillas que reusaban el esqueleto de Vidriera se dieron de baja por
parecerse demasiado. Una receta corre el mismo riesgo si solo cambia el color.
Lo que separa dos recetas de verdad, y hay que mover **varias a la vez**:

- el tipo de hero y la forma de las categorías;
- el ritmo de las filas (grilla, tira, a sangre) y el orden de los bloques;
- el radio (0 contra 24) y la sombra (`none` contra una dura tipo `6px 6px 0`);
- sobre todo, el par de tipografías: una serif fina sobre papel y una
  condensada en mayúsculas sobre negro no se parecen aunque compartan render.

Para paleta, tipografías y estilo, invocar la skill `ui-ux-pro-max` (regla del
repo para toda tarea de UI). Referencia del dueño: travistrend.com.ar y las
theme stores de Shopify/Tiendanube. Y su criterio: minimalista, sin acento por
sección ni badges en mayúscula; el color solo donde es el dato o se clickea.

### 4. Cargar los datos de muestra

En `datos.tsx`: `id`, `nombre`, `para`, `queCambia`, `secciones[]`, `marca`,
`tagline`, `layout: 'receta'`, `headerPropio`/`heroPropio`/`piePropio` en
`true`, `cartel`, `links`, `categorias`, `slides[]`, `productos[]`.

- `queCambia` se muestra en el panel: que diga qué la hace distinta, no
  adjetivos. Sin comparaciones que envejecen ("la más sobria de las X").
- La foto de `slides[0]` es la portada en la galería: **única** entre todas.
- Fotos: ver `referencia/fotos.md`. Bajarlas, mirarlas en una hoja de
  contactos y recién ahí asignarlas.
- **Si la plantilla es genérica** (no es de un rubro), ningún texto de muestra
  puede nombrar un rubro: ni `cartel`, ni `links`, ni categorías, ni `tagline`.

### 5. Registrarla en la API

Sumar el id a `HOME_TEMPLATES_DISPONIBLES`
(`apps/api/src/businesses/dto/set-home-template.dto.ts`). Sin esto el panel la
ofrece y la API la rechaza con 400. **Tocar ese archivo obliga a desplegar la
API a mano** (`./deploy/deploy.sh`, ver CLAUDE.md): un push a `main` no alcanza.

### 6. Pasar el check y mirarla

Ver § El modo check. Después, actualizar el conteo de plantillas en esta skill
y en el comentario de arriba de `PlantillasConfig.tsx`.

## Celular

Cada bloque se escribe dos veces, una por pantalla. `Home()` recibe `movil` y
el corte es a 768px; en la tienda sale de `useMovilPlantilla()`.

**Lo que tiene que cumplir toda plantilla en celular:**

- **Nada desborda a lo ancho.** Ni una barra de scroll horizontal en la página.
  Lo que no entra se apila o va en una tira que scrollea adentro de su bloque.
- **Toda estructura de dos columnas se apila**: `flexDirection: movil ?
  'column' : 'row'`, o `gridTemplateColumns: movil ? '1fr' : '1fr 1fr'`.
- **Las grillas bajan a dos columnas** (`cols(d, 2)`), o a una si la tarjeta
  es horizontal. Las tiras se quedan como tiras.
- **Se puede navegar.** Si los enlaces del header no entran, va `MenuMovil`.
  Nunca un `☰` dibujado.
- **Se puede buscar, entrar a la cuenta y ver el carrito**, igual que en
  computadora. El buscador va en un renglón propio debajo de la barra si no
  entra al lado de la marca.
- **El hero se lee.** El título no desborda (frase corta; lo largo va en la
  bajada) y el velo sobre la foto se piensa para el formato parado, que deja
  el texto sobre otra parte de la imagen.
- **Tipografía y aire propios**: los títulos de 60px de escritorio bajan a
  30–38, y los márgenes de 40px a 16.
- **Lo que se toca, se puede tocar**: botones y enlaces de 40px de alto o más,
  sin depender del hover (la segunda foto de la tarjeta y los subrayados no
  existen en un teléfono).
- **El parallax se apaga solo** (`.pl-parallax`): en celular la foto fija se
  ve mal y varios navegadores no la soportan.

**Qué revisa el check y qué no.** Corre todo en las dos pantallas, así que ve
si en celular falta el menú, el buscador, la cuenta, un estante o un legal. No
mide tamaños: el desborde, un título cortado o un botón chico solo se ven
mirando. Por eso cada plantilla nueva o modificada se mira en **Celular** en la
vitrina (Avanzado → Plantillas → Ver cómo queda) y aplicada en una tienda desde
un teléfono de verdad, no solo achicando la ventana.

## Modificar una plantilla

| Qué se quiere cambiar | Dónde |
|---|---|
| Colores, tipografía, radio, sombra | `tema` en `datos.tsx` |
| Orden o variante de los bloques (receta) | `receta.bloques` en `datos.tsx` |
| Cómo se ve un bloque en TODAS las recetas | rama `if (p.receta)` de `homes.tsx` |
| Qué campos ofrece el editor de un bloque de receta | `esquemaDeReceta()` en `secciones.ts` |
| Una plantilla de bloque propio | su `if (p.layout === '…')` en `homes.tsx` + su esquema en `secciones.ts` |
| Fotos o textos de la vitrina | `datos.tsx` (muestra) o `porDefecto` en `secciones.ts` |
| Datos reales que llegan a la portada | `plantillaReal.ts` |
| Header, paleta o fuentes fuera de la portada | `StorefrontChrome.tsx` |

Tocar la rama de receta o `esquemaDeReceta()` cambia las diez plantillas con
receta a la vez. Es lo que se busca, pero hay que mirar más de una después.

**Sumar un bloque al vocabulario** (cuando varias plantillas lo van a usar):
el tipo en `BloqueReceta` (`tipos.ts`), su render en la rama de receta, y sus
campos en `esquemaDeReceta()`. Solo si lo llena un dato que Órbita ya tiene.

**Si Apariencia suma un contenido nuevo**, entra al estándar: el dato en
`contenidoDeApariencia()` (`plantillaReal.ts`), el bloque en `BLOQUES_ESTANDAR`
(`tipos.ts`) y en la rama de receta, su lugar en las diez recetas, su tarjeta
en la pestaña Contenido, y su prueba de prendido/apagado en el check.

## El editor: qué puede tocar el dueño

Con la plantilla activa, Configuración → Apariencia queda bloqueada y el
dueño edita desde Avanzado → Plantillas de Home:

| Pestaña | Qué edita | De dónde sale |
|---|---|---|
| Hero | Slides: foto, título, bajada, botón, enlace. Solo imagen completa | El mismo `heroSlides` de Apariencia. `heroMaxSlides` lo limita |
| Header | Logo y enlaces del menú | `headerLinks` de Apariencia |
| Secciones | Los encabezados de las filas y los bloques propios | `seccionesDe(id)`: de la receta, o declarado a mano |
| Contenido | Los interruptores y las tarjetas de Apariencia: anuncio, estadísticas, categorías, estantes, buscador, WhatsApp, parallax, marcas, video | Las mismas columnas que Apariencia, en las veintiséis. La barra de estadísticas solo en las que la dibujan (`usaStats`) |
| Pie | La descripción bajo el logo y si se muestran las redes | Las columnas y los legales los arma `pieReal()`, no se editan |

Las tarjetas de Contenido son las mismas piezas de `Apariencia.tsx`
(`secTextos`, `secEstadisticas`, `secParallax`, `secMarcas`, `secVideo`): si
Apariencia suma un contenido nuevo, se suma como bloque al estándar y su
tarjeta se muestra acá, no se escribe un formulario aparte.

Lo guardado va a `homeTemplateData.secciones[idSeccion][idCampo]`, un JSON por
negocio: sumar un campo no necesita migración.

### El editor ofrece exactamente lo que la plantilla dibuja

Ni un campo de más ni uno de menos. Un campo que se carga y no se ve es una
promesa del panel que la tienda no cumple, y es fácil de escribir sin darse
cuenta: el editor y el bloque están en archivos distintos. Pasó en Lienzo (el
editor pedía la imagen de cada slide y su hero no dibujaba ninguna), y la
prueba que salió de ahí encontró 29 casos más en 20 plantillas.

Lo que hay que cuidar al tocar un bloque o el editor:

- **Hero:** título, bajada, botón e imagen de cada slide se ven en la portada.
  Con más de un slide, rota y trae con qué navegarlo (`navHero`), o cada uno
  tiene su lugar fijo y la plantilla declara `heroMaxSlides` (ahí el editor
  dice "Imágenes del hero" y no deja cargar de más).
- **La imagen del slide es opcional en todas.** Sin imagen el hero se dibuja
  igual, sobre un degradé del primario. En un hero que por diseño es solo
  texto (el `minimo` de las recetas) la foto se muestra detrás del texto si el
  dueño subió una (`Slide.fotoPropia`), y sin foto queda el diseño original.
- **Secciones:** cada campo del esquema cambia algo. En una receta el
  formulario sale de la variante del bloque: una franja en `cartelera` pide
  solo el título; unas categorías en `pastillas` no piden el enlace.
- **Contenido:** el anuncio respeta "Mostrar como cartelera" y los varios
  ítems; la barra de estadísticas se ofrece solo si se dibuja (`usaStats`).
- **Pie:** la descripción y el interruptor de redes. El cupón se ofrece con
  `dibujaCupon()`: las que declaran uno de muestra, y todas las recetas.

El grupo `editor-portada` del check lo prueba al revés de como se escribe el
bug: no mira el código del editor, cambia cada dato que el editor deja
cambiar y exige que la portada cambie.

### Cómo se declara un campo

```ts
{ id: 'titulo', label: 'Título', tipo: 'texto', max: 44, porDefecto: 'Comprá por categoría' }
```

- **Tipos:** `texto`, `parrafo`, `imagen`, `switch` y `seleccion` (elegir una
  categoría o un producto del catálogo real).
- **`porDefecto` vive solo en `secciones.ts`.** Lo leen la portada (`txt()`) y
  el editor, así no se desincronizan. Un campo vacío cae a su `porDefecto`:
  una tienda que no editó nada se ve igual que su vitrina.
- **`afirmacion: true`** si el texto promete algo del negocio (un descuento, un
  envío gratis, cuotas, un plazo, una cantidad, una certificación). En la
  vitrina se ve; en la tienda real no se dibuja hasta que el dueño lo escriba.
  La prueba: leerlo con *"esta tienda garantiza que…"* adelante. En un par
  número + etiqueta ("12" + "cuotas sin interés") se marcan los dos.
- **`porDefectoReal`** si el texto no promete nada pero nombra el rubro de la
  maqueta ("Buscá por rubro", "¿Cuántos meses tiene?"). La vitrina muestra el
  sabroso y la tienda el neutro.
- **Si el dato ya está en el catálogo o en Configuración, no se escribe.** Un
  producto se elige (`seleccion`) y su nombre y precio salen solos; el número
  de WhatsApp, el horario y las redes no se piden en la plantilla.
- **Si al sacarle lo inventado una sección queda en "escribí vos una tabla",
  la sección no va.** Preguntarse qué dato real la llena.
- **Un interruptor que no mueve nada es peor que no tenerlo.** Si la plantilla
  no dibuja la barra de stats, `usaStats: false`.

## El modo check

```bash
pnpm --dir apps/web test plantillas
```

Tarda dos segundos y no usa navegador. Dibuja cada plantilla con el mismo
`Home()` y el mismo `plantillaReal()` que la tienda, contra cuatro tiendas de
prueba y en dos pantallas, y revisa el HTML que sale. También corre en CI con
cada push a `main` (`pnpm test`).

Las cuatro tiendas: **vacía** (recién creada), **mínima** (una categoría, dos
productos, sin fotos, nada editado), **completa** y **grande** (nueve
categorías, cuarenta productos).

| Grupo | Qué revisa |
|---|---|
| catálogo | Ids únicos y **coinciden con la lista de la API**; portada única; fuentes en `FUENTES_PLANTILLAS`; receta bien formada |
| editor | Cada `txt()` del bloque tiene su campo en `secciones.ts`, y cada campo se dibuja (solo bloque propio; el de una receta se genera) |
| tema | Contraste del texto y del botón |
| vitrina | Dibuja en las dos pantallas, sin `undefined`/`NaN`, sin fotos que no existen, sin enlaces sin destino |
| tienda | Lo mismo, y además: nada de la marca, los productos ni las categorías de muestra; ninguna afirmación que el dueño no escribió; cuenta, carrito y **buscador** reales en el header, en las dos pantallas; enlaces reales del menú (o menú en celular); **todo enlace va a una página que existe**; Términos, Privacidad y Arrepentimiento en el pie; si hay productos, alguno se ve |
| estándar | En las veintiséis: cada estante, el anuncio, el parallax, las marcas, el video, las categorías, el buscador y el WhatsApp se ven prendidos y desaparecen apagados, sin dejar un título suelto; una tienda sin ventas muestra sus productos bajo "Recién llegados" y no un "Más vendidos". En las recetas, además, que estén todos los bloques |
| editor-portada | Cada cosa que el editor deja cargar cambia la portada: los campos de cada slide, cada campo de Secciones, la cartelera y los ítems del anuncio, estadísticas, parallax, marcas, la descripción, las redes y el cupón. Y al revés: no dibuja lo que el editor no ofrece |
| header | El header suelto (el que usa el catálogo, la ficha y el carrito) trae cuenta y carrito, y no arrastra la portada |

### Cómo leer un fallo

```
tienda > base:
  - promete "Envío gratis desde $80.000" sin que el dueño lo haya escrito (franja.titulo)  (en todos los casos)
```

Dice el grupo, la plantilla, qué pasa, el campo y en qué tiendas y pantallas.
Si falla solo en `minima` o `vacia`, es un caso límite: una sección que asume
que siempre hay categorías, fotos o destacados.

### La lista de pendientes

`PENDIENTES`, arriba de `plantillas.test.ts`, es para anotar lo que el check
encuentre en una plantilla ya publicada y no se arregle en el momento. Hoy
está vacía. Funciona como trinquete:

- Un problema que no está en la lista hace fallar el check. **Una plantilla
  nueva no suma nada ahí: se arregla.**
- Cuando se arregla uno de la lista, el check falla pidiendo que se borre el
  renglón. La lista solo se achica.

Arreglar un pendiente cambia cómo se ve una tienda que hoy está andando:
avisarle al dueño antes, no hacerlo de pasada.

### Lo que el check no ve

El HTML estático no tiene tamaños, ni `onClick`, ni ojos. Hay que mirar a mano,
en la vitrina (Avanzado → Plantillas → Ver cómo queda), en Computadora y en
Celular:

- que nada desborde a lo ancho y que el hero se lea sobre su foto;
- que las fotos tengan que ver con el rubro y no desentonen con la paleta;
- que todo lo que parece clickeable lo sea. En el código: `grep` de
  `accion="` sin `onAccion`, de `<Boton` sin `onClick`, y de un `☰` dibujado
  sin `MenuMovil`;
- que se distinga de las otras veinticinco.

Las pruebas con el navegador las hace el dueño: decirle qué plantilla mirar y
qué probar, en vez de abrir el navegador integrado. Si hace falta medir
desborde o fotos rotas en la vitrina, `referencia/verificacion.md` explica
cómo usar el script de consola.

## Cuándo un bloque propio

Solo cuando la plantilla tiene una **idea** que el vocabulario no puede
expresar: el panel lateral fijo de Circuito, el muro de Mosaico, "Comprá el
look" de Escaparate. No por querer mover un margen.

Cuesta: escribir el bloque en `homes.tsx`, declarar el esquema a mano en
`secciones.ts`, y cumplir el estándar con las piezas comunes (ver § El
estándar → Cómo lo cumple cada tipo de plantilla): una receta lo trae resuelto. Antes de
empezar, leer `referencia/bloque-propio.md` (cómo se engancha y el checklist)
y `referencia/errores.md` (los dieciocho bugs que ya pasaron). Las dieciséis
que existen quedan como están; se tocan si el dueño lo pide o si el check
encuentra algo.

Si la idea la van a usar varias plantillas, no es un bloque propio: es un
bloque nuevo del vocabulario.

## Ocultar o dar de baja

`oculta: true` la saca de la galería sin borrar nada. Dar de baja de verdad:
sacar la entrada de `datos.tsx`, el id de `HOME_TEMPLATES_DISPONIBLES`, sus
fotos de `public/plantillas/` y su fuente de `FUENTES_PLANTILLAS` **si nadie
más las usa** (`grep` antes de borrar), y coordinar antes con cualquier
negocio que la tenga activa.

## Antes de decir que está lista

1. `pnpm --dir apps/web test plantillas` en verde, sin sumar a `PENDIENTES`.
2. `pnpm --dir apps/web typecheck`.
3. Si se tocó `apps/api/`, typecheck y tests de la API, y avisar que hace
   falta `deploy.sh`.
4. Decirle al dueño qué mirar: la plantilla en la vitrina, en las dos
   pantallas, y aplicada en una tienda de prueba.
5. Si cambió algo de cómo se crean, se editan o se verifican las plantillas,
   actualizar esta skill en el mismo commit.

## Convenciones del repo

- Los archivos son **CRLF** (`core.autocrlf=true`). Un script que edite con
  `\n` rompe los matches: leer con `.replace('\r\n','\n')` y escribir al revés.
- Comentarios en castellano rioplatense, explicando el *por qué*.
- Estilos **inline**, como el resto del panel. Al string `CSS` de `piezas.tsx`
  solo va lo que necesita clase: hover, animaciones y el reveal.
- Cada medida con su variante `movil ? x : y`. `cols(d, m)` y `cuantos(d, m)`
  van siempre de a pares; para categorías, `colsDe(max, cuantas, movil)`.
- Nada de `next/image` acá: son fotos de muestra, `<img>` está bien.
- Un hook no puede ir adentro de un bloque: los bloques son ramas del mismo
  componente. El estado va arriba de `Home()`, sin condicionar.
