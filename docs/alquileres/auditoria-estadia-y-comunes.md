# Auditoría UX/UI: Alquileres, modo estadía, pantallas comunes y alta

Fecha: 20/11/2026. Alcance: todo el panel de **estadía**, el **sitio público** de estadía, las pantallas
**comunes a los tres modos** (Reglas de reserva, Recordatorios y mensajes, Pagos y señas, Calendarios
.ics, Configuración → Datos del negocio y Equipo) y el **alta**. Canchas y salones los auditan otros.

Para quién se mira: el **dueño chico** (1 a 5 cabañas o deptos en Puerto Iguazú y parecidos) que hoy
recibe por WhatsApp y Airbnb, anota a mano y usa el panel **desde el celular** casi siempre. La vara
son las reglas de la skill `ui-ux-pro-max` (accesibilidad, toque de 44 px, responsive sin scroll
horizontal, formularios, navegación, datos), el diseño
[`2026-11-18-alquileres-sobre-el-backend-design.md`](../superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md)
(§ 2 y § 7) y el [estudio de la competencia](estudio-sistemas-similares.md) (ideas E1–E18, T1–T5).

## Cómo leer esto

- **Capturas.** Las rutas son relativas al scratchpad de la sesión
  (`C:\Users\vegaa\AppData\Local\Temp\claude\5c0021555b7b8d42\d7772cc8-e029-4a26-aa35-c4af697f7a0a\scratchpad\`):
  `capturas/estadia/<ancho>/…` (lo que se ve al abrir), `capturas-alto/estadia/<ancho>/…` (contenido
  completo) y `capturas-extra/…` (estados que saqué yo con Playwright: modales, menú, reserva paso a
  paso, oscuro, alta). Son de la demo con "hoy" fijo en el sáb 14/11/2026.
- **Severidad del problema:** **Grave** (puede hacer perder plata, reservar dos veces o romper la
  confianza), **Media** (molesta todos los días o confunde), **Leve** (detalle).
- **Mejoras:** impacto alto/medio/bajo para el dueño chico; esfuerzo chico (días), medio (1–2 semanas),
  grande (más).
- **Lo que NO cuento como problema** (son cosas de la demo o de cómo se sacaron las capturas):
  la barra negra de arriba (Índice / Alta / Panel… y el selector de modo), el círculo "N" del modo
  desarrollo de Next, las fechas en formato mm/dd/aaaa (las capturas base se sacaron con el navegador en
  inglés; con `es-AR` los `<input type="date">` salen dd/mm/aaaa y la página ya tiene `lang="es"`), las
  barras fijas que aparecen en el medio de las capturas de página completa, el mapa vacío del sitio en
  la captura alta (es carga diferida: al bajar, aparece, ver `capturas-extra/390-sitio-mapa.jpg`), y las
  fotos de ejemplo (una oficina para "cabaña en el bosque").
- **Lo que está bien y no repito en cada pantalla:** en celular los botones, chips, pestañas y celdas
  de calendario llegan a 44 px (`estilo.tsx` sube `rv-btn--sm`, `rv-chip` y `rv-seg` a 44 px debajo de
  768 px), los campos pasan a 16 px (no hay zoom de iOS), no encontré scroll horizontal de página en
  ningún ancho, los formularios tienen etiqueta visible y error debajo del campo, cada página de
  configuración tiene barra de "Tenés cambios sin guardar" con Descartar/Guardar, los skeletons
  reservan el lugar y el modo oscuro existe en todo el panel.

---

## 1. Resumen

### Los 5 problemas más graves

1. **Calendarios (.ics) no evita reservar dos veces (Grave).** "Exportar" baja un archivo `.ics`
   (`descargarICS`): una foto del momento. Airbnb y Google importan una **URL** que vuelven a leer cada
   tanto; un archivo no se puede pegar en Airbnb y, si se pudiera, quedaría viejo al día siguiente. El
   diseño (§ 7.1) pide una URL pública por propiedad con token. Además: no hay "Sincronizar ahora" ni
   aviso de error de sync, y "Quitar" un calendario de Airbnb se ejecuta con un toque y **libera de golpe
   todas esas noches** para que alguien las reserve en el sitio. Es exactamente el anti-objetivo del
   diseño (§ 2: "que una reserva de Airbnb y una del sitio caigan en las mismas noches").
   Capturas: `capturas-alto/estadia/390/panel-calendarios.jpg`.
2. **La ficha de una reserva es de solo mirar y su acción más peligrosa no pide confirmación
   (Grave).** En el detalle (`capturas-extra/390-detalle-llega.jpg`): "Cancelar reserva" es el
   **primer** botón de la pila en celular y cancela con un toque, sin "¿seguro?" ni deshacer; el teléfono
   del huésped es texto (no abre WhatsApp ni llama); **no se puede editar** nada (fechas, propiedad,
   huéspedes, precio); y "Marcar realizada" además marca el saldo como pagado sin preguntar
   (`Reservas.tsx`: `{ estado: 'completada', saldoPagado: true }`), así que Ingresos deja de mostrar
   como "por cobrar" un saldo que quizás nunca entró.
3. **El sitio le dice al huésped otra política de cancelación que la configurada (Grave).** En Pagos y
   señas está "Si cancelan tarde: se devuelve la mitad" (`capturas-alto/estadia/1280/panel-pagos.jpg`),
   pero en Mis reservas el huésped lee "Ya pasó el plazo: si cancelás, la seña no se devuelve"
   (`capturas/estadia/390/sitio-mis-reservas.jpg`) y en el paso de la seña solo "Si cancelás hasta 7
   días antes, se devuelve", sin decir qué pasa después (`capturas-extra/390-reserva-pago.jpg`). Encima
   la regla está partida en dos pantallas (el plazo en Reglas, el qué pasa con la seña en Pagos). Una
   promesa de devolución que no coincide con lo cobrado es un reclamo seguro.
4. **No hay una vista de todas las propiedades juntas (Grave para 3–5 cabañas).** La pantalla de
   inicio (Calendario) muestra **una propiedad por vez** en pestañas; para saber "qué pasa hoy y esta
   semana" hay que tocar cada pestaña. La única lista de llegadas y salidas de todas las propiedades está
   **escondida en Ingresos** (`capturas-alto/estadia/390/panel-ingresos.jpg`). En celular las pestañas
   se cortan ("Depto Centro" a medias) y con 5 propiedades dos quedan fuera de la vista sin indicio.
5. **"Nueva reserva" a mano arranca con un huésped ya elegido (Media-grave).** El selector viene con
   **"Sofía Ramírez"** (el primer cliente de la lista), y "+ Alguien nuevo" es la **última** opción de un
   `<select>` nativo sin buscador (`capturas-extra/390-nueva-reserva.jpg`). Para quien recibe por
   WhatsApp, casi todas las reservas son de gente nueva: es fácil agendar a nombre de otro. Tampoco se
   puede decir de dónde vino (WhatsApp, teléfono, otro: diseño § 7.6 y F8), ni ajustar el precio, ni
   marcar que la seña ya entró por transferencia (queda "pendiente" y hay que abrirla de nuevo).

### Las 5 mejoras de más impacto

1. **Un "Hoy" de todas las propiedades** (impacto alto, esfuerzo medio): arriba, lo que pide acción
   (llegan hoy, salen hoy, señas por vencer, saldos a cobrar al llegar, conflictos con Airbnb); abajo,
   una grilla de ocupación con una fila por propiedad y una columna por día (7 días en celular, 14–30 en
   escritorio, con scroll interno, no de página). Es la vista que todos los competidores dan como
   "multicalendario" (estudio: Guesty Lite, Pxsol "plano de ocupación"). Saca "Llegadas y salidas" de
   Ingresos.
2. **WhatsApp a un toque en todo lo que tiene un huésped** (alto, chico): ficha de reserva, ficha de
   huésped, lista de Huéspedes y "Por cobrar", con el mensaje armado ("Hola Mateo, te recuerdo la seña de
   $63.200 para Cabaña Arrayán del 19 al 21/12…"). `wa.me` no necesita la API de WhatsApp. Es el canal
   del dueño (diseño § 1; estudio, resumen punto 10 y T3).
3. **Airbnb de verdad y visible** (alto, medio; ya está en el diseño § 7.1 y en E1–E3): URL de
   exportación **copiable** por propiedad con instrucciones de dónde pegarla en Airbnb, "última
   sincronización" y "Sincronizar ahora" por calendario, error visible, confirmación al quitar, y el
   aviso "Airbnb tarda hasta 3 h en enterarse: entrá a Airbnb > Calendario > Actualizar" después de cada
   reserva directa. Ofrecerlo también **en el alta**.
4. **"Qué hay libre" que responde la consulta entera** (alto, chico): sumar cuántos vienen, el **precio
   total** de esas noches con temporada, fin de semana y limpieza (hoy muestra solo "$68.000 la noche")
   y un botón **"Copiar respuesta"** / "Responder por WhatsApp" con disponibilidad, total y seña. Es la
   pantalla que el propio panel dice que es "para responder al toque".
5. **Navegación pensada para el celular** (alto, medio): barra inferior con Hoy · Libre · Huéspedes ·
   Números · Más; el buscador de huéspedes y reservas disponible en celular (hoy desaparece debajo de
   1100 px); el título del header sin cortarse. Hoy cada cambio de sección son dos toques y una lista
   de 12 ítems.

---

## 2. Pantalla por pantalla

### 2.1 Calendario (inicio del panel)

Capturas: `capturas/estadia/{390,768,1280}/panel-reservas.jpg`, `capturas-alto/…/panel-reservas.jpg`,
`capturas-extra/390-oscuro-calendario.jpg`, `capturas-extra/390-campanita.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Una propiedad por vez (pestañas Arrayán / Lapacho / Depto). Con tres o más, la pregunta "¿qué tengo
    libre el finde?" exige mirar tres calendarios. **Grave** (ver Resumen 4).
  - Las noches **libres son botones deshabilitados** (`disabled={!e}` en `Ocupacion`): tocar un día libre
    no hace nada; para agendar hay que ir a "Agendar a mano" y volver a elegir las fechas en otro
    calendario. **Media.**
  - La celda de hoy (14) pierde el fondo de "reservada" y queda solo con borde: hoy llega Sofía y el
    día parece libre. **Leve.**
  - La leyenda "Seña pendiente" usa `--color-warning-bg`, un amarillo casi blanco: el cuadradito no se
    distingue del fondo y una noche con seña pendiente apenas se diferencia de una libre. Estado
    comunicado solo por un color pálido (regla `color-not-only`). **Media.**
  - El encabezado dice "3 reservas con seña pendiente: si no se paga, el lugar se libera", pero en la
    campanita hay señas pendientes desde el 15/10 que nunca se liberaron
    (`capturas-extra/390-campanita.jpg`), y no se dice **cuándo** se libera. Promesa sin plazo. **Media.**
  - El "3" del menú junto a Calendario no dice qué cuenta (son señas pendientes). **Leve.**
  - "Próximas reservas" no muestra de qué canal vino cada una (sitio, WhatsApp, Airbnb). **Media**
    (ver mejoras).
- **Tablet (768)**: sin barra lateral (el corte es ≤768 px) y el calendario estirado a todo el ancho con
  celdas de 90 px; "Esta semana" y "Próximas" quedan debajo, a 900 px de scroll. Es el celular estirado:
  cabía en dos columnas. **Media.**
- **Celular (390)**: el calendario y la ocupación entran bien y las celdas tienen 44 px. Problemas: las
  pestañas de propiedad cortan "Depto Centro" sin indicio de que hay más; los dos botones de arriba
  ("Bloquear fechas" / "Nueva reserva") ocupan la mitad de la primera pantalla junto con el texto de
  seña; "Esta semana" y "Próximas reservas" (lo que más se usa) recién aparecen después de 700 px de
  scroll. **Media.** En oscuro las noches reservadas son un azul marino apenas distinto del fondo
  (`capturas-extra/390-oscuro-calendario.jpg`). **Media.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Vista de todas las propiedades: grilla propiedades × días con las estadías como barras con nombre, y arriba "Hoy: llegan / salen / en casa / señas por vencer" | Alto | Medio | Estudio (Guesty Lite multicalendario, Pxsol plano de ocupación); regla `content-priority` |
| 2 | Tocar una noche libre abre "Nueva reserva" con esa entrada ya puesta (y arrastrar o tocar la salida) | Alto | Chico | Regla `primary-action`; menos pasos |
| 3 | Marcar el canal en cada estadía (ícono o texto: Sitio, WhatsApp, Airbnb) y mostrar las noches de Airbnb distintas de un bloqueo propio | Alto | Chico | Diseño § 7.1 y § 7.6; estudio T1 |
| 4 | Aviso de conflicto arriba de todo cuando una reserva choca con noches que trajo Airbnb | Alto | Medio | Diseño § 7.1 ("Si choca") |
| 5 | Decir el plazo de la seña ("se libera a las 24 h si no paga") y mostrar cuánto falta en cada pendiente | Medio | Chico | Estudio S3 (reserva tentativa que vence) |
| 6 | Leyenda y estados con algo más que color: borde punteado o ícono de reloj en "seña pendiente" | Medio | Chico | Regla `color-not-only` |

### 2.2 Modales de la agenda: Nueva reserva, detalle de la reserva y Bloquear fechas

Capturas: `capturas-extra/390-nueva-reserva.jpg`, `390-nueva-reserva-2.jpg`, `1280-nueva-reserva.jpg`,
`390-detalle-pendiente.jpg`, `390-detalle-llega.jpg`, `390-bloquear.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Nueva reserva: huésped preseleccionado ("Sofía Ramírez · 3757 55-1101"); "+ Alguien nuevo" último en
    un `<select>` sin búsqueda: con 200 huéspedes es inusable. **Grave** (Resumen 5).
  - Nueva reserva: el total y la seña no se ven hasta elegir fechas, y no se puede tocar el precio
    (descuento, tarifa pactada por WhatsApp), ni marcar "la seña ya la pagó", ni elegir canal. **Media.**
  - Nueva reserva: el calendario ocupa 420 de los 620 px del modal y muestra un solo mes; una estadía del
    28/12 al 3/1 obliga a cambiar de mes en medio de la selección. **Leve.**
  - Detalle: "Cancelar reserva" sin confirmación ni deshacer. **Grave.**
  - Detalle: sin "Editar" (fechas, propiedad, huéspedes, precio), sin WhatsApp/llamar, sin historial de
    pagos (cuándo y por qué medio entró la seña), sin "mandar recordatorio". **Grave** para lo de editar:
    hoy el único camino para cambiar fechas es cancelar y volver a cargar.
  - Detalle: "Marcar realizada" pone `saldoPagado: true` en silencio. **Media.**
  - Modal de bloqueo: "se quita desconectando el calendario **en Configuración**", pero Calendarios es una
    sección propia, no está en Configuración. **Leve.**
- **Tablet (768)**: igual que escritorio; el modal entra bien.
- **Celular (390)**: el modal sube como hoja, bien. En el detalle la pila de botones pone **"Cancelar
  reserva" arriba**, el primero que encuentra el pulgar al bajar, y la acción principal ("Marcar
  realizada" / "Registrar seña") abajo; con tres botones apilados el pie ocupa 190 px de 844. **Media.**
  En Nueva reserva el calendario no entra en la primera pantalla y el botón "Agendar" está siempre
  activo aunque falten las fechas (el error aparece recién al tocar). **Leve.** Bloquear fechas: el
  botón "Bloquear" queda deshabilitado sin decir qué falta. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Confirmación al cancelar ("Se libera Cabaña Arrayán del 14 al 19/11. ¿Devolvés la seña de $105.100?") y deshacer en el aviso | Alto | Chico | Regla `escape-routes`; ruta de reembolso del diseño § 7.3 |
| 2 | Editar reserva (cambiar fechas o propiedad con chequeo de disponibilidad y recálculo de precio) | Alto | Medio | Estudio T1 (ficha única de reserva) |
| 3 | Botones "WhatsApp" y "Llamar" en el huésped, y "Mandar recordatorio de seña/saldo" con texto armado | Alto | Chico | Diseño § 1; estudio T3, E6 |
| 4 | Nueva reserva: el campo huésped arranca vacío, con búsqueda por nombre o teléfono y "Alguien nuevo" primero; canal (WhatsApp, teléfono, otro); total editable; "seña ya pagada" con medio | Alto | Medio | Diseño § 7.2 (F8, canales) y § 7.6 |
| 5 | "Marcar realizada" pregunta por el saldo si no estaba registrado | Medio | Chico | Integridad de Ingresos |
| 6 | Historial de la reserva: creada, seña registrada (quién, cuándo, medio), mensajes enviados | Medio | Medio | Estudio T1 (Pxsol, expediente) |
| 7 | Bloquear fechas para varias propiedades a la vez (hoy es una por vez; canchas y salones ya tienen "todas") | Bajo | Chico | Coherencia entre modos |

### 2.3 Qué hay libre

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-disponibilidad.jpg`,
`capturas/estadia/768/panel-disponibilidad.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Los tres indicadores repiten lo mismo de tres formas ("1 de 2", "1 de 2", "0 de 1") y no suman
  (son 3 propiedades, pero "de 2" porque el depto por mes va aparte). Hay que pensar para entenderlos.
  **Media.**
  - Las tarjetas dan el precio por noche, no **cuánto sale lo que preguntaron** (2 noches del 14 al 16
    con fin de semana y limpieza). Es lo primero que pregunta quien escribe por WhatsApp. **Media.**
  - No se puede filtrar por cuántos vienen (Arrayán es para 4, Lapacho para 6). **Media.**
  - "Noches" ofrece 1, 2, 3, 4, 5, 7, 10, 14: no hay 6 ni "hasta el …". **Leve.**
  - El texto del depto por mes se contradice a primera lectura: "Alquilada por Juan Pérez hasta el mié 20
    ene · libre 3 meses desde el mié 2 jun" (hay otra reserva en el medio que no se nombra). **Leve.**
  - El rótulo "Meses (por mes)" es redundante. **Leve.**
- **Tablet (768)**: los 3 indicadores quedan 2 + 1 con un hueco a la derecha, y los filtros en dos filas
  (Entrada y Noches arriba, Meses solo abajo). Las tarjetas de propiedades 2 + 1. **Leve.**
- **Celular (390)**: los tres indicadores ocupan 300 px **antes** de los filtros; quien entra a
  contestar una consulta tiene que bajar para cambiar la fecha y otra vez para ver el resultado. El orden
  debería ser fechas → resultado. **Media.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Total de la estadía por propiedad (con temporada, fin de semana, limpieza) y la seña | Alto | Chico | Ya existe `precioEstadia`; regla `content-priority` |
| 2 | "Copiar respuesta" / "Responder por WhatsApp": "Para el 14 al 16/11 tengo Cabaña Lapacho (hasta 6), total $209.000, seña $55.200. ¿Te la reservo?" | Alto | Chico | Diseño § 1 (WhatsApp); el propio subtítulo de la pantalla |
| 3 | Filtro de huéspedes y ocultar o marcar lo que no entra | Medio | Chico | Regla de filtrado; estudio (todas las reservas directas lo piden) |
| 4 | Filtros arriba y fijos en celular; indicadores abajo o fuera (son secundarios aquí) | Medio | Chico | Regla `content-priority` |
| 5 | "Hasta" como segunda fecha (o calendario de rango), en vez de la lista cerrada de noches | Medio | Chico | Regla de formularios (menos fricción) |
| 6 | "Mandar link de reserva con estas fechas" (el sitio ya acepta `?propiedad=`; sumar fechas) | Medio | Chico | Cierra la venta sin cargar a mano |

### 2.4 Huéspedes

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-clientes.jpg`, `capturas-extra/390-cliente.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: la tabla se lee bien. Problemas: el orden es "por la reserva más lejana en el
  futuro" (Valentina con reserva en febrero primero) y no se puede cambiar; los teléfonos no son
  tocables; no hay forma de cargar un huésped sin reserva ni de editar uno; "Gastado $0" en Valentina,
  que tiene reserva y seña pendiente, se lee como "no vale nada". Juan Pérez, que **está viviendo ahora**
  en el depto, figura con "Próxima —" y "Última mar 20 oct": no hay estado "en casa". **Media.**
- **Tablet (768)**: muestra las **tarjetas de celular estiradas** a 670 px (rótulo a la izquierda,
  valor a 600 px de distancia), y cada huésped ocupa 220 px: 7 huéspedes son 1.600 px de scroll cuando la
  tabla entraba. Los indicadores 2 + 1 con hueco. **Media.**
- **Celular (390)**: tarjetas de 200 px con 4 filas rótulo/valor; 7 huéspedes ≈ 1.450 px. Para una
  lista de búsqueda es muy poco denso: alcanzaría nombre, teléfono y una línea "9 reservas · $1.932.500 ·
  próxima mar 17 nov". **Media.** El modal del huésped (`capturas-extra/390-cliente.jpg`) está bien
  armado (nota "Pidió factura A", historial), pero sin WhatsApp ni editar ni agregar nota. **Media.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | WhatsApp y llamar desde la fila y la ficha | Alto | Chico | Diseño § 1; estudio T3 |
| 2 | Lista compacta en celular y tabla desde 768 | Medio | Chico | Regla `content-priority`, densidad |
| 3 | Orden elegible (próxima llegada, más reservas, más gastado, A–Z) y estado "en casa ahora" | Medio | Chico | Regla de datos |
| 4 | Editar huésped y notas (preferencias, "pidió factura A", "trae mascota") desde la ficha | Medio | Chico | Estudio T1 |
| 5 | "Volver a invitar" a los que vinieron (mensaje con link de reserva) — conecta con el mensaje de Agradecimiento | Medio | Chico | Estudio E7 |
| 6 | Exportar a CSV (para el contador o para una lista de difusión) | Bajo | Chico | Pedido típico del rubro |

### 2.5 Ingresos (en el diseño, "Estadísticas")

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-ingresos.jpg`, `capturas-extra/390-oscuro-ingresos.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - "Facturado … por la fecha de la reserva": no queda claro si es la fecha en que **reservaron** o la de
    la **estadía**. Por eso el depto de $520.000/mes aparece casi en cero en "Por propiedad". Un dueño
    piensa en "lo que gané en noviembre" = noches de noviembre. **Media.**
  - "Por propiedad" es un gráfico de barras verticales con valor solo en la más alta: no se sabe cuánto
    aportó Arrayán ni el depto. Con 3–5 propiedades conviene barras horizontales con monto y % al lado.
    **Media.**
  - "▼ 52,3%" en rojo sin decir contra cuánto (no muestra el monto del mes pasado). **Leve.**
  - Ocupación 17% acá y 37% en el Calendario de Arrayán: son cosas distintas (total vs. una propiedad,
    hasta hoy vs. mes entero) pero nada lo explica. **Leve.**
  - "Llegadas y salidas" vive acá: no es un número, es operación del día; acá nadie la busca. **Media.**
  - "Por cobrar" incluye un "Saldo" de Juan Pérez definido como "saldos de reservas ya realizadas", pero
    su estadía está en curso hasta enero. **Leve.**
- **Tablet (768)**: bien resuelto en dos columnas. Solo el botón "Filtros: Este mes" agrega un toque para
  algo que entraba como segmentado (como en 1280). **Leve.**
- **Celular (390)**: los 4 indicadores en 2 × 2 entran; los gráficos tienen rótulos de 10–11 px y solo
  un valor visible. "Por cobrar" y "Llegadas" quedan a 1.100 px de scroll. **Media.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Ingresos **por canal** (sitio, WhatsApp, Airbnb, a mano) y con lo de Airbnb importado del CSV, neto de comisión | Alto | Medio | Diseño § 7.2 y § 7.6; estudio E9, E10 |
| 2 | Contar por noches de la estadía (o dejar elegir) y decirlo en una línea clara | Alto | Chico | Diseño § 7.6; Hospitable (métricas explicadas) |
| 3 | Tarifa promedio por noche y ocupación **por propiedad**, en lenguaje simple ("cada noche ocupada te dejó $74.000") | Alto | Chico | Estudio E9 |
| 4 | "Por cobrar" con WhatsApp de recordatorio y vencimiento (saldo N días antes o al llegar) | Alto | Chico | Estudio E5, E6 |
| 5 | Mover "Llegadas y salidas" al inicio (ver 2.1) | Medio | Chico | Regla `nav-hierarchy` |
| 6 | Gastos (limpieza, servicios, comisiones) para ver ganancia, no solo ingresos | Medio | Medio | Estudio E12 (Alojando) |
| 7 | Comparación con el mismo mes del año pasado (la temporada pesa más que el mes anterior) | Medio | Chico | Estudio E9 |
| 8 | Bloque de Google (vistas, llamadas, cómo llegar, reseñas) cuando exista | Medio | Grande | Diseño § 7.4; ojo con la elegibilidad (estudio E14) |

### 2.6 Propiedades

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-propiedades.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Comodidades: la marcada se distingue de la no marcada solo por un borde y un tinte celeste suaves
    (Wi-Fi vs. Calefacción). Sin tilde, con poco contraste. **Media** (regla `color-not-only`).
  - Fotos: no se puede subir, quitar ni ordenar ("en la demo…"); en el producto real hace falta las tres
    cosas y elegir la de portada. **Media** (es la vidriera del sitio).
  - "Quitar Cabaña Arrayán" al pie, rojo, sin confirmación en el código (se descarta solo si no se guarda,
    pero el botón no lo dice). **Media.**
  - La nota al pie manda a otras tres pantallas para precio, mínimos y bloqueos: la propiedad está
    repartida en cuatro secciones. **Media** (ver transversales).
  - Faltan datos que el huésped pregunta siempre: horario de entrada/salida (está en Reglas), reglas de la
    casa (mascotas, fumar, ruidos), cómo llegar e instrucciones de llegada, Wi-Fi. **Media.**
- **Tablet (768)**: dos columnas de campos; bien. **Bien.**
- **Celular (390)**: el formulario largo (9 campos + 17 chips + fotos + mapa) entra sin scroll horizontal.
  El mapa embebido de 16:9 dentro de una página que se scrollea atrapa el gesto: al bajar con el dedo
  sobre el mapa se mueve el mapa, no la página. **Leve.** Las pestañas de propiedad, cortadas como en
  el Calendario. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Fotos reales: subir varias desde el celular, ordenar, portada, borrar | Alto | Medio | Diseño § 7.5 |
| 2 | Bloque "Llegada": instrucciones, dirección exacta, Wi-Fi, reglas de la casa, que se usen como llaves en los mensajes | Alto | Chico | Estudio E7, E8, E13 |
| 3 | Comodidades con tilde y contraste | Medio | Chico | Regla `color-not-only` |
| 4 | Duplicar propiedad (para la segunda cabaña igual) | Medio | Chico | Dueño con 2–5 unidades iguales |
| 5 | En la ficha, el link a su calendario de Airbnb y su estado de sync | Medio | Chico | Diseño § 7.1 ("pega la URL en la propiedad") |
| 6 | Importar fotos y descripción pegando el link del aviso de Airbnb | Medio | Medio | Estudio E11 (verificar condiciones de Airbnb) |

### 2.7 Temporadas y precios

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-temporadas.jpg`, `capturas-extra/390-barra-guardar.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Los montos se escriben y se ven **sin separador de miles** ("$ 120000", "$ 98000") mientras el resto
    del panel muestra "$120.000". Cuesta distinguir 12.000 de 120.000. **Media.**
  - En "Qué rige cada día" el precio va en 9,5 px gris claro ("68k"): ilegible y bajo contraste
    (regla de 12 px mínimo y 4,5:1). **Media.**
  - Las temporadas se cargan por propiedad: con tres cabañas, "Temporada alta del 18/12 al 28/2" se carga
    tres veces. **Media.**
  - "+ Alta" / "+ Baja" crean una temporada con nombre y precio sugeridos (×1,4 / ×0,8) sin decirlo. **Leve.**
  - No hay mínimo de noches por temporada (en Carnaval suele ser 3–4) ni descuento por semana o mes.
    **Media.**
- **Tablet (768)**: cada temporada ocupa 240 px (nombre, fechas y precio apilados) y el calendario queda
  a 1.400 px; en 1280 la fila entraba en un renglón. **Leve.**
- **Celular (390)**: título del header cortado ("Temporadas y pre…"). Las temporadas apiladas se leen
  bien. El calendario de precios entra, pero con el precio a 9,5 px. **Media.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Formato de miles mientras se escribe en todo campo de plata | Medio | Chico | Regla `number-tabular` / formularios |
| 2 | "Aplicar a otras propiedades" (temporadas y fin de semana) | Alto | Chico | Dueño de 2–5 unidades |
| 3 | Mínimo de noches por temporada | Medio | Chico | Práctica del rubro (Carnaval, Semana Santa) |
| 4 | Precio en el calendario a 12 px y con más contraste; tocar un día para ver el desglose | Medio | Chico | Regla de tipografía |
| 5 | Descuento por semana / por mes y precio por huésped extra | Medio | Medio | Lo que el huésped compara con Airbnb |
| 6 | Feriados argentinos sugeridos como temporada (Carnaval, Semana Santa, invierno) | Bajo | Chico | Calendario local |

### 2.8 Bloqueos

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-bloqueos.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: la fila se lee. Las fechas van en monoespaciada ("23 al 26 de noviembre"), con
  otro peso visual que el resto; el bloqueo de Airbnb aparece como "Calendario externo · Reservado por
  Airbnb" mezclado con los propios: una estadía de Airbnb no es un bloqueo para el dueño. **Leve.**
- **Tablet (768)**: bien.
- **Celular (390)**: la fila se rompe: el nombre parte en dos ("Cabaña / Arrayán") y el motivo queda
  **cortado debajo del botón Quitar** ("Mantenimie… del deck"). **Media.** "Quitar" borra con un toque,
  sin confirmar. **Leve** (hay aviso, no hay deshacer).

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | En celular, fecha arriba y propiedad + motivo abajo, Quitar como ícono con etiqueta accesible | Medio | Chico | Regla `truncation-strategy` |
| 2 | Separar "Estadías de Airbnb" (con huésped y monto cuando llegue el CSV) de "Bloqueos tuyos" | Medio | Medio | Diseño § 7.2 |
| 3 | Bloqueos pasados plegados y deshacer al quitar | Bajo | Chico | Regla `escape-routes` |

### 2.9 Reglas de reserva (común)

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-reglas.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: la cancelación es una sola para todo el negocio, pero mínimos y horarios son por
  propiedad; y lo que pasa con la seña al cancelar está en otra pantalla (Pagos). Un dueño no separa "el
  plazo" de "qué devuelvo": es una sola política. **Media** (ver Resumen 3).
- **Tablet (768)**: cada propiedad ocupa 220 px con 3 selects en 2 columnas; con 5 propiedades, 1.100 px
  de selects iguales. **Leve.**
- **Celular (390)**: 3–4 selects apilados por propiedad (10 selects para 3 propiedades) sin forma de
  "aplicar a todas". **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Una sola "Política de reserva" por propiedad (o del negocio con excepciones): seña, saldo y cuándo, cancelación y qué se devuelve, depósito | Alto | Medio | Estudio E5 (Lodgify, OwnerRez) |
| 2 | Anticipación mínima ("no reservar para hoy después de las 18") y horizonte ("hasta 12 meses") | Medio | Chico | Estudio E3 (aviso previo para cubrir la ventana de Airbnb) |
| 3 | Días entre estadías para limpieza | Medio | Chico | Estudio S6 y T2 |
| 4 | "Igual para todas las propiedades" en un toque | Bajo | Chico | Menos carga |
| 5 | Vista previa de cómo lo lee el huésped (como ya hace Pagos) | Bajo | Chico | Consistencia |

### 2.10 Recordatorios y mensajes (común)

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-mensajes.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: bien resuelto (interruptor, vista previa tipo chat, llaves que se insertan). Lo
  que falla: la llave se llama **`{sena}`** sin ñ, y las llaves en monoespaciada con llaves `{}` son jerga
  de programador para el dueño; faltan llaves clave para una cabaña (dirección/cómo llegar, Wi-Fi,
  instrucciones, saldo a pagar al llegar); los momentos son fijos (24 h antes, al día siguiente) y no
  se pueden cambiar ni sumar. **Media.**
- **Tablet (768)**: la vista previa pasa debajo del texto (bien). **Bien.**
- **Celular (390)**: el título del header se corta ("Recordatorios y m…"). En la tabla "Llaves", el
  valor de `{link}` se sale de la tarjeta (`orbita.site/cabanasdelbosque/r/RE6` cortado sin "…"). Las 9
  llaves ocupan 3 filas de chips. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Mensajes por disparador editable: al reservar, N días antes de llegar (cómo llegar, Wi-Fi), el día de llegada, al salir (pedir reseña en Google), al cancelar; con "mandar igual si ya pasó" | Alto | Medio | Estudio E7 (Smoobu) |
| 2 | Recordatorio de saldo N días antes y aviso al dueño | Alto | Chico | Estudio E6 |
| 3 | Condición "no mandar instrucciones de acceso si el saldo no está pago" | Medio | Chico | Estudio E8 |
| 4 | Cola visible "lo que se va a mandar esta semana" con cancelar uno | Medio | Medio | Estudio E7 |
| 5 | Llaves con nombre humano ("Nombre del huésped") y `{seña}` con ñ; nuevas: dirección, cómo llegar, Wi-Fi, saldo | Medio | Chico | Regla de lenguaje claro |
| 6 | Avisar que los huéspedes de Airbnb (por iCal) no reciben estos mensajes | Medio | Chico | Estudio (Smoobu: iCal no transporta mensajes) |

### 2.11 Pagos y señas (común)

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-pagos.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - "Si cancelan tarde: Se devuelve la mitad" no llega al sitio (Resumen 3). **Grave.**
  - "Lo que se paga al reservar. **El resto, en el lugar**" con "Efectivo: apagado": ¿cómo se paga el
    resto entonces? El saldo y su medio no se configuran en ningún lado. **Media.**
  - "Transferencia: prendida" con alias, pero el sitio en el paso de la seña solo ofrece "Pagar con
    Mercado Pago" (`capturas-extra/390-reserva-pago.jpg`). **Media.**
  - El texto "La seña se cobra online al reservar y va directo a tu cuenta" se repite dos veces seguidas
    (en el interruptor y en la tarjeta de la cuenta conectada). "Desconectar" Mercado Pago no pide
    confirmación. **Leve.**
  - El ejemplo de cálculo de la seña es muy bueno ("total $161.000, seña $40.800 y $120.200 en el lugar").
- **Tablet (768)**: bien.
- **Celular (390)**: bien; la frase "Así lo lee el cliente" en azul sobre celeste está justa de
  contraste. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Una sola fuente de verdad de la política de cancelación, la misma frase en Pagos, en el paso de la seña y en Mis reservas | Alto | Chico | Diseño § 7.3 punto 5 |
| 2 | Saldo: "al llegar (efectivo/transferencia)" o "N días antes (link de Mercado Pago)" con recordatorio | Alto | Medio | Estudio E5, E6 |
| 3 | Plazo para pagar la seña (vence en X horas) visible acá y en el sitio | Alto | Chico | Estudio S3; diseño § 7.3 (retención) |
| 4 | Mostrar al huésped todas las formas prendidas (MP y transferencia con alias para copiar) | Medio | Chico | Coherencia con lo configurado |
| 5 | Depósito de garantía también para estadía por noche (hoy solo en por mes) | Bajo | Chico | Diseño § 2 ("se registra, no se cobra") |

### 2.12 Calendarios (.ics) (común)

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-calendarios.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Exportar = descargar un archivo. No sirve para Airbnb ni para Google Calendar (piden URL). **Grave**
    (Resumen 1).
  - "Quitar" un calendario importado sin confirmar: libera todas sus noches. **Grave.**
  - Sin "Sincronizar ahora", sin hora de la próxima, sin error visible. **Media** (estudio E2).
  - El aviso azul habla de "APIs" y "servidor": jerga que no le dice al dueño qué hacer. **Leve.**
  - El nombre de la sección "Calendarios (.ics)" es técnico; el dueño busca "Airbnb". **Media** (el
    diseño § 7.7 ya propone "Airbnb" y "Google Maps" como canales).
  - El placeholder del nombre ("Airbnb · Cabaña Lapacho") no cambia al elegir "Para: Cabaña Arrayán".
    **Leve.**
  - No hay ayuda de **dónde** sacar la URL en Airbnb. **Media.**
- **Tablet (768)**: bien.
- **Celular (390)**: bien maquetado; el nombre del calendario importado se parte en tres líneas
  ("Airbnb · Cabaña Lapacho → Cabaña Lapacho") junto al botón Quitar. **Leve.** Pegar una URL larga en
  el celular sin botón "Pegar" es incómodo. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | URL de exportación por propiedad con "Copiar" y "Regenerar", y guía de 3 pasos con capturas de Airbnb | Alto | Medio | Diseño § 7.1 |
| 2 | Estado por calendario: última sync, "Sincronizar ahora", error y qué hacer | Alto | Chico | Estudio E2 |
| 3 | Confirmar al quitar ("Se liberan 12 noches en Cabaña Lapacho que Airbnb tiene ocupadas") | Alto | Chico | Anti-objetivo del diseño § 2 |
| 4 | Aviso al dueño después de cada reserva directa: "Actualizá el calendario en Airbnb" | Alto | Chico | Estudio E3 |
| 5 | Renombrar la sección a "Airbnb" (y más adelante "Google Maps") | Medio | Chico | Diseño § 7.7 |
| 6 | Importar ganancias de Airbnb (CSV) con vista previa y unión de avisos con propiedades | Alto | Medio | Diseño § 7.2; estudio E10 |

### 2.13 Configuración → Datos del negocio (común)

Capturas: `capturas-alto/estadia/{390,768,1280}/panel-configuracion-negocio.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: pocos datos para lo que muestra el sitio: no hay logo ni foto de portada (el alta
  sí pide logo), ni email, ni Instagram, ni horario de atención (el sitio dice "Respondemos todos los días
  de 9 a 21 h" y no se puede cambiar acá). La dirección se repite con la de cada propiedad sin decir cuál
  manda. **Media.** La dirección del sitio (`orbita.site/cabanasdelbosque`) es texto: no se puede copiar
  ni compartir de un toque. **Media.**
- **Tablet (768)**: bien.
- **Celular (390)**: título del header cortado ("Datos del …") porque conviven menú, volver, tema,
  campanita y cuenta. La descripción se corta en el textarea (3 líneas visibles de 5). **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | "Compartir mi sitio" (copiar link, WhatsApp, QR) | Alto | Chico | El sitio es el canal directo que reemplaza a Airbnb |
| 2 | Logo y foto de portada; horario de atención; Instagram y email | Medio | Chico | Lo que ya muestra el sitio |
| 3 | WhatsApp del negocio separado del teléfono (y botón de WhatsApp en el sitio) | Alto | Chico | Diseño § 1 |
| 4 | Límite de la descripción igual al del alta (160 allá, 240 acá) | Bajo | Chico | Consistencia |

### 2.14 Configuración → Equipo (común)

Capturas: `capturas-alto/estadia/{390,1280}/panel-configuracion-equipo.jpg`, `capturas/estadia/768/panel-configuracion-equipo.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**: no se puede cambiar el rol de alguien (solo quitar y volver a sumar); "Quitar"
  saca a la persona sin confirmar; no se ve si la invitación está pendiente o aceptada. **Media.**
- **Tablet (768)**: bien.
- **Celular (390)**: bien; la tabla de roles en dos columnas entra. **Bien.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Rol "Limpieza": ve solo salidas y llegadas del día por propiedad, sin plata ni datos del huésped | Medio | Chico | Estudio (Alojando: tareas por WhatsApp sin app) — versión mínima, sin "gestión de equipos" (E17) |
| 2 | Cambiar rol, estado de la invitación y reenviar | Medio | Chico | Regla de feedback |
| 3 | Confirmar al quitar | Bajo | Chico | Regla `escape-routes` |

### 2.15 Portada de la demo (sitio-inicio)

Capturas: `capturas/estadia/{390,768,1280}/sitio-inicio.jpg`. Es una pantalla interna de la demo (elegir
negocio y pantalla), no la ve un dueño ni un huésped. Solo dos notas leves: en 768 la tercera tarjeta
queda sola y la foto de "Cabañas del Bosque" es una oficina. Nada que priorizar.

### 2.16 Sitio del negocio

Capturas: `capturas/estadia/{390,768,1280}/sitio-negocio.jpg`, `capturas-extra/390-sitio-mapa.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - **No hay forma de escribir por WhatsApp** desde el sitio: solo el teléfono en el pie, como texto.
    Para un huésped argentino (o brasileño, en Iguazú) es el primer impulso. **Media-grave.**
  - Las tarjetas de propiedades no llevan a una ficha: no hay galería, descripción completa,
    comodidades ni calendario de disponibilidad por propiedad. Se reserva "a ciegas" con una foto. El
    diseño § 1 pide "sitio propio con fotos, ubicación, calendario y reseñas". **Grave** para convertir.
  - Sin reseñas ni ningún dato de confianza (cantidad de estadías, puntaje de Google). **Media.**
  - "$68k la noche, desde" arriba y "$68.000" en las tarjetas: dos formatos. **Leve.**
  - Dos botones al mismo nivel en el héroe ("Reservar estadía" y "Mis reservas"): Mis reservas es para
    quien ya reservó, pesa demasiado. **Leve.**
  - El mapa marca el centro aunque la dirección es "Ruta 12 km 5" (en la demo el punto no se mueve).
    **Leve** (demo).
- **Tablet (768)**: la foto del héroe ocupa 340 px a todo el ancho y los datos debajo quedan a media
  anchura; tarjetas 2 + 1. **Leve.**
- **Celular (390)**: título del header cortado ("Cabañas del Bo…"). La barra fija "Reservar estadía"
  abajo está bien. El mapa embebido atrapa el scroll (ver 2.6). **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Ficha por propiedad: galería, descripción, comodidades, reglas, calendario de disponibilidad y "Reservar estas fechas" | Alto | Medio | Diseño § 1 y § 7.5; estudio (Pxsol "landing por unidad") |
| 2 | Botón flotante de WhatsApp con mensaje armado ("Hola, quería consultar por …") | Alto | Chico | Diseño § 1 |
| 3 | Buscador de fechas y huéspedes en el héroe ("¿Cuándo venís?") que filtra lo libre | Alto | Medio | Patrón de todos los sitios de reserva directa |
| 4 | Reseñas (de Google cuando esté la conexión; mientras, cargadas a mano) | Medio | Medio | Diseño § 7.4; ojo E14 |
| 5 | "Cómo llegar" que abre Google Maps con la dirección | Medio | Chico | Regla de contenido útil |
| 6 | Portugués (y quizás inglés) en el sitio público | Medio | Grande | Público de Iguazú (Foz, Brasil) — sugerencia propia, a validar |

### 2.17 Reserva (el flujo del huésped)

Capturas: `capturas/estadia/{390,768,1280}/sitio-reserva.jpg`, `capturas-extra/390-reserva-cuando.jpg`,
`390-reserva-cuando-elegido.jpg`, `390-reserva-datos-errores.jpg`, `390-reserva-pago.jpg`,
`1280-reserva-cuando.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Arranca por **la propiedad**, no por las fechas: el huésped elige Arrayán, descubre que noviembre está
    casi todo tomado y tiene que volver. Para 1–5 propiedades conviene "¿cuándo y cuántos?" primero y
    después "estas están libres". **Media.**
  - El primer paso (lista de propiedades) no tiene fotos grandes ni comodidades; la decisión se toma con
    una miniatura de 96 px. **Media.**
  - El paso de la seña solo ofrece Mercado Pago (ver 2.11) y no pide aceptar reglas de la casa ni la
    política de cancelación. **Media** (estudio E13).
  - El paso de la seña muestra **dos** botones de pagar (en la tarjeta y en la barra). **Leve.**
  - Los pasos no hechos ("Tus datos", "Seña") en gris claro sobre blanco, con opacidad 0,6: bajo
    contraste. **Leve.**
- **Tablet (768)**: el resumen "Tu reserva" baja debajo de la lista y el botón vive en una barra fija
  abajo; bien.
- **Celular (390)**
  - La barra fija de abajo corta su propio texto: "Elegí entrada y salida para s…", "Cabaña Arrayán · 10
    al 12 de …". El texto que explica por qué el botón está deshabilitado es justo el que se corta.
    **Media.**
  - El calendario no tiene leyenda: los días tomados son beige y tachados, los libres blancos; se
    entiende, pero no hay forma de saber el **mínimo de noches** ni el precio por día antes de elegir.
    **Leve.**
  - El celular pide "con código de área" y asume Argentina: un huésped de Brasil o Paraguay no sabe qué
    poner. **Media** en Iguazú.
  - El desglose de precio (noche, fin de semana, limpieza, seña) está muy bien.

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Fechas y huéspedes primero; después las propiedades libres con su total | Alto | Medio | Patrón de reserva directa; menos idas y vueltas |
| 2 | La política de cancelación completa y aceptar reglas de la casa con una casilla | Alto | Chico | Estudio E13; Resumen 3 |
| 3 | Transferencia como alternativa (alias para copiar, "ya transferí", queda pendiente de que el dueño confirme) | Alto | Medio | Diseño § 7.3 punto 6 |
| 4 | Teléfono con selector de país (+54 por defecto, +55, +595) | Medio | Chico | Público de frontera |
| 5 | Mínimo de noches visible en el calendario y precio por noche al tocar un día | Medio | Chico | Menos errores al elegir |
| 6 | Barra fija sin texto cortado: dos líneas o solo el total | Bajo | Chico | Regla `truncation-strategy` |
| 7 | Mostrar cuánto tiempo tiene para pagar la seña (retención) | Medio | Chico | Diseño § 7.3 (retenida con vencimiento) |

### 2.18 Mis reservas (huésped)

Capturas: `capturas/estadia/{390,1280}/sitio-mis-reservas.jpg`, `capturas-alto/estadia/768/sitio-mis-reservas.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - La política que se muestra no es la configurada (Resumen 3). **Grave.**
  - "Cancelar" está igual de visible en una reserva **que empieza hoy** que en una de dentro de 20 días.
    El modal sí confirma, bien. **Leve.**
  - No dice cuánto queda por pagar al llegar ($270.100), ni el horario de entrada, ni cómo llegar, ni
    cómo hablar con el dueño. Es lo que el huésped busca el día del viaje. **Media.**
  - No queda claro cómo entra el huésped a esta pantalla en el producto real (la demo la muestra
    directo). Si es por código + celular, falta esa puerta. **Media** (a definir).
- **Tablet (768)**: bien.
- **Celular (390)**: título del header cortado; tarjetas claras; los botones "Agregar al calendario" y
  "Cancelar" con el mismo peso. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Por reserva: saldo a pagar y cómo, horario de entrada, "Cómo llegar" (Maps), "Escribir por WhatsApp" | Alto | Chico | Estudio E7 (información de llegada) |
| 2 | Política de cancelación real, con el monto que se devuelve hoy si cancela | Alto | Chico | Resumen 3 |
| 3 | Pagar el saldo online si el dueño lo habilita | Medio | Medio | Estudio E5 |
| 4 | Cómo se entra (link con token en la confirmación o código + celular) | Medio | Medio | A definir con el backend |

### 2.19 Alta (onboarding)

Capturas: `capturas/estadia/{390,768,1280}/alta.jpg`, `capturas-extra/{390,1280}-alta-paso-1.jpg` a
`…-paso-4.jpg`.

**Qué tiene de malo**

- **Escritorio (1280)**
  - Dos pasos para decir lo mismo: paso 1 "Alquileres" y paso 2 "Alojamiento por noche o por mes". Se
    podía elegir "Alquileres → Alojamiento" en uno. **Leve.**
  - El recorrido orbital de arriba rotula los pasos en ~8 px gris sobre negro: decorativo, ilegible.
    **Leve.**
  - Paso 3 ("Tu propiedad") viene **precargado con valores reales** ("Cabaña 1", $68.000, $25.000 de
    limpieza, mínimo 2 noches), no como ejemplo: quien apura el alta publica a $68.000 sin haberlo
    decidido. **Media.**
  - Se carga **una** propiedad; quien tiene 3 cabañas termina el alta con un sitio que muestra una sola,
    sin fotos (las fotos van "después, en Configuración"). El alta no lleva a un sitio presentable.
    **Media.**
  - No pregunta por Airbnb (la razón número uno para usar el panel: no reservar dos veces). **Media.**
  - La descripción permite 160 caracteres acá y 240 en Configuración. **Leve.**
- **Tablet (768)**: bien.
- **Celular (390)**: los pasos entran sin scroll horizontal; el "Volver" es solo un ícono a la izquierda
  de "Continuar" (con el indicador de Next encima en la demo). En el paso 2, "Continuar" se ve activo sin
  haber elegido nada y el error aparece recién al tocar, abajo del todo. **Leve.**

**Qué le falta o qué sumarle**

| Prioridad | Qué | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| 1 | Paso opcional "¿Estás en Airbnb?": pegar la URL del calendario de cada aviso y copiar la de Órbita | Alto | Medio | Diseño § 7.1; estudio E15 (el calendario unificado es lo que engancha) |
| 2 | Cargar 1 a 5 propiedades en el alta (nombre, capacidad, precio) y al menos una foto cada una | Alto | Medio | Público de 1–5 unidades |
| 3 | Precios vacíos con ejemplo como placeholder, no como valor | Medio | Chico | Regla de formularios |
| 4 | Pregunta de elegibilidad de Google (complejo con atención vs. depto suelto) antes de prometer Maps | Medio | Chico | Estudio E14 |
| 5 | Importar fotos y descripción desde el link del aviso de Airbnb | Medio | Medio | Estudio E11 |
| 6 | Un solo paso para módulo + modo | Bajo | Chico | Menos pasos |

---

## 3. Problemas transversales

1. **Navegación en celular (Media-grave).** Todo pasa por la hamburguesa: 12 secciones en un cajón de
   272 px donde "Configuración" queda debajo del pliegue (`capturas-extra/390-drawer.jpg`). Cada cambio
   de sección son dos toques y perder el lugar. El buscador (Ctrl K) **se oculta debajo de 1100 px**
   (`LayoutPanel.tsx`: `@media (max-width: 1100px) { .rvp-buscar { display: none; } }`), así que en
   celular y tablet no hay forma rápida de encontrar a un huésped o una reserva salvo entrar a
   Huéspedes. Propuesta: barra inferior con 4 destinos (Hoy, Libre, Huéspedes, Números) + "Más", y el
   buscador como ícono en el header. Regla `bottom-nav-limit` (≤5) y `nav-hierarchy`.
2. **Header de celular sobrecargado (Media).** Menú, volver (en Configuración), tema, campanita y cuenta
   comen el lugar del título, que se corta en casi todas las secciones: "Temporadas y pre…",
   "Recordatorios y m…", "Datos del …", "Cabañas del Bo…" en el sitio. El cambio de tema no necesita estar
   en el header del celular (puede ir en el menú de la cuenta).
3. **Tablet = celular estirado (Media).** El panel pasa a hamburguesa en ≤768 px y casi todas las
   pantallas quedan en una columna: Calendario con celdas de 90 px, Huéspedes con tarjetas de 670 px en
   lugar de tabla, indicadores 2 + 1 con hueco (Qué hay libre, Huéspedes). Un iPad en vertical tiene
   lugar para dos columnas y para la tabla. Regla `breakpoint-consistency`.
4. **Selector de propiedad en pestañas horizontales (Media).** Calendario, Propiedades y Temporadas usan
   un segmentado que en 390 corta la tercera propiedad sin flecha ni degradé, y con 5 no entra. Para 1–5
   unidades, un desplegable con la propiedad actual o chips que bajan de línea funciona mejor. Y la
   propiedad elegida no se recuerda entre secciones.
5. **La propiedad está repartida en cuatro secciones (Media).** Datos y fotos en Propiedades; precio y
   temporadas en Temporadas; mínimos y horarios en Reglas; bloqueos en Bloqueos; su calendario de Airbnb
   en Calendarios. Para cargar "la cabaña nueva" hay que pasar por cinco pantallas. Una ficha de
   propiedad con pestañas (Datos · Precios · Reglas · Calendario/Airbnb) resolvería la mayoría.
6. **Acciones destructivas sin confirmación (Grave por la de cancelar).** Cancelar reserva, Quitar
   calendario externo, Quitar persona del equipo, Quitar bloqueo y Desconectar Mercado Pago se ejecutan
   con un toque. Solo el sitio (cancelar desde Mis reservas) confirma. Regla `escape-routes`: confirmar
   lo que no se deshace y ofrecer "Deshacer" en el aviso para lo demás.
7. **WhatsApp ausente en el panel (Media-grave).** El producto se vende a quien vive en WhatsApp, y
   ningún teléfono del panel ni del sitio es tocable. `wa.me` y `tel:` son cambios chicos con mucho
   efecto (estudio, resumen 10).
8. **Montos y números (Media).** En los campos de plata no hay separador de miles ("$ 120000") y en la
   lectura sí ("$120.000"); en el sitio conviven "$68k" y "$68.000". Las fechas de Bloqueos y los
   rótulos (kicker "ALOJAMIENTO POR NOCHE O POR MES", llaves de mensajes) van en monoespaciada: está bien
   para cifras tabulares, no para texto. Rótulos de 9,5–11 px en Temporadas y gráficos. Regla de 12 px
   mínimo.
9. **Estados solo con color y contraste bajo (Media).** Seña pendiente en amarillo casi blanco,
   comodidades marcadas con un celeste suave, reservado/libre en oscuro con poca diferencia, pasos no
   hechos al 60 % de opacidad. Regla `color-not-only` y 4,5:1.
10. **Jerga (Leve-media).** ".ics", "APIs", "servidor", "llaves", "{sena}", "Calendarios (.ics)". El dueño
    piensa en "Airbnb", "datos del huésped" y "seña".
11. **Kicker repetido (Leve).** Cada página de configuración lleva arriba "ALOJAMIENTO POR NOCHE O POR
    MES": no aporta (el dueño sabe qué alquila) y empuja el contenido 20 px en celular.
12. **Cambios sin guardar al navegar (Media, a verificar en el producto).** La barra "Tenés cambios sin
    guardar" aparece bien, pero no encontré en `LayoutPanel.tsx` un aviso al cambiar de sección desde el
    menú con cambios pendientes; si no existe, el borrador se pierde en silencio.
13. **Datos de la demo que contradicen los textos (Leve, pero se ve en videos y ventas).** "Si no se paga,
    el lugar se libera" con señas pendientes desde el 15/10; Mateo Díaz "Reservada el lun 16 nov" con
    hoy en sáb 14; "Gastado $0" en una huésped con reserva. Conviene ajustar el negocio de ejemplo para
    que muestre lo que el texto promete.
