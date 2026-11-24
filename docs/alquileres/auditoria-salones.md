# Auditoría UX/UI: Alquileres, modo salones por bloque

Fecha: 20/11/2026. Alcance: panel (Calendario, Qué hay libre, Eventos, Ingresos, Salones, Paquetes,
Extras, Días bloqueados) y sitio público (página del negocio, reserva, mis reservas) del modo
`bloque`, con la demo "Burbujas Eventos" (dos salones, "hoy" fijo sáb 14/11/2026, modo claro).
Reglas, Mensajes, Pagos, Calendarios, Configuración y el alta quedan para el otro auditor, salvo lo
propio de salones.

**Material.** Capturas de `scratchpad/capturas/bloque/{390,768,1280}` y `capturas-alto/...`, más
estados que no estaban (cada paso de la reserva, la ficha del evento, el modal "Nuevo evento"),
sacados con Playwright en `scratchpad/extra/{390,1280}-*.jpg`. Para los datos, leí el código de
`apps/web/src/modules/alquileres/` y del kit `design-system/reservas/`. Las ideas de competencia salen
de `docs/alquileres/estudio-sistemas-similares.md` (sección Salones: Brinden y ROLLER, ideas S1 a S7).

**Vara.** Reglas de la skill ui-ux-pro-max: accesibilidad (contraste, etiquetas, foco), toque de
44 px, sin scroll horizontal, formularios (error junto al campo, valores por defecto seguros,
confirmar acciones destructivas), navegación y datos (gráficos legibles, no depender solo del color).

**No cuento como problemas** (son de la demo o de la captura):
- la tira negra "Vista previa local" (a 390 corta el selector de modo "Salones pa…");
- el botón "N" de Next.js abajo a la izquierda, que en varias capturas tapa texto;
- los cuadros rosas vacíos del mapa y de la galería en la captura alta de celular, que son el
  `loading="lazy"` del iframe y de las imágenes en una captura de página entera;
- la fecha `11/14/2026` del input nativo, que sale en formato de EE. UU. porque el Chrome de la
  captura está en inglés.

---

## 1. Resumen

### Los 5 problemas más graves

| # | Problema | Dónde | Por qué es grave |
|---|---|---|---|
| P1 | **Un bloqueo de varios días se muestra con un día de más.** La lista dice "25 al 27 de noviembre · Salón Jardín · Pintura del salón", pero el bloqueo guardado es del 25 al 27 *sin incluir* el 27 (`hasta` exclusivo, rotulado con `rangoTxt`, que es de estadía). El 27 aparece libre en el sitio ("vie 27 nov · 1 bloque") y en el calendario del panel, y ya hay un evento ese día (Cumple de Felipe, vie 27 nov tarde, Salón Jardín). | `panel-bloqueos` (los tres anchos), `sitio-negocio`, `extra/1280-reserva-3-bloque-elegido` | El dueño lee una cosa y el sistema hace otra. O cree que el 27 está cerrado y se encuentra con una familia en el salón recién pintado, o no entiende por qué entró una reserva. Es un error de datos que se ve, no un detalle visual. |
| P2 | **El depósito de garantía no se le dice a la familia antes de pagar.** El salón pide $50.000 (Jardín) u $80.000 (Arcoíris), pero no aparece en la página del negocio, ni en "Cómo funciona", ni en el resumen de la reserva, ni en el paso de la seña. Aparece recién en la confirmación, después de pagar. | `sitio-negocio`, `extra/390-reserva-9-pago`, `extra/390-reserva-10-confirmacion` | Es un costo sorpresa (para estadía mensual el código sí lo muestra antes). Genera desconfianza y reclamos ("nadie me dijo que tenía que llevar $50.000 más"). |
| P3 | **"Cancelar reserva" en la ficha del evento no pide confirmación.** Un toque la cancela, cierra el modal y libera el bloque. En celular es el primer botón del pie, a todo el ancho y arriba de "Registrar saldo". | `extra/390-panel-ficha`, `extra/1280-panel-ficha` (`Detalle` en `admin/Reservas.tsx`) | Es una acción destructiva sobre un evento de $300.000 a $700.000, con la seña ya cobrada y la familia avisada. "Mis reservas" del sitio sí pregunta "¿Cancelar la reserva?": el panel, que es donde más se toca, no. |
| P4 | **La ficha del evento es de solo lectura.** No se pueden cambiar los invitados, el paquete, los extras, el bloque ni la fecha. Las únicas acciones son registrar seña, saldo o depósito, marcar realizada o cancelar. | `extra/*-panel-ficha` | Lo más cotidiano de un salón es "al final somos 38, no 30" o "sumale el animador". Hoy la única forma es cancelar y volver a cargar, que pierde la seña registrada y el código que la familia ya tiene. |
| P5 | **Lo que falta cobrar está mal contado en tres lugares.** (a) En Ingresos, "Por cobrar" muestra "$0 de saldos" porque solo cuenta saldos de eventos ya pasados. Los saldos de los 36 eventos próximos, que son la plata grande del salón, no aparecen en ninguna parte. (b) "Marcar realizada" da el saldo por pagado (`saldoPagado: true`) sin preguntar. (c) En Eventos, la columna "Saldo" de un evento con seña pendiente muestra solo el saldo: Catalina (3) figura con $514.500 y debe $735.000. | `panel-ingresos` (KPI "Por cobrar"), `panel-eventos` | El dueño no sabe cuánto entra este fin de semana, y cerrar un evento borra una deuda sin dejar rastro. ROLLER pone "saldos pendientes" como métrica de primer nivel (S4). |

Les siguen de cerca:
- el calendario del panel no distingue un día con un evento de uno vacío;
- el sitio no ofrece consultar por WhatsApp (el teléfono del pie ni siquiera es un link);
- con varios salones, la familia tiene que probar salón por salón para ver si su fecha está libre.

### Las 5 mejoras de más impacto

| # | Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|---|
| M1 | **Embudo consulta → presupuesto → señado → confirmado**, con un presupuesto que se manda por WhatsApp como link (paquete, extras, total, seña, depósito, vencimiento) y una **reserva tentativa que vence sola**, con la cuenta regresiva a la vista en el panel y en el link. | Alto | Medio | Brinden (embudo, presupuesto PDF; S1), ROLLER (vencimiento; S3) |
| M2 | **"A cobrar" de primer nivel:** los saldos y depósitos de los eventos que vienen, agrupados por fin de semana ("Este finde entran $1.240.000 en saldos y $130.000 en depósitos"), con "Registrar saldo" desde la lista. Que "Marcar realizada" pregunte si se cobró el saldo. | Alto | Chico | ROLLER (S4) |
| M3 | **Precio por invitado y por día.** Paquete con base más precio por persona adicional (en vez de saltos de $280.000 a $420.000 entre 30 y 31 invitados), y precio distinto de sábado y domingo contra miércoles y jueves, que hoy son los únicos días libres. | Alto | Medio | ROLLER (S2). El precio por día ya existe en canchas (reglas por franja). |
| M4 | **Qué hay libre para contestar el WhatsApp:** buscar por fecha en cualquier mes y por cantidad de invitados, y un botón "Copiar para WhatsApp" que arme el texto ("Sáb 21/11 tengo la noche en el Arcoíris, hasta 120, desde $480.000"). | Alto | Chico | El propósito que la pantalla declara ("para responder al toque cuando preguntan si hay lugar"), y la consulta como entrada natural del salón según Brinden. |
| M5 | **Ficha del evento completa:** editable, con un botón "Escribir por WhatsApp" a la familia y una **hoja de ruta** imprimible o para compartir (horario, salón, cumpleañero, invitados, paquete, extras, notas, saldo y depósito por cobrar). | Alto | Medio | ROLLER (hoja de ruta; S5) |

---

## 2. Pantalla por pantalla

### 2.1 Panel → Calendario (`panel-reservas`)

**Qué tiene de malo**

*Escritorio (1280).*
- El calendario del mes solo marca los días llenos o bloqueados (gris). En el mismo gris se ven
  el 20 (feriado) y el 21 (dos eventos). Un día con 1 de 2 bloques tomados se ve igual que un día
  vacío: el jue 19 tiene un evento (Martina, tarde) y está en blanco como el 18. Para ver qué pasa
  hay que tocar día por día. Sin conteo ni puntitos, el mes no sirve como vista general.
- La leyenda tiene dos problemas. La muestra de "Completo o bloqueado" es gris muy claro sobre
  blanco y casi no se ve: queda por debajo de 3:1 para un elemento que no es texto. Y no explica el
  tachado de lunes y martes (días cerrados) ni el punto de "hoy".
- Hay que pasar de solapa para ver cada salón ("Salón Jardín" / "Salón Arcoíris"). Con dos salones
  no hay una vista de "este finde, los dos salones", que es la pregunta de todos los días.
- "4 reservas con seña pendiente: si no se paga, el lugar se libera" no es un link y no filtra
  nada. Tampoco dice cuándo vence cada una (ver M1).
- A la derecha, abajo de las dos tarjetas del día, queda un espacio grande vacío.

*Tablet (768).* El calendario se apila arriba del día (bien), pero la grilla ocupa unos 400 px de
una tarjeta de 670: queda un bloque blanco a la derecha. Lo demás, igual que en escritorio.

*Celular (390).*
- Las celdas miden unos 42 px de lado, apenas debajo de 44. Aceptable, pero justo.
- El chip de estado ("Confirmada") baja a su propio renglón y alarga cada tarjeta. No es grave.
- La ficha que se abre al tocar un evento se cubre más de la mitad con cuatro botones apilados, y
  "Cancelar reserva" queda primero (ver 2.9).

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| En cada día del mes, un indicador por bloque (dos puntitos o "1/2", "2/2"), color propio para los bloqueados y otro para "con seña pendiente". La leyenda con los cuatro estados y el tachado. | Alto | Chico | Regla de datos: no depender solo del color; agenda de Brinden con doble reserva a la vista |
| Una opción "Todos los salones" que muestre el día (o el fin de semana) con un renglón por salón | Medio | Medio | Pedido típico de un dueño con 2 o más salones |
| Que "4 reservas con seña pendiente" sea un link a Eventos filtrado por seña pendiente, con lo que falta para que venza cada una | Medio | Chico | ROLLER (S3) |
| En el hueco de la derecha, "Próximo finde": eventos, bloques libres y saldo a cobrar | Bajo | Chico | ROLLER (S4) |

### 2.2 Panel → Qué hay libre (`panel-disponibilidad`)

**Qué tiene de malo**

*Escritorio (1280).*
- Los tres indicadores dicen casi lo mismo: "Bloques libres hoy: 1", "Este fin de semana: 2 (sáb 14
  y dom 15)" y "Próximo día con lugar: Hoy". Con "hoy" en sábado, son la misma información tres
  veces.
- La tira de días arranca tres días antes de hoy (mié 11, jue 12, vie 13), que no sirven para
  contestar "¿tenés lugar?", y llega solo hasta el mar 17. Las consultas de salón son a semanas o
  meses ("el sábado 12 de diciembre, somos 40"). No hay un salto a una fecha ni un filtro por
  invitados.
- Las tarjetas de salón ocupan 2 de 3 columnas y dejan la tercera vacía.

*Tablet (768).* Los indicadores van 2 + 1, con un hueco al lado de "Próximo día con lugar". Las
tarjetas de salón, en dos columnas, están bien.

*Celular (390).*
- La tira muestra tres días enteros y dos cortados en los bordes. El corte insinúa el scroll, está
  bien, pero los días pasados empujan "hoy" al medio.
- El botón "+ Noche 19:30-23:30" está en monoespaciada, a la misma altura que el texto de ayuda: se
  lee más como dato que como acción. Su tamaño es correcto.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| "Copiar para WhatsApp": arma el texto con la fecha, los bloques libres por salón, la capacidad y el precio desde | Alto | Chico | El propósito de la pantalla; la consulta como entrada del salón (Brinden) |
| Elegir una fecha en cualquier mes (selector de mes) y la cantidad de invitados, para ver solo los salones y paquetes que entran | Alto | Chico | ROLLER (paquete según invitados; S2) |
| Vista "próximos fines de semana": los 6 a 8 sábados y domingos que vienen, con los bloques libres de cada salón | Alto | Chico | Es lo que se vende en un salón |
| Reemplazar los tres indicadores por "Libres este finde" y "Libres el próximo finde" | Bajo | Chico | — |
| Empezar la tira en hoy | Bajo | Chico | — |

### 2.3 Panel → Eventos (`panel-eventos`)

**Qué tiene de malo**

*Escritorio (1280).*
- Columnas angostas. "Cumple de Bautista (11)" ocupa dos renglones, "Salón Jardín" se parte en
  dos, "Hasta 30 invitados · 1 extra" también. Cada fila mide unos 80 px y los 36 eventos próximos
  piden más de tres pantallas de scroll. La columna "Ficha →" se lleva unos 100 px que, con la fila
  entera tocable, sobran.
- "Paquete y extras" dice "1 extra" pero no cuál. Para saber si va el DJ hay que abrir la ficha.
- La columna "Saldo" no es "lo que falta cobrar" como promete la bajada. Con seña pendiente no suma
  la seña (ver P5c), y los eventos marcados como realizados salen "Pagado" porque marcarlos da el
  saldo por cobrado (ver P5b).
- La lista es plana: no hay separadores por día o por fin de semana ("Sábado 21: 3 eventos"), ni
  filtro por rango de fechas, ni exportar o imprimir.

*Tablet (768).* Usa la tarjeta de celular con rótulo a la izquierda y valor a la derecha, separados
por unos 600 px. El ojo cruza la pantalla en cada dato y cada evento mide unos 270 px. A este ancho
entra una tabla compacta (evento, cuándo, salón, invitados, saldo, estado) o una tarjeta en dos
columnas.

*Celular (390).*
- Cada evento es una tarjeta de unos 250 px con seis pares rótulo/valor. 36 eventos dan unos
  9.000 px de scroll sin agrupar por día.
- El filtro está colapsado en "Filtros: Próximos" (bien), pero no se ve cuántos hay por estado
  hasta abrirlo.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Agrupar por día (encabezado "Sáb 21 nov · 3 eventos · $X por cobrar") y, en celular, una tarjeta compacta de 3 renglones (quién y edad; salón, bloque e invitados; estado y saldo) | Alto | Chico | Regla de datos: escaneo; ROLLER ("días con más movimiento") |
| Columna "Falta cobrar" = seña pendiente + saldo pendiente, y que el chip de estado diga "Seña vence en 6 h" cuando corresponda | Alto | Chico | ROLLER (S3, S4) |
| Mostrar los nombres de los extras (DJ, Inflables) en vez de "2 extras" | Medio | Chico | — |
| Exportar la semana o imprimir hojas de ruta | Medio | Chico | ROLLER (S5) |
| Filtro por estado del embudo: consulta, presupuesto, señado, confirmado | Alto | Medio | Brinden (S1) |

### 2.4 Panel → Ingresos (`panel-ingresos`)

**Qué tiene de malo**

*Escritorio (1280).*
- "Por cobrar $681.000 · $681.000 de señas · $0 de saldos". Los saldos de los eventos que vienen no
  se cuentan (ver P5a). Con 36 eventos próximos, el saldo por cobrar real es de varios millones y
  la pantalla dice $0.
- "Por salón" son dos barras casi iguales y solo la del Arcoíris tiene monto ($9.985.000). El
  Jardín no tiene número. La bajada promete "qué parte del total aporta cada uno", pero no hay
  porcentaje. Para dos valores, dos números con su % se leen mejor que un gráfico.
- "Por semana" rotula solo el pico ($5.760.000) y no tiene eje: las otras semanas no se pueden
  leer. La primera barra es "26 oct" en un período que dice "dom 1 nov al lun 30 nov".
- "Facturado … por la fecha de la reserva": no queda claro si es la fecha en que se reservó o la
  del evento. En un salón, que se reserva con meses de anticipación, la diferencia es grande.
- La lista "Por cobrar" dice "Tocá una para registrar el pago", pero las filas no tienen chevron ni
  botón: no parecen tocables.

*Tablet (768).* Los rótulos de "Por paquete" se cortan en "Arcoíris · 1…", y así no se distingue
el paquete hasta 100 del de hasta 120. Lo demás está bien en dos columnas.

*Celular (390).* El mismo corte de "Por paquete", más fuerte. Los indicadores en 2 × 2 están
bien.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| "A cobrar en eventos próximos" (saldos y depósitos) como indicador y lista por fin de semana | Alto | Chico | ROLLER (S4) |
| Gasto promedio por evento y extras más pedidos (hoy los totales por extra están en Extras, sin período) | Medio | Chico | ROLLER (tablero) |
| "Por salón" como dos números con % y cantidad de eventos; "Por paquete" con el rótulo completo o en barras horizontales | Medio | Chico | Regla de datos: rótulos legibles |
| Aclarar "por la fecha del evento" o dejar elegir el criterio | Medio | Chico | — |
| Monto encima de cada barra de "Por semana", o al tocarla | Bajo | Chico | Regla de datos: tooltips |

### 2.5 Panel → Salones (`panel-salones`)

**Qué tiene de malo**

*Escritorio (1280).*
- "Detalle" es texto libre y repite la capacidad ("Pelotero y patio · hasta 60"). Si el dueño
  cambia "Capacidad máxima" a 70, el sitio sigue diciendo "hasta 60". Son dos fuentes de verdad
  para el mismo dato.
- Los bloques no se configuran: salen solos del horario general y de la duración (tarde 14-18,
  noche 19:30-23:30), iguales todos los días. No se puede tener un bloque de mañana el domingo, ni
  ponerle nombre, ni pasar de medianoche. Para un salón de fiestas o un quincho (21 a 04) es una
  limitación real; para cumples infantiles, menor.
- El depósito de garantía, que es de cada salón, vive en "Pagos y señas". Acá solo hay una nota
  que lo nombra y un botón "Ir a Paquetes". El dueño tiene que visitar tres pantallas para armar
  un salón.
- "Quitar Salón Jardín" (rojo) no avisa que hay 22 eventos en noviembre en ese salón. La barra de
  guardar sirve de red, pero no explica qué pasa con esos eventos.

*Tablet (768).* Una columna. Bien.

*Celular (390).* Todo en una columna, con campos de 44 px o más. Bien. La nota de la sección queda
larga.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Bloques editables por día de la semana (nombre, inicio y fin, que puedan pasar de medianoche) | Medio-alto | Medio | ROLLER (colchón entre fiestas, horarios por día) |
| Depósito de garantía como campo del salón (que Pagos lo lea de acá) | Medio | Chico | — |
| Armar el "detalle" del sitio con la capacidad del campo, y dejar libre solo la descripción ("Pelotero y patio") | Medio | Chico | — |
| Al quitar un salón con eventos futuros, decir cuántos son y qué pasa con ellos | Medio | Chico | Regla de acción destructiva |
| Reglas del salón visibles en el sitio (si se puede llevar torta o comida, decoración, música, edad del pelotero) | Medio | Chico | Brinden (perfil público) |

### 2.6 Panel → Paquetes (`panel-paquetes`)

**Qué tiene de malo**

*Escritorio (1280).*
- El precio va sin separador de miles ("280000"). Para un dueño que escribe en el celular, un cero
  de más o de menos no salta a la vista, y es la cifra más sensible del negocio.
- El área de "Qué incluye" tiene alto fijo y corta el cuarto renglón: en el paquete hasta 60 se ve
  "Mesa dulce armada" a medias.
- El nombre repite el campo "Hasta" ("Hasta 30 invitados" y 30). Si se cambia uno, el otro queda
  viejo.
- "24 eventos con este paquete · $8.555.000 en total" no dice de qué período (no es noviembre:
  Ingresos dice 12) y suma los extras.

*Tablet (768).* Hasta y Precio en dos columnas, bien. El área de texto también corta el cuarto
renglón.

*Celular (390).* Una columna, papelera de 44 px al lado del nombre. El cuarto renglón queda tapado
dentro del área de texto.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Precio base + precio por invitado adicional (y mínimo de invitados), en vez de solo saltos por tramo | Alto | Medio | ROLLER (S2) |
| Precio por día o bloque (sábado noche ≠ miércoles tarde) | Alto | Medio | Práctica del rubro; ya existe en canchas |
| Separador de miles en el campo de precio y área de texto que crezca con el contenido | Medio | Chico | Regla de formularios |
| Nombre propio del paquete ("Clásico", "Full") aparte de la capacidad | Bajo | Chico | — |
| Período en las estadísticas ("en los últimos 90 días") | Bajo | Chico | — |

### 2.7 Panel → Extras (`panel-extras`)

**Qué tiene de malo**

*Escritorio (1280).*
- Las estadísticas no cierran entre sí. Cada extra dice su "en total" sin período (la suma da
  $8.680.000), y el pie dice "En noviembre los extras sumaron $4.060.000 en 38 eventos" cuando
  noviembre tiene 36 (Ingresos). Un dueño que compara pierde confianza en los números.
- Los extras son del negocio entero ("en cualquiera de los salones"). No se puede decir que los
  inflables van solo en el Jardín (el del patio) ni que la cocina exclusiva es del Arcoíris.
- Precio fijo por evento: no hay extras por invitado (souvenir, menú por chico) ni por cantidad
  (dos mozos extra).
- Mismo campo de precio sin separador que en Paquetes.

*Tablet (768).* Bien.

*Celular (390).* Cada extra ocupa unos 180 px (nombre, precio debajo y estadística). Con 6 extras
se puede usar; con 15 se hace largo. Bien en lo táctil.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Extras por invitado o con cantidad | Alto | Medio | ROLLER (S2: extras que escalan con la cantidad) |
| Restringir el extra a ciertos salones o bloques | Medio | Chico | ROLLER (extras restringidos por horario) |
| Foto o una línea de descripción, que se vea en el paso Extras del sitio | Medio | Chico | ROLLER (extras sugeridos en el checkout) |
| Arreglar el período y el conteo de las estadísticas | Medio | Chico | — |

### 2.8 Panel → Días bloqueados (`panel-bloqueos`)

**Qué tiene de malo**

*Escritorio (1280).*
- "25 al 27 de noviembre" bloquea el 25 y el 26, no el 27 (ver P1).
- "Bloquear un día" bloquea de a uno: para la pintura de tres días son tres pasadas por el modal.
  Tampoco se puede bloquear solo un bloque (la noche del 31 para un evento propio).
- Las fechas van en monoespaciada con formatos distintos ("vie 20 nov" contra "25 al 27 de
  noviembre"). El ancho mínimo de 150 px de la columna de fecha no alcanza para el rango, así que
  "Salón Jardín" arranca más a la derecha que "Todos los salones" y los nombres no quedan
  alineados.

*Tablet (768).* El mismo desalineado. Lo demás, bien.

*Celular (390).* La columna de fecha se come el ancho: "Todos los / salones" y "Salón / Jardín /
Pintura / del salón" se parten en 2 a 4 renglones. Conviene la fecha arriba y el salón y el motivo
abajo.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Rotular el rango con el último día incluido ("25 y 26 nov", "del 25 al 27 inclusive") y que el modal elija un rango de días | Alto | Chico | — |
| Bloquear un bloque suelto (tarde o noche) | Medio | Chico | ROLLER (colchón y bloqueos por horario) |
| Avisar en la lista si un bloqueo pisa eventos ("hay 1 evento ese día") | Medio | Chico | El modal ya lo avisa al crearlo; la lista no |

### 2.9 Ficha del evento y "Nuevo evento" (modales del panel)

No están en las capturas originales: `extra/{390,1280}-panel-ficha.jpg` y `-panel-nuevo-evento.jpg`.

**Qué tiene de malo**

*Escritorio (1280).*
- "Cancelar reserva" sin confirmación (ver P3).
- La ficha es de solo lectura (ver P4).
- "Marcar realizada" registra el saldo sin preguntar (ver P5b).
- El teléfono de la familia es texto plano: no es un link `tel:` ni de WhatsApp.
- En "Nuevo evento", el campo Cliente viene con el primer cliente elegido (Sofía Ramírez). Si el
  dueño no lo mira, el evento queda a nombre de otra persona. Además es un `<select>` nativo con
  todos los clientes, que con 200 no sirve.
- Los errores salen en un solo mensaje al pie del formulario ("Completá quién cumple y cuántos
  vienen"), no junto a cada campo.

*Tablet (768).* Lo mismo que en escritorio.

*Celular (390).*
- El pie con cuatro botones apilados ocupa unos 170 de los 844 px. La sección "Pagos" queda
  cortada y hay que hacer scroll dentro del modal para ver total, seña y saldo.
- "Cancelar reserva" es el botón más fácil de tocar.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Confirmar la cancelación, decir qué pasa con la seña y llevarla a "Más acciones" | Alto | Chico | Regla de acción destructiva |
| Editar invitados, paquete, extras, bloque y fecha, recalculando el total y la seña | Alto | Medio | — |
| Botón "WhatsApp" a la familia, con mensajes armados (seña, saldo, recordatorio) | Alto | Chico | Brinden (consulta por WhatsApp) |
| Hoja de ruta imprimible o para compartir | Medio | Chico | ROLLER (S5) |
| Cliente vacío por defecto, con buscador por nombre o celular | Medio | Chico | Regla de valores por defecto seguros |
| En celular, dejar una acción principal (la que corresponde al estado) y el resto en un menú | Medio | Chico | Regla táctil |

### 2.10 Sitio → Inicio (`sitio-inicio`)

Es el índice de la demo ("Tres formas de alquilar, un solo módulo"), no una pantalla del producto:
no la audito como sitio del salón. Se ve prolijo en los tres anchos.

### 2.11 Sitio → Página del negocio (`sitio-negocio`)

**Qué tiene de malo**

*Escritorio (1280).*
- No hay forma de consultar. El único camino es "Reservar el salón", que termina en pagar la
  seña. El teléfono del pie es texto, sin `tel:` ni WhatsApp. Brinden lo dice claro: el salón vende
  por consulta, y una familia con dudas ("¿puedo llevar mi torta?") se va.
- No se muestra el depósito (ver P2). Tampoco las reglas del salón, qué pasa si vienen más
  invitados, ni preguntas frecuentes.
- "Horarios" muestra 14:00–24:00 de miércoles a domingo, el horario de apertura. La familia
  necesita los bloques (tarde 14 a 18, noche 19:30 a 23:30), que solo aparecen al reservar.
- La misma foto de globos aparece tres veces: portada, tarjeta del Jardín y galería. "Así son los
  salones" mezcla los dos salones sin rótulo, y la torta y el juguete son fotos de stock.
- "Próximas fechas libres" lista miércoles y jueves del Jardín (incluido el vie 27, que el dueño
  cree bloqueado: P1). No dice que los fines de semana están llenos ni ofrece "avisame si se
  libera".
- Detalles: "$280k" en el resumen contra "$280.000" en el resto; "$280.000 el paquete, desde" con
  el orden de palabras invertido; fechas y precios en monoespaciada chica.

*Tablet (768).* La foto de portada ocupa casi toda la primera pantalla (unos 550 px) y el título y
"Reservar el salón" quedan contra el borde de abajo. La barra fija de "Reservar el salón" lo
compensa. Paquetes en dos columnas, con el tercero del Arcoíris solo: correcto.

*Celular (390).*
- Hasta llegar a "Próximas fechas libres" hay unos 3.500 px: portada, salones y cinco tarjetas de
  paquete de unos 280 px cada una. La familia que solo quiere saber si hay fecha tiene que bajar
  mucho.
- La barra fija "Reservar el salón" está bien.
- Los chips de fechas miden 44 px de alto. Bien.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Botón "Consultar por WhatsApp" (fijo en celular junto a Reservar) y teléfono con `tel:` | Alto | Chico | Brinden (perfil público con formulario de consulta) |
| Depósito, bloques horarios y reglas del salón en la página, antes de reservar | Alto | Chico | Transparencia de precio; ROLLER (deslindes) |
| Buscador arriba: fecha + invitados → qué salón y qué paquete entran | Alto | Medio | ROLLER (S2) |
| Galería por salón, con rótulo, y portada distinta de las tarjetas | Medio | Chico | — |
| En celular, paquetes en un carrusel o acordeón por salón, para llegar antes a las fechas | Medio | Chico | Regla responsive (contenido primero) |

### 2.12 Sitio → Reserva (`sitio-reserva` y `extra/*-reserva-*`)

Pasos para salones: Qué (salón) → Cuándo (fecha y bloque) → Paquete (invitados) → Extras → Tus
datos → Seña.

**Qué tiene de malo**

*Escritorio (1280).*
- **El orden obliga a probar salón por salón.** Si la familia quiere el sáb 21 y elige el Jardín,
  lo ve lleno. Nada le dice que en el Arcoíris está libre la noche: tiene que volver al paso 1 y
  probar de nuevo.
- **Los invitados se piden en el tercer paso.** La familia piensa en "somos 70". Con ese dato
  arriba, el Jardín (hasta 60) ni se ofrecería.
- **El color de los días está invertido.** En el calendario (`extra/1280-reserva-3-bloque-elegido`),
  los días completos o bloqueados van en rosa de marca y tachados: el mismo tono que el día
  elegido. Los libres van sin fondo. No hay leyenda. Se lee al revés: lo resaltado parece lo
  disponible.
- El resumen repite el paquete: "Paquete: Hasta 60 invitados · 45 invitados" y abajo "Hasta 60
  invitados $420.000".
- En el paso Seña hay dos botones de pago: "Pagar $153.000 con Mercado Pago" dentro de la tarjeta
  y "Pagar $153.000" en el resumen o la barra.
- La seña del 30% se calcula sobre el total con extras ($153.000 sobre $510.000). Es la misma
  limitación que documenta ROLLER, y nadie la explica.
- No aparece el depósito (ver P2).

*Tablet (768).* Pasa al diseño de una columna con barra fija abajo. Con el teclado abierto en
"Tus datos", la barra queda arriba del teclado y tapa el campo activo. No lo pude probar en un
dispositivo real; conviene verificarlo.

*Celular (390).*
- La barra de pasos se desborda y "Seña" queda fuera de la pantalla. En el último paso, el paso
  actual no se ve en la barra (`extra/390-reserva-9-pago`): no se desplaza sola al paso actual.
- El texto de la barra fija se corta ("Salón Jardín · Miércoles 18 d…", "Elegí un paquete y
  cuántos i…").
- Los pasos ya hechos tienen 44 px (bien). Los que faltan, con opacidad 0,6 sobre gris tenue,
  quedan por debajo de 4,5:1. Para un botón deshabilitado se tolera.
- Tocar "Ir a pagar la seña" con todo vacío marca los errores junto a cada campo (bien,
  `extra/390-reserva-8-datos-errores`).

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| Con varios salones, empezar por fecha + invitados y mostrar los salones y bloques libres; o, como mínimo, en "Cuándo" avisar "ese día hay lugar en el Arcoíris" | Alto | Medio | ROLLER (paquete según invitados) |
| Depósito en el resumen y en el paso Seña ("El día del evento: $357.000 de saldo + $50.000 de depósito, que se devuelve") | Alto | Chico | — |
| Calendario con libres resaltados, llenos en gris y una leyenda | Medio | Chico | Regla de color: no depender solo del color, consistencia |
| "Reservar sin pagar todavía": pedir presupuesto o consulta, con la fecha retenida X horas | Alto | Medio | Brinden (S1), ROLLER (S3) |
| Paquete preelegido cuando es el único que entra para esos invitados | Bajo | Chico | — |
| Un solo botón de pago, barra de pasos que se desplace al paso actual y resumen sin repetir | Bajo | Chico | — |

### 2.13 Sitio → Mis reservas (`sitio-mis-reservas`)

**Qué tiene de malo**

*Escritorio (1280).*
- Cada reserva dice "$395.000 · seña $118.500 pagada", pero no cuánto queda para el día del evento
  ($276.500) ni el depósito. Es lo que la familia más pregunta la semana del cumple.
- No hay forma de escribirle al salón ni de pedir un cambio (más invitados, un extra).
- "Repetir" en las anteriores tiene sentido en canchas, no en un cumpleaños.
- En el modal de cancelar, "Sí, cancelar" va con el estilo primario en vez del de peligro.

*Tablet (768).* Bien.

*Celular (390).* Bien armado: código abajo y botones de 44 px. Mismas faltas de contenido.

**Qué le falta o qué sumarle**

| Qué | Impacto | Esfuerzo | De dónde |
|---|---|---|---|
| "El día del evento: saldo $X + depósito $Y", con link para pagar el saldo antes si el salón lo permite | Alto | Chico | ROLLER (cobrar el saldo con el medio guardado) |
| "Pedir un cambio" o "Escribir al salón" por WhatsApp | Medio | Chico | Brinden |
| Hoja de ruta del evento para la familia (horario, dirección, qué incluye, qué llevar) | Medio | Chico | ROLLER (S5) |
| Para salones, "Reservar otra fecha" en vez de "Repetir" | Bajo | Chico | — |
| Invitaciones y confirmación de asistencia | Bajo | Medio | ROLLER (S7). Lindo, no urgente. |

---

## 3. Problemas transversales de salones

1. **Los números no cierran entre pantallas (alto).** "Saldo" en Eventos, "Por cobrar" en Ingresos,
   "realizada = saldo pagado", los 38 eventos de Extras contra los 36 de Ingresos, y totales por
   paquete y por extra sin período. En un negocio que vive de señas y saldos, el dueño tiene que
   poder confiar en una sola cifra de "lo que me deben". Conviene definir una vez "falta cobrar"
   (seña pendiente + saldo + depósito) y usarla en todas las pantallas.
2. **No existe el estado "consulta / presupuesto" (alto).** Todo nace como reserva con seña. El
   embudo real del salón (Brinden: presupuestado → señado → reservado) no tiene lugar ni en el
   panel ni en el sitio, y "si no se paga, el lugar se libera" es una promesa sin reloj visible
   (ROLLER, S3).
3. **WhatsApp ausente donde importa (alto).** El salón trabaja por WhatsApp, pero ni la ficha del
   evento, ni Qué hay libre, ni el sitio, ni Mis reservas tienen un link de WhatsApp. El teléfono
   no es link en ningún lado. (Los recordatorios automáticos son de Mensajes, del otro auditor.)
4. **El depósito está escondido (alto).** Se configura en Pagos, no en Salones, y la familia lo ve
   recién al confirmar. Debería estar en la ficha del salón y en todo el recorrido de la familia.
5. **Precio rígido (alto).** Paquete por tramos sin precio por persona, sin precio por día ni por
   bloque, y extras sin cantidad. Los miércoles y jueves libres del calendario no tienen con qué
   venderse (ROLLER, S2).
6. **Con varios salones, todo es "uno por vez" (medio).** Calendario por solapa, reserva que fija
   el salón antes de la fecha, galería mezclada. Falta una vista y un recorrido "por fecha" que
   cruce los salones.
7. **Rangos de fechas con el formato de estadía (medio).** `rangoTxt` es de noches y, aplicado a
   días de salón, suma un día (P1). Revisar cualquier otro lugar de salones que lo use.
8. **Monoespaciada para fechas y precios en lugares de lectura (bajo).** Ayuda en tablas de
   números, pero en chips de fechas del sitio, en el botón "+ Noche" y en la columna de bloqueos
   baja la legibilidad y le quita aspecto de botón a lo que es tocable.
9. **Datos de la demo poco creíbles (bajo, pero pesa en ventas y videos).** "Cumple de Catalina (3)"
   con 94 invitados, Isabella (8) dos veces en la misma semana, Olivia (6) con seis reservas, y una
   torta y un juguete de stock en la galería. Para mostrarle a un dueño de salón, los datos deberían
   parecer de su negocio.

**Lo que está bien y conviene no romper:**
- los errores junto al campo en "Tus datos";
- los radios nativos con foco visible en salones, bloques y paquetes;
- "No alcanza para tus invitados" en el paquete chico;
- el aviso de limpieza entre bloques en Salones;
- la barra de guardar y descartar en las pantallas de configuración;
- la confirmación de cancelación del lado de la familia;
- los objetivos táctiles de 44 px en casi todo el celular;
- que no haya scroll horizontal de página en ningún ancho (los únicos desbordes son las tiras y la
  barra de pasos, que scrollean adentro a propósito).
