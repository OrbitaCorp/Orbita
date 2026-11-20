# Auditoría UX/UI: Alquileres, modo canchas por hora

Fecha: 20/11/2026. Alcance: lo propio de canchas (complejo de fútbol 5 y pádel; también salas de
ensayo, boxes, estudios, coworking). Panel: Reservas, Qué hay libre, Clientes, Ingresos, Canchas,
Extras, Precios por horario, Días bloqueados. Sitio público: inicio, página del negocio, reserva,
mis reservas. Reglas, Mensajes, Pagos, Calendarios, Configuración y el alta los revisa otro auditor.

**Material.** Capturas de la demo ("hoy" fijo: sábado 14/11/2026, 10:40), en modo claro, a 390, 768
y 1280 px. Cuando dice `capturas/…` es lo que se ve al abrir la pantalla; `alto/…` es la ventana
alta (`capturas-alto/cancha/<ancho>/…`). Los estados que faltaban (modales, pasos de la reserva) los
saqué con Playwright y quedaron en `scratchpad/aud-cancha/` (los cito como `aud/…`). El código es
el de `apps/web/src/modules/alquileres/` y el kit `apps/web/src/design-system/reservas/`.

**Vara.** Las reglas de la skill `ui-ux-pro-max`: accesibilidad (contraste, foco, no depender solo
del color), toque de 44 px y 8 px de separación, nada de scroll horizontal en celular, formularios
(etiquetas, errores al lado del campo, confirmar lo destructivo, deshacer), navegación predecible y
datos legibles (valores, leyendas, unidades). Las ideas de producto salen de
`estudio-sistemas-similares.md` (C1 a C7, S3, T1, T3) y lo digo en cada caso.

**Fuera de la auditoría.** La barra negra de arriba ("Índice · Alta · Panel…", "VISTA PREVIA LOCAL")
y el botón redondo "N" de abajo a la izquierda son de la demo y de Next en desarrollo: no son del
producto. `sitio-inicio` es el índice de la demo, no la portada del negocio (ver § 9).

**Severidad.** *Alta*: hace perder plata o una reserva, o lleva a un error que el usuario no ve.
*Media*: cuesta tiempo todos los días o confunde. *Baja*: prolijidad.

---

## Resumen

### Los 5 problemas más graves

1. **Agendar a mano puede quedar a nombre de otra persona.** El modal "Nueva reserva" arranca con un
   cliente ya elegido (el primero de la lista: "Sofía Ramírez · 3757 55-1101"). Si el encargado elige
   la hora y toca Agendar, la reserva queda a nombre de Sofía. El selector es un `<select>` con
   todos los clientes y sin búsqueda, y ofrece horarios de hoy que ya pasaron (09:00 y 10:00 cuando
   son las 10:40). Captura: `aud/390-panel-nueva.jpg`, `aud/1280-panel-nueva.jpg`. Código:
   `Reservas.tsx:541` (`useState(clientes[0]?.id)`) y `:566` (las franjas del modal no reciben
   `desde: AHORA`; el sitio sí).
2. **"Cancelar reserva" del panel es inmediato y no avisa a nadie.** No pide confirmación ni deja
   deshacer, y no pregunta qué pasa con la seña ni si se le avisa al jugador. En celular es el
   primer botón de la pila, arriba de "Registrar saldo". Un toque de más libera un turno pago.
   Captura: `aud/390-panel-detalle.jpg`. Código: `Reservas.tsx:485`. El sitio sí confirma
   (`MisReservas.tsx:135`).
3. **El sitio hace elegir la cancha antes que el horario.** El jugador piensa "¿hay pádel a las 21?".
   Hoy tiene que elegir una cancha, después un día en un calendario de mes y recién ahí ve las horas.
   Si a esa hora está ocupada, vuelve atrás y prueba con otra. "Ver todos los horarios" de la portada
   tampoco muestra horarios: lleva al paso "¿Qué cancha querés?". Captura:
   `alto/1280/sitio-reserva.jpg`, `aud/390-reserva-cuando-elegido.jpg`. Playtomic y AlquilaTuCancha
   arrancan por día y hora, con todas las canchas del deporte.
4. **Un solo largo de turno y un solo horario para todo el complejo.** Pádel figura con "turnos de
   1 h" como el fútbol 5 (`aud/390-f-cuando-hora.jpg`), cuando en pádel lo habitual es 90 minutos.
   Los siete días abren igual, de 09:00 a 24:00 (`alto/1280/sitio-negocio.jpg`), y nada puede pasar
   de las 24:00: muchos complejos cierran a la 1 o a las 2. Código: `datos/index.ts:739`
   (`aperturaDe` devuelve un solo tramo para todos los días), `pasoMin`, `duracionMin` y
   `maxFranjas` son del negocio y no de cada cancha, y `HORAS` llega hasta 24:00
   (`configuracion/comun.tsx:28`).
5. **Las señas pendientes no vencen y no se pueden ver juntas.** El encabezado dice "24 reservas con
   seña pendiente: si no se paga, el lugar se libera", pero nada las libera, no hay un plazo a la
   vista y el texto no lleva a ningún lado. Ingresos muestra 8 y termina en "Y 16 más: están en la
   agenda". El aviso de seña sale "a las 24 h de reservar" (`datos/index.ts:223`), y en canchas
   buena parte de las reservas son para el mismo día. Además, toda reserva a mano con seña queda
   "pendiente" aunque el jugador haya pagado en el mostrador, porque el modal no tiene la opción
   "ya pagó". Captura: `capturas/1280/panel-reservas.jpg`, `alto/1280/panel-ingresos.jpg`.

### Las 5 mejoras de más impacto

1. **Turnos fijos** ("el grupo de los martes 21 h"): crearlos desde la agenda o desde la ficha del
   cliente, verlos en la grilla con otra marca, renovarlos y avisar si no se van a usar. Es lo que
   llena un fútbol 5. La demo ya lo pide: la ficha de Sofía tiene la nota "Juega los martes"
   (`aud/390-panel-cliente.jpg`). Fuente: C1 (AlquilaTuCancha). Impacto alto, esfuerzo medio.
2. **Buscar por horario, no por cancha**, en el sitio y en Qué hay libre: deporte y día arriba, y una
   grilla con las horas y las canchas libres de ese deporte, cada una con su precio final. Fuente:
   Playtomic, AlquilaTuCancha, EasyCancha. Impacto alto, esfuerzo medio.
3. **Deporte y largo del turno por cancha, y horario por día de la semana** (incluido pasar la
   medianoche). Sin esto, un complejo con pádel no puede configurarse bien. Impacto alto, esfuerzo
   medio (toca el modelo).
4. **La ficha de reserva que se use en el mostrador** (T1): llamar o escribir por WhatsApp con un
   toque, mover a otra hora o cancha, marcar "no vino", registrar cómo pagó (efectivo,
   transferencia, Mercado Pago), cancelar con confirmación, aviso y destino de la seña (devolver,
   perder o dejar como saldo a favor, C4). Impacto alto, esfuerzo medio.
5. **Bloquear por horas, por rango y con repetición, y cancelar en un paso a los afectados.** La
   escuelita de los martes de 18 a 20, la cancha que se riega a la mañana o un torneo de sábado con
   12 reservas tomadas. Hoy solo se bloquea el día entero, de a uno, y cada reserva se cancela a
   mano. Impacto alto, esfuerzo medio.

---

## 1. Reservas (la agenda del día)

### Qué tiene de malo

**Escritorio (1280)**
- **Lo importante queda abajo** (media). A 1280×800 la grilla arranca a las 09:00 y la primera
  reserva, la de las 17:00, aparece en el borde inferior (`capturas/1280/panel-reservas.jpg`). De 11 a
  16 son seis filas vacías: el horario fuerte de una cancha (de 18 a 24) no se ve sin scrollear.
- **Lo pasado y lo bloqueado se ven igual, y no hay leyenda** (media). Las rayas de 09:00 y 10:00 son
  horas pasadas, pero el mismo rayado (`.alg-libre:disabled`) marca una cancha bloqueada. Tampoco hay
  una línea de "ahora".
- **El rótulo de la fecha no sigue al día elegido** (media). Arriba siempre dice "SÁBADO 14 DE
  NOVIEMBRE" aunque se esté mirando el sábado 21 (`aud/390-panel-reservas-21.jpg`). Solo el chip
  marcado indica qué día se ve.
- **"24 reservas con seña pendiente" mezcla todos los días y no se puede tocar** (media; ver problema
  5 del resumen). Ese día hay una sola.
- **La tarjeta de la reserva no dice lo que el mostrador necesita** (media). Muestra nombre, horario
  y estado, pero no si debe el saldo ("debe $22.500") ni si lleva luz o pelotas. Hay que abrir cada
  una.
- **Los huecos libres solo se descubren con el mouse encima** (baja). El "+" de cada celda libre
  aparece con hover, y nada dice que se puede tocar una celda para agendar.

**Tablet (768)**
- **Pasa a lista y pierde la grilla** (media). El corte es `max-width: 768px` (`Reservas.tsx:105`),
  así que a 768 se ve la lista por cancha (`alto/768/panel-reservas.jpg`), cuando cuatro columnas de
  ~170 px entran sin problema. Con la lista no se ven los huecos.

**Celular (390)**
- **La lista no muestra los huecos libres** (media-alta). Cada cancha lista solo sus reservas y
  termina en "Agendar en Cancha 1", que abre el modal sin hora (`alto/390/panel-reservas.jpg`). Para
  contestar "¿tenés a las 20?" hay que ir a Qué hay libre.
- **La tira de días queda cortada en los bordes** (baja). "JUE" aparece cortado a la izquierda y
  "LUN" a la derecha (`capturas/390/panel-reservas.jpg`). Es un scroll horizontal a propósito, pero se
  lee como un error de maquetado.
- **Detalle de la reserva** (`aud/390-panel-detalle.jpg`): "Cancelar reserva" en rojo es el primer
  botón y cancela sin preguntar (alta, problema 2 del resumen). El teléfono "3757 55-1102" es texto:
  no llama ni abre WhatsApp (media). No se puede cambiar la hora ni la cancha: solo cancelar y volver a
  agendar (media).
- **Nueva reserva** (`aud/390-panel-nueva.jpg`): el cliente viene elegido de antemano, ofrece horas
  ya pasadas y no tiene "ya pagó la seña" (alta, problemas 1 y 5 del resumen). Los botones de hora no
  muestran el precio de la franja.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Turnos fijos: crear "todos los martes 21 h", verlos en la grilla con otra marca, renovarlos y suspender una fecha | Alto | Medio | C1, AlquilaTuCancha; la nota "Juega los martes" de la demo |
| Detalle accionable: WhatsApp o llamar, mover de hora o cancha, "No vino", medio de pago, cancelar con confirmación, aviso y destino de la seña | Alto | Medio | T1 (Pxsol), Playtomic; regla `confirmation-dialogs` y `undo-support` |
| Nueva reserva: buscador de cliente (nombre o celular) sin nadie elegido, "Pagó la seña / sin seña", sin horas pasadas | Alto | Chico | Reglas de formularios; el sitio ya filtra las horas pasadas |
| En celular, intercalar los huecos libres en la lista de cada cancha ("20:00 libre +") | Alto | Chico | Práctica de AlquilaTuCancha y Playtomic (agenda por cancha con huecos) |
| Lista y filtro de "señas pendientes" con plazo y "liberar" en un toque; reserva tentativa que vence sola en X minutos | Alto | Medio | S3 (ROLLER), C2 |
| Arrancar la grilla en la hora actual (o en la primera reserva), con línea de "ahora" y leyenda de rayado | Media | Chico | Reglas `content-priority`, `color-not-only` |
| Grilla también en tablet (desde ~700 px) | Media | Chico | Regla `breakpoint-consistency` |
| En la tarjeta: "debe $X" y los extras como íconos | Media | Chico | Uso de mostrador |
| Cobrar bebidas y alquiler de paletas en la caja del POS, atado al turno | Media | Chico | C5 (Playtomic Professional, caja de ATC) |
| Arrastrar una reserva para moverla (escritorio) | Baja | Medio | Playtomic Manager |

---

## 2. Qué hay libre

### Qué tiene de malo

**Escritorio (1280)**
- **Para responder "¿hay a las 21?" hay que recorrer cuatro tarjetas** (media-alta). Los horarios
  están agrupados por cancha (`alto/1280/panel-disponibilidad.jpg`). La pregunta del teléfono es por
  hora y por deporte.
- **El precio que se ve no es el que se cobra** (media). La tarjeta dice "$45.000 la hora" y los
  botones de 19:00 a 21:00 valen $51.800 por la franja de +15%. El encargado que lee el precio por
  teléfono pasa uno equivocado.
- **No se puede filtrar por deporte** (media). Fútbol 5, pádel y tenis aparecen mezclados.
- **Los tres números de arriba no ayudan a decidir** (baja). "LIBRES HOY 42" cuenta horarios sueltos.
  "AHORA MISMO 4 de 4" sirve. "MAÑANA 43" no dice cuándo.

**Tablet (768)**
- La tercera tarjeta de números queda sola en una segunda fila (`alto/768/panel-disponibilidad.jpg`)
  (baja).
- La estela decorativa del fondo cruza la tira de días por encima de "JUE" (baja; es de todo el panel,
  ver transversales).

**Celular (390)**
- **Los números ocupan ~250 px antes del contenido** (media-baja). Son tres tarjetas en 2+1
  (`alto/390/panel-disponibilidad.jpg`), y con las cuatro canchas la página pasa los 1.300 px.
- Los botones de hora van en tres columnas y dejan ~60 px vacíos a la derecha de cada tarjeta (baja).
- La tira de días se ve cortada, igual que en Reservas (baja).
- Los botones "+ 11:00" miden 44 px de alto y están bien separados: cumplen.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Vista "por hora": una fila por horario con los chips de las canchas libres, filtrable por deporte | Alto | Medio | Playtomic y ATC (grilla día × cancha) |
| Precio final en cada botón de hora (con franja) | Media | Chico | Coherencia con el sitio |
| "Copiar para WhatsApp": "Hoy libres en F5: 18, 20 y 22 h" | Media | Chico | T3 (WhatsApp como canal); idea propia |
| Números de arriba más útiles: "libres en horario pico" en vez de "libres hoy" | Baja | Chico | — |

---

## 3. Clientes

### Qué tiene de malo

**Escritorio (1280)**
- **No se puede ordenar ni filtrar** (media). No hay orden por reservas, gasto ni última vez, y no se
  puede filtrar "no vienen hace un mes" o "deben" (`alto/1280/panel-clientes.jpg`).
- **El teléfono no es un link** (media). Ni en la tabla ni en la ficha abre WhatsApp o llama.
- **La ficha mezcla lo que viene con lo que pasó, y no se puede tocar** (media). El historial empieza
  por "sáb 5 dic", que es futuro (`aud/390-panel-cliente.jpg`). Cada fila es un `div`
  (`Clientes.tsx:98`): no abre la reserva.
- **Las canceladas no aparecen** (media). `Clientes.tsx:39` las filtra, así que no se ve quién
  cancela seguido. En canchas eso decide si a alguien se le pide seña o no.
- **No se pueden corregir el nombre, el celular ni la nota** (media).
- **Los datos de la demo no son creíbles** (baja). Son 8 clientes con 61 a 72 reservas cada uno y
  "Nuevos este mes: 0". En una demo de venta, un complejo real tiene cientos de clientes con 1 a 5
  reservas.

**Tablet (768)**
- **Usa tarjetas donde entra la tabla** (media). Cada cliente es una tarjeta de ~240 px con el rótulo
  a la izquierda y el valor a 700 px a la derecha, así que entran dos clientes por pantalla
  (`capturas/768/panel-clientes.jpg`). Además, la tercera tarjeta de números queda sola.

**Celular (390)**
- **Una tarjeta alta por cliente** (media). Cada una tiene cuatro filas y el botón "Ver"
  (`alto/390/panel-clientes.jpg`). Ocho clientes ya son ~2.000 px; con 200 no se puede usar. Alcanza
  con una fila compacta (nombre, celular, próxima reserva) y el resto en la ficha.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| WhatsApp y llamar desde la fila y la ficha | Alto | Chico | T3 |
| "Hacer turno fijo" desde la ficha | Alto | Medio | C1 |
| Historial con canceladas y "no vino", separado en próximas y pasadas, y que abra la reserva | Alto | Chico | AlquilaTuCancha (la tarjeta en garantía existe por los que faltan) |
| Saldo a favor por cliente (para devolver una cancelación sin reembolsar) | Media | Medio | C4 (Playtomic, monedero) |
| Orden y filtros: inactivos, con deuda, frecuentes | Media | Chico | Regla `sortable-table` |
| Editar los datos y la nota | Media | Chico | — |
| "Agendar de nuevo" (mismo horario y cancha) | Media | Chico | El "Repetir" que ya tiene Mis reservas |

---

## 4. Ingresos

### Qué tiene de malo

**Escritorio (1280)**
- **"Facturado" no es plata cobrada** (media). Suma las reservas confirmadas del mes por la fecha del
  turno, incluidas las que todavía no se jugaron y cuyo saldo se paga en el lugar. Además, "facturado"
  se confunde con factura de AFIP. El dueño no sabe cuánto entró de verdad
  (`alto/1280/panel-ingresos.jpg`).
- **La ocupación del 18% engaña** (media). Se mide sobre las horas abiertas de 9 a 24. En canchas, la
  mañana de un día hábil está muerta por naturaleza. Lo que importa es la ocupación en el horario
  fuerte (de 18 a 24) y por cancha.
- **"Por cobrar" se corta** (media). Muestra 8 y termina en "Y 16 más: están en la agenda", sin un link
  ni una forma de ver las otras 16.
- **Las barras no dicen cuánto vale cada una** (media-baja). Solo la más alta tiene su valor
  (`Barras`, `piezas.tsx:368`); el resto aparece con hover o foco. "Por cancha" dice "Qué parte del
  total aporta cada una" y no muestra ningún porcentaje.
- **Las semanas cortadas parecen una caída** (media-baja). "26 oct" y "30 nov" son semanas parciales
  y se ven como una caída de ventas.
- **Falta** lo que se cobró por medio (efectivo, transferencia, Mercado Pago), las cancelaciones y los
  "no vino", y cuánto sumaron los extras.

**Tablet (768)**: dos columnas, bien (`capturas/768/panel-ingresos.jpg`). Mismos problemas de
contenido.

**Celular (390)**: el período queda detrás de "Filtros: Este mes", que está bien. Las barras tienen el
mismo problema de valores y la página tiene ~1.900 px (`alto/390/panel-ingresos.jpg`) (baja).

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Separar "Cobrado" (entró) de "Reservado" (comprometido) | Alto | Chico | Reglas de datos; estudio, punto 5 |
| Cierre de caja del día por medio de pago | Alto | Medio | C5, caja de AlquilaTuCancha |
| Ocupación en horario fuerte y mapa de calor día × hora | Media | Medio | "Reportes en tiempo real" de ATC; métricas del estudio |
| "Por cobrar" completo, con link a la lista de señas pendientes | Media | Chico | — |
| Valor encima de cada barra, o % en "Por cancha" | Media | Chico | Reglas `direct-labeling` y `tooltip-on-interact` |
| Cancelaciones y "no vino" del período | Media | Chico | AlquilaTuCancha |

---

## 5. Canchas

### Qué tiene de malo

**Escritorio (1280)**
- **Se puede borrar una cancha con reservas futuras sin aviso** (alta). El tacho la saca del borrador y
  "Guardar" confirma, sin decir que la Cancha 1 tiene "73 reservas en noviembre" ni qué pasa con las
  que vienen (`alto/1280/panel-unidades.jpg`; `Canchas.tsx:36`).
- **El precio se escribe sin separador de miles** (media-baja). El campo muestra "45000" y en todo lo
  demás dice "$45.000". Con un cero de más se cobra 10 veces más.
- **No hay deporte ni largo de turno por cancha** (alta, ver problema 4 del resumen). "Detalle" es
  texto libre ("Fútbol 5 · césped sintético"), así que el sitio no puede filtrar por deporte.
- **No se puede cambiar la foto** (media). El sitio muestra una foto por cancha, y una cancha nueva
  toma la foto de portada (`Canchas.tsx:25`).
- **El ancho cambia de una sección a otra** (baja). La página mide 880 px centrados y la agenda ocupa
  todo el ancho. Al pasar de Reservas a Canchas, el título salta de x=272 a x=352.

**Tablet (768)**: bien (`capturas/768/panel-unidades.jpg`).

**Celular (390)**: "Detalle" queda cortado ("Fútbol 5 · césped s", "Pádel · cristal panc";
`alto/390/panel-unidades.jpg`) (baja). El tacho mide 44 px y queda al lado del nombre: bien.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Deporte (de una lista) y largo del turno por cancha (60/90/120) | Alto | Medio | Práctica del rubro: el pádel se juega en 90 minutos |
| Avisar al borrar si hay reservas futuras, y ofrecer "pausar" en vez de borrar | Alto | Chico | Regla `confirmation-dialogs` |
| Foto por cancha | Media | Chico | El sitio ya la muestra |
| Precio con formato de miles mientras se escribe | Media | Chico | Regla `number-formatting` |
| Techada/descubierta, con luz, jugadores (para el sitio) | Baja | Chico | EasyCancha, Playtomic (ficha de pista) |

---

## 6. Extras

### Qué tiene de malo

**Escritorio (1280)**
- **La luz es opcional y no tendría que serlo** (media). "Iluminación" es un extra que el jugador
  marca o no. Un turno de las 22 h sin luz no existe: en la práctica la luz se cobra sí o sí a partir
  de cierta hora.
- **Los extras son de todo el complejo** (media). Las pelotas de pádel no son las de fútbol, y las
  pecheras no van con el tenis. No se puede decir qué extra va con qué cancha.
- **Mezcla dos períodos** (baja-media). Cada extra dice "Pedido 116 veces · $580.000 en total", que es
  el total histórico, y la nota de abajo dice "En noviembre los extras sumaron $330.000 en 66
  reservas" (`alto/1280/panel-extras.jpg`).
- No hay cantidad (dos paletas, diez pecheras) (baja).

**Tablet (768)**: bien.

**Celular (390)**: el precio ocupa media fila y deja la otra mitad vacía, y la lista termina con un
divisor y enseguida el borde de la tarjeta (`alto/390/panel-extras.jpg`) (baja).

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Extra obligatorio por franja (luz desde las 19 h) | Media | Chico | Práctica del rubro |
| Extras por cancha o deporte | Media | Chico | Playtomic (alquiler de paletas en pádel) |
| Venta en el lugar por el POS de Órbita (bebidas, paletas) atada al turno | Media | Chico | C5 |
| Cantidad por extra | Baja | Chico | — |

---

## 7. Precios por horario

### Qué tiene de malo

**Escritorio (1280)**
- **Solo porcentajes, y salen precios raros** (media-alta). El ajuste es un % de una lista fija (de
  -30 a +30). El dueño de una cancha piensa "de 18 a 24, $50.000", y la vista previa le muestra
  $38.300 y $51.800 (`alto/1280/panel-precios.jpg`), que nadie cobra así.
- **Las franjas valen para todas las canchas** (media). No se puede poner hora pico solo en fútbol 5,
  ni una tarifa nocturna distinta para pádel.
- **"Si dos franjas se pisan, manda la primera de la lista", pero no se pueden reordenar** (media-baja).
  Tampoco avisa cuando se pisan.
- **"Hasta" llega a las 24:00** (media, problema 4 del resumen). No hay franjas después de la
  medianoche ni de feriados.
- Los días elegidos y los no elegidos se distinguen por un borde y un texto azul contra uno gris, y
  "Sáb" y "Dom" sin marcar casi no se ven distintos (baja).

**Tablet (768)**: bien.

**Celular (390)**: bien. Los chips de días miden 44 px y la vista previa va en tres columnas
(`alto/390/panel-precios.jpg`). La franja no tiene nombre ("Hora pico", "Mañanas").

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Precio fijo por franja, como alternativa al % | Alto | Chico | Cómo cobran los complejos (precio por turno) |
| Franjas por cancha o deporte | Media | Medio | Playtomic (tarifas por pista) |
| Feriados con el precio del fin de semana | Media | Chico | — |
| Nombre de la franja, visible en el sitio ("Hora pico") | Baja | Chico | — |
| Aviso cuando dos franjas se pisan y orden arrastrable | Baja | Chico | Regla `error-clarity` |

---

## 8. Días bloqueados (y el modal "Bloquear un día")

### Qué tiene de malo

**Escritorio (1280)**
- **Solo días enteros, de a uno** (alta). No se pueden bloquear horas ("escuelita de 18 a 20", "riego
  a la mañana") ni un rango de días, y nada se repite (`Bloquear.tsx:18`).
- **El torneo deja el trabajo sucio al encargado** (alta). Si el día tiene reservas, el modal avisa
  "siguen en pie. Si no se va a poder usar, cancelalas desde la agenda". Un torneo de sábado con 12
  turnos tomados son 12 cancelaciones a mano, sin aviso a los jugadores y sin decidir qué pasa con las
  señas.
- **"Quitar" no pide confirmación, y aparece también en "Pasados"** (baja-media). La sección dice
  "Quedan como historial" y al lado se puede borrar ese historial (`alto/1280/panel-bloqueos.jpg`).

**Tablet (768)**: bien.

**Celular (390)**
- **La fila queda apretada** (media-baja). La fecha tiene `minWidth: 150` (`Bloqueos.tsx:31`) y al texto
  le quedan ~60 px: "Todas las / canchas" y "Cancha / inundada" en dos o tres renglones
  (`alto/390/panel-bloqueos.jpg`).
- El modal está bien: calendario de 44 px, "Bloquear" deshabilitado hasta elegir el día
  (`aud/390-panel-bloquear.jpg`).

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Bloqueo por horas, por rango y recurrente (clases, escuelita) | Alto | Medio | Playtomic (clases públicas y bloqueos en el plan Standard) |
| "Cancelar y avisar a los afectados" en un paso, eligiendo devolver la seña o dejar saldo a favor | Alto | Medio | C4, T3 |
| Confirmar "Quitar" y no ofrecerlo en los pasados | Baja | Chico | Regla `confirmation-dialogs` |
| Motivos rápidos (Torneo, Mantenimiento, Lluvia, Feriado) | Baja | Chico | — |

---

## 9. Sitio: inicio

`sitio-inicio` es el índice de la demo ("Tres formas de alquilar, un solo módulo"), no la portada que
ve un jugador: no lo audito. Solo un detalle: a 390 la barra de la demo corta "Reserva" en "R"
(`alto/390/sitio-inicio.jpg`). La portada real del complejo es la "página del negocio" (§ 10).

---

## 10. Sitio: página del negocio

### Qué tiene de malo

**Escritorio (1280)**
- **"Ver todos los horarios" no muestra horarios** (media). Lleva al paso "¿Qué cancha querés?"
  (`Home.tsx:116`).
- **El precio de las tarjetas es el base** (media). Cancha 1 dice "$45.000 la hora". A las 20 h se
  pagan $51.800, y $56.800 con luz. El jugador se entera recién en el paso del horario.
- **"$28k la hora, desde" está mal y escrito distinto** (media-baja). El tenis de lunes a viernes a la
  mañana sale $23.800 (-15%). Además, "k" no aparece en ningún otro lado del sitio ("$28.000").
- **Los "próximos horarios" son los menos útiles** (baja-media). Las cuatro tarjetas muestran "Hoy
  11:00 · 12:00 · 13:00" (`alto/1280/sitio-negocio.jpg`), las horas que nadie busca un sábado. Para
  el que quiere jugar a la noche no sirve.
- **No se puede filtrar por deporte** (media).
- **El contacto no es tocable** (media). El teléfono del pie es texto y no hay botón de WhatsApp ni
  "Cómo llegar".
- **Los horarios ocupan siete filas iguales** ("09:00 - 24:00") (baja).

**Tablet (768)**
- **La primera pantalla es solo foto** (media). La foto de portada ocupa todo el ancho y ~690 px de
  alto. El nombre empieza cerca de y=700 y el botón "Reservar cancha" de la página aparece recién
  cerca de y=950, debajo de la barra fija (`capturas/768/sitio-negocio.jpg`). Los tres datos (4
  canchas, $28k, 42 libres) usan el 60% del ancho.

**Celular (390)**
- **El nombre del complejo se corta en la cabecera** (media-baja): "Complejo La Ca…", para hacerle
  lugar a "Mis reservas" (`alto/390/sitio-negocio.jpg`). Es la marca del negocio.
- **La página es muy larga** (baja). Cuatro tarjetas con foto de ~300 px suman ~4.100 px.
- **El crédito de OpenStreetMap tapa un quinto del mapa** (baja; `aud/390-sitio-mapa.jpg`). El mapa
  carga cuando se llega a él; en las capturas de página completa sale gris, pero no es un error.
- La barra fija "Reservar cancha" no tapa contenido: cumple.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Arriba de todo: deporte + día + "¿a qué hora?", que lleve a la grilla de horarios libres | Alto | Medio | Playtomic, AlquilaTuCancha, EasyCancha |
| Botón de WhatsApp y "Cómo llegar" | Alto | Chico | T3; Google Maps |
| Precio "de $X a $Y" según el horario, calculado bien | Media | Chico | — |
| "Próximos horarios" en el horario fuerte, o los primeros de la tarde-noche | Media | Chico | — |
| Servicios del complejo (vestuarios, estacionamiento, buffet, luz) | Media | Chico | Fichas de club de Playtomic |
| Portada más baja en tablet; nombre completo en la cabecera de celular | Media | Chico | Regla `content-priority` |
| Horarios agrupados ("Todos los días, de 9 a 24") | Baja | Chico | — |

---

## 11. Sitio: reserva

### Qué tiene de malo

**Escritorio (1280)**
- **El orden es cancha → día → hora, en cinco pasos** (alta, problema 3 del resumen). Qué, Cuándo,
  Extras, Tus datos y Seña, para un turno de una hora (`alto/1280/sitio-reserva.jpg`).
- **Lo ocupado parece lo disponible** (media-alta). Las horas tomadas (18, 19, 21 y 23) y las ya
  pasadas (09 y 10) se ven igual: tachadas sobre un fondo verde claro. Con el tema verde de canchas,
  ese tinte se lee como "libre", y las libres son blancas (`aud/1280-f-cuando-hora.jpg`). Tampoco se
  distingue "ya pasó" de "lo tomó otro".
- **En hora pico dice "+15%" en vez del precio** (media). 19:00, 20:00 y 21:00 muestran "+15%"; el
  resto, "$52.000". El jugador hace la cuenta o la ve recién en el resumen ($59.800).
- **El día no viene elegido** (media). Hay que tocar el día en un calendario de mes aunque sea hoy:
  "ELEGÍ UN DÍA" (`aud/390-reserva-cuando-elegido.jpg`).
- **Si la cancha está llena a esa hora, no sugiere otra** (media). No hay un "a las 21 hay lugar en
  Cancha 1".
- Las horas van en dos columnas angostas (~216 px) al lado de un calendario ancho (baja).

**Tablet (768)**: igual que en celular, con el resumen debajo de la lista
(`capturas/768/sitio-reserva.jpg`). Bien.

**Celular (390)**
- **Dos botones primarios iguales en el paso de pago** (baja-media). "Pagar $29.900 con Mercado Pago"
  dentro de la tarjeta y "Pagar $29.900" en la barra fija (`aud/390-f-pago.jpg`).
- La fila de pasos se va de pantalla: "Seña" queda cortado en el borde (`alto/390/sitio-reserva.jpg`)
  (baja). El texto de la barra fija se corta ("Cancha 2 · Sábado 14 de novi…") (baja).
- Lo bueno: los errores de "Tus datos" aparecen debajo de cada campo (`aud/390-f-datos-error.jpg`),
  el celular usa teclado numérico, y la pantalla final tiene el código, "Agregar al calendario" y
  "Compartir" (`aud/390-f-listo.jpg`).

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| Primer paso: deporte y día (tira de 7 días con hoy elegido), y una grilla hora × cancha con las libres | Alto | Medio | Playtomic, AlquilaTuCancha |
| Precio final en cada hora | Media | Chico | — |
| Libre, ocupado y pasado bien distintos (ocupado gris, sin tinte verde; pasado oculto o atenuado) | Media | Chico | Regla `color-not-only`, `state-clarity` |
| Extras dentro de "Cuándo" o "Tus datos" (un paso menos) | Media | Chico | Regla `progressive-disclosure` |
| Pago dividido: link de Mercado Pago por jugador | Media | Medio | C3 (Playtomic) |
| Tarjeta en garantía o seña chica, con política de cancelación tardía | Alta | Medio | C2 (AlquilaTuCancha) |
| Recordar nombre y celular para la próxima | Media | Chico | — |
| Un solo botón de pago | Baja | Chico | Regla `primary-action` |

---

## 12. Sitio: mis reservas

### Qué tiene de malo

**Escritorio (1280)**
- **No se puede cambiar el horario** (media). Solo cancelar y volver a reservar, y fuera de plazo eso
  hace perder la seña (`alto/1280/sitio-mis-reservas.jpg`).
- **"Compartir" está solo en la pantalla final** (media). El que organiza un fútbol 5 tiene que
  pasarles la hora y la dirección a otros nueve, y en las tarjetas de las próximas no está.
- **No hay "Cómo llegar" ni WhatsApp** del complejo (media).
- El aviso "Ya pasó el plazo: si cancelás, la seña no se devuelve" queda al costado del botón; el modal
  de confirmación lo repite, así que alcanza (baja).

**Tablet (768)**: bien.

**Celular (390)**: bien. Las tarjetas se apilan, los botones miden 44 px y "Repetir" en las anteriores
es un acierto (`alto/390/sitio-mis-reservas.jpg`).

**Pregunta abierta (no se ve en la demo):** cómo entra el jugador a "Mis reservas" en producción (¿link
del WhatsApp, código, celular?). Si es por código, falta el campo.

### Qué le falta o qué sumarle

| Mejora | Impacto | Esfuerzo | De dónde sale |
|---|---|---|---|
| "Compartir con los jugadores" en cada reserva próxima | Media | Chico | Playtomic (partido con invitados) |
| Cambiar de horario dentro del plazo | Media | Medio | — |
| WhatsApp y "Cómo llegar" en cada tarjeta | Media | Chico | T3 |
| Partidos abiertos / "falta 1" | Baja | Grande | C6: más adelante |

---

## 13. Problemas transversales propios de canchas

1. **El tiempo es único para todo el complejo** (alta). Un largo de turno, un paso, un horario de
   apertura igual los siete días y nada después de las 24:00. Se nota en el sitio ("turnos de 1 h"
   también en pádel), en Precios ("Hasta" llega a 24:00), en los horarios del sitio (siete filas
   iguales) y en la agenda, que arma las filas con el primer tramo de apertura (`Reservas.tsx:174`).
   Si el día viniera partido (9 a 13 y 17 a 24), la tarde no se mostraría. Si un turno de 90 minutos
   empieza fuera de la grilla de 60, no se dibuja: `enCelda` busca `r.inicio === h`.
2. **El precio que se muestra no es el que se cobra** (media). Qué hay libre, las tarjetas del sitio y
   "$28k desde" usan el precio base. El precio final aparece recién al elegir la hora, y en hora pico
   como "+15%".
3. **Señas pendientes sin plazo** (alta). Ver el problema 5 del resumen. Un aviso a las 24 h no sirve
   para un turno de hoy a la noche. Hace falta una reserva tentativa que venza sola (S3) o una seña
   con Mercado Pago en el momento (C2).
4. **No existen los turnos fijos ni la repetición en ningún lado** (alta). Ni en la reserva, ni en el
   bloqueo (clases), ni en la ficha del cliente. Es el corazón comercial de un fútbol 5 (C1).
5. **El contacto nunca es tocable** (media). Ni el teléfono del detalle de la reserva, ni el de la
   ficha del cliente, ni el del pie del sitio abren WhatsApp o llaman.
6. **Lo destructivo sin red** (alta en la cancelación, baja en el resto). Cancelar una reserva, borrar
   una cancha con reservas y quitar un bloqueo no piden confirmación ni dejan deshacer. El sitio sí
   confirma la cancelación; el panel no.
7. **La fecha y la tira de días** (media-baja). El rótulo "SÁBADO 14 DE NOVIEMBRE" no cambia al mirar
   otro día. En celular, la tira de días queda cortada en los dos bordes, en Reservas y en Qué hay
   libre.
8. **Celular y tablet pierden la vista de huecos** (media). La agenda pasa a lista desde 768 y la lista
   solo muestra lo reservado.
9. **Detalles del panel que también se ven acá** (baja). La estela decorativa del fondo pasa por
   encima de botones y de la tira de días (`capturas/390/panel-reservas.jpg` sobre "Nueva reserva",
   `alto/768/panel-disponibilidad.jpg` sobre "JUE"). La agenda usa todo el ancho y las páginas de
   configuración 880 px centrados, así que el título salta de lugar entre secciones.
10. **Los datos de la demo no son creíbles para vender** (baja). Son 8 clientes con ~70 reservas cada
    uno, ocupación del 18% y "Nuevos este mes: 0". Para un video o una demo comercial conviene un
    complejo con muchos clientes de pocas reservas, la noche llena y la mañana vacía.
