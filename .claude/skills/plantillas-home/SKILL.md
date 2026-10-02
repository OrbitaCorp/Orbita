---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, modificar o revisar los diseños alternativos de la PORTADA de una tienda. Usar cuando el pedido sea agregar una plantilla nueva, cambiar el diseño o el editor de una existente, sumar un bloque al vocabulario de recetas, sumar fotos, o verificar que las plantillas anden (modo check). Cubre el modelo (diseño fijo de la plantilla + contenido editable por el dueño), las recetas y su editor generado, el modo check automático (`pnpm test plantillas`), el contrato con la tienda real (plantillaReal.ts, StorefrontChrome.tsx), el estándar visual y las fotos. Palabras clave: plantilla, plantillas, home, portada, template, theme, receta, bloque, check, verificar, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer, circuito, vera, cobijo, nítida, lienzo, pulso, terracota, base, carbón, bloque, sobrio, roble, pétalo, sello."
---

# Plantillas de Home

Diseños alternativos **para la portada** de una tienda de Órbita. El dueño las
elige desde el panel: Avanzado → Plantillas de Home. Hay **veintiséis**, todas
del módulo tienda, y todas se aplican de verdad en un negocio.

## El modelo, en tres líneas

1. **El diseño es de la plantilla y es fijo.** Paleta, tipografías, radio,
   sombra, tipo de hero, forma de las categorías, orden de los bloques. El
   dueño no los cambia: eligió la plantilla justamente por eso.
2. **El contenido es del negocio y es editable.** Con la plantilla activa, el
   dueño edita en cinco pestañas —Hero, Header, Secciones, Contenido, Pie— que
   son el mismo editor de Apariencia en modo `soloContenido`. Todo lo demás
   (productos, categorías, WhatsApp, redes) sale solo de lo que ya cargó.
3. **Una plantilla no está lista hasta que pasa el modo check.** No alcanza
   con que la vitrina se vea bien: ahí siempre se ve bien.

## Las cinco reglas que no se negocian

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
    { t: 'categorias', estilo: 'altas', cols: 4 },
    { t: 'fila', id: 'fila', cols: 4 },
    { t: 'franja', estilo: 'apilada' },
    { t: 'whatsapp' },
  ],
}
```

| Bloque | Variantes | Qué edita el dueño |
|---|---|---|
| `hero` | `pleno` · `partido` · `minimo` · `tarjeta` | Slides (pestaña Hero) y un segundo botón |
| `categorias` | `grilla` · `pastillas` · `tira` · `altas` | El encabezado. Las categorías son las suyas |
| `fila` | `grilla` · `tira` · `sangre`; `fuente`: destacados / masVendidos / catálogo | El encabezado. Los productos salen del catálogo |
| `porCategoria` | `cuantas`, `porFila` | Nada: usa los nombres de sus categorías |
| `franja` | `plena` · `filete` · `cartelera` · `apilada` | Título, bajada y botón. Vacía, no se dibuja |
| `parallax` | — | Foto, volanta, título, texto, botón |
| `campana` | — | Foto, volanta, título, texto, botón |
| `whatsapp` | — | Título, bajada y botón. El número sale de Configuración |

Cada `fila` lleva un `id` distinto: es la clave de su encabezado editable.

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

## El editor: qué puede tocar el dueño

Con la plantilla activa, Configuración → Apariencia queda bloqueada y el
dueño edita desde Avanzado → Plantillas de Home:

| Pestaña | Qué edita | De dónde sale |
|---|---|---|
| Hero | Slides: foto, título, bajada, botón, enlace | El mismo `heroSlides` de Apariencia. `heroMaxSlides` lo limita |
| Header | Logo y enlaces del menú | `headerLinks` de Apariencia |
| Secciones | Los textos y fotos propios de la plantilla | `seccionesDe(id)`: de la receta, o declarado a mano |
| Contenido | Anuncio y barra de stats | Solo si la plantilla los dibuja (`usaStats`, cintillo) |
| Pie | La descripción bajo el logo y si se muestran las redes | Las columnas y los legales los arma `pieReal()`, no se editan |

Lo guardado va a `homeTemplateData.secciones[idSeccion][idCampo]`, un JSON por
negocio: sumar un campo no necesita migración.

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
| tienda | Lo mismo, y además: nada de la marca, los productos ni las categorías de muestra; ninguna afirmación que el dueño no escribió; cuenta y carrito reales en el header; enlaces reales del menú (o menú en celular); Términos, Privacidad y Arrepentimiento en el pie; si hay productos, alguno se ve |
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

`PENDIENTES`, arriba de `plantillas.test.ts`, anota lo que el check encontró en
plantillas que ya estaban publicadas y todavía no se arregló. Funciona como
trinquete:

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
`secciones.ts`, y cumplir a mano lo que una receta trae resuelto. Antes de
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
