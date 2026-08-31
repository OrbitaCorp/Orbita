---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, mejorar o revisar los diseños alternativos de la PORTADA de una tienda. Usar cuando el pedido sea agregar plantillas nuevas, rehacer una existente, sumar fotos, o verificar que las plantillas anden. Cubre la arquitectura (tipos/datos/piezas/homes/PlantillasConfig), el estándar visual, de dónde salen las fotos, y el chequeo automático de las doce en escritorio y celular. Palabras clave: plantilla, plantillas, home, portada, template, theme, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer."
---

# Plantillas de Home

Diseños alternativos **solo para la portada** de una tienda de Órbita. El dueño las
elige desde el panel: Avanzado → Plantillas de Home → Configurar.

## Las cinco reglas que no se negocian

1. **Solo cambia el HOME.** Catálogo, ficha de producto, carrito, checkout y perfil
   son idénticos con cualquier plantilla. Si una propuesta es "una grilla con
   filtros", eso es el catálogo, no una portada — no va.
2. **Una plantilla por vez pertenece a UN módulo.** Hoy las siete visibles son
   del módulo **tienda**. Gastronomía, turnos y el resto van a tener las suyas.
   No mezclar una carta de restaurante entre las de tienda.
3. **Solo secciones que Órbita realmente genera.** El home real (ver
   `cliente/inicio/Inicio.tsx`) tiene: cartel, hero, barra de stats,
   categorías, filas de productos, banner de WhatsApp y pie. **No hay
   newsletter, ni testimonios, ni planes por suscripción** — una plantilla que
   los muestre promete algo que después la tienda no puede cumplir. Pedido
   explícito del dueño: *"eso no lo ofrecemos"*.
4. **Todas usan el mismo esqueleto: el layout `tienda`** (el de Vidriera, que
   es el que más vende). Lo que las diferencia es el tema, las fotos, los
   rubros y los textos — como las variantes de un theme de Shopify. Antes cada
   una tenía su propio esqueleto; el dueño pidió unificarlas.
5. **Las acciones de tienda son iguales en todas.** Ingresar / Mis pedidos /
   Carrito con contador (`AccionesTienda`). Cambia la portada, no la forma de
   entrar a la cuenta ni de comprar.

## Dónde vive todo

```
apps/web/src/modules/ventas/panel/avanzado/plantillas/
  tipos.ts             Tema, Layout, Producto, Slide, Plantilla, IMG, sans/serif/ar
  datos.tsx            PLANTILLAS[] — marca, tagline, tema, slides y productos de muestra
  piezas.tsx           CSS + componentes compartidos + marcos Notebook/Celular
  homes.tsx            Home({p, movil}) — un bloque `if (p.layout === '...')` por plantilla
  PlantillasConfig.tsx Pantalla del panel: galería → detalle → aplicar
apps/web/public/plantillas/   129 fotos JPG locales, 15 MB (NO van a git, ver .git/info/exclude)
apps/web/src/pages/plantillas.tsx   Página suelta para mostrar en reuniones (tampoco va a git)
```

`Avanzado.tsx` la engancha con `vista === 'plantillas'` (mismo patrón que
`JuegosConfig`), sin ruta propia: el dueño nunca sale de la pantalla.

## Piezas compartidas (usarlas antes de escribir una nueva)

`Reveal` (scroll-reveal), `Foto` (con segunda imagen al hover), `Estrellas`,
`Card`, `Boton`, `Titulo`, `Marquee`, `AccionesTienda`, `HeaderCentrado`,
`HeaderLateral`, `Carrusel`, `Beneficios`, `Resenas`, `Newsletter`, `Pie`,
`Notebook`, `Celular`, `TONOS`, `CSS`, `cargarFuentes`.

`Tira` (fila horizontal con snap) vive en `homes.tsx`, no en `piezas.tsx`.

## El estándar visual

Referencia del dueño: **travistrend.com.ar**, y el nivel de las theme stores de
Shopify/Tiendanube. Lo que separa esto de un wireframe:

- **Detalle en la tarjeta de producto**: segunda foto al hover, swatches de
  color, estrellas con cantidad de reseñas, aviso de stock, precio con
  transferencia y cuotas.
- **Movimiento**: reveals al scrollear, zoom lento en las fotos, carrusel que
  avanza solo, marquee.
- **Profundidad**: sombras propias del tema (`tema.sombra`), no una sombra
  genérica para todas.
- **Fotos reales**, nunca bloques de color.
- Cada plantilla trae **su tipografía** (`fh` títulos / `fb` cuerpo) y **su
  radio** (`radio: 0` para las duras, 10–16 para las amables).

## Tipografías

`loadFont()` de `lib/fonts.ts` NO sirve acá: solo conoce las siete familias que
el dueño puede elegir en Apariencia y, para cualquier otra, arma un `<link>`
roto (`family=undefined`). Las plantillas tienen su propio cargador,
`cargarFuentes()` en `piezas.tsx`, con la lista `FUENTES_PLANTILLAS` y los pesos
exactos que se usan (varias piden 800/900, que los specs de Apariencia no
traen). Fuente nueva → agregarla ahí, no en `lib/fonts.ts`.

## Fotos

Son **locales a propósito**: con URLs remotas la presentación se cae sin internet.

- Fuente que funciona: `https://images.unsplash.com/photo-{id}?w=1200&q=80`.
  `picsum.photos` está bloqueado y `source.unsplash.com` devuelve 503.
- Bajarlas a `apps/web/public/plantillas/` con nombre por rubro:
  `joya-collar.jpg`, `tech-teclado.jpg`, `moda-mujer-invierno.jpg`.
  Prefijos en uso: `vidriera- casa- tech- moda- belleza- comida- joya- local-
  editorial- relato- libre- ferre- dep- masc- vino- bebe-`.
- **Verificar cada id con curl antes de asignarla** y mirarlas todas juntas en
  una hoja de contactos (ver `referencia/fotos.md`) — bajar a ciegas termina en
  una foto que no tiene nada que ver.
- **Que no desentonen con la paleta.** Una hoja verde tropical adentro de una
  joyería carbón y dorado arruina la fila entera.
- **Sin repetir la misma foto dos veces en pantalla** (una en el mosaico de
  categorías y otra en la fila de productos se nota y se lee como vagancia).
- **Chequear duplicados por hash**, no de memoria: dos ids distintos de Unsplash
  pueden traer el mismo archivo.
  `md5sum *.jpg | awk '{print $1}' | sort | uniq -d`

## Agregar una plantilla nueva

Ya no se escribe JSX: se agrega una entrada de datos con `layout: 'tienda'`.

1. **Fotos primero.** Bajar 8–12 del rubro, verificarlas, hoja de contactos.
2. `datos.tsx`: entrada nueva con `id`, `nombre`, `para`, `queCambia`,
   `secciones[]`, `marca`, `tagline`, `layout: 'tienda'`, `tema`, y el contenido
   del esqueleto: `cartel`, `links`, `confianza`, `categorias`, `cupon`, `pie`,
   `slides[]` y `productos[]`.
3. **Los `slides` son promos, no frases.** El carrusel dibuja el `titulo` a
   132 px: va `3x2`, `−30%`, `48 hs`. El texto largo va en `bajada`.
4. `queCambia` se muestra en el panel: que diga qué la hace distinta (paleta,
   tipografía, rubros), no adjetivos.
5. `npx tsc --noEmit` y `npx eslint src/modules/ventas/panel/avanzado/plantillas`.
6. Correr el chequeo de `referencia/verificacion.js` en las dos vistas.

### Ocultar sin borrar

`oculta: true` en la entrada la saca de la galería (`PlantillasConfig` filtra
por ahí). Hoy están guardadas así las cinco de autor —Escaparate, Mosaico,
Premium, Nocturno y Glow— más los seis esqueletos de rubro que quedaron sin
uso en `homes.tsx`: el dueño los quiso conservar por si los pide de vuelta.
Recuperar uno es sacarle el campo, o volver a apuntar su `layout`.

## Verificación (obligatoria antes de decir que está listo)

Pegar `referencia/verificacion.js` en la consola del panel, en
`/admin/{negocioId}/ventas/avanzado?vista=plantillas`. Va de a una plantilla
(`__chequear(i)`) porque varias juntas pasan el timeout de CDP (45 s).

Tiene que dar, en **escritorio y celular**: `rotas: 0`, `desborda: false`,
`ocultas: 0`. Cualquier otra cosa es un bug, no un detalle.

**La pestaña tiene que estar ADELANTE mientras corre.** En una pestaña de fondo
Chrome congela los timers y el IntersectionObserver: el reveal no dispara nunca
y `ocultas` da distinto de cero aunque no haya nada roto. El script avisa —
chequear `document.visibilityState === 'visible'` antes de creerle al número.

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

## Convenciones del repo

- Los archivos son **CRLF** (`core.autocrlf=true`). Un script de Python que
  edite con `\n` rompe los matches: leer con `.replace('\r\n','\n')` y escribir
  con `.replace('\n','\r\n')`.
- Comentarios en **castellano rioplatense**, explicando el *por qué* (sobre todo
  cuando algo costó llegar), no el *qué*.
- Estilos **inline**, como el resto del panel. Solo van al string `CSS` las
  cosas que necesitan clase: hover, animaciones y el reveal.
- Nada de `next/image` acá: son fotos de muestra, `<img>` está bien.

## Lo que todavía no está conectado

"Aplicar al home" guarda la elección en `localStorage` por negocio. Para que la
tienda **renderice** la plantilla falta una columna en `storefront_config` (ej.
`home_template`) expuesta en `GET /storefront/:slug/config` — es una migración
sobre la base que apunta a producción, así que no se corre sin avisar. Cuando
exista, lo único que cambia es `leerHomeAplicado` / `guardarHomeAplicado` en
`PlantillasConfig.tsx`.
