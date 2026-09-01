---
name: plantillas-home
description: "Plantillas de Home de Órbita (paquete Avanzado): crear, mejorar o revisar los diseños alternativos de la PORTADA de una tienda. Usar cuando el pedido sea agregar plantillas nuevas, rehacer una existente, sumar fotos, o verificar que las plantillas anden. Cubre la arquitectura (tipos/datos/piezas/homes/PlantillasConfig), el estándar visual, de dónde salen las fotos, y el chequeo automático de las veinte en escritorio y celular. Palabras clave: plantilla, plantillas, home, portada, template, theme, vidriera, escaparate, mosaico, premium, nocturno, glow, papelería, corralón, atleta, patitas, bodega, crecer, semilla, lunar, tueste, piñón, circuito, vera, cobijo, nítida."
---

# Plantillas de Home

Diseños alternativos **solo para la portada** de una tienda de Órbita. El dueño las
elige desde el panel: Avanzado → Plantillas de Home → Configurar.

## Las cinco reglas que no se negocian

1. **Solo cambia el HOME.** Catálogo, ficha de producto, carrito, checkout y perfil
   son idénticos con cualquier plantilla. Si una propuesta es "una grilla con
   filtros", eso es el catálogo, no una portada — no va.
2. **Una plantilla por vez pertenece a UN módulo.** Hoy las veinte son del
   módulo **tienda**. Gastronomía, turnos y el resto van a tener las suyas. No
   mezclar una carta de restaurante entre las de tienda.
3. **Solo secciones que Órbita realmente genera.** El home real (ver
   `cliente/inicio/Inicio.tsx`) tiene: cartel, hero, barra de stats,
   categorías, filas de productos, banner de WhatsApp y pie. **No hay
   newsletter, ni testimonios, ni planes por suscripción** — una plantilla que
   los muestre promete algo que después la tienda no puede cumplir. Pedido
   explícito del dueño: *"eso no lo ofrecemos"*.
4. **Tienen que verse MUY distintas entre sí**, no la misma página repintada.
   Lo que las diferencia de verdad: header propio, forma propia de mostrar el
   producto, proporción propia de imagen y al menos una sección que las otras
   no tengan. (Se probó unificarlas todas bajo el esqueleto de Vidriera y el
   dueño lo volvió atrás: quiere variedad.) `tienda` es el esqueleto de
   Vidriera, disponible por si una nueva lo quiere reusar.

   **Cuándo reusar `tienda` y cuándo escribir un esqueleto propio.** Preguntar
   antes de escribir ocho iguales: en la tanda de las ocho el dueño eligió
   mitad y mitad. Reusan `tienda` los rubros de venta masiva, donde la forma
   de Vidriera es la que vende (Semilla, Lunar, Tueste, Piñón); tienen
   esqueleto propio los que se compran de otra manera (Circuito con la ficha
   técnica al lado del producto, Vera como catálogo impreso, Cobijo por
   ambiente, Nítida partida en dos). Una plantilla que reusa `tienda` igual
   necesita tema, tipografía, fotos y rubros propios: repintar no alcanza,
   pero tampoco hace falta un esqueleto nuevo para cada rubro.
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
  PlantillasConfig.tsx Pantalla del panel: galería → detalle
apps/web/public/plantillas/   174 fotos JPG locales, 29 MB (SÍ van a git desde
                              que esto es una pantalla del panel, no una demo)
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
traen). Fuente nueva → agregarla ahí, no en `lib/fonts.ts`, y chequear que
exista antes de usarla:

```bash
curl -o /dev/null -w "%{http_code}\n" "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700"
```

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
  bajan un `<html>404</html>` con extensión `.jpg` (7 de 48 en la última tanda).
- Bajarlas a `apps/web/public/plantillas/` con nombre por rubro:
  `joya-collar.jpg`, `tech-teclado.jpg`, `moda-mujer-invierno.jpg`.
  Prefijos en uso: `vidriera- casa- tech- moda- belleza- comida- joya- local-
  editorial- relato- libre- ferre- dep- masc- vino- bebe- diet- boutique-
  cafe- auto-`.
- **Verificar cada id con curl antes de asignarla** y mirarlas todas juntas en
  una hoja de contactos (ver `referencia/fotos.md`) — bajar a ciegas termina en
  una foto que no tiene nada que ver. El `alt` tampoco alcanza solo: el de
  `diet-paprika.jpg` decía "frasco de vidrio con líquido marrón" y era un
  frasco con la etiqueta SWEET PAPRIKA a la vista, que se iba a vender como
  miel.
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
4. `homes.tsx`: bloque `if (p.layout === 'nuevo') { ... }`. Empezar por el
   header (con `<AccionesTienda t={t} movil={movil} />`), seguir por el hero y
   después las secciones.
5. Todo bloque que no sea header ni hero va envuelto en `<Reveal>`.
6. Cada medida con su variante `movil ? x : y`. Usar el helper `cols(d, m)`.
7. Si la plantilla reusa el esqueleto de Vidriera (`layout: 'tienda'`), no se
   escribe JSX: se completan `cartel`, `links`, `confianza`, `categorias`,
   `cupon` y `pie` en los datos, y los `slides` son promos cortas (el carrusel
   dibuja el título a 132 px: va `3x2`, `−30%`, `48 hs`).
8. Actualizar el conteo en la bajada de `PlantillasConfig.tsx` ("Veinte
   portadas distintas para tu tienda") y en el comentario de arriba del
   archivo. Y cuidado con las comparaciones que envejecen dentro de
   `queCambia`: "la más sobria de las siete" quedó mintiendo al pasar a veinte.
9. `npx tsc --noEmit` y `npx eslint src/modules/ventas/panel/avanzado/plantillas`.
   Los 4 warnings de `no-img-element` son esperados (ver Convenciones).
10. Correr el chequeo de `referencia/verificacion.js` en las dos vistas, y
    **mirar las nuevas con los ojos**: el script no dice si una foto miente ni
    si el hero se lee.

### Ocultar sin borrar

`oculta: true` en la entrada la saca de la galería (`PlantillasConfig` filtra
por ahí). Hoy no hay ninguna oculta — el campo queda porque ya se usó una vez
y sirve para guardar una plantilla sin perderla.

## Verificación (obligatoria antes de decir que está listo)

Pegar `referencia/verificacion.js` en la consola del panel, en
`/admin/{negocioId}/ventas/avanzado?vista=plantillas`. Va de a una plantilla
(`__chequear(0..19)`) porque varias juntas pasan el timeout de CDP (45 s): de
a tres entra, de a seis se corta.

Tiene que dar, en **escritorio y celular**: `rotas: 0`, `desborda: false`,
`ocultas: 0`. Cualquier otra cosa es un bug, no un detalle.

**La pestaña tiene que estar ADELANTE mientras corre.** En una pestaña de fondo
Chrome congela los timers y el IntersectionObserver: el reveal no dispara nunca
y `ocultas` da distinto de cero aunque no haya nada roto. El script avisa —
chequear `document.visibilityState === 'visible'` antes de creerle al número.

**Sin backend a mano**, la pantalla corre sola: una página temporal en
`apps/web/src/pages/` que devuelva `<PlantillasConfig onVolver={() => {}} />`
alcanza — no llama a la API, y `useAuth` (que solo aporta el subdominio del
marco) cae a `tu-tienda` sin sesión. Borrarla antes de commitear.

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
| Ocho plantillas nuevas todas con el mismo esqueleto | Se tomó al pie de la letra un pedido de "reusar el de Vidriera" sin chequear la regla 4, que decía lo contrario | Preguntar antes de escribir la tanda: el dueño eligió mitad y mitad (ver regla 4) |

## Convenciones del repo

- Los archivos son **CRLF** (`core.autocrlf=true`). Un script de Python que
  edite con `\n` rompe los matches: leer con `.replace('\r\n','\n')` y escribir
  con `.replace('\n','\r\n')`.
- Comentarios en **castellano rioplatense**, explicando el *por qué* (sobre todo
  cuando algo costó llegar), no el *qué*.
- Estilos **inline**, como el resto del panel. Solo van al string `CSS` las
  cosas que necesitan clase: hover, animaciones y el reveal.
- Nada de `next/image` acá: son fotos de muestra, `<img>` está bien.

## Es una vitrina, no aplica nada

`PlantillasConfig` solo MUESTRA. No hay botón de aplicar ni se guarda ninguna
elección — decisión explícita del dueño: enganchar una plantilla con la tienda
real (columna en `storefront_config`, el storefront leyendo esa columna y
armando cada sección con el catálogo de verdad) es otro laburo y se hace
aparte. **No agregar un "Aplicar al home" hasta que esa lógica exista.**
