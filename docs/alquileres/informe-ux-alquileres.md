# Alquileres: qué tiene de malo cada pantalla y qué le falta

**Fecha:** 20/11/2026 · **Para:** Alan (y Ale para lo compartido)

Resumen de cuatro informes hechos sobre la demo de Alquileres (los tres modos, el sitio público y el
alta), con capturas de cada pantalla a 390 px (celular), 768 px (tablet) y 1280 px (escritorio), el
código y las reglas de UX de la skill `ui-ux-pro-max`:

- [Auditoría de estadía, pantallas comunes y alta](auditoria-estadia-y-comunes.md) (19 pantallas)
- [Auditoría de canchas](auditoria-canchas.md)
- [Auditoría de salones](auditoria-salones.md)
- [Estudio de sistemas similares](estudio-sistemas-similares.md) (10 de estadía, 3 de canchas, 2 de salones)

Ahí está el detalle por pantalla y por ancho, con la captura que muestra cada cosa. Acá va lo que importa
para decidir.

---

## 1. Lo bueno, para no romperlo

- En celular los botones, chips, pestañas y celdas del calendario llegan a 44 px y los campos a 16 px
  (sin zoom de iOS).
- No hay scroll horizontal de página en ningún ancho.
- Los formularios tienen etiqueta visible y el error debajo del campo; cada página de configuración
  avisa "Tenés cambios sin guardar".
- Hay silueta mientras carga y modo oscuro en todo el panel.

## 2. Lo que se repite en los tres modos (arreglarlo una vez arregla todo)

| # | Problema | Gravedad | Arreglo |
|---|---|---|---|
| T1 | **"Cancelar reserva" cancela con un toque**, sin confirmar ni deshacer, y en celular es el primer botón de la ficha. Lo mismo con Quitar calendario, Quitar bloqueo, Quitar persona y Desconectar Mercado Pago. El sitio sí confirma. | Grave | Confirmar lo que no se deshace (con qué pasa con la seña y si se avisa al cliente) y "Deshacer" en el aviso para lo demás. Mover Cancelar al final. |
| T2 | **La ficha de la reserva es de solo mirar:** no se cambian fecha, unidad, invitados, extras ni precio; el teléfono no abre WhatsApp ni llama; "Marcar realizada" da el saldo por pagado sin preguntar. | Grave | Ficha editable, botón "Escribir por WhatsApp" (`wa.me`) y "Llamar" (`tel:`), y que "Marcar realizada" pregunte si se cobró el saldo. |
| T3 | **"Nueva reserva" arranca con un cliente ya elegido** (el primero de la lista) en un selector sin buscador, ofrece horarios de hoy que ya pasaron y no deja marcar "ya pagó la seña" ni elegir el canal. | Grave | Campo vacío con búsqueda y "Alguien nuevo" arriba; filtrar lo que ya pasó; "Ya pagó" y canal (WhatsApp, teléfono, Airbnb, en el lugar). |
| T4 | **Las señas pendientes no vencen y los números no cierran:** el encabezado promete "si no se paga, el lugar se libera" pero nada lo libera; el panel dice 24 pendientes e Ingresos 8; el aviso de seña sale a las 24 h. | Grave | Lista de señas por vencer con plazo a la vista; vencimiento opcional por negocio (hoy decidido: la libera el dueño); un solo número. |
| T5 | **"Por cobrar" mal contado:** solo cuenta lo pasado; los saldos de lo que viene (la plata grande) no aparecen. | Grave | "A cobrar" por semana o fin de semana, con lo que viene, y "Registrar saldo" desde la lista. |
| T6 | **Navegación en celular:** todo por la hamburguesa (12 secciones, Configuración bajo el pliegue), el buscador desaparece debajo de 1100 px y el título del header se corta en casi todas las secciones. | Media-grave | Barra inferior con 4 destinos + "Más", buscador como ícono, sacar el cambio de tema del header. |
| T7 | **WhatsApp no existe en el panel ni en el sitio:** ningún teléfono es tocable. Es el canal del dueño. | Media-grave | `wa.me` con mensaje armado en fichas, listas y "Por cobrar"; botón flotante en el sitio. |
| T8 | **Tablet = celular estirado:** a 768 px todo en una columna, tarjetas de 670 px en vez de tabla, indicadores 2 + 1 con hueco. | Media | Dos columnas y tablas desde 768 px. |
| T9 | **Montos y textos:** campos de plata sin separador de miles, "$68k" y "$68.000" juntos, rótulos de 9,5–11 px, estados que se distinguen solo por un color pálido, jerga (".ics", "APIs", "llaves", "{sena}"). | Media | Formato de miles al escribir, mínimo 12 px, ícono o texto además del color, palabras del dueño. |
| T10 | **"Qué hay libre" no contesta la consulta:** muestra el precio base y no el de esa franja o esas noches, y no arma la respuesta. | Media (impacto alto) | Precio total real + botón "Copiar para WhatsApp" con disponibilidad, total y seña. |

## 3. Lo propio de cada modo

### Estadía (el foco)
- **Grave: Calendarios (.ics) no evita reservar dos veces.** "Exportar" baja un archivo, pero Airbnb pide
  una **URL** que vuelve a leer; no hay "Sincronizar ahora", última sincronización ni aviso de error, y
  "Quitar" libera todas las noches de Airbnb de un toque. Es justo lo que el diseño quiere evitar (§ 7.1
  ya pide la URL con token).
- **Grave: el sitio le promete al huésped otra política** que la configurada ("se devuelve la mitad" en
  Pagos contra "la seña no se devuelve" en Mis reservas), y la regla está partida entre Reglas y Pagos.
- **Grave para 3–5 cabañas: no hay vista de todas juntas.** El Calendario muestra una propiedad por vez;
  las llegadas y salidas de todas están escondidas en Ingresos.
- **Media: la propiedad está repartida en cinco pantallas** (Propiedades, Temporadas, Reglas, Bloqueos,
  Calendarios). Una ficha por propiedad con pestañas lo resuelve.
- **Sitio:** cada propiedad necesita su ficha (galería, comodidades, calendario, precio total) y falta el
  botón de WhatsApp.

### Canchas
- **Grave: el sitio hace elegir la cancha antes que el horario.** El jugador piensa "¿hay pádel a las 21?";
  Playtomic y AlquilaTuCancha arrancan por día y hora con todas las canchas del deporte.
- **Grave: un solo largo de turno y un solo horario para todo el complejo** (pádel con turnos de 1 h, los
  siete días iguales, nada pasa de las 24:00).
- **Media: en el sitio las horas ocupadas se ven verdosas**, como si estuvieran libres.
- **Lo que más falta: turnos fijos** ("el grupo de los martes 21 h"). La demo ya lo pide: un cliente tiene
  la nota "Juega los martes".

### Salones
- **Grave: un bloqueo de varios días muestra un día de más** ("25 al 27" deja el 27 libre, y el sitio lo
  vende). Es un error de datos: el fin del rango se guarda sin incluir y se rotula como noches de estadía.
- **Grave: el depósito de garantía ($50.000 / $80.000) aparece recién después de pagar la seña.**
- **Media: el calendario del panel no distingue un día con un evento de uno vacío**, y con varios salones
  la familia prueba salón por salón.
- **Lo que más falta:** el camino consulta → presupuesto (link para WhatsApp) → seña que vence sola, y
  precio por invitado y por día.

## 4. Lo que hay que corregir del diseño

- **Google Maps:** según Google, un dueño individual no puede tener ficha de Business Profile para su casa
  ni aparecer en el buscador de alojamientos; un complejo con atención sí. El alta tiene que preguntar qué
  tipo de dueño es, y la pantalla de Google mostrarse solo a quien puede usarla. La API además responde con
  cuota 0 hasta que Google la aprueba (hasta unos 14 días).
- **Airbnb tarda hasta 3 horas** en leer un calendario importado. Además de la URL: volver a leer el
  calendario de Airbnb **justo antes de cobrar una seña** en el sitio, y después de cada reserva directa
  avisar "entrá a Airbnb → Calendario → Actualizar".

## 5. Qué sumar para que sea realmente útil (de la competencia)

| Idea | Para | Impacto | Esfuerzo | De dónde |
|---|---|---|---|---|
| **"Hoy" de todas las propiedades:** llegan, salen, señas por vencer, saldos al llegar, conflictos con Airbnb, y una grilla de ocupación (fila por propiedad, columna por día) | Estadía | Alto | Medio | Guesty Lite, Pxsol |
| **Plan de pagos:** % de seña con Mercado Pago y saldo N días antes o en efectivo al llegar, con recordatorio del saldo | Los tres | Alto | Medio | Lodgify, OwnerRez |
| **Mensajes automáticos por momento** (al reservar, X días antes o después de llegar o salir, al cancelar), con la cola de lo programado a la vista y sin mandar las instrucciones de acceso si el saldo no está pago | Estadía | Alto | Medio | Smoobu, OwnerRez |
| **Estadísticas mínimas:** ocupación, tarifa promedio por noche, ingresos por propiedad y por canal (sumando el CSV de Airbnb leído por encabezado) | Estadía | Alto | Medio | Hospitable, Alojando, Pxsol |
| **Turnos fijos** con renovación y aviso si no se van a usar | Canchas | Alto | Medio | AlquilaTuCancha |
| **Buscar por deporte y hora** con todas las canchas y el precio final | Canchas | Alto | Medio | Playtomic, AlquilaTuCancha |
| **Presupuesto → seña que vence sola**, "a cobrar" por fin de semana y hoja de ruta del evento | Salones | Alto | Medio | Brinden, ROLLER |
| **Precio por invitado y por día** | Salones | Alto | Medio | ROLLER |
| **Paso de Airbnb en el alta** (pegar su URL y copiar la nuestra) | Estadía | Alto | Chico | Diseño § 7.1 |

**Qué no copiar para el dueño chico:** precios dinámicos, portal de propietarios, equipos de limpieza,
cerraduras inteligentes, bandeja con IA y ser socio de conectividad de Google.

**Dónde está el hueco:** la competencia directa es argentina (Alojando, US$10 por alojamiento por mes;
Pxsol, desde US$49 por mes hasta 5 deptos) y apunta más a administradores que al dueño de 1 a 5 cabañas.

## 6. Orden propuesto

Encaja en el plan del ciclo: lo de la columna "Ahora" son cambios chicos que conviene hacer mientras cada
sección se conecta a la API (semanas 2 a 4), porque se toca la misma pantalla.

| Cuándo | Qué |
|---|---|
| **Ahora** (con la conexión de cada sección) | T1 confirmar lo destructivo · T3 "Nueva reserva" sin cliente elegido y con "ya pagó" · el bloqueo con un día de más (salones) · el depósito antes de pagar (salones) · la política de cancelación coherente (estadía) · `wa.me` y `tel:` en fichas y sitio · las horas ocupadas en verde (canchas) · separador de miles |
| **Semana de estadía** | Calendarios de verdad (URL, sincronizar, error, confirmar al quitar) · vista de todas las propiedades · "Qué hay libre" con total y "Copiar para WhatsApp" |
| **Después del ciclo** (propuesta para Ale) | Barra inferior en celular · tablet a dos columnas · plan de pagos · mensajes automáticos por momento · estadísticas · turnos fijos · reserva por hora en canchas · presupuesto en salones · Google solo para complejos |
