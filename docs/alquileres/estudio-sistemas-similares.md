# Alquileres: estudio de sistemas parecidos

Fecha del relevamiento: **20 de noviembre de 2026**. Todo lo que figura acá sale de páginas oficiales
(precios, funciones, centros de ayuda) consultadas ese día, salvo donde dice "fuente de terceros" o
"no confirmado". Varios sitios (Lodgify, centro de ayuda de Lodgify, Playtomic, Tokeet ayuda,
Capterra) devolvieron 403 al leerlos automáticamente: en esos casos el dato viene de una página
alternativa del mismo proveedor o queda marcado como no confirmado. Los precios cambian seguido
(noviembre tiene promos de Black Friday en casi todos): tomalos como orden de magnitud.

---

## Resumen en 10 líneas

1. **Todos los competidores de estadía se conectan a Airbnb por API**; Órbita va por iCal. Airbnb importa calendarios **cada 3 horas** (con botón "Actualizar" limitado) y por iCal solo manda fechas bloqueadas, link de la reserva y los últimos 4 dígitos del teléfono. Hay que diseñar alrededor de esa ventana de 3 horas, no ignorarla.
2. **Copiar:** re-leer el iCal de Airbnb *justo antes* de cobrar una seña directa, mostrar "última sincronización" por calendario (como Airbnb) y detectar cancelaciones cuando un evento desaparece del feed (Beds24).
3. **Copiar:** el **plan de pagos** de Lodgify/OwnerRez: % de seña al reservar + saldo N días antes (o "en efectivo al llegar"), con aviso automático antes del vencimiento. OwnerRez trae por defecto 50 % + saldo 30 días antes.
4. **Copiar:** **mensajes por disparador** de Smoobu (al reservar, X días antes/después de llegada o salida, cancelación) con variables, cola visible de mensajes programados y "mandar igual si el disparador ya pasó".
5. **Copiar:** las métricas que repiten Hospitable, Alojando y Pxsol: **ocupación, tarifa promedio por noche, ingresos por alojamiento y mezcla de canales** (de dónde vienen). RevPAR y similares, solo como dato secundario.
6. **Ojo con Google:** Google dice que **un dueño individual no puede tener ficha de Business Profile para su casa** ni aparecer en Vacation Rentals; un complejo con administración sí puede caer en categorías de alojamiento ("cabaña", "complejo"). Choca en parte con la decisión de "manejar la ficha de Google Maps": hay que validar elegibilidad en el alta.
7. **Competencia argentina directa:** **Alojando** (US$10 por alojamiento/mes, Mercado Pago, WhatsApp, dice tener API directa con Airbnb) y **Pxsol Vacation Rentals** (desde US$49/mes hasta 5 deptos, cobra con Mercado Pago). Órbita compite con ellos, no con Guesty.
8. **Canchas:** copiar **turnos fijos**, **tarjeta en garantía / seña con Mercado Pago** (AlquilaTuCancha) y **pago dividido** entre jugadores (Playtomic). **Salones:** copiar el embudo **presupuestado → señado → reservado** con presupuesto en PDF (Brinden) y el **paquete que calcula según cantidad de invitados** (ROLLER).
9. **No copiar para el dueño chico:** precios dinámicos, portal y liquidaciones a propietarios, gestión de equipos de limpieza, cerraduras inteligentes, bandeja con IA, "100+ canales", ser socio de conectividad de Google Vacation Rentals. Son de administradores con 15+ unidades (Hostaway ni atiende a quien tiene 1).
10. **El hueco de Órbita:** nadie de afuera cobra en pesos con Mercado Pago, manda por WhatsApp y une estadía + sitio + Google en un panel simple para 1 a 5 cabañas; los locales (Alojando, Pxsol) apuntan a administradores. Ese es el posicionamiento.

---

## Tabla comparativa: estadía

| Sistema | Público | Precio de entrada (nov 2026) | Sync con Airbnb | Sitio directo | Pagos / señas | Mensajes automáticos | Estadísticas | App móvil | Google |
|---|---|---|---|---|---|---|---|---|---|
| **Lodgify** | Dueños y administradores chicos/medianos | Basic US$14, Starter US$26, Professional US$47, Ultimate US$68 por mes (la misma página muestra cifras contradictorias; terceros dan otras) | API (y iCal en todos los planes) | Desde Starter | Plan de pagos en cuotas configurable, depósito de garantía por política | Solo desde Professional ("custom message automation") | "Booking reports" en Starter; analytics avanzados en Ultimate | App para huéspedes en Ultimate; app del dueño no confirmada | Google Vacation Rentals desde Professional |
| **Smoobu** | Dueños chicos/medianos, fuerte en Europa | €29/mes + 0,9 % por reserva (Flex) o €35/mes sin comisión (Prepaid); varía con la cantidad de unidades | API (exige aceptar reserva inmediata en Airbnb) o iCal (permite solicitud de reserva) | Sí | Stripe y PayPal; señas no confirmadas | Sí, por disparadores (reserva, llegada, salida, cancelación, check-in online) | Sí (detalle no confirmado) | iOS y Android | No directo: a "Google Vacation Finder" vía HomeToGo |
| **Hospitable** | Anfitriones de Airbnb, de 1 a muchas | Essentials gratis; Host US$29 (1 prop., máx. 2); Professional US$59 (2 prop.) | API, todos los planes | Solo Professional y Mogul (1 % o 4 % + 3 %) | Cuotas y reembolsos en directo (Professional) | Mensajes programados (limitados en gratis), automáticos desde Host, IA en Mogul | Dashboard de ocupación, ingresos, noches, reseñas (completo desde Professional) | No confirmado en precios | Google Vacation Rentals en Professional |
| **OwnerRez** | Dueños y administradores, muy configurable | US$40/mes 1 propiedad, US$55 2, US$88 5; sitio web +US$15 | Integración directa (API) con Airbnb, Vrbo, Booking, Google | Add-on "Hosted Site" (+US$15 con 1 propiedad) | Plan de pagos (por defecto 50 % + saldo 30 días antes), depósito en garantía (retención o reembolsable), contrato con firma digital | "Triggers" por eventos (incluye estados del depósito) | Reportes (detalle no relevado) | No confirmado | Google Vacation Rentals incluido sin costo extra |
| **Hostaway** | Administradores de 2 a 199+ propiedades; con 1 sola, lista de espera | A cotizar (no publica precios) | Canal Airbnb (API; estado de socio no confirmado) | Motor de reserva directa | Pagos (detalle no confirmado) | Automáticos, SMS y WhatsApp, reseñas automáticas | "Advanced Reporting" | No confirmado | Google figura como canal |
| **Guesty Lite** | Anfitriones de 1 a 3 alojamientos | Desde US$9 por alojamiento/mes | Airbnb, Vrbo, Booking | Incluido | Stripe | Mensajes programados y tareas de limpieza | Analytics avanzados son add-on | Mencionada, sin detalle por plan | Solo en Pro (4+ unidades) |
| **Beds24** | Desde 1 unidad hasta hoteles; muy técnico | €14,90/mes + €3 por habitación + channel manager €0,65 por enlace | API certificada (recomendada) + iCal bidireccional | Motor de reservas sin comisión; subdominio privado +€19/mes | Cobro al huésped (señas no confirmadas) | Automatizaciones y mensajes a huéspedes y personal | No mencionadas en precios | Sí | No mencionado |
| **Tokeet** | Dueños y administradores | US$134,90/mes hasta 10 alojamientos (mensual); dice tener plan gratis sin detalle | No confirmado en precios | Constructor de sitios | Pasarelas de pago | No confirmado en precios | No confirmado | Sí | Tiene ayuda sobre Google Vacation Rentals (no se pudo leer) |
| **Pxsol Vacation Rentals** (Argentina/LatAm) | Dueños de 1 a 3, administradores de 4 a 40 y 40+ | Desde US$49/mes anual hasta 5 deptos; lista US$80 hasta 5 + US$16 por depto extra | "Airbnb, Booking y 100+ canales sincronizados" (no dice si API o iCal) | Motor propio con subdominio o dominio propio, landing por unidad | Pxsol Pay 0,5 % por cobro con **Mercado Pago**, Stripe, PayPal, Payway, WebPay | Bandeja unificada con Airbnb, Booking y **WhatsApp**; automáticos no confirmados | Plano de ocupación, registro de actividad, ingresos por unidad | No mencionada | No mencionado |
| **Alojando** (Argentina/LatAm) | Administradores de alquileres temporarios (5 a 500+) y propietarios con portal | US$10 por alojamiento/mes (1 a 9), sin comisión, prueba 30 días | Dice API directa con Airbnb, Booking, Expedia, Vrbo, Despegar (no iCal) | Sitio con pago integrado, dominio propio, editor visual | **Mercado Pago** (LatAm) y Stripe; señas no confirmadas | Bandeja unificada y asistente de **WhatsApp**; tareas de limpieza por WhatsApp | Ocupación, tarifa promedio, mezcla de canales, gastos, flujo de caja, alertas | No confirmada | No mencionado |

---

## Estadía: un apartado por sistema

### Lodgify
- Para quién: anfitriones y administradores chicos; es la referencia de "sitio propio + channel manager".
- Precios: la página oficial (vía su sitio espejo) muestra Basic US$14, Starter US$26, Professional US$47, Ultimate US$68, todos con 0 % de comisión, pero la misma página tiene otra tabla contradictoria y los terceros dan cifras distintas (16 a 103 dólares). **No confirmado** cuál rige.
- El sitio web y el motor de reservas arrancan en Starter; **Basic no trae sitio**. Los mensajes automáticos personalizados, recién en Professional.
- Airbnb: API en tiempo real; la conexión por iCal la marca como **función heredada** ("legacy") y exporta su calendario a Airbnb cada 2 horas.
- Pagos: **plan de pagos por política**: cantidad de cuotas y cuándo se cobran (ej. 25 % al reservar, 75 % 7 días antes). Opción "no programar el saldo" (lo cobra el dueño, por ejemplo en efectivo al llegar). Aviso al dueño 3 días antes de cada vencimiento. Depósito de garantía definido en la política.
- Recomienda **no encadenar plataformas** (Lodgify → Airbnb → Vrbo): cada una conectada directo al centro.
- **Para extraer:** política de reserva como objeto (plan de pagos + cancelación + depósito) que se asigna a cada propiedad; "saldo en efectivo al llegar" como opción explícita; avisar al dueño antes de cada vencimiento.

### Smoobu
- Para quién: dueños de pocas unidades; precio por cantidad de unidades. Flex €29/mes + 0,9 % por reserva; Prepaid €35/mes sin comisión. Prueba 14 días sin tarjeta.
- Airbnb: **API exige aceptar reserva inmediata**; quien quiere seguir con "solicitud de reserva" usa iCal. Su propio artículo (6/5/2026): iCal tarda **2 a 24 horas**, solo pasa fechas bloqueadas y tiene riesgo alto de doble reserva.
- Mensajes: plantillas con **disparador** (reserva, llegada, salida, cancelación), días antes/después (hasta 30) y franja horaria; **cola de mensajes programados** editable; opción de mandar aunque el momento ya pasó (reserva para el mismo día).
- Check-in online como variable en la plantilla y disparador "check-in online completado".
- Advierte que los canales conectados por iCal **no transportan mensajes**.
- Google: no directo; publica en "Google Vacation Finder" a través de HomeToGo (comisión 3 % según Smoobu).
- **Para extraer:** el modelo de disparador + desplazamiento + franja horaria; la cola visible; la regla "si ya pasó, mandalo igual".

### Hospitable
- Para quién: anfitriones de Airbnb. Essentials **gratis** (propiedades ilimitadas, sin sitio directo, métricas limitadas); Host US$29 (1 propiedad, +US$10 la segunda, máx. 2); Professional US$59 (2 propiedades, +US$15 c/u). 12 % de descuento anual.
- El sitio de reserva directa y Google Vacation Rentals recién en Professional; el directo cobra 1 % (básico) o 4 % + 3 % (premium).
- Métricas: tablero de ocupación, ingresos, impuestos, reseñas, noches reservadas, desempeño de mensajes; define ocupación, ADR (ingreso / noches) y RevPAR (ADR × ocupación).
- "Review Rules" para el circuito de reseñas (detalle no confirmado).
- **Para extraer:** un plan gratis que engancha con el calendario y cobra cuando el dueño quiere sitio directo; las tres métricas básicas bien definidas y explicadas en lenguaje simple.

### OwnerRez
- Para quién: dueños y administradores que quieren mucho control. US$40/mes con 1 propiedad, US$55 con 2, US$88 con 5; sitio propio +US$15 (1 propiedad); SMS US$15 por número.
- Channel management y Google Vacation Rentals **incluidos sin costo** en el precio base. Firma digital incluida.
- Pagos: por defecto **50 % al reservar y saldo 30 días antes**, editable en las reglas de cotización; pagos extra programables a mano; **recordatorios automáticos** de pagos y depósitos.
- Depósito de garantía: retención en tarjeta (que el procesador libera solo al vencer; OwnerRez la renueva) o depósito reembolsable. Con PayPal no se puede retener.
- **Contrato de alquiler** desde plantilla, firmado por el huésped; tiene una guía sobre cómo usarlo con huéspedes de Airbnb (Airbnb lo permite si está en las reglas de la casa antes de reservar).
- "Triggers": mensajes disparados por eventos, incluidos los estados del depósito; un usuario advierte que mal configurado manda los datos de acceso antes del pago.
- **Para extraer:** plan de pagos con valores por defecto sensatos; contrato con aceptación online; "no mandar instrucciones de llegada hasta que el saldo esté pago" como condición del mensaje.

### Hostaway
- Para quién: administradores. El alta pregunta 2-14, 15-49 o 50+ alojamientos; **con 1 solo te manda a lista de espera**. Sin precios públicos.
- Funciones: multicalendario, bandeja unificada con respuestas IA, SMS y WhatsApp, precios dinámicos, motor de reserva directa, portal del huésped, reportes avanzados, reseñas automáticas, tareas, pagos.
- **Para extraer:** poco para el dueño chico. Sirve como límite: todo lo de "operación de equipo" y "revenue management" es de este segmento.

### Guesty Lite (Guesty for Hosts)
- Para quién: 1 a 3 alojamientos, desde US$9 por alojamiento/mes, prueba 14 días.
- Incluye sync con Airbnb, Vrbo y Booking, multicalendario, bandeja unificada, **sitio de reserva directa**, Stripe, mensajes programados y tareas de limpieza.
- Google Vacation Rentals, portal de propietarios y revenue management **solo en Pro** (4 a 199). Analytics avanzados son add-on.
- **Para extraer:** la confirmación de que el paquete mínimo para 1-3 unidades es "calendario unificado + sitio + mensajes programados"; todo lo demás es para más grandes.

### Beds24
- Para quién: desde una unidad hasta hoteles; muy potente y técnico. €14,90/mes + €3 por habitación + €0,65 por enlace a canal; pago por uso, sin contrato.
- Airbnb: API certificada recomendada; **iCal bidireccional como alternativa**. Su wiki (editada 7/4/2025) es la mejor descripción de los límites del iCal de Airbnb: sin precios, sin nombre ni email, solo fechas bloqueadas y **últimos 4 dígitos del teléfono**; no importa reservas pasadas ni a más de un año; **una reserva se da por cancelada cuando desaparece del feed**; Airbnb puede actualizar tan poco como una vez por día; sugiere pasar a "solicitud de reserva" si no alcanza.
- **Para extraer:** las reglas de importación por iCal (cancelación por desaparición, horizonte de un año, datos mínimos) y la sugerencia de usar "solicitud" para bajar el riesgo de doble reserva.

### Tokeet
- Para quién: dueños y administradores. US$134,90/mes con hasta 10 alojamientos (pago mensual; 20 % menos anual); dice que hay un plan gratis sin dar detalle. Prueba 15 días.
- Incluye gestor de reservas, channel manager, app móvil, constructor de sitio, pasarelas de pago, usuarios ilimitados.
- Tiene artículo de ayuda sobre Google Vacation Rentals (devolvió 403; no confirmado qué dice).
- **Para extraer:** poco específico; confirma que "app móvil + sitio + pagos" es la canasta estándar.

### Pxsol Vacation Rentals (Argentina / LatAm)
- Para quién: segmenta explícitamente **dueños de 1 a 3 departamentos**, administradores de 4 a 40 y empresas de 40+. Cabañas, apart hotels, casas de campo.
- Precio: un plan "All In One", **desde US$49/mes anual hasta 5 deptos** (lista US$80 + US$16 por depto extra); factura en moneda local con impuestos. Un depto cuenta si estuvo publicado y reservable en el mes.
- Pagos: **Pxsol Pay 0,5 % por cobro** sobre Mercado Pago, Stripe, PayPal, Payway o WebPay.
- Bandeja unificada con Airbnb, Booking, Expedia y **WhatsApp**; email "próximamente".
- Expediente por reserva (huésped, pagos, canal de origen, pendientes) y avisos de vencimientos.
- Facturación: **no incluida** por ahora.
- **Para extraer:** la "ficha de la reserva" con canal de origen y pendientes; cobrar por unidad *activa en el mes*; segmentar el mensaje comercial por cantidad de unidades.

### Alojando (Argentina / LatAm)
- Para quién: administradores de alquileres temporarios (Capterra: 5 a 500+), con portal para propietarios y equipos de limpieza por WhatsApp.
- Precio: **US$10 por alojamiento/mes** (1 a 9), baja a US$6 con 200+; sin comisión por reserva; prueba 30 días.
- Dice conectar **por API directa** con Airbnb, Booking, Expedia, Vrbo y Despegar (no iCal). No pudimos verificar cómo lo logra con Airbnb.
- Sitio propio con pago integrado y dominio propio; cobros con **Mercado Pago**.
- Reportes: ocupación, tarifa promedio, mezcla de canales, gastos, flujo de caja, alertas.
- Extras: importar el anuncio desde el link de Airbnb, verificación de identidad, tareas de limpieza y check-in/out enviadas por WhatsApp sin app.
- **Para extraer:** **importar el anuncio pegando el link de Airbnb** (fotos, descripción) para que el alta tarde minutos; gastos junto a ingresos para mostrar ganancia; tareas por WhatsApp sin app (para el dueño que tiene una persona de limpieza).

---

## Canchas

### AlquilaTuCancha / ATC Sports (Argentina, LatAm)
- Software de gestión de complejos deportivos; según su one-pager oficial (mayo 2025), más de 3.000 canchas activas en 9 países. Prensa (Forbes Argentina) habló de 350+ clubes y 200 mil usuarios.
- **Tarjeta en garantía**: el jugador deja la tarjeta y paga en efectivo; solo se cobra si no se presenta o cancela tarde. Integración con Mercado Pago para que "todas las reservas estén garantizadas"; también seña por adelantado.
- Su sitio menciona caja (POS), estadísticas, turnos fijos, partidos abiertos de la comunidad y WhatsApp, pero **sin detalle verificable**; precios no publicados (la página de planes pide registro).
- Es a la vez **marketplace** de jugadores (app para encontrar cancha).
- **Para extraer:** la tarjeta en garantía como alternativa a la seña; turnos fijos; reportes "en tiempo real" del complejo.

### Playtomic (Manager)
- Software para clubes de pádel/tenis + app de jugadores. Planes Standard, Professional, Champion, Master; **precios no publicados**.
- Standard ya trae bloqueos, chats, clientes, partidos, pagos, clases públicas, reportes, agenda y torneos; Professional suma **monedero** y POS; Champion suma membresías, ligas, cursos, campañas, facturas.
- **Partidos abiertos** generados automáticamente en los huecos libres, con nivel y tipo; el pago en partidos abiertos es solo online.
- **Pago dividido**: el sistema divide la cancha por la cantidad de jugadores; el organizador paga todo y el club marca como pagadas las otras partes dentro de las 2 horas del fin del partido (centro de ayuda; la página no se pudo releer el 20/11).
- La página de precios no menciona turnos fijos.
- **Para extraer:** pago dividido entre jugadores; monedero/saldo a favor (útil para devolver una cancelación sin reembolsar plata); partidos abiertos como función de comunidad (más adelante).

### EasyCancha (Chile, LatAm)
- Marketplace + sistema para clubes, presente en Argentina entre otros países. Reserva 24/7, pago con tarjeta, gestión de inventario y usuarios, función "MATCH" para encontrar con quién jugar.
- No se confirmaron turnos fijos, POS ni precios.
- **Para extraer:** poco nuevo; confirma que en canchas el valor diferencial es encontrar jugadores, no solo reservar.

---

## Salones y eventos

### Brinden (Argentina)
- Para salones de fiestas, cumpleaños infantiles, de 15, casamientos, **quinchos** y catering en Argentina; reemplaza planilla y cuaderno.
- Según directorios (no se encontró el sitio oficial): agenda con detección de doble reserva, **embudo presupuestado → señado → reservado**, **presupuesto en PDF**, caja para señas y pagos, clientes, reportes, permisos por vendedor, perfil público con formulario de consulta, sync con Google Calendar.
- Precio **contradictorio**: ARS 30.000 (Capterra) o ARS 50.000/mes plan único cobrado por Mercado Pago (ComparaSoftware). No confirmado.
- **Para extraer:** el embudo de estados con presupuesto PDF; la consulta (no reserva directa) como entrada natural del salón.

### ROLLER (Australia, parques y centros de entretenimiento)
- **Paquete de fiesta que calcula lo incluido según la cantidad de invitados** elegida al reservar.
- Extras estándar o restringidos por horario, sugeridos en el checkout; seña y **links de pago**; las reservas tentativas sin pagar **se cancelan solas**; se guarda el medio de pago para cobrar el saldo si no lo paga el día.
- Su ayuda aclara una limitación: los extras se cobran completos en el checkout aunque la seña sea del 50 %.
- Deslindes firmados online, invitaciones y confirmaciones de asistencia (RSVP) para los invitados, **hoja de ruta descargable** para el anfitrión, tiempo de colchón entre fiestas.
- Tablero: gasto promedio por fiesta, **saldos pendientes**, productos más vendidos, días con más movimiento.
- **Para extraer:** precio por invitado dentro del paquete, vencimiento automático de reservas sin seña, hoja de ruta del evento, "saldos pendientes" como métrica de primer nivel.

---

## Ideas concretas para Órbita

Impacto = para el dueño chico. Esfuerzo = chico (días), medio (1-2 semanas), grande (más).

### Estadía

| # | Idea | De dónde sale | Impacto | Esfuerzo | Notas |
|---|---|---|---|---|---|
| E1 | **Re-leer el iCal de Airbnb justo antes de confirmar una reserva directa** (antes de generar el link de Mercado Pago y al recibir el pago). Si apareció un bloqueo, no confirmar y devolver. | Advertencias de Smoobu y Beds24 sobre la demora del iCal | Alto | Chico | Es el único momento en que Órbita controla la frescura del dato. Respeta la decisión iCal. |
| E2 | **"Última sincronización" por calendario importado, botón "Actualizar ahora" y alerta si un feed falla** | Airbnb (muestra hora por calendario), Beds24 | Alto | Chico | El dueño tiene que poder ver que la sincronización funciona. |
| E3 | **Guía al dueño para cerrar la ventana de 3 horas del lado de Airbnb**: después de cada reserva directa, aviso "entrá a Airbnb > Calendario > Actualizar"; y recomendación de configurar "aviso previo" en Airbnb (no aceptar para el mismo día) | Airbnb (3 h + botón Actualizar), Beds24 (pasar a solicitud) | Alto | Chico | Es texto + un link; no requiere API. |
| E4 | **Importación por iCal con reglas claras**: crear la reserva con origen "Airbnb", guardar link y últimos 4 dígitos del teléfono, darla por cancelada si desaparece del feed, horizonte de 1 año | Wiki de Beds24 | Alto | Medio | Base de "de dónde vienen las reservas" sin API. |
| E5 | **Política de reserva por propiedad**: % de seña con Mercado Pago, saldo N días antes o "en efectivo al llegar", política de cancelación y depósito de garantía opcional | Lodgify, OwnerRez (50 % + 30 días por defecto) | Alto | Medio | Encaja con "Pagos y señas". Proponer valores por defecto argentinos (ej. 30 % de seña, saldo al llegar). |
| E6 | **Recordatorio automático de saldo** al huésped y aviso al dueño unos días antes del vencimiento | Lodgify (3 días antes), OwnerRez | Alto | Chico | Reusa Recordatorios y mensajes. |
| E7 | **Mensajes por disparador**: al reservar, X días antes de llegar (cómo llegar, Wi-Fi, horario), el día de llegada, al día siguiente de la salida (pedido de reseña en Google), cancelación; con variables y **cola visible** de lo programado; "mandar igual si ya pasó" | Smoobu, Hostaway (reseñas automáticas) | Alto | Medio | Por el canal que Órbita ya use (mail/WhatsApp). Los huéspedes de Airbnb por iCal no traen email: solo aplica a reservas directas o cargadas a mano. |
| E8 | **Condición "no mandar instrucciones de acceso si el saldo no está pago"** | Problema reportado en foros de OwnerRez | Medio | Chico | Evita el error típico de las automatizaciones. |
| E9 | **Estadísticas mínimas bien explicadas**: ocupación %, tarifa promedio por noche, ingresos por mes y por alojamiento, reservas e ingresos **por origen** (Airbnb, sitio, WhatsApp, manual); comparación con el mismo mes del año anterior | Hospitable, Alojando, Pxsol | Alto | Medio | Lo pidió el dueño. RevPAR solo como dato secundario. La comparación anual es sugerencia propia. |
| E10 | **Importar el CSV de ganancias de Airbnb y emparejarlo con las reservas del iCal** (por fechas y código), para tener ingresos reales de Airbnb y la comisión | Decisión tomada; Airbnb permite exportar ingresos con comisión y limpieza | Alto | Medio | Las columnas varían entre exportaciones (foros de Airbnb): mapear por encabezado, no por posición. |
| E11 | **Alta en minutos: importar fotos y descripción pegando el link del anuncio de Airbnb** | Alojando | Medio | Medio | Verificar que no viole las condiciones de Airbnb antes de hacerlo; alternativa: subir fotos a mano con buena guía. |
| E12 | **Gastos por alojamiento** (limpieza, servicios, comisiones) para mostrar ganancia, no solo ingresos | Alojando (gastos, flujo de caja) | Medio | Medio | |
| E13 | **Contrato o reglas de la casa aceptadas online** al pagar la seña | OwnerRez (contrato con firma) | Medio | Chico | Aceptación con casilla y registro alcanza para el dueño chico; firma digital formal, no. |
| E14 | **Verificar elegibilidad de Google en el alta**: preguntar si es complejo con atención o depto suelto; si es depto suelto, no prometer ficha de Maps | Reglas de Google Business Profile y Vacation Rentals | Alto | Chico | **Choca con: "manejar su ficha de Google Maps"** para el dueño de 1 depto. Además la API de Business Profile requiere aprobación previa de Google (cuota 0 hasta aprobar; revisión de hasta ~14 días según Google). |
| E15 | **Plan gratis solo con calendario unificado** (iCal entrada/salida + bloqueos) y pago cuando activa sitio y seña | Hospitable (Essentials gratis) | Medio | Chico | Decisión comercial, no técnica. |
| E16 | Ser socio de conectividad de **Google Vacation Rentals** | Lodgify, Hospitable, OwnerRez | Bajo | Grande | Google: individuos no elegibles; solo administradores registrados con sitio directo; integración de 8 a 12 semanas. Dejar para cuando haya administradores. |
| E17 | Precios dinámicos, portal de propietarios, tareas de limpieza, cerraduras inteligentes | Hostaway, Guesty Pro, Hospitable Mogul | Bajo | Grande | No copiar ahora. |
| E18 | Conexión API con Airbnb / channel manager | Todos los internacionales, Alojando | — | — | **Choca con: "nada de channel managers; Airbnb por iCal"**. Anotado solo para explicar por qué los competidores prometen "cero doble reserva" y Órbita no puede prometer lo mismo. |

### Canchas

| # | Idea | De dónde sale | Impacto | Esfuerzo | Notas |
|---|---|---|---|---|---|
| C1 | **Turnos fijos** (el mismo grupo, todos los martes 21 h) con renovación y aviso si no se va a usar | ATC (lo menciona), práctica del rubro | Alto | Medio | Es lo que llena la grilla de un fútbol 5. |
| C2 | **Tarjeta en garantía / seña con Mercado Pago**, con política de cancelación tardía | AlquilaTuCancha | Alto | Medio | Ver si Mercado Pago permite retener sin cobrar en el flujo que use Órbita; si no, seña chica. |
| C3 | **Pago dividido**: link de Mercado Pago por jugador y el turno se confirma cuando paga el organizador | Playtomic | Medio | Medio | |
| C4 | **Saldo a favor** (monedero) para devolver cancelaciones sin reembolsar | Playtomic | Medio | Medio | Sirve también para salones. |
| C5 | Venta de bebidas y alquiler de paletas en la caja del POS de Órbita, asociado al turno | Playtomic Professional, ATC (caja) | Medio | Chico | Órbita ya tiene POS. |
| C6 | Partidos abiertos / "falta 1" | Playtomic, ATC (anunciado) | Bajo | Grande | Comunidad: después. |
| C7 | Marketplace de canchas | EasyCancha, ATC | — | — | Órbita es sitio por negocio, no marketplace. Fuera de alcance. |

### Salones

| # | Idea | De dónde sale | Impacto | Esfuerzo | Notas |
|---|---|---|---|---|---|
| S1 | **Embudo consulta → presupuesto → señado → confirmado** con presupuesto en PDF o link | Brinden | Alto | Medio | El salón vende por consulta, no por reserva directa. |
| S2 | **Paquete con precio por invitado** (base + por persona, extras que escalan con la cantidad) | ROLLER | Alto | Medio | Encaja con Paquetes y Extras. |
| S3 | **Reserva tentativa que vence sola** si no se paga la seña en X horas | ROLLER | Alto | Chico | Sirve también para estadía (bloqueo mientras paga en Mercado Pago). |
| S4 | **Saldos pendientes** como métrica y lista de primer nivel | ROLLER | Alto | Chico | |
| S5 | **Hoja de ruta del evento** (horarios, extras, contacto, menú) descargable | ROLLER | Medio | Chico | |
| S6 | Colchón de tiempo entre eventos (limpieza) | ROLLER | Medio | Chico | Igual que el día de limpieza entre estadías. |
| S7 | Invitaciones y confirmación de asistencia para cumpleaños | ROLLER | Bajo | Medio | Lindo, no urgente. |

### Transversal

| # | Idea | De dónde sale | Impacto | Esfuerzo | Notas |
|---|---|---|---|---|---|
| T1 | **Ficha única de reserva** con origen, pagos, saldo, mensajes enviados y pendientes | Pxsol (expediente por reserva) | Alto | Medio | |
| T2 | **Exportar el calendario de Órbita por iCal con margen** (días de limpieza/aviso previo incluidos como bloqueados) | Airbnb (incluye tiempo de preparación en su export) | Medio | Chico | |
| T3 | **Recordatorio de turno o llegada por WhatsApp** | Hostaway, Pxsol, Alojando (WhatsApp) | Alto | Medio | Depende de la integración de WhatsApp que ya tenga Órbita. |
| T4 | Cobro por unidad activa en el mes | Pxsol | Medio | Chico | Decisión comercial. |
| T5 | Facturación electrónica | Ninguno de los locales la trae (Pxsol: "no incluida") | Medio | Grande | Oportunidad, no urgente. |

---

## Fuentes (consultadas el 20/11/2026)

Estadía
- https://webflow-mkt.lodgify.com/pricing (sitio espejo de Lodgify; lodgify.com devolvió 403)
- https://help.lodgify.com/hc/en-us/articles/360002853014 (iCal con Airbnb, función heredada; vía buscador)
- https://help.lodgify.com/hc/en-us/articles/22865401014684-Google-Vacation-Rentals-Synchronisations (vía buscador; 403 al leer)
- https://help.lodgify.com/hc/en-us/articles/360002852714 y https://help.lodgify.com/hc/en-us/articles/360022990433 (plan de pagos y depósito; vía buscador)
- https://www.roommaster.com/blog/lodgify-pricing (terceros, precios en conflicto)
- https://www.smoobu.com/en/pricing/
- https://www.smoobu.com/es/blog/api-frente-a-ical-la-mejor-conexion-para-tus-alquileres-vacacionales/ (6/5/2026)
- https://smoobu.com/en/blog/user-guide-how-to-manage-airbnb-if-you-use-the-official-connection-with-smoobu
- https://smoobu.com/en/blog/user-guide-how-to-send-automatic-messages-based-on-triggers-such-as-booking-arrival-or-departure
- https://support.smoobu.com/hc/en-us/articles/5482581617810
- https://support.smoobu.com/hc/en-us/articles/34756630368402-How-do-I-publish-my-listing-on-Google-Vacation-Finder-via-HomeToGo
- https://hospitable.com/pricing
- https://help.hospitable.com/en/articles/4596748-how-does-our-pricing-work
- https://hospitable.com/vacation-rental-metrics
- https://www.ownerrez.com/pricing
- https://www.ownerrez.com/support/articles/costs-and-fees
- https://www.ownerrez.com/support/articles/multiple-payments
- https://www.ownerrez.com/support/articles/security-deposit-holds
- https://www.ownerrez.com/guides/how-to-handle-rental-agreements-and-extra-fees-outside-of-airbnb
- https://www.ownerrez.com/forums/general-help/how-do-i-trigger-a-message-when-the-security-deposit-is-set-up
- https://www.hostaway.com/pricing/
- https://www.hostaway.com/features/
- https://www.guesty.com/pricing/
- https://beds24.com/pricing.html
- https://wiki.beds24.com/index.php/AirBnB.com (editada 7/4/2025)
- https://www.tokeet.com/pricing
- https://pxsolvr.com/es/producto/pms
- https://pxsolvr.com/es/precios
- https://alojando.app (redirige a alojando.com.ar)
- https://www.capterra.com/p/10045874/Alojando-App/

Airbnb
- https://www.airbnb.com/help/article/99 (sincronizar calendarios: cada 3 horas, botón Actualizar, 2 años)
- https://www.airbnb.com.hk/help/article/1295/what-are-airbnbs-calendar-sync-rate-limits
- https://www.airbnb.com/help/article/418 (exportar ingresos en CSV)
- https://community.withairbnb.com/t5/Help-with-your-business/Problem-with-AirBnb-Transaction-History-csv-file/td-p/1741590

Google
- https://support.google.com/hotelprices/answer/12564561 (dueños individuales no elegibles para Business Profile ni Vacation Rentals)
- https://support.google.com/hotelprices/answer/12567939 (socios de conectividad de Vacation Rentals)
- https://support.google.com/hotelprices/answer/11949903 (guía de inicio de Vacation Rentals)
- https://support.google.com/business/answer/3038177 (pautas de Business Profile)
- https://www.brightlocal.com/blog/google-business-profile-new-guidelines-and-policies/ (terceros: lista de no elegibles)
- https://developers.google.com/my-business/content/prereqs (acceso a la API de Business Profile)
- https://developers.google.cn/my-business/content/faq?hl=en (cuota 0 hasta aprobar)

Canchas
- https://atcsports.io
- https://www.cancilleria.gob.ar/userfiles/ut/2025-05_-_one_pager_atc.pdf
- https://infonegocios.info/enfoque/se-cansaron-de-llamar-a-cada-club-para-poder-alquilar-una-cancha-y-crearon-una-app-asi-es-alquilatucancha
- https://www.forbesargentina.com/negocios/crearon-una-app-alquilar-canchas-tienen-mas-350-clubes-200-mil-usuarios-pico-monaco-como-inversor-n36054
- https://playtomic.com/pricing
- https://help.playtomic.com/en/articles/5505954-split-payment-vs-single-payment (vía buscador)
- https://helpmanager.playtomic.com/hc/en-gb/articles/20535035123473-How-to-configure-Open-Matches-at-your-Club (vía buscador)
- https://www.easycancha.com/en-US/clubes

Salones
- https://www.capterra.es/software/1102966/Brinden (vía buscador; 403 al leer)
- https://www.comparasoftware.com/brinden
- https://roller.software/features/party-booking-software/
- https://mysupport.roller.software/docs/why-are-party-booking-deposits-charging-more-than-the-set-amount
- https://www.roller.software/pricing
