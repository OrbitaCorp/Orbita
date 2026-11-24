# «Un día con Órbita» — guion (16:9, ~8 min)

**Para qué:** el video que se le manda a alguien que pregunta «¿qué puede hacer Órbita?», y candidato para el home. Muestra casi
todo, con prioridad en el **día a día de quien tiene la tienda**, sin dejar de lado **lo que ve su cliente**.

**Idea:** la jornada de una dueña, de la mañana a la noche. Un pedido (Lucía compra unos auriculares) es el hilo que atraviesa
el día. Cuando algo pasa del lado del cliente, la pantalla se parte: **izquierda, el celular de Lucía · derecha, el panel**.

**Material:** demo pública de **Nébula Tech** (tienda `demo.orbita.site` + su panel), la única con tienda y panel, así el pedido
es el mismo de los dos lados. WhatsApp e Instagram conectados con datos de ejemplo (como en los videos de la demo).
Voz htFf a 1,04×, subtítulos, música suave, capítulos con su título (hora del día + tema). Estándar: `VIDEOS-MARKETING.md`.

**Verificado en el código (17/11):** medios de pago del checkout (`CheckoutPago.tsx`) y de la venta manual (`PedidoNuevo.tsx`),
descuento por medio de pago (RBT-692), confirmación automática con Mercado Pago (`mercadopago.service.ts`).

---

## 0 · Apertura (0:00 – 0:12)
- **Se ve:** reloj 8:30 sobre el fondo de Órbita → se parte la pantalla: la tienda en un celular, el panel en la compu.
- **Voz:** «Así es un día con Órbita: lo que ves vos en tu panel… y lo que ven tus clientes en tu tienda.»

## 1 · 8:30 — Cómo viene el negocio (0:12 – 0:42)
- **Se ve:** Inicio. Hoy / Semana / Mes; los números (ganancia, pedidos, ticket promedio, clientes nuevos, visitas, comisión de
  Mercado Pago); las alertas («pedidos que necesitan tu atención», «stock crítico», «pagos por confirmar»); el gráfico y el Top.
- **Voz:** «Abrís el panel y en un vistazo sabés cómo viene: lo que ganaste, cuántos pedidos entraron y quién te visitó.
  Y arriba, las alertas: lo que hay que resolver hoy.»
- **Cartel:** *Inicio · Tus números de un vistazo*

## 2 · 9:00 — Lo que ve tu cliente (0:42 – 1:40) · celular a pantalla completa
- **Se ve (tienda de Nébula Tech en el celular de Lucía):** la portada con su diseño y las promos → busca y entra a una categoría →
  la ficha de los auriculares: fotos, colores, stock disponible, el precio y **el precio con descuento por transferencia o efectivo**
  → «Agregar al carrito» → el carrito con un cupón aplicado → elige envío a domicilio o retiro en el local.
- **Voz:** «Del otro lado está Lucía, que entra a tu tienda desde el celular. Ve tus productos con fotos, colores y stock al día,
  y el precio con descuento si paga en efectivo o por transferencia. Agrega al carrito, usa su cupón y elige si se lo mandás
  o lo pasa a buscar.»
- **Cartel:** *Tu tienda · lo que ven tus clientes*

## 3 · 9:15 — Cómo te pagan o se coordinan con vos (1:40 – 2:35) · pantalla partida
- **Lucía (checkout):** las formas de pagar o de arreglar con la tienda, una por una:
  - **Mercado Pago:** tarjeta de crédito en cuotas, débito o dinero en cuenta, pagado en el momento.
  - **Efectivo:** cuando lo recibe o cuando lo retira.
  - **Coordinar por WhatsApp:** cierra la compra y arreglan el pago por chat — transferencia, link de pago, crédito u otro —
    con tu alias, el titular y el banco ya a la vista en la tienda.
  - **Al retirar en el local:** débito o crédito con posnet.
  Paga con Mercado Pago → «¡Pedido confirmado!».
- **Panel (a la derecha):** Configuración → Pagos: qué formas activás, y el **% de descuento por forma de pago** (para empujar
  la que más te conviene); al pagar, entra el pedido con la campanita.
- **Voz:** «Y Lucía elige cómo pagar, o cómo arreglar con vos: con Mercado Pago, en cuotas, con débito o con dinero en cuenta;
  en efectivo cuando lo recibe o lo retira; o cierra la compra y lo coordinan por WhatsApp, por transferencia o como les quede
  mejor, con tu alias ya a la vista. Si lo retira, puede pagar con tarjeta en el local. Vos elegís qué formas aceptás, y hasta
  podés premiar una con un descuento. Lucía paga… y el pedido ya está en tu panel: con Mercado Pago se confirma solo.»
- **Cartel:** *Cómo te pagan · o se coordinan con vos*

## 4 · 10:00 — Preparar y enviar (2:30 – 3:10) · pantalla partida en el final
- **Panel:** el pedido de Lucía → «Iniciar preparación» → «Enviado» con transportista y número de seguimiento → el stock se descuenta.
- **Lucía:** le llega el aviso y sigue su envío desde «Mis pedidos»; también puede escribirte por el chat de la tienda.
- **Voz:** «Lo preparás, lo despachás y cargás el número de seguimiento. El stock se descuenta solo, y Lucía recibe el aviso y
  sigue su envío desde la tienda, sin tener que escribirte para preguntar.»
- **Cartel:** *Pedidos · de «pendiente» a «entregado»*

## 5 · 11:30 — Las ventas de afuera de la tienda (3:10 – 3:50)
- **Panel:** «Nuevo pedido» → buscás productos del catálogo y ponés cantidades → «Venta presencial» (se cobró y se entregó ya)
  o «Pedido online» (queda pendiente) → «Venta y cliente» o «Solo la venta» → cobro en **efectivo, transferencia o combinado**
  → el pedido entra a la lista y a los números.
- **Voz:** «Y lo que vendés por fuera de la tienda también va acá: en el mostrador, por WhatsApp, por Instagram o por teléfono.
  Cargás la venta con un par de toques, a nombre de un cliente o como consumidor final, cobrada en efectivo, por transferencia
  o combinando las dos. Descuenta el stock y suma a tus números como cualquier venta.»
- **Cartel:** *Nuevo pedido · mostrador, WhatsApp, teléfono*

## 6 · 12:30 — Te escriben (3:50 – 4:30)
- **Panel:** Mensajes → WhatsApp con chats; respondés con una respuesta guardada; Orbi atendiendo otro chat.
- **Voz:** «Te escriben por WhatsApp y les respondés desde el panel, por tu número. Para lo que se repite, respuestas guardadas.
  Y si tenés el paquete Avanzado, Orbi atiende por vos: contesta, muestra productos y toma pedidos, también en Instagram.»
- **Cartel:** *Mensajes · WhatsApp y Orbi*

## 7 · 14:00 — Llegó mercadería (4:30 – 5:10)
- **Panel:** Productos → editar stock rápido de una variante → «Crear producto»: fotos, precio y costo, variantes; Orbi escribe
  la descripción. Un toque a «Importar desde Excel» con las fotos sugeridas.
- **Voz:** «Llegó mercadería: actualizás el stock sin abrir cada producto. Para uno nuevo, subís las fotos, ponés precio y
  variantes, y Orbi te escribe la descripción. ¿Tenés muchos? Los subís de una con un Excel, y hasta te sugiere las fotos.»
- **Cartel:** *Productos · stock, variantes y Excel*

## 8 · 15:00 — Descuentos y cupones: vender más (5:10 – 6:30) · pantalla partida en partes
Capítulo largo a propósito: es de lo que más le sirve a un dueño y lo que menos se conoce.
- **Panel — dos herramientas distintas:** Descuentos (se aplican solos en la tienda, «la promo de vidriera») y Cupones (un código
  dirigido: tus seguidores, un cliente que no vuelve, compensar un problema).
- **Panel — los tipos de descuento** (pasan rápido, uno por tarjeta): % en productos o categorías · monto fijo («$2.000 menos») ·
  % sobre el total con mínimo de compra (sube el ticket promedio) · **2x1 y 3x2** armados solos en el carrito · llevá otro con
  descuento · **precios por cantidad** (para mayoristas) · **oferta relámpago** con cuenta regresiva en tu portada (Avanzado).
- **Panel — afinarlo:** a qué le pega (productos, categoría o todo), condición (unidades o monto mínimo), vigencia y hasta
  **días y horarios** («solo los martes de 14 a 18»), límite de usos.
- **Panel — un cupón:** código corto, usos totales y por persona, mínimo de compra, **oculto** (solo para quien lo recibe).
- **Panel → Lucía — compartirlo:** el **link** del cupón: quien lo abre entra a la tienda con el descuento ya puesto (para
  Instagram, una historia, WhatsApp) · o **por email**: Órbita le manda el mail con un botón directo · o a muchos de una con
  el email masivo de Clientes. **Lucía** abre el link y en su carrito ya está el descuento; con un 2x1, el carrito lo arma solo.
- **Panel — Rendimiento:** cuántas veces se usó cada promo, cuánta plata movió y cuánto descuento regalaste.
- **Voz:**
  «Para vender más tenés dos herramientas. Los descuentos se aplican solos en tu tienda: un porcentaje en una categoría, un monto
  fijo, un dos por uno, precios por cantidad para mayoristas, o una oferta relámpago con cuenta regresiva en tu portada.
  Los afinás a tu medida: con un mínimo de compra, por fecha y hasta por día y horario, como un descuento que corre solo los
  martes a la tarde.
  Y los cupones son para lo dirigido: un código para tus seguidores o para que vuelva un cliente, con límite de usos y hasta
  oculto. Lo compartís con un link y tu cliente entra a la tienda con el descuento ya puesto, o Órbita se lo manda por mail.
  Después, en Rendimiento, ves qué promo funcionó: cuánto se usó y cuánta plata movió.»
- **Carteles (van cambiando):** *Descuentos · se aplican solos* → *Cupones · para lo dirigido* → *Compartilo con un link* →
  *Rendimiento · qué promo funcionó*

## 8b · 16:30 — Instagram desde el panel (6:30 – 6:55)
- **Panel:** Difusión → publicar un producto en Instagram con el texto de Orbi → el calendario.
- **Voz:** «Y en Difusión publicás tus productos en Instagram con el texto que te escribe Orbi, y lo dejás programado, sin salir
  del panel.»
- **Cartel:** *Difusión · tu Instagram desde Órbita*

## 9 · 18:00 — Tus clientes (6:55 – 7:15)
- **Panel:** Clientes → la ficha de Lucía con sus pedidos → escribirles por email.
- **Voz:** «Cada cliente queda guardado con todo lo que te compró, y les podés escribir cuando quieras.»
- **Cartel:** *Clientes*

## 10 · 19:00 — Que la tienda sea tuya (7:15 – 7:40) · pantalla partida
- **Panel:** Configuración → Apariencia: plantilla de portada y colores. **Lucía:** la tienda cambia en su celular.
  Toques rápidos: Envíos, Dominio propio, Equipo.
- **Voz:** «Y la tienda es tuya: elegís el diseño y los colores y tus clientes lo ven al instante; configurás tus envíos,
  usás tu propio dominio y sumás a tu equipo.»
- **Cartel:** *Configuración · diseño, envíos, dominio y equipo*

## 11 · 21:00 — Cierre del día (7:40 – 8:00)
- **Panel:** Reportes / Métricas avanzadas: ganancia, conversión y cuándo te compran. Botón «Ver tutorial» y Orbi AI.
- **Voz:** «A la noche ves qué vendiste y cómo te fue en el día. Y si en algún momento te trabás, cada sección tiene su tutorial,
  y Orbi te responde lo que necesites.»
- **Cartel:** *Reportes · y ayuda en cada paso*

## 12 · Final (8:00 – 8:15)
- **Se ve:** logo de Órbita + «Tu tienda, tu panel, tu negocio.» + orbita.site.
- **Voz:** «Todo tu negocio, en un solo lugar. Creá tu espacio en orbita punto site.»

---

### Notas de producción
- **Verificar en la demo antes de grabar:** que la tienda de Nébula Tech tenga activos todos los medios de pago (Mercado Pago,
  efectivo, coordinar por WhatsApp, retiro con débito/crédito) y un descuento por medio de pago; el pedido con Mercado Pago y su
  confirmación; el seguimiento del envío del lado del cliente; el cupón con link. Si la demo no tiene alguno activo, se graba
  en local con esa configuración (sin tocar la demo de producción).
- La comisión de Mercado Pago es de Mercado Pago y varía según el medio y las cuotas; Órbita no cobra comisión por venta.
- Paquete Avanzado: se dice cada vez que algo es de Avanzado (Orbi atendiendo, plantillas de portada).
- Para redes salen cortes de 30–45 s por capítulo (9:16) con las mismas tomas; los capítulos 3 (cómo te pagan) y 8 (descuentos y cupones) dan para un TikTok cada uno.

---

## Voz final (como quedó en el video, 17/11)

Cambios respecto del guion de arriba, por lo que se verificó grabando la demo:
- **El link del cupón no deja el cupón aplicado**: abre una página del cupón que dice «copiá el código y pegalo en el checkout». La voz dice solo «lo compartís con un link».
- **«Coordinar por WhatsApp» muestra el alias solo si la tienda lo cargó** (Configuración → Pagos → Datos para transferir). La voz dice «si cargás tu alias, Lucía ya lo ve en la tienda».
- En Rendimiento se ven ventas con descuento y lo que se regaló («revenue sacrificado»), no cuánto se vendió con cada cupón.
- «Creá tu espacio» sonaba «Crea» → el cierre dice «Empezá hoy en orbita punto site».
- El cupón del video es NEBULA15 (VIP-LUCIA es personal de otra cuenta y la tienda lo rechaza).


**Apertura**
- Así es un día con Órbita: lo que ves vos en tu panel, y lo que ven tus clientes en tu tienda.

**8:30 · Inicio**
- Arrancás el día, abrís el panel y en un vistazo sabés cómo viene el negocio.
- Lo que ganaste, cuántos pedidos entraron, el ticket promedio y cuánta gente pasó por tu tienda.
- Y arriba, las alertas: lo que hay que resolver hoy.

**9:00 · Lo que ve tu cliente**
- Del otro lado está Lucía, que entra a tu tienda desde el celular.
- Ve tus productos con fotos, los colores que hay y el stock al día.
- Y el precio con descuento si paga por transferencia o en efectivo.
- Lo agrega al carrito, pone el cupón que publicaste en Instagram y ya ve cuánto se ahorra.
- Completa sus datos y elige si se lo mandás o lo pasa a buscar.

**9:15 · Cómo te pagan o se coordinan con vos**
- Después elige cómo pagarte, o cómo arreglar con vos.
- Con Mercado Pago: tarjeta, cuotas, débito o dinero en cuenta.
- En efectivo, cuando lo recibe o cuando lo retira.
- O cierra la compra y lo coordinan por WhatsApp: transferencia, link de pago o como les quede mejor.
- Y si lo retira en el local, también con débito o crédito.
- Vos elegís qué formas aceptás, y hasta podés premiar una con un descuento.
- Si cargás tu alias, Lucía ya lo ve en la tienda y no tenés que pasárselo.
- Lucía paga con Mercado Pago, y listo: el pedido ya está en tu panel, confirmado solo.

**10:00 · Preparar y enviar**
- Abrís el pedido y ves todo: qué compró, cuánto pagó y adónde va.
- Lo pasás a preparación, y cuando lo despachás cargás el transportista y el número de seguimiento.
- Lucía recibe el código y sigue su envío desde la tienda, sin tener que escribirte para preguntar.

**11:30 · Nuevo pedido**
- Y lo que vendés por fuera de la tienda también va acá: en el mostrador, por WhatsApp o por teléfono.
- Elegís los productos, si fue una venta en persona o un pedido para entregar después,
- a nombre de un cliente o solo la venta, y cómo te pagó: efectivo, transferencia o las dos combinadas.
- Y suma a tus números como cualquier otra venta.

**12:30 · Mensajes**
- Al mediodía te escriben por WhatsApp, y les contestás desde el panel, con tu número.
- Para lo que te preguntan siempre, tenés respuestas guardadas.
- Y con el paquete Avanzado, Orbi atiende por vos: contesta, muestra productos y toma pedidos, también en Instagram.

**14:00 · Productos**
- A la tarde llega mercadería: actualizás el stock ahí mismo, sin abrir cada producto.
- Para uno nuevo cargás las fotos, el precio y las variantes, y Orbi te escribe la descripción.
- ¿Son muchos? Un Excel y listo: se cargan todos de una, y hasta te sugiere las fotos.

**15:00 · Descuentos y cupones**
- Para vender más tenés dos herramientas.
- Los descuentos se aplican solos en tu tienda: un porcentaje en una categoría, un dos por uno, un tres por dos,
- o una oferta relámpago, con cuenta regresiva en tu portada.
- Y los ajustás a tu medida: con fecha de inicio y de fin, y hasta por día y horario, como uno que corre solo los martes a la tarde.
- Los cupones son para algo más dirigido: un código para tus seguidores, o para que vuelva un cliente.
- Le ponés un límite de usos, cuántas veces lo puede usar cada uno, y hasta lo podés hacer privado.
- Lo compartís con un link, o Órbita se lo manda por mail con un botón directo a tu tienda.
- Y después, en Rendimiento, ves cuántas ventas trajo cada promo y cuánto descuento regalaste.

**16:30 · Difusión**
- Y en Difusión publicás tus productos en Instagram, con el texto que te escribe Orbi, sin salir del panel.

**18:00 · Clientes**
- Cada cliente queda guardado con todo lo que te compró, y les podés escribir a todos de una con un mail.

**19:00 · Configuración**
- Y la tienda es tuya: elegís el diseño y los colores, y configurás tus envíos.
- Usás tu propio dominio, y sumás a tu equipo, cada uno con sus permisos.

**21:00 · Cierre del día**
- A la noche mirás los reportes: qué vendiste, qué productos salen más y quiénes te compran.
- Y si en algún momento te trabás, cada pantalla tiene su tutorial, y Orbi te responde lo que necesites.

**Final**
- Todo tu negocio, en un solo lugar. Empezá hoy en orbita punto site.
