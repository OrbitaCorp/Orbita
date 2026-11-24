# Alquileres sobre el backend: el mapa, lo que falta y lo nuevo de la estadía

**Fecha:** 18/11/2026 · **Responsable del módulo:** Alan · **Decide lo compartido:** Ale
**Estado:** aprobado por Alan el 18/11 (con las decisiones de este diseño marcadas como tales).
Lo marcado "decide Ale" o "(compartido)" se habla con Ale antes de escribir código.

## 1. Para qué

Alquileres es uno de los tres módulos de reservas de Órbita (Turnos de Mateo, Alquileres de
Alan, Gimnasio de Ale). Los tres comparten un solo motor de reservas
(`apps/api/src/reservas`). Alquileres tiene tres modos que no se mezclan:

| Modo | Qué se alquila | Recurso del motor |
|---|---|---|
| **Canchas** (por hora) | fútbol 5, pádel, salas de ensayo, boxes, estudios, coworking | `CANCHA` |
| **Salones** (por bloque) | salón de cumpleaños y de fiestas, pelotero, quincho, auditorio | `SALON` |
| **Estadía** (por noche o por mes) | casa, depto, cabañas, quinta, hostel, camping; deptos, cocheras y oficinas por mes | `ALOJAMIENTO` |

Hoy el módulo es una **demo completa sin backend** (`apps/web/src/modules/alquileres/`, en
`/alquileres-demo`): panel, sitio, reserva, Mis reservas, alta y 19 rubros, todo con datos del
navegador. El trabajo del ciclo 2 (plan del Superadmin → Módulos, del 05/11 al 23/12) es
**llevar los tres modos al motor compartido** para que el sitio reserve de verdad y el alta
real cree un negocio de verdad.

Encima de eso, Alan definió el 18/11 hacia dónde va la **estadía**: el dueño chico (una a cinco
cabañas o deptos, en Iguazú y lugares así), que hoy recibe reservas por **WhatsApp y Airbnb**
y las anota como puede. Lo que quiere es **un solo panel** para:

- mostrar su alquiler (sitio propio con fotos, ubicación, calendario y reseñas);
- no reservar dos veces lo mismo aunque reciba por varios lados;
- ver **todas sus estadísticas juntas**: ocupación, ingresos, de dónde vienen las reservas y
  cómo le va en Google Maps.

Nada de channel managers (Channex y similares) ni de Booking: un depto chico en Iguazú no
está en Booking. Como mucho está en Airbnb y en Google Maps.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos del ciclo (el plan de 8 semanas):**

- Cada pantalla del panel y del sitio de Alquileres lee y escribe en la API de reservas, en los
  tres modos.
- El sitio reserva de verdad (retener → confirmar, idempotencia, vencimiento).
- El alta real crea el negocio con su config y sus recursos según el modo.
- QA en celular, tablet, escritorio y oscuro, con datos reales.

**Objetivos de la estadía (nuevos, fuera del plan: se acuerdan con Ale, ver § 9):**

- Calendario de Airbnb sincronizado en las dos direcciones (iCal real, no simulado).
- Importar el CSV de ganancias de Airbnb para que las estadísticas incluyan esa plata.
- Seña online con Mercado Pago desde el sitio propio.
- Ficha de Google Maps conectada: fotos, reseñas y métricas desde el panel.
- Estadísticas por canal (sitio, Airbnb, WhatsApp, a mano) junto con las de Google.

**No objetivos:**

- Channel manager, Booking, Expedia ni ninguna integración por intermediarios certificados.
- Editar fotos, precios o descripción del aviso de Airbnb desde Órbita: Airbnb no tiene API
  abierta (solo para unas 40 empresas aprobadas, sin admisión abierta). Eso se sigue haciendo
  en Airbnb.
- Leer mensajes o reseñas de Airbnb (misma razón).
- Aparecer en el buscador de alojamientos de Google con precio ("Vacation Rentals"): Google no
  acepta propiedades de dueños individuales, solo vía intermediarios certificados.
- Cobrar el depósito de garantía: se **registra**, no se cobra.

**Anti-objetivos** (aunque funcione, sería un fracaso):

- Que una reserva de Airbnb y una del sitio caigan en las mismas noches porque la sincronización
  llegó tarde y nadie se enteró.
- Que el precio que ve el huésped en el sitio no coincida con el que cobra el servidor.
- Romper Turnos o Gimnasio al tocar el motor compartido.
- Que el dueño tenga que cargar dos veces lo mismo (la reserva de Airbnb a mano y además el
  CSV) para ver sus números.

## 3. Restricciones

- **Un solo motor.** Lo que tocan los tres módulos (tablas `reservas_*`, `dominio/`, rutas,
  permisos) **lo decide Ale** antes de tocarlo. Los módulos no se importan entre sí; cada uno usa
  `apps/web/src/lib/reservasApi/` con su `modulo`.
- **El precio y la seña se calculan siempre en el servidor** (`dominio/precio.ts`). Hoy el
  servidor sabe "base × unidades + extras"; todo lo que la demo calcula de más (precios por
  horario, paquetes, temporadas, fin de semana, limpieza, por mes) tiene que pasar al servidor.
- **Decisiones abiertas de Ale que este diseño necesita** (`decisiones.ts`,
  "backend-compartido-pendientes"): cobro online de la seña con MP (punto 1), devolución
  automática (punto 2), WhatsApp (punto 3), recordatorio (punto 4) y habilitar el módulo en el
  alta real (punto 5). Alan eligió seña online con MP para la estadía. La propuesta del punto 1
  de Ale deja la reserva `PENDIENTE` hasta el webhook; este diseño propone dejarla `RETENIDA`
  con la retención extendida (§ 7.3), porque `PENDIENTE` no vence y una seña que nunca se paga
  dejaría las noches tomadas. Es una diferencia a resolver con Ale.
- **El `main` local está atrasado** respecto de `origin/main` (el patrón de Turnos de la § 4 y
  las entradas de Auditoría nuevas están solo en `origin/main`): actualizar antes de empezar.
- **Entornos** (CLAUDE.md): todo se prueba en dev y staging. Staging **no** tiene conexión con
  Mercado Pago ni login con Google: la seña online y Google se prueban en local contra dev.
- **El manual del panel es lo que sabe Orbi:** cada pantalla del panel que se toque actualiza
  su tema en `apps/web/src/modules/ventas/panel/manual/contenido.ts` y se regenera con
  `pnpm manual:generar`.
- **UI:** toda pantalla nueva o cambiada pasa primero por la skill `ui-ux-pro-max`, con el kit
  de `design-system/reservas/`.
- **El orden de deploy** de CLAUDE.md (frontend por `main`, API a mano con `deploy.sh`,
  migraciones en dev primero y en producción con `prisma-prod.sh`).

## 4. Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **1. Evolucionar la demo de Alquileres (elegido)** | Más corto; reusa pantallas ya probadas en 390/768/1280 y oscuro; la demo ya tiene la forma de datos de la API ("cambia el adaptador, no las pantallas"); respeta el motor compartido | El panel arrastra los tres modos; hay que cuidar que la demo siga andando |
| 2. Módulo nuevo "Alojamientos" aparte | Producto más limpio, con nombre propio para vender | Rehace lo que la demo tiene; dos lugares donde vive el alojamiento; mucho más tiempo |
| 3. Plantilla de la tienda de Ventas | — | La tienda es de productos y carrito: noches y calendario entran a la fuerza |

Elegido por Alan el 18/11: **evolucionar la demo**. Si conviene venderlo como "Alojamientos",
se nombra así en el alta, la landing y los textos, sin separar el código.

Patrón a copiar de Turnos (Mateo, 13/11): **un origen de datos por sección**
(`modules/turnos/datos/origen/`: `index.ts` con la interfaz, `demo.ts`, `api.ts` y
`mapear.ts` con sus tests). La demo sigue siendo el origen por defecto en `/alquileres-demo`; el
panel real monta el origen de la API.

## 5. El mapa: cada pantalla con su ruta

Rutas del panel: `/api/v1/reservas/...` (sesión de miembro). Rutas del sitio:
`/api/v1/storefront/:slug/reservas/...` (sin sesión). `F#` = faltante de la § 6.

### 5.1 Panel, común a los tres modos

| Sección (sidebar) | Lee | Escribe | Estado |
|---|---|---|---|
| Reservas / Calendario | `GET /reservas?desde&hasta&recursoId&estado&q`, `GET /:id` (historial) | `POST /:id/confirmar`, `completar`, `ausente`, `cancelar`, `reprogramar`, `PATCH /:id/nota` | Cubre. La API da hasta 93 días por pedido: paginar en tramos (como Turnos) |
| Nueva reserva a mano | `GET /disponibilidad` (o `/noches`) | `POST /reservas` | Cubre lo básico; el canal (WhatsApp, teléfono, Airbnb) → F8 |
| Qué hay libre | `GET /disponibilidad`, `/disponibilidad/rango`, `/disponibilidad/noches` | — | Cubre |
| Clientes / Huéspedes | Las reservas, agrupadas por persona | — | Parcial → F13 |
| Ingresos | `GET /reservas/resumen?desde&hasta` + las reservas | `POST /:id/pago` | Parcial: el resumen no separa por canal (F8) ni suma Airbnb (F18) |
| Reglas de reserva | `GET /config` | `PUT /config` | Parcial: cancelación, anticipación y confirmación cubren; noches mínimas y check-in/out van en el recurso; lo de la seña → F11 |
| Días bloqueados / Bloqueos | `GET /bloqueos` | `POST`, `DELETE /bloqueos` | Cubre (por recurso o todos). Lo que viene de un .ics → F9 |
| Recordatorios y mensajes | — | — | Falta → F10 (y punto 4 de Ale) |
| Pagos y señas | `GET /config` (`senaPorcentaje`, `senaReembolsable`) | `PUT /config` | Parcial → F11; cobro online → F15 |
| Calendarios (.ics) | — | — | Falta: hoy simulado → F9 |
| Configuración → Datos del negocio | El negocio (`Business`) | Lo de Tienda | No es de reservas: datos del negocio, como en Turnos |
| Configuración → Horarios (canchas y salones) | `config.horario`, horario propio del recurso | `PUT /config`, `PUT /recursos/:id` | Cubre |
| Configuración → Equipo | Miembros y roles de Órbita | — | Parcial → F12 |

### 5.2 Panel, por modo

| Modo | Sección | Lee / escribe | Estado |
|---|---|---|---|
| Canchas | Canchas | `GET/POST/PUT/DELETE /recursos` (`CANCHA`: `duracionMinutos` = franja, `pasoMinutos`, `maximoSeguidos`, `precio` = por hora) | Cubre |
| Canchas | Extras | `datos.extras` de cada recurso | Cubre, pero la demo los tiene **por negocio** y el motor **por recurso**: se copian a todas las canchas al guardar (decisión del constructor) |
| Canchas | Precios por horario | — | Falta → F2 |
| Salones | Salones | `/recursos` (`SALON`: duración = bloque, `margenMinutos` = limpieza, capacidad en `datos`) | Cubre |
| Salones | Paquetes | — | Falta → F3 |
| Salones | Eventos | Las reservas | Parcial: agasajado, edad, invitados → F6; depósito → F7 |
| Estadía | Propiedades | `/recursos` (`ALOJAMIENTO`: check-in, check-out y noches mínimas en `datos`; tipo, huéspedes, ambientes, camas, baños, comodidades, fotos, dirección y ubicación también en `datos`) | Cubre lo de reservar; las fotos → ver § 7.5 |
| Estadía | Temporadas y precios | — | Falta → F4 |
| Estadía | Por mes (contratos) | — | Falta → F5 |

### 5.3 Sitio

| Página | Rutas | Estado |
|---|---|---|
| Inicio (Home, Sitio) | `GET /config?modulo=ALQUILERES`, `GET /recursos` | Cubre |
| Reserva de cancha (franjas seguidas) | `GET /disponibilidad` (con `seguidas`), `POST /retener` + `/mi/:token/confirmar` | Cubre; el precio por horario → F2 |
| Reserva de salón (paquete y extras) | `GET /disponibilidad/rango` + `/disponibilidad`, `retener` + `confirmar` | Parcial → F3 y F6 |
| Reserva de estadía | `GET /disponibilidad/noches`, `retener` (con `fechaHasta`) + `confirmar` | Parcial: precio con temporadas → F4; seña online → F15 |
| Mi reserva (`/mi-reserva/<token>`, link de los emails) | `GET /mi/:token`, `POST /mi/:token/cancelar` y `/reprogramar` | Cubre. Página nueva (hoy no existe en la demo) |
| Mis reservas con sesión | — | Falta → F14 |

## 6. Lo que el backend no cubre

Marcado **(compartido)** lo que toca a los tres módulos: se habla con Ale antes de escribir
código. Cada uno trae la propuesta de este diseño.

| # | Qué | Propuesta | Toca |
|---|---|---|---|
| F1 | El rubro del negocio | Igual que Turnos: `Business.industry = "alquileres"` y `subrubros = ["cabana"]` con la clave de `RUBROS_ALQUILERES`. El modo sale del rubro. Sin migración | Solo Alquileres |
| F2 | Precios por horario (canchas) | Las reglas (`ReglaFranja` de la demo) en `datos.reglasPrecio` de cada cancha, y el cálculo en `dominio/precio.ts` del servidor (portar `lib/reservas/precio.ts`, con los mismos tests) | **(compartido)** el cálculo del precio |
| F3 | Paquetes por salón | Cada paquete es un **`ReservaServicio`** limitado a su salón (`recursoIds`), con `precio`, duración = el bloque y `descripcion` = lo que incluye; `hastaInvitados` en el nombre o en un campo nuevo. El sitio elige paquete como Turnos elige servicio. Sin migración si alcanza | Probablemente nada compartido (a confirmar) |
| F4 | Temporadas, fin de semana, limpieza (estadía) | `datos.tarifa` del recurso (`{ temporadas, finDeSemanaPct, limpieza }`, la forma de `TarifaEstadia`) y el cálculo en el servidor (portar `precioEstadia` de `lib/reservas/estadia.ts` a `dominio/`, con sus tests) | **(compartido)** el cálculo del precio |
| F5 | Alquiler por mes (deptos, cocheras, oficinas) | Mismo `ALOJAMIENTO` con `datos.modalidad = "mes"` y `datos.mensual` (precio por mes, mínimo y máximo de meses, depósito); `fechaHasta` = entrada + N meses; precio = precio por mes × meses. Es lo de menor prioridad de la estadía: si no entra en el ciclo, queda en demo | **(compartido)** el cálculo |
| F6 | Datos propios de la reserva (evento: agasajado, edad, invitados; huéspedes; canal; depósito) | **Agregar `datos Json?` a `Reserva`** (migración chica), igual que el que ya tienen recursos | **(compartido)** migración |
| F7 | Depósito de garantía (salones y por mes) | En `Reserva.datos.deposito = { monto, registrado }`; se registra, no se cobra | Depende de F6 |
| F8 | El canal de cada reserva | `ReservaOrigen` es solo `TIENDA` o `PANEL`. Propuesta: `Reserva.datos.canal` = `sitio`, `whatsapp`, `telefono`, `airbnb`, `otro` (el panel lo pide al cargar a mano) y que `GET /reservas/resumen` agrupe por canal | **(compartido)** el resumen |
| F9 | Calendarios externos (.ics) reales | Ver § 7.1: tabla `reservas_calendarios_externos`, columnas `origen` y `calendario_id` en `reservas_bloqueos`, una ruta pública con token para exportar y la sincronización periódica | **(compartido)** migración y cron |
| F10 | Plantillas de mensajes | Mismo faltante que Turnos (su faltante 2): un `datos Json` en `ReservaConfig`. Los textos de fábrica ya están en `mensajesDeFabrica` | **(compartido)** |
| F11 | Formas de pago, alias, qué pasa con la seña si cancelan tarde | Formas y alias en `ReservaConfig.datos` (el mismo de F10). **Decisión de este diseño:** en v1 la seña es siempre un porcentaje **del total** y "cancelar tarde" es pierde o no pierde (`senaReembolsable`), que es lo que el servidor ya sabe. Salen de las pantallas conectadas: "seña sobre la base" (`senaSobre: 'base'`), "devolver la mitad" y "crédito para otra reserva". Si después se quieren, van al servidor primero, para que el precio del sitio siga siendo el que cobra el servidor | **(compartido)** |
| F12 | Roles del equipo | La demo tiene dueño / encargado / recepción; el motor tiene `reservas.view`, `manage` y `config`. Encargado = `view` + `manage` + bloqueos; recepción = `view` + `manage`. Problema: los bloqueos piden `config`. Propuesta: pasar los bloqueos a `manage` | **(compartido)** permisos |
| F13 | Clientes / huéspedes | Mismo faltante que Turnos (su faltante 5). Mientras tanto, salen de las reservas | **(compartido)**, una sola solución para los dos |
| F14 | Mis reservas con sesión | Mismo faltante que Turnos (su faltante 6): una ruta que liste las reservas del cliente logueado | **(compartido)**, una sola solución |
| F15 | Seña online con Mercado Pago y devolución | Ver § 7.3. Es el punto 1 y 2 de la decisión abierta de Ale | **(compartido)** y mueve plata |
| F16 | Recordatorio del día anterior | Punto 4 de la decisión de Ale | **(compartido)** |
| F17 | Ficha de Google Maps | Ver § 7.4. Pieza transversal de Órbita (sirve también a Tienda, Turnos y Gimnasio) | **(compartido)**, transversal |
| F18 | Ingresos de Airbnb | Ver § 7.2: importar el CSV | Solo Alquileres (tabla nueva) |

**Lo que falta del lado del front** (igual que en Turnos):

- **Rutas de producción:** `pages/panel` y `pages/tienda/[slug]` son de Tienda. Un negocio de
  Alquileres no tiene dónde abrir su panel ni su sitio fuera de `/alquileres-demo`. Se resuelve
  igual para los tres módulos (con Ale y Mateo), no tres veces.
- **El "hoy" fijo de la demo:** `HOY = '2026-11-14'` y `AHORA` en `datos/index.ts`. Con la API
  se pasa el hoy real; la demo lo sigue usando.
- **La página Mi reserva** (`/mi-reserva/<token>`) no existe; los emails ya apuntan ahí
  (`RUTA_MI_RESERVA` en `reservas-avisos.service.ts`).

**La seña por transferencia sin pagar (decisión del 18/11, recomendación aceptada por Alan):**
una reserva del sitio con seña por transferencia queda `PENDIENTE` (confirmación manual del
negocio) u ocupando las noches, se exporta a Airbnb como ocupada y **la libera el dueño** desde
el panel. No vence sola: el motor no cambia. El mensaje "seña pendiente" de la demo (a las 24 h)
le recuerda al huésped, y el panel muestra arriba las reservas con seña sin registrar. Un
vencimiento automático puede sumarse después, si hace falta, como cambio del motor compartido.

## 7. Lo nuevo de la estadía

### 7.1 Airbnb: calendario sincronizado en las dos direcciones

Airbnb publica, por cada aviso, una URL `.ics` con las noches ocupadas, y acepta importar
calendarios `.ics` de afuera. Es lo único oficial y gratuito para cualquier anfitrión.

- **Exportar (Órbita → Airbnb):** una ruta pública
  `GET /api/v1/storefront/:slug/reservas/ical/:recursoId.ics?t=<token>` que devuelve las
  reservas que ocupan (RETENIDA, PENDIENTE, CONFIRMADA) y los bloqueos del dueño de esa propiedad,
  sin datos personales (solo "Reservado"). El token es por recurso, se puede regenerar y va en
  `datos` del recurso. El dueño pega la URL en Airbnb ("Importar calendario"). **No** se
  exportan los bloqueos que vinieron de Airbnb (evita el eco).
- **Importar (Airbnb → Órbita):** el dueño pega la URL `.ics` de Airbnb en la propiedad. Se
  guarda en `reservas_calendarios_externos` (`recurso_id`, `nombre`, `url`, `ultima_sync`,
  `ultimo_error`, `activo`). La sincronización baja el `.ics`, lo parsea (ya hay un parser en
  `lib/reservas/ics.ts` para portar) y **reemplaza** los bloqueos de ese calendario
  (`reservas_bloqueos` con `origen = 'ICAL'` y `calendario_id`). Desconectar el calendario borra
  sus bloqueos.
- **Cada cuánto:** colgado del job de Cloud Scheduler que ya corre cada 5 minutos
  (`instagram-cada-5-minutos` en `internal-cron.controller.ts`, compartido con Instagram y
  dominios; ahí ya se barren las retenidas vencidas), cada calendario se baja si pasaron
  **30 minutos** desde su última sync, y a pedido con un botón "Sincronizar ahora". Así no hace
  falta otro job. Ese job existe **solo en producción**: en staging y en local se prueba con el
  botón. El valor exacto lo ajusta el constructor.
- **El eco de vuelta (decisión de este diseño, a verificar):** Airbnb probablemente publica
  como "Not available" tanto las noches que el dueño cierra a mano como las que importó de
  Órbita. Si es así, cada reserva del sitio volvería como bloqueo de Airbnb sobre sus mismas
  noches. Regla: al importar, se **descarta** un evento cuyas fechas coinciden exactamente con
  una reserva o un bloqueo que Órbita exportó para esa propiedad; y se guarda el tipo de evento
  (`reservado` si el texto es de reserva de Airbnb, `cerrado` si es "Not available"). La
  ocupación de la § 7.6 cuenta solo los `reservado`. **Antes de la semana 4**, probarlo con un
  calendario real de Airbnb conectado a uno exportado por Órbita, y ajustar la regla a lo que se
  vea (por fechas o por UID).
- **Si choca:** una reserva del sitio retenida en noches que después aparecen bloqueadas por
  Airbnb no se borra: el panel la marca **en conflicto** con un aviso visible arriba ("Airbnb
  tiene reservadas noches que también tenés acá") y el dueño decide. La ventana de riesgo (entre
  dos syncs) se dice en la pantalla, con la hora de la última sync.
- **Si falla la descarga:** se guarda el error, se muestra en la propiedad y en el panel, y los
  bloqueos anteriores quedan como estaban (nunca se borran por un error).
- **Lo que trae el `.ics` de Airbnb:** fechas y un texto tipo "Reserved" / "Airbnb (Not
  available)"; no trae nombre ni monto. Por eso los ingresos van por el CSV.

### 7.2 Airbnb: ingresos por el CSV

Airbnb deja descargar el historial de transacciones como CSV desde Ganancias. El panel suma
"Importar ganancias de Airbnb":

- El dueño sube el CSV; el servidor lo lee y muestra una vista previa antes de guardar.
- Cada fila de reserva se guarda en una tabla nueva de Alquileres (`alquileres_ingresos_externos`:
  `business_id`, `recurso_id`, `canal = 'airbnb'`, `codigo_externo` (el código de confirmación de
  Airbnb), `entrada`, `salida`, `noches`, `huesped`, `monto_bruto`, `comision`, `monto_neto`,
  `moneda`, `importado_en`). El `codigo_externo` es único por negocio: importar dos veces el
  mismo CSV no duplica.
- **Qué propiedad es cada fila:** el CSV trae el nombre del aviso de Airbnb. La primera vez el
  dueño une cada aviso con su propiedad de Órbita; la unión se guarda y las siguientes
  importaciones la usan.
- Si una fila coincide en fechas con un bloqueo de Airbnb de esa propiedad, se muestran juntos
  (la estadía de Airbnb con su monto).
- **Una estadía de Airbnb nunca es una reserva del motor (decisión de este diseño).** Vive como
  bloqueo del `.ics` (las noches) más la fila del CSV (la plata y el huésped). Por eso `airbnb`
  **no** está entre los canales que se eligen al cargar una reserva a mano (F8): el motor
  rechaza una reserva que pise un bloqueo, y si se pudiera cargar, la plata se contaría dos
  veces con el CSV. Si el dueño quiere anotar algo de un huésped de Airbnb antes de tener el CSV,
  lo hace como nota del bloqueo.
- **A verificar antes de construir:** el formato exacto del CSV (columnas, separador, formato de
  fecha y moneda) con un archivo real de un anfitrión argentino. No hay documentación oficial.

### 7.3 Seña online con Mercado Pago

Reusa lo que ya existe en `apps/api/src/mercadopago/`: la conexión OAuth por negocio
(`getValidAccessToken`), la preferencia, el webhook de pagos y el reembolso (`refundPayment`).
Lo nuevo es una preferencia ligada a una **reserva** en lugar de un pedido.

1. El huésped elige noches → `POST /retener` → la reserva nace `RETENIDA` con `retenidaHasta`.
2. Al confirmar con sus datos, si el negocio tiene MP conectado y la seña es > 0, la API crea la
   preferencia por el monto de la seña, extiende la retención para cubrir el pago (por ejemplo
   30 minutos; lo fija Ale con la decisión) y devuelve el link de pago. La reserva queda
   `RETENIDA` (no `CONFIRMADA`) hasta el webhook.
3. **Webhook aprobado a tiempo:** `CONFIRMADA`, `pagado = seña`, `pagoMetodo = 'mercadopago'`,
   historial y email.
4. **Webhook aprobado tarde** (la retención venció y otro tomó las noches): se devuelve el pago
   solo y se avisa al huésped y al negocio. Si las noches siguen libres, se confirma igual.
5. **Cancelación a tiempo:** si la política dice que se devuelve y se cobró por MP, reembolso
   automático (punto 2 de Ale). Si no, queda como hoy (aviso al negocio).
6. Sin MP conectado, el sitio funciona como hoy: seña por transferencia que el dueño registra.

Idempotencia: el webhook puede llegar más de una vez; confirmar es compare-and-set, como el
resto del motor. Esta pieza vive en el **motor compartido**: Turnos y Gimnasio la heredan.

Lo que esta pieza necesita y hoy no existe:

- **Dónde guardar el pago de MP de una reserva.** `Payment.orderId` es obligatorio y `Reserva`
  solo tiene `pagado` y `pagoMetodo`. Hace falta el `mpPaymentId` para devolver, para no
  procesar dos veces el mismo webhook y para la comisión en Estadísticas. Propuesta: una tabla
  `reservas_pagos` (`reserva_id`, `mp_payment_id` único, `monto`, `comision`, `estado`,
  `devuelto_en`). **(compartido)**, migración.
- **El webhook:** el actual busca el pedido por el `orderId` de la URL; para reservas, la
  preferencia lleva una referencia propia (por ejemplo `reserva:<id>`) y el webhook la
  distingue.
- **Con confirmación manual (decisión de este diseño):** el pago aprobado deja la reserva
  `PENDIENTE` (pagada, esperando al dueño). Si el dueño la rechaza, la seña se devuelve sola.

### 7.4 Google Maps (Google Business Profile)

Pieza **transversal de Órbita** (no de Alquileres): sirve a cualquier negocio con ficha en
Google. Va en un módulo nuevo de la API (por ejemplo `apps/api/src/google-perfil/`).

- **Requisito previo, una sola vez:** Órbita pide acceso a la API de Google Business Profile
  (formulario de Google; piden un perfil verificado con 60 días o más y un proyecto de Google
  Cloud; la revisión tarda unas dos semanas). **Este trámite es lo primero, porque bloquea todo
  lo demás.**
- **Cómo conecta el dueño:** recomendado, que **agregue la cuenta de Órbita como administrador
  de su perfil** (Google lo permite desde la ficha). Así Órbita maneja todas las fichas con una
  sola credencial guardada en Secret Manager, sin OAuth por negocio. La alternativa (OAuth con la
  cuenta de Google del dueño) queda para el constructor si la primera no alcanza.
- **Qué muestra y hace el panel:**
  - **Métricas** (Performance API): vistas de la ficha (en Maps y en Búsqueda), llamadas, clics
    al sitio, pedidos de "cómo llegar", por día y por mes.
  - **Reseñas:** listarlas con su puntaje y responderlas desde el panel.
  - **Fotos:** subir fotos a la ficha (las mismas que ya están en la propiedad, con un botón).
- **Lo que no hace:** no crea la ficha (eso lo hace el dueño en Google) ni edita horarios o
  categoría en v1.

### 7.5 Fotos

Las fotos de cada propiedad se guardan en Supabase Storage como el resto de Órbita, en
`datos.fotos` del recurso. Desde ahí se usan en el sitio y se pueden mandar a Google (§ 7.4). A
Airbnb no se pueden mandar (§ 2).

### 7.6 Estadísticas (Ingresos pasa a ser "Estadísticas" en la estadía)

Todo por período (mes, mes pasado, últimos 3 meses, como hoy) y contra el período anterior:

- **Ocupación:** noches ocupadas ÷ noches disponibles (sin contar los bloqueos del dueño), por
  propiedad y total. Incluye las noches de Airbnb (bloqueos del `.ics`).
- **Ingresos:** reservas propias (lo cobrado) + lo importado del CSV de Airbnb (neto de
  comisión), separado por canal.
- **Precio promedio por noche** e **ingreso por noche disponible** (ingresos ÷ noches
  disponibles), por propiedad.
- **De dónde vienen:** reservas y plata por canal (sitio, Airbnb, WhatsApp, teléfono, otro).
- **Estadía promedio** (noches) y **anticipación promedio** (días entre que reservan y entran).
- **Google:** vistas, llamadas, clics al sitio y "cómo llegar" del período, y el puntaje y la
  cantidad de reseñas.
- **Lo que falta cobrar** (como hoy en Ingresos).

Sin datos del período anterior no se inventa un porcentaje (regla que ya cumple `Ingresos.tsx`).

### 7.7 Cómo cambia el sidebar de la estadía

| Grupo | Hoy (demo) | Propuesto |
|---|---|---|
| Hoy | Calendario, Qué hay libre, Huéspedes, Ingresos | Calendario, Qué hay libre, Huéspedes, **Estadísticas** |
| Propiedades | Propiedades, Temporadas y precios, Bloqueos | Igual |
| Reservas | Reglas, Recordatorios y mensajes, Pagos y señas | Igual |
| Canales | Calendarios (.ics) | **Airbnb** (calendarios + importar ganancias), **Google Maps** (métricas, reseñas, fotos) |
| — | Configuración | Igual |

Canchas y salones no cambian su sidebar, salvo que Calendarios (.ics) se vuelve real para los
tres (la sync sirve igual para una cancha que también se alquila por otra app).

## 8. Orden de trabajo

Hoy es 18/11 (semana 3 del ciclo). **De las tareas de Alquileres del plan no arrancó ninguna**:
el último cambio del módulo es del 04/11. Turnos hizo su arranque el 13/11, una semana tarde.
El horizonte de 1 mes (hasta el 27/11) ya no es alcanzable para Alquileres.

Propuesta: respetar el orden del plan, comprimido, y dejar lo nuevo de la estadía para después,
salvo lo que cae solo en las semanas del plan:

| Cuándo | Qué | Del plan |
|---|---|---|
| 18–19/11 (el 20 es feriado) | Arranque: este mapa como entrada de Auditoría, negocio de prueba en dev, capa de datos por origen (patrón Turnos), reunión con Ale por F2–F16 | Semana 1 |
| 23–27/11 | Canchas sobre el backend (F2 si Ale lo aprueba) | Semana 2 |
| 30/11–04/12 | Salones y eventos (F3, F6, F7) | Semana 3 |
| 07–11/12 | Estadía: propiedades, temporadas (F4), calendario, reserva a mano, bloqueos. **Más la sync de Airbnb real (F9)**: reemplaza la pantalla simulada | Semana 4 |
| 14–18/12 | El sitio reserva de verdad (los tres modos) + Mi reserva | Semana 5 |
| 21–23/12 | Qué hay libre, Ingresos, alta real, entrada de cierre | Semana 6, recortada |

**Quedan fuera del ciclo** y pasan a la propuesta de cierre del 22/12 (o a un ciclo 3, si
Ale lo aprueba): QA completa, alquiler por mes (F5), seña online con MP (F15), CSV de Airbnb
(F18), Google Maps (F17) y Estadísticas por canal (§ 7.6). **El trámite de acceso a la API de
Google conviene pedirlo ya**, porque tarda dos semanas y no depende de nada.

Este orden es una propuesta: lo confirma Alan y, como mueve el plan, lo ve Ale.

## 9. Lo que decide Ale (para llevar a la reunión)

En orden de importancia:

1. **Mover el plan:** el atraso de dos semanas y qué se recorta (§ 8).
2. **Sumar lo nuevo de la estadía** (Airbnb, CSV, seña online, Google, estadísticas) al plan, y
   cuándo.
3. **El precio en el servidor:** precios por horario (F2), temporadas (F4) y por mes (F5) en
   `dominio/precio.ts`.
4. **`datos Json` en `Reserva` y en `ReservaConfig`** (F6, F10, F11): dos migraciones chicas,
   que Turnos también necesita.
5. **Calendarios externos** (F9): tabla nueva, columnas en `reservas_bloqueos` y la sync dentro
   del job de mantenimiento.
6. **Seña online y devolución** (F15): ya está en su decisión abierta, puntos 1 y 2.
7. **Bloqueos con permiso `manage`** (F12).
8. **Google Business Profile como pieza transversal** (F17) y pedir el acceso ya. Antes hay
   que saber si Órbita tiene una ficha de Google verificada con 60 días o más y desde qué cuenta
   se pide (Alan no lo sabe al 18/11).
9. **Rutas de producción de los módulos de reservas:** una solución para los tres, con
   responsable y fecha. **Bloquea las semanas 5 y 6:** hoy el panel de Turnos sobre la API da
   `notFound` en producción (y por eso tampoco existe en staging). Tiene que estar antes del
   14/12. De paso: los emails arman el link con `https://<sub>.orbita.site/mi-reserva/<token>`
   fijo (`reservas-avisos.service.ts`), así que desde staging apuntan a producción.
10. **Dónde se guarda el pago de MP de una reserva** (§ 7.3): tabla nueva en el motor.

## 10. Lo que queda al constructor

- Los nombres finales de tablas, columnas, rutas y archivos (los de este documento son
  propuestas).
- Los detalles de la capa de datos por origen, siguiendo el patrón de Turnos.
- El intervalo exacto de la sync de iCal y el tope de calendarios por propiedad.
- El parseo del CSV de Airbnb, una vez visto un archivo real.
- La estrategia de extras por negocio vs. por recurso en canchas (§ 5.2).
- Cómo se ve cada pantalla nueva (Airbnb, Google, Estadísticas), pasando por `ui-ux-pro-max` y
  el kit de reservas.

## 11. Cómo se verifica

- **Reglas puras** (precio por horario, temporadas, por mes, parseo de `.ics` y del CSV) con
  tests en `apps/api/src/reservas/dominio/*.spec.ts`, comparando contra los resultados de
  `apps/web/src/lib/reservas/` (el precio del sitio = el del servidor).
- **El motor** con sus tests unitarios y los e2e **contra dev** (nunca producción), sumando: una
  reserva del sitio que choca con un bloqueo de Airbnb; un webhook de MP que llega tarde; el
  mismo CSV importado dos veces.
- **Turnos y Gimnasio no se rompen:** sus tests en verde después de cada cambio compartido.
- **Front:** typecheck, eslint, los tests de `modules/alquileres` (incluido `navegacion.test.ts`)
  y la demo `/alquileres-demo` igual que antes.
- **Manual del panel:** `contenido.ts` actualizado y `pnpm manual:generar`; `pnpm test` de
  `apps/web` en verde.
- **QA** en 390, 768 y 1280, claro y oscuro, con datos reales de dev.

## Fuentes de la investigación (18/11/2026)

- Airbnb sin API abierta: [bnbcalc](https://www.bnbcalc.com/blog/airbnb-business/buying-rental-property/does-airbnb-have-an-api),
  [elfsight](https://elfsight.com/blog/how-to-get-and-use-airbnb-api-partnership-and-integration/),
  [Hostify](https://hostify.com/blog/airbnb-api).
- Google Business Profile API (acceso, reseñas, fotos, métricas):
  [prismareviews](https://prismareviews.com/guides/google-business-profile-api-access),
  [slashpost](https://slashpost.ai/blogs/google-business-profile/google-business-profile-api-documentation-2026).
  **A confirmar contra la documentación oficial de Google antes de construir.**
- Google Vacation Rentals no acepta dueños individuales:
  [Google, guía inicial](https://support.google.com/hotelprices/answer/11949903?hl=en),
  [intermediarios certificados](https://developers.google.com/hotels/connectivity-partners).
