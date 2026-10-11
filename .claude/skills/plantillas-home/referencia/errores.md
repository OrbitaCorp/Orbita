# Errores ya cometidos

Cada punto salió de un bug real, encontrado con una plantilla aplicada en una
tienda con catálogo de verdad. Todos son de la misma familia: algo que la
maqueta resolvía con un valor fijo y que en la tienda real tiene que salir de
los datos.

Al lado de cada título dice si el modo check (`pnpm test plantillas`) ya lo
detecta solo. Lo que dice **a mano** hay que seguir revisándolo leyendo el
bloque.

## 1. Lo que solo estaba en la portada

*Lo detecta: a mano.*

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

## 2. Fondo clavado + tinta del tema (o al revés)

*Lo detecta: a mano (el check solo mide el contraste del tema).*

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

## 3. Datos que el adaptador arma y el bloque no dibuja

*Lo detecta: a mano.*

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

## 4. Enlaces que no son enlaces

*Lo detecta: check, a medias: ve un `<a>` sin destino, no un botón sin `onClick`.*

En el pie, los ítems de columna se dibujaban como `<div>` — sin `href` ni
`onClick`. **Ningún enlace del footer navegaba a ningún lado**, en las catorce
plantillas.

**Regla: cualquier cosa que parezca clickeable tiene que serlo.** Después de
enganchar una plantilla, `grep` por `accion="` sin `onAccion`, por `<Boton`
sin `onClick` y por columnas de texto que deberían ser `<a>`. En esta pasada
aparecieron **ocho** `<Titulo>` con un "Ver todo →" a la derecha que no hacía
nada.

## 5. El pie es contenido real, no decoración

*Lo detecta: check.*

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

## 6. Los toggles de Apariencia que la plantilla ignora

*Lo detecta: a mano.*

"Mostrar footer" no lo respetaban las plantillas con `piePropio`: el que lo
chequeaba era `StorefrontFooter`, que ahí ni se dibuja. Ahora va por
`ocultarPie`.

**Regla: cuando una plantilla reemplaza un componente de Órbita, hereda sus
toggles.** Antes de dar por listo el reemplazo, mirar qué banderas de
Apariencia leía el componente original (`showFooter`, `showSocialFooter`,
`showStatsBar`, `showWhatsapp`…) y pasarlas.

## 7. El navbar es contenido real, igual que el pie

*Lo detecta: check.*

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

## 8. `porDefecto` que promete algo es una mentira en producción

*Lo detecta: check.*

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

## 9. Un control decorativo es peor que no tenerlo

*Lo detecta: check, a medias: ve que en celular haya menú.*

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

## 10. "Rellenar con lo primero que haya" tampoco es contenido real

*Lo detecta: a mano.*

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

## 11. Una sección que el dueño tiene que llenar a mano no es una función

*Lo detecta: a mano.*

La comparativa de Nocturno ("¿Cuál te conviene más?") era una tabla de tres
modelos con sus specs y sus precios, inventada. Al sacarle los datos falsos
quedó como cinco campos de texto libre con formato `etiqueta | col1 | col2 |
col3`. Se sacó entera.

**Regla: si al quitarle lo inventado una sección queda en "escribí vos una
tabla de 5×4", la sección no va.** Órbita no tiene con qué llenarla, y pedirle
eso al dueño para que se vea algo no es una función: es un formulario. Antes de
pelear por conservar una sección, preguntarse qué dato REAL la llena.

## 12. Un número es una afirmación cuando su etiqueta lo vuelve una

*Lo detecta: a mano: el check solo calla lo que ya está marcado.*

El barrido del punto 8 marcó 46 campos pero se salteó dos: los números `12` y
`12` de Nocturno. Vistos solos parecen inocuos —es un número— pero sus
etiquetas decían "meses de garantía" y "cuotas sin interés".

**Regla: en un par valor+etiqueta, mirar los DOS juntos antes de decidir.** Y
marcar el par completo: si solo se marca el valor, la etiqueta queda huérfana
y se dibuja sola.

## 13. Una fila se corta por el ancho de su grilla, no por el largo del array

*Lo detecta: a mano.*

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

## 14. `p.productos` son los DESTACADOS, no el catálogo

*Lo detecta: a mano.*

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

## 15. Un dato que el dueño escribe a mano se desactualiza solo

*Lo detecta: a mano.*

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

## 16. Las categorías son las que son: la grilla se reparte, no se rellena

*Lo detecta: a mano.*

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

## 17. Si el dato ya está en Configuración, no se pide de nuevo

*Lo detecta: a mano.*

El botón "Mandar mi lista" del banner de campaña era un `<span>` sin
`onClick`. Lo que corresponde es que abra el WhatsApp del negocio — y el
número **no se carga en la plantilla**: ya está en Configuración.

**Regla: la plantilla edita CONTENIDO propio, nunca datos del negocio.** El
texto del botón sí es de la plantilla y va editable; el número de WhatsApp, el
email, el horario y el CUIT no — tenerlos en dos lados garantiza que un día no
coincidan. Lo mismo que ya vale para el pie (punto 5).

## 18. La plantilla se diseña para un rubro, pero la aplica cualquiera

*Lo detecta: check, a medias: lo ve si el texto nombra una categoría de muestra.*

Papelería encabezaba sus categorías con **"Buscá por rubro"** — jerga de
librería — y eso terminó arriba de "Camisas street" en una tienda de ropa que
le gustó el diseño. Lo mismo con "¿Cuántos meses tiene?" (Crecer),
"Departamentos" y "Entrá por rubro" (Corralón), "Por familia" (Nítida).

Esto es fácil de no ver, porque **en la vitrina se lee perfecto**: ahí la
plantilla viene con su marca de muestra y sus productos de muestra, todos del
mismo rubro. El texto solo desentona cuando lo aplica un negocio de otra cosa
— que es el caso normal, no la excepción.

**Regla: un `porDefecto` que nombra el rubro necesita su `porDefectoReal`.**
La vitrina sigue mostrando la versión sabrosa —es lo que le da personalidad a
la plantilla y ayuda al dueño a elegirla— y la tienda real muestra la neutra.
El editor precarga la neutra, porque edita la tienda, no la vitrina.

No confundir con `afirmacion` (punto 8), aunque el mecanismo sea parecido:

| | Qué pasa | Qué se hace |
|---|---|---|
| `afirmacion` | Promete algo que puede ser falso | Se calla hasta que lo escriban |
| `porDefectoReal` | No es falso, pero asume el rubro | Se reemplaza por una versión neutra |

Callarse no serviría acá: la sección se quedaría sin encabezado.

**La prueba:** leer el texto imaginando la plantilla aplicada en una tienda de
otro rubro. Si "Buscá por rubro" arriba de "Camisas street" suena raro, hace
falta la versión neutra.


## La tabla completa

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

| "Buscá por rubro" arriba de "Camisas street" | El `porDefecto` estaba escrito para el rubro de la maqueta, y en la vitrina se leía bien | `porDefectoReal` con la versión neutra: la vitrina conserva la sabrosa, la tienda muestra la neutra |

| Dos plantillas idénticas en la galería | Compartían la foto de `slides[0]`, que es la portada de la tarjeta | La portada es única entre las veintiséis; adentro repetir no molesta |
| Una plantilla nueva que pedía editor nuevo | Se escribió su bloque a mano aunque usaba el vocabulario de siempre | Si se puede escribir con `receta`, va con receta: el editor sale solo |
| El panel ofrecía una plantilla que la API rechazaba con 400 | `datos.tsx` sumó ids y `HOME_TEMPLATES_DISPONIBLES` quedó atrás | Cruzar las dos listas antes de cerrar, y desplegar la API a mano |

| Los enlaces del navbar no llevaban a ningún lado en la vitrina, y el hover era un gris sucio | `navDe` devolvía solo la etiqueta sin `acciones`, y `.pl-nav:hover` bajaba la opacidad al 58% sobre un nav ya gris | `navDe` da enlaces con `onClick` también en la vitrina (`irEnVitrina`), y el hover subraya y lleva el texto a `t.text` con `...navHover(t)`. Ver § El nav del header en la skill |
