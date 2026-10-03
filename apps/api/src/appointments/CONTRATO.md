# Contrato de la API de Turnos & Agenda (`appointments`)

Estado: **fundación**. Existen el esquema, las migraciones, los permisos, el catálogo de rubros y
roles, las utilidades de horarios, el motor de disponibilidad y los tipos de respuesta. **Ningún
endpoint de este documento está implementado todavía**: es lo que tienen que construir las sesiones
que siguen, repartido en cuatro paquetes (P1 a P4).

Fuente de cada cosa:

| Qué | Dónde |
|---|---|
| Modelos y tablas | `prisma/schema.prisma` (bloque "TURNOS & AGENDA"), `MODELO_DATOS_DEFINITIVO.md` § 22 |
| Tipos de respuesta (los nombres `XxxDto` de este documento) | `src/appointments/appointments.types.ts` |
| Rubros, reglas y horario de fábrica | `src/appointments/catalogo/rubros.ts` |
| Roles de fábrica y alcances ↔ permisos | `src/appointments/catalogo/roles.ts` |
| Horarios (tramos, cruce, validación, hora de Argentina) | `src/appointments/horarios/horarios.ts` |
| Disponibilidad (motor puro) | `src/appointments/disponibilidad/disponibilidad.ts` |
| Demo que define el comportamiento | `apps/web/src/modules/turnos/` |

Nadie más toca `schema.prisma`: si a un paquete le falta una columna, se avisa antes de inventarla.

---

## 0. Convenciones (valen para todos los endpoints)

**Rutas.** Prefijo global `/api/v1`. Panel: `/api/v1/appointments/...`. Público:
`/api/v1/storefront/:slug/appointments/...`. Cuenta de cliente: `/api/v1/me/appointments/...`.

**Nombres.** En el backend "turno" es el turno de conversación de Orbi. Acá todo es `appointment`:
no crear archivos, clases ni tablas `Turn*` / `turno*`.

**Vertical.** Todo endpoint de panel empieza verificando que el negocio sea de turnos
(`business.vertical === 'APPOINTMENTS'` y existe `appointment_settings`); si no, `404 "Este negocio
no usa Turnos"`. Hacerlo en un helper único del módulo (`this.settings.delNegocio(businessId)`), no
en cada método. Los públicos igual: una tienda (`STORE`) responde 404 en `storefront/:slug/appointments/*`.

**Panel.** `@CurrentBusiness() ctx` + `assertMemberContext(ctx)`; `businessId` SIEMPRE sale del
token, nunca del body ni de la URL. Toda consulta Prisma sobre un modelo con `businessId` lo lleva
en el `where` (lo verifica `test/unit/aislamiento-consultas.unit-spec.ts`): para leer o tocar una
fila por id se usa `findFirst({ where: { id, businessId } })` / `updateMany({ where: { id, businessId } })`.

**Permisos y alcance.** El decorador es `@RequirePermission('<código base>')`. Los pares
(`*.view` / `*.view_all`, `*.manage` / `*.manage_all`) se resuelven en el service:

```ts
// Lo "propio" de quien mira: la agenda cuyo memberId es él, y el espacio que tenga asignado.
const todo = member.roleName === 'owner' || member.permissions.includes('appointments.agenda.view_all');
const propios = todo ? null : await idsDeMisAgendas(member); // [resource.id, resource.assignedSpaceId]
```

Sin `_all`, las listas se filtran a `propios` y una fila ajena responde **404** (no 403: no se
revela que existe). El dueño (`roleName === 'owner'`) pasa por todo, como en `PermissionsGuard`.
Dependencias entre permisos: `normalizarCodigos()` de `catalogo/roles.ts` (se aplica al guardar un rol).

| Código | Qué habilita |
|---|---|
| `appointments.agenda.view` (+`_all`) | Ver la agenda, los turnos, las clases, los servicios y las agendas |
| `appointments.agenda.manage` (+`_all`) | Dar, mover, confirmar, cancelar, marcar atendido/ausente; anotar y sacar de clases |
| `appointments.clients.view` (+`_all`) | Ver clientes y su historial. Sin `_all`: solo los que atendió |
| `appointments.clients.contact` | Ver teléfonos y emails sin tapar; armar/mandar mensajes |
| `appointments.cash.charge` | Registrar una seña o un cobro |
| `appointments.earnings.view` (+`_all`) | Ver ganancias (las propias / las de todos) |
| `appointments.earnings.settle` | Registrar pagos al equipo y cambiar cómo cobra cada uno |
| `appointments.reports.view` | Ver montos del negocio (ingresos del día, gastado por cliente) |
| `appointments.services.manage` | Servicios, precios, grilla de clases |
| `appointments.team.manage` | Personas, espacios, invitaciones y roles |
| `appointments.settings.manage` | Configuración (todas las pestañas) y Avanzado |

Teléfono tapado: sin `appointments.clients.contact`, `phone` viaja como
`telefono.replace(/\d(?=(?:\D*\d){2})/g, '•')` (quedan los dos últimos dígitos) y `email` como `null`.
Montos: sin `appointments.reports.view`, los campos marcados `number | null` en los tipos van en `null`.

**Avanzado.** Los endpoints de P4 llevan `@RequiresAddon('ADVANCED')` y, las escrituras,
`@RequirePermission('appointments.settings.manage')`. Sumar cada escritura a
`test/unit/funciones-pagas.gates.unit-spec.ts` (hoy exige `advanced.manage`: agregar una segunda
lista para Turnos con `appointments.settings.manage`). En rutas **públicas** no hay `req.user`: el
gate se revalida en el service con `BusinessesService.hasActiveAddon(businessId, 'ADVANCED')` Y con
`settings.advanced[funcion].on` (patrón de `CountdownService.getActiveCountdown`). Sin add-on, la
función responde como si no existiera (lista vacía / 404), nunca 403.

**Públicos.** `@Public()` en lecturas; `@OptionalAuth()` en lo que cambia con sesión (crear
reserva). Siempre `@Throttle` propio. El slug se resuelve con `StorefrontService.resolveBusinessId(slug)`
y después se exige sitio abierto (`isActive && !isPaused`), salvo en "mi turno" (ver § P2: quien ya
reservó tiene que poder ver y cancelar aunque el negocio esté pausado). Un JWT de cliente de OTRO
negocio se ignora (`ctx.businessId !== businessId` → se trata como anónimo).

**Serialización.** Plata `number` (pesos, 2 decimales). Instantes ISO UTC. Días `YYYY-MM-DD` de
Argentina. Horas del día en minutos desde las 00:00 de Argentina. Día de la semana 0 = lunes.
Enums con el valor de Prisma.

**Hora.** Argentina fija (-03:00). `startsAt = instanteDe(date, startMin)`. Nunca `getDay()` /
`getHours()` del servidor (corre en UTC): usar `fechaArgentina`, `fechaYMinutos`, `diaDeSemana`.

**Validación.** DTOs con class-validator (el `ValidationPipe` global ya tiene `whitelist`).
Fechas: `@Matches(/^\d{4}-\d{2}-\d{2}$/)` + `esFecha()` en el service. Ids: `@IsUUID('4')`.
Textos con `@MaxLength` igual al `VarChar` de la columna.

**Errores.** Mensajes en español rioplatense, pensados para mostrarse tal cual.
`400` regla de negocio o dato inválido · `403` falta permiso (`Permiso requerido: <código>`) o add-on
(`ADDON_REQUIRED:ADVANCED`) · `404` no existe, es de otro negocio o está fuera del alcance de quien
mira · `409` conflicto de concurrencia (el horario se ocupó, cupo lleno) · `429` throttle.

**Auditoría.** Las escrituras del panel registran en `audit_logs` con `AuditService` (mismo patrón
que `coupons`): entidad `appointment`, `appointment_service`, `appointment_resource`,
`appointment_settings`, `appointment_payout`…; revisar `test/unit/acciones-sin-registro.*`.

**Teléfono.** Se guarda normalizado: solo dígitos, sin el 0 del área ni el 15 (10 dígitos para un
celular argentino). `normalizarTelefono()` vive en `src/appointments/` (P2 la crea; P1 la usa al
dar un turno desde el panel). Validación pública: 10 dígitos exactos, con los mensajes de la demo
(`storefront/reserva/PasoDatos.tsx → validar`).

**Cliente (`customers`).** Al crear un turno (panel o sitio) se busca la ficha por
`(businessId, phone)` con `deletedAt: null`; si no, por `(businessId, email)` cuando hay email; si
no existe se crea (`firstName` = primera palabra, `lastName` = el resto, `phone`, `email` solo si
ningún otro cliente del negocio lo tiene, sin `passwordHash`). El turno guarda SIEMPRE el snapshot
(`customerName`, `customerPhone`…) además del `customerId`. Vincular una reserva anónima a una
ficha no le muestra nada a quien reserva: "mi turno" sin cuenta entra solo por su enlace.

---

## 1. Reglas de negocio transversales

### 1.1 Crear un turno (la única forma correcta)

Lo usan P1 (panel), P2 (sitio), P4 (turno fijo). Vive en un solo método
(`AppointmentsService.crear`), con esta secuencia:

1. Cargar settings, servicio (`isActive`, `deletedAt: null`; en el sitio además `bookableOnline`),
   agendas candidatas (`isBookable`, `isActive`, `deletedAt: null`, `kind` según `agendaMode`).
2. `prisma.$transaction(async (tx) => { ... })`:
   a. Tomar un lock por negocio y día: `SELECT pg_advisory_xact_lock(hashtext(<businessId>||':'||<date>))`
      (`tx.$queryRaw`). Serializa las reservas simultáneas del mismo día.
   b. Leer los turnos no cancelados que tocan ese día (± el margen) de las agendas candidatas.
   c. Armar el `ContextoDisponibilidad` y llamar `horarioSiEstaLibre(ctx, date, startMin, duracion, resourceId | CUALQUIERA)`.
      `modo: 'publico'` en el sitio, `'panel'` en el panel. `null` → `409 "Ese horario se acaba de
      ocupar. Elegí otro."` (o `400 "Ese horario no está disponible."` si nunca fue válido: fuera de
      horario, de la grilla o de la ventana).
   d. Recalcular precio, descuento y seña EN EL SERVIDOR (§ 1.3). Lo que mande el cliente se ignora.
   e. `tx.appointment.create(...)` con `code` (§ 1.5), `accessToken` (§ 1.5), snapshot y
      `resourceId` = el que devolvió el motor.
3. Si la base rechaza con `23P01` (constraint `appointments_no_overlap`), traducir a 409. Prisma lo
   entrega como `PrismaClientUnknownRequestError` / `P2010` con el código en el mensaje: capturar
   por `/23P01|appointments_no_overlap/`.
4. Fuera de la transacción: mensajes (§ 1.6), notificación al panel, auditoría.

En modo `RESOURCE` con una persona que tiene `assignedSpaceId`, el turno se guarda sobre el
ESPACIO. "Los turnos de una persona" = los de `resourceId IN (persona.id, persona.assignedSpaceId)`.

### 1.2 Estados

`PENDING → CONFIRMED | CANCELLED | NO_SHOW` · `CONFIRMED → COMPLETED | NO_SHOW | CANCELLED` ·
`COMPLETED`, `NO_SHOW`, `CANCELLED` son finales. `COMPLETED` y `NO_SHOW` solo cuando el turno ya
empezó (`startsAt <= ahora`). Está en `TRANSICIONES` / `puedePasarA()`. "En curso" no se guarda:
`estadoVisible()`.

Estado inicial: `CONFIRMED` si `confirmation === 'auto'` y no hay seña online pendiente; `PENDING`
si `confirmation === 'manual'` o si falta pagar una seña online (pasa a `CONFIRMED` cuando el
webhook aprueba el pago, salvo confirmación manual). Desde el panel: `CONFIRMED` siempre.

Efectos al cambiar de estado (en la misma transacción):

- `CONFIRMED`: `confirmedAt`. Mensaje `confirmacion` si venía de `PENDING`.
- `COMPLETED`: `completedAt`. Suma un sello (`AppointmentLoyaltyCard`) si el cliente tiene cuenta
  y hay tarjeta (§ P4 fidelidad). Si se pagó con pack: `sessionsUsed + 1` (una sola vez).
- `NO_SHOW`: `AppointmentCustomerProfile.noShowCount + 1`. Con seña paga: se aplica
  `depositOutOfWindow` (`forfeit`: nada; `credit`: suma a `depositCredit`).
- `CANCELLED`: `cancelledAt`, `cancelledBy`, `cancelReason`. Seña (§ 1.4). Libera el horario: si
  hay lista de espera, ofrecer el lugar (§ P4/P3). Mensaje `cancelacion`.

### 1.3 Precio, descuento y seña (siempre en el servidor)

```
precio      = servicio.price, con el ajuste de "Precios por horario" si aplica (P4):
              redondear(price * (100 + adjustPercent) / 100) — la regla activa cuyo día y franja
              contienen el inicio del turno; si hay más de una, la de mayor descuento.
descuento   = bienvenida: round(precio * welcomeDiscountPercent / 100) si account.accountEnabled,
              welcomeDiscountPercent > 0, la reserva viene con cuenta de cliente y
              profile.welcomeUsedAt es null. Se marca welcomeUsedAt al crear.
              (+ cupón de "Recuperar clientes" si manda uno válido, P4. No se acumulan: el mayor.)
aPagar      = precio - descuento
pideSeña    = aPagar > 0 && (rules.depositEnabled
                             || (rules.depositForNoShows && profile.noShowCount > 0))
seña        = depositType === 'percent' ? round(aPagar * depositPercent / 100)
                                        : min(depositFixed, aPagar)
              menos profile.depositCredit disponible (se descuenta del crédito al crear).
cobroOnline = según payments.onlineCharge: 'deposit' → seña; 'total' → aPagar;
              'customer_choice' → lo que elija el cliente entre esos dos (campo `pay` del DTO).
```

`round` = redondeo al peso. Si se paga con pack, gift card o membresía (P4), `aPagar` baja a 0 (o a
lo que no cubra el saldo de la gift card) y no hay seña.

**Sin Mercado Pago conectado** (`MercadopagoService.getStatus(businessId).connected === false`):
no se cobra nada online. La reserva se crea igual, `depositAmount` queda con el monto pedido y
`depositPaidAt` en null (el negocio la cobra y la registra a mano); el estado inicial sigue la regla
de confirmación (no queda `PENDING` esperando un pago que no puede llegar). La respuesta trae
`payment: null` y, si `showTransferData`, `transfer` con alias/CBU/titular de `business_config`.
`SitioTurnosDto.booking.onlinePaymentAvailable` le avisa al sitio de antemano.

### 1.4 Cancelar y reprogramar

- **Cancelar (cliente):** siempre puede mientras el turno sea `PENDING` o `CONFIRMED` y no haya
  empezado. A tiempo = `ahora <= startsAt - cancelUntilHours` (con `cancelUntilHours = 0`, hasta el
  inicio). A tiempo y con seña paga por MP → reembolso por API de MP (mismo camino que
  `CancellationsService`); si el reembolso falla, queda registrado y se avisa al negocio. Fuera de
  plazo → `depositOutOfWindow`. `depositOnCancel` de `MiTurnoDto` anticipa cuál de los cuatro casos
  aplica: `refund` | `forfeit` | `credit` | `none` (no hay seña paga).
- **Cancelar (panel):** siempre, con `cancelledBy = BUSINESS`. La seña paga se reembolsa (el
  negocio canceló) salvo que el DTO diga `keepDeposit: true`.
- **Reprogramar (cliente):** exige `rescheduleEnabled`, `rescheduleCount < rescheduleMax` y
  `ahora <= startsAt - rescheduleUntilHours`. El horario nuevo pasa por § 1.1 con `salvo = id`. Se
  hace con un `update` de la misma fila (`startsAt`, `endsAt`, `resourceId` si era "cualquiera",
  `rescheduleCount + 1`, `reminderSentAt = null`, `secondReminderSentAt = null`): la seña y el
  `accessToken` siguen siendo los mismos. El precio NO se recalcula.
- **Mover (panel):** igual, sin los límites del cliente y sin sumar `rescheduleCount`. Deja el turno
  en `CONFIRMED` (como la demo). Puede cambiar de agenda.

### 1.5 `code` y `accessToken`

- `code`: 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin 0/O/1/I). Único por negocio
  entre `appointments` Y `appointment_class_enrollments` (quien lo genera mira las dos tablas y
  reintenta ante `P2002`). Es una **referencia visible** ("decile al negocio tu código 4F7K2Q"). **No
  autentica nada**: ningún endpoint público busca por `code`.
- `accessToken`: `randomBytes(32).toString('base64url')` (43 caracteres), único global. Es el
  secreto del enlace personal `<sitio>/mi-turno/<accessToken>`. Se devuelve una sola vez (respuesta
  de crear la reserva) y va en los mensajes de confirmación. No se loguea, no va en `audit_logs` y
  **no se devuelve en ningún endpoint del panel**. Comparar siempre por igualdad exacta en el
  `where` (es `@unique`: la búsqueda por índice no filtra tiempo de forma útil).
- No hay OTP por WhatsApp/SMS ni búsqueda por teléfono: no existe proveedor y el teléfono solo
  filtraría turnos ajenos.

### 1.6 Mensajes automáticos

`AppointmentMessagingService.despachar(plantilla, destino)` (lo crea P2, lo usan todos):

1. Lee `settings.messages` (o los textos de fábrica de la demo, `admin/configuracion/Mensajes.tsx`,
   más `reprogramacion`). Si la plantilla está `on: false`, no hace nada.
2. Arma el texto: `{nombre} {servicio} {fecha} {hora} {profesional} {negocio} {link}`.
   `{link}` = `https://<dominio del negocio>/mi-turno/<accessToken>`. Firma opcional.
3. Por cada canal activo de la plantilla Y del negocio (`messages.email`, `messages.wa`):
   - `email` → `MailService` (método nuevo por plantilla: `sendAppointmentConfirmation`,
     `sendAppointmentCancelled`, `sendAppointmentRescheduled`, `sendAppointmentReminder`,
     `sendAppointmentWaitlistOffer`, `sendAppointmentWinback`), con `meta.businessId`. Solo si hay
     `customerEmail`.
   - `whatsapp` → `WhatsappProvider.enviar(to, { texto }, variables)` (interfaz en
     `appointments.types.ts`). El proveedor se elige con la variable de entorno
     `WHATSAPP_PROVIDER` (no sensible: va en `deploy/env-vars.yaml`); sin definir o `stub` usa
     `WhatsappStubProvider`, que solo hace `logger.log('[WHATSAPP STUB] …')` SIN el teléfono
     completo ni el texto, y devuelve `SIMULATED`. El proveedor real (probablemente WhatsApp Cloud
     API) queda para después: cuando exista, usa `settings.whatsappProviderData` (ids) y, si
     necesita tokens, se guardan CIFRADOS como `mp_credentials` (`pgp_sym_encrypt`), no en ese Json.
4. Escribe una fila en `appointment_message_logs` por canal (`SENT` | `FAILED` | `SIMULATED`) con
   `dedupeKey = "<plantilla>:<canal>:<id>:<startsAt ISO>"`. Si ya existe esa clave
   (`@@unique([businessId, dedupeKey])`, `P2002`) no se manda de nuevo: es lo que hace idempotente
   al cron. Reprogramar cambia `startsAt`, así que el recordatorio del horario nuevo sí sale.
5. Nunca tira: un fallo de mail o de WhatsApp se registra `FAILED` y la reserva sigue.

### 1.7 Recordatorio diario

Colgado del cron existente de las 22 h: `InternalCronController.resumenDiario()` suma, después de
`notifications.resumenDiario()`, una llamada a `AppointmentsRemindersService.recordatoriosDeManana()`
dentro de su propio `try/catch` (si falla se anota, no marca la corrida como fallida — mismo
criterio que `costs.syncAll()`). Agregar el service como dependencia OPCIONAL al final del
constructor, como las demás.

`recordatoriosDeManana()`: turnos `CONFIRMED` (y `PENDING`) con `wantsReminder`, `reminderSentAt`
null y `startsAt` dentro del día argentino de mañana, de negocios `APPOINTMENTS` activos, no
pausados ni borrados; lo mismo para inscripciones `ENROLLED`. Despacha `recordatorio` y marca
`reminderSentAt`. Recorre todos los negocios a la vez: sumar el archivo a `EXCEPCIONES` de
`aislamiento-consultas.unit-spec.ts` con el motivo. Con el cron a las 22 h el recordatorio sale
entre 2 y 26 horas antes: la opción "48 h / 12 h antes" de la demo y el "último aviso" del mismo día
(`recordatorio2`) NO se pueden cumplir con un cron diario (ver § Pendientes de producto).

---

## P1 — Núcleo del panel

Controllers: `appointments-settings`, `appointment-services`, `appointment-resources`,
`appointments`, `appointments-agenda`. Todos `@Controller('appointments...')`.

### P1.1 Configuración

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/settings` | miembro del negocio | — | `SettingsDto` |
| `PUT appointments/settings/business` | `appointments.settings.manage` | `UpdateBusinessDto` | `SettingsDto` |
| `PUT appointments/settings/site` | `appointments.settings.manage` | `UpdateSiteDto` | `SettingsDto` |
| `PUT appointments/settings/schedule` | `appointments.settings.manage` | `UpdateScheduleDto` | `SettingsDto` |
| `PUT appointments/settings/booking` | `appointments.settings.manage` | `UpdateBookingDto` | `SettingsDto` |
| `PUT appointments/settings/messages` | `appointments.settings.manage` | `UpdateMessagesDto` | `SettingsDto` |
| `PUT appointments/settings/payments` | `appointments.settings.manage` | `UpdatePaymentsDto` | `SettingsDto` |
| `PUT appointments/settings/whatsapp` | `appointments.settings.manage` | `UpdateWhatsappDto` | `SettingsDto` |

`GET` lo puede leer cualquier miembro (el panel lo necesita para dibujarse: modo de agenda, grilla,
horario). No trae secretos. `payments.transfer*` y `whatsapp.number` van en `null` para quien no
tiene `appointments.settings.manage`.

- **`UpdateBusinessDto`** (pestaña Datos del negocio): `name` (2–80), `description?` (≤500),
  `address?` (≤200), `latitude?`, `longitude?`, `city?`, `neighborhood?`, `floor?`, `directions?`
  (≤400), `homeZones?` (≤400), `modalities` (`ON_SITE` | `HOME`, mínimo una, y dentro de
  `modalidadesPosibles(rubro)`), `phone?`, `whatsapp?`, `email?` (`@IsEmail`), `instagram?`.
  Escribe en `businesses` (name, description), en la sucursal principal (`whereSucursalPrincipal`:
  address, latitude, longitude), en `business_config` (whatsapp, email, instagram) y en
  `appointment_settings` (el resto). El logo se sube con el endpoint de logo que ya existe
  (`storefront_config.logo_url`). Errores: `400 "Elegí al menos una forma de atender."`,
  `400 "Una cancha o una clase no se llevan a domicilio."`.
- **`UpdateSiteDto`** (Apariencia): `siteForm` (`web` | `simple`), `simpleDesign` (`tarjeta` |
  `portada` | `partida` | `editorial` | `enlaces`), `appearance?: AparienciaTurnos` (objeto
  anidado validado: `color` `/^#[0-9a-fA-F]{6}$/`, `radio` 0–40, `plantilla`/`tipo` ≤40,
  `foto` URL de R2 o `/turnos/…`, `secciones` ≤12 con `id` ≤30, `nombre` ≤80, `frase` ≤160,
  `boton` ≤40). La plantilla es un id del catálogo del FRONT (`storefront/plantillas.ts`): el
  backend no lo valida contra una lista. Aplicar una plantilla que no sea la de fábrica del rubro
  es función de Avanzado (`plantillas`): si `appearance.plantilla` cambia y el negocio no tiene el
  add-on → `403 ADDON_REQUIRED:ADVANCED` (revalidar acá, igual que `setHomeTemplate`).
- **`UpdateScheduleDto`** (Horarios): `weekSchedule: number[][][]`, `specialDays: { date, kind,
  ranges, reason? }[]` (≤60, REEMPLAZA la lista entera: `deleteMany` + `createMany` en una
  transacción), `vacation: { enabled, from?, to?, message? }`. Validar con `errorSemana(week, {
  exigirUnDiaAbierto: true })` y `errorTramos(ranges)`; el mensaje de esas funciones va tal cual en
  el `400`. `kind = SPECIAL` exige al menos un tramo. Fechas de días especiales sin repetir
  (`400 "Hay dos días especiales con la misma fecha."`). Vacaciones prendidas exigen `from <= to`.
  Cambiar el horario NO cancela turnos ya dados fuera del horario nuevo: la respuesta suma
  `affected: number` (turnos futuros `PENDING`/`CONFIRMED` que quedaron fuera) para que el panel avise.
- **`UpdateBookingDto`** (Reglas de reserva): `rules: ReglasReserva`, `policy: PoliticaReserva`,
  `account: BeneficiosCuenta`. Rangos: `minAdvanceMin` ∈ {0,60,120,240,720,1440};
  `maxAdvanceDays` ∈ {7,14,30,60,90}; `slotMin` ∈ `grillasDe(rubro)`; `bufferMin` ∈ {0,5,10,15};
  `confirmation` ∈ {auto, manual}; `maxActivePerCustomer` ∈ {0,1,2,3,5}; `waitlistAcceptMin` ∈
  {15,30,60}; `classDefaultCapacity` 1–500; `classOpenDays` ∈ {1,2,3,7,14}; `classMinEnrolled`
  0–500; `rescheduleUntilHours` ∈ {2,6,12,24,48}; `rescheduleMax` ∈ {1,2,3}; `depositType` ∈
  {percent, fixed}; `depositPercent` 10–100 múltiplo de 5; `depositFixed` 0–10.000.000;
  `cancelUntilHours` ∈ {0,2,6,12,24,48,72}; `depositOutOfWindow` ∈ {forfeit, credit};
  `toleranceMin` ∈ {0,5,10,15,20,30}; `welcomeDiscountPercent` ∈ {0,5,10,15,20}; `loyaltyStamps` ∈
  {0,5,6,8,10}. Los booleanos, `@IsBoolean`.
- **`UpdateMessagesDto`**: `MensajesTurnos` (`mensajes` ≤10; `id` de la lista cerrada; `canales` ⊆
  {wa, email}; `texto` 1–600; `cuando` ≤4). Variables desconocidas entre llaves → `400 "La
  variable {x} no existe. Podés usar: {nombre}, {servicio}, {fecha}, {hora}, {profesional},
  {negocio}, {link}."`.
- **`UpdatePaymentsDto`**: `onlineCharge` ∈ {deposit, total, customer_choice}; `onSiteMethods` ⊆
  {CASH, TRANSFER, DEBIT_CARD, CREDIT_CARD, QR}; `transferAlias?` (≤40), `transferCbu?` (22
  dígitos), `transferHolder?` (≤120) → `business_config`; `showTransferData`. Conectar o
  desconectar Mercado Pago es el flujo que ya existe (`/mercadopago/oauth/*`); hoy pide
  `@Roles('owner','admin')`.
- **`UpdateWhatsappDto`**: `number?` (dígitos, 8–15). `connected` no se escribe a mano: lo pone el
  flujo del proveedor cuando exista; con el STUB queda siempre `false`.

### P1.2 Servicios

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/services` | `appointments.agenda.view` | `?includeInactive=true` | `ServicioDto[]` (por `sortOrder`, `createdAt`) |
| `POST appointments/services` | `appointments.services.manage` | `UpsertServiceDto` | `ServicioDto` |
| `PUT appointments/services/:id` | `appointments.services.manage` | `UpsertServiceDto` | `ServicioDto` |
| `PUT appointments/services/order` | `appointments.services.manage` | `{ ids: string[] }` (≤200) | `ServicioDto[]` |
| `DELETE appointments/services/:id` | `appointments.services.manage` | — | `{ ok: true }` |

`UpsertServiceDto`: `name` (1–120), `description?` (≤500), `durationMin` (5–600), `price`
(0–100.000.000, hasta 2 decimales), `bookableOnline` (bool), `isActive?`. Nombre repetido (sin
distinguir mayúsculas ni acentos) entre los no borrados → `400 "Ya tenés un servicio con ese
nombre."`. Borrar es soft-delete (`deletedAt`); si lo usan plantillas de clase activas o paquetes
activos → `400 "Ese servicio se usa en <N> clases de la grilla. Sacalo de ahí primero."`. Los
turnos ya dados conservan `serviceName`.

### P1.3 Agendas (personas y espacios)

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/resources` | `appointments.agenda.view` | `?kind=PERSON\|SPACE&bookable=true` | `RecursoDto[]` |
| `POST appointments/resources` | `appointments.team.manage` | `UpsertSpaceDto` | `RecursoDto` |
| `PUT appointments/resources/:id` | `appointments.team.manage` | `UpsertSpaceDto` | `RecursoDto` |
| `DELETE appointments/resources/:id` | `appointments.team.manage` | — | `{ ok: true }` |

Estos tres de escritura son para **espacios** (`kind = SPACE`: canchas, cabinas, consultorios,
salas — pantalla Espacios). Las personas se crean y editan en P3 (Equipo). `GET` sin `_all`
devuelve solo las agendas propias. `UpsertSpaceDto`: `name` (1–120), `roleLabel?` (≤80), `color?`
(`#RRGGBB`), `workDays` (0–6, sin repetir, mínimo uno), `ownSchedule?` (semana o `null`; validar
con `errorSemana`), `isActive?`. Errores: `400 "Elegí al menos un día."`; borrar con turnos futuros
activos → `400 "Tiene <N> turnos por delante. Movelos o cancelalos antes de borrarla."`. Soft-delete.

### P1.4 Turnos

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments` | `appointments.agenda.view` | `ListAppointmentsQuery` | `Paginado<TurnoDto>` |
| `GET appointments/availability` | `appointments.agenda.manage` | `?serviceId&date&resourceId?&except?` | `DisponibilidadDiaDto` |
| `GET appointments/availability/range` | `appointments.agenda.manage` | `?serviceId&from&to&resourceId?&except?` | `DisponibilidadRangoDto` |
| `GET appointments/:id` | `appointments.agenda.view` | — | `TurnoDetalleDto` |
| `POST appointments` | `appointments.agenda.manage` | `CreateAppointmentDto` | `TurnoDetalleDto` |
| `PATCH appointments/:id/status` | `appointments.agenda.manage` | `ChangeStatusDto` | `TurnoDetalleDto` |
| `POST appointments/:id/move` | `appointments.agenda.manage` | `MoveAppointmentDto` | `TurnoDetalleDto` |
| `POST appointments/:id/deposit` | `appointments.cash.charge` | `RegisterDepositDto` | `TurnoDetalleDto` |
| `PATCH appointments/:id/note` | `appointments.agenda.manage` | `{ internalNote: string \| null }` (≤500) | `TurnoDetalleDto` |
| `GET appointments/:id/message` | `appointments.clients.contact` | `?template=<MensajeId>` | `MensajeRenderizadoDto` |
| `POST appointments/:id/messages` | `appointments.clients.contact` | `{ template: MensajeId }` | `MensajeEnviadoDto[]` |

- `ListAppointmentsQuery`: `from?`, `to?` (fechas; rango ≤ 92 días; por defecto hoy), `resourceId?`,
  `customerId?`, `status?` (lista separada por comas), `q?` (nombre o teléfono del snapshot, sin
  acentos), `page` (≥1), `limit` (1–100, defecto 50). Orden por `startsAt`.
- `availability`: motor en `modo: 'panel'` (sin anticipación mínima ni máxima). `resourceId`
  ausente = `CUALQUIERA`. `except` = id del turno que se está moviendo (`salvo`). Sin
  `manage_all`, solo sobre las agendas propias.
- `CreateAppointmentDto`: `serviceId`, `resourceId` (uuid o `"cualquiera"`), `date`, `startMin`
  (0–1439), `customerId?` **o** `customer?: { name (3–120), phone?, email?, insuranceName? }`
  (exactamente uno: `400 "Elegí un cliente o cargá uno nuevo."`), `modality?`, `internalNote?`,
  `priceOverride?` (0–100.000.000, exige `appointments.services.manage`). Regla § 1.1 con
  `origin = PANEL`, estado `CONFIRMED`, `createdByMemberId`. El límite de turnos activos por cliente
  NO aplica en el panel. No pide seña online; `depositAmount` se calcula igual para mostrar "seña
  pendiente". Sin `manage_all`, solo en una agenda propia (`404` si no).
- `ChangeStatusDto`: `status` ∈ {CONFIRMED, COMPLETED, NO_SHOW, CANCELLED}, `reason?` (≤300),
  `keepDeposit?`. Transición inválida → `400 "Un turno <estado actual> no puede pasar a <nuevo>."`;
  todavía no empezó → `400 "Todavía no es la hora del turno: no se puede marcar como atendido ni
  ausente."`. Efectos: § 1.2.
- `MoveAppointmentDto`: `date`, `startMin`, `resourceId?`. § 1.4 "Mover". Turno final (atendido,
  ausente, cancelado) → `400 "Ese turno ya está cerrado: no se puede mover."`.
- `RegisterDepositDto`: `method` ∈ {CASH, TRANSFER, DEBIT_CARD, CREDIT_CARD, QR}, `amount?`
  (defecto `depositAmount`; 0 < amount ≤ total), `kind?` ∈ {DEPOSIT, BALANCE, FULL} (defecto
  DEPOSIT), `reference?` (≤120). Crea `AppointmentPayment` `APPROVED` con `paidAt = now`,
  `registeredByMemberId`; con `kind = DEPOSIT` setea `depositPaidAt` / `depositMethod`. Seña ya
  registrada → `400 "La seña de este turno ya está registrada."`.
- `GET :id/message`: arma el texto de la plantilla para ese turno SIN enviarlo, con `waLink` para
  abrir el chat a mano (`https://wa.me/54<phone>?text=…`). Es la acción manual mientras no haya
  proveedor de WhatsApp. Incluye el `{link}` personal del turno: por eso exige
  `appointments.clients.contact` (quien ve el enlace puede actuar como el cliente).
- `POST :id/messages`: despacha la plantilla ahora por los canales activos (§ 1.6) con un
  `dedupeKey` que incluye el instante (reenvío manual explícito). Throttle `30/h`.

### P1.5 Agenda y resumen

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/agenda/day` | `appointments.agenda.view` | `?date` | `AgendaDiaDto` |
| `GET appointments/agenda/range` | `appointments.agenda.view` | `?from&to` (≤ 42 días: la grilla del mes) | `AgendaRangoDto` |
| `GET appointments/summary` | `appointments.agenda.view` | `?date` (defecto hoy) | `ResumenDelDiaDto` |

- Día: una columna por agenda reservable, con sus tramos (`tramosDelRecurso`) y sus turnos
  (incluye cancelados: la demo los muestra tachados). Sin `view_all`: solo las propias.
- Rango: semana (7 días) y mes (hasta 42). Los turnos van por día; los cancelados NO se cuentan
  en el mes pero sí viajan (el front decide).
- Resumen: `kpis` del día; `occupancyPercent` = minutos de turnos no cancelados / minutos que
  atienden las agendas ese día (el corte del mediodía no cuenta); `expectedRevenue` = suma de
  `total` de los no cancelados; `collectedRevenue` = pagos `APPROVED` del día; `gaps` = por agenda,
  `horariosLibres` en `modo: 'panel'` con duración = `slotMin` (los huecos para ofrecer);
  `inProgress` / `upcoming` (los próximos 8). Con rol sin `reports.view`, los dos montos en `null`.

**Notificaciones al panel** (campanita): al crear una reserva desde el sitio, al cancelar o
reprogramar el cliente, y por cada turno `PENDING` que espera confirmación. Reutilizar
`NotificationsService` con eventos nuevos (`turno_nuevo`, `turno_cancelado`, `turno_reprogramado`)
sumados a `notification-events.ts`.

---

## P2 — Público

Controllers: `storefront-appointments` (`@Controller('storefront/:slug/appointments')`),
`me-appointments` (`@Controller('me/appointments')`), `appointments-webhooks`
(`@Controller('webhooks/mercadopago')`). El módulo importa `StorefrontModule`, `BusinessesModule`,
`MercadopagoModule`.

### P2.1 Sitio

| Método y ruta | Auth · Throttle | Entrada | Respuesta |
|---|---|---|---|
| `GET storefront/:slug/appointments/site` | `@Public` · 120/min | — | `SitioTurnosDto` |
| `GET storefront/:slug/appointments/services` | `@Public` · 120/min | — | `ServicioPublicoDto[]` |
| `GET storefront/:slug/appointments/resources` | `@Public` · 120/min | `?serviceId?` | `RecursoPublicoDto[]` |
| `GET storefront/:slug/appointments/availability` | `@Public` · 60/min | `?serviceId&date&resourceId?` | `DisponibilidadDiaDto` |
| `GET storefront/:slug/appointments/availability/range` | `@Public` · 30/min | `?serviceId&from&to&resourceId?` | `DisponibilidadRangoDto` |

- `site` responde también con el sitio pausado o sin publicar (trae `isActive` / `isPaused` para
  que el front muestre "no disponible"), igual que `StorefrontService.getConfig`. El resto exige
  sitio abierto (`404`).
- `services`: `isActive`, `bookableOnline`, no borrados. Sin campos internos.
- `resources`: agendas `isBookable` activas. Si `letChooseResource` es `false`, devuelve `[]` (el
  cliente no elige: se asigna). Nunca expone `memberId`, mail, teléfono ni forma de pago.
- `availability`: motor en `modo: 'publico'`. `resourceId` ausente o `"cualquiera"` = `CUALQUIERA`
  (si `offerAnyResource` es `false` y `letChooseResource` es `true`, `resourceId` es obligatorio:
  `400 "Elegí con quién querés atenderte."`). Con `letChooseResource: false` se ignora el
  `resourceId` que llegue. Cada slot trae `price` con el ajuste de precios por horario (si la
  función está prendida y hay add-on). `reason: 'vacaciones'` suma `message` = `vacationMessage`.
  `resourceId` va en la respuesta solo si el cliente eligió una agenda; con "cualquiera" se omite
  el nombre (el front muestra "te asignamos al confirmar").
- `range`: máximo 62 días (`MAX_DIAS_RANGO`). No pasa de `hoy + maxAdvanceDays`.

Las lecturas de turnos para armar el contexto del motor traen SOLO `resourceId`, `startsAt`,
`endsAt` (`select`): ningún dato de otro cliente sale de la base hacia estos endpoints.

### P2.2 Reservar

`POST storefront/:slug/appointments/bookings` · `@OptionalAuth` · 10/min y 40/h por IP ·
`CreateBookingDto` → `201 ReservaCreadaDto`

`CreateBookingDto`: `serviceId`, `resourceId?` (uuid | `"cualquiera"`), `date`, `startMin`,
`name` (3–120), `phone` (10 dígitos tras normalizar), `email?` (`@IsEmail`, ≤254), `note?` (≤500),
`modality?` (defecto la única del negocio; tiene que estar en `settings.modalities`), `address?`
(obligatoria con `HOME`: ≥5 caracteres y al menos un dígito), `dni?` (7–8 dígitos; obligatorio si
`askDni`), `insuranceName?` (≤120; obligatorio si `askInsurance`), `insuranceNumber?` (≤60),
`reason?` (≤500; solo se guarda si `askReason`), `wantsReminder?` (defecto true), `pay?`
(`deposit` | `total`, solo con `onlineCharge = customer_choice`), `createAccount?: { password }`
(8–72; solo si `accountEnabled` y hay `email`), `giftCardCode?`, `packagePurchaseId?`,
`couponCode?`, `recurring?: { frequency, occurrences }` (P4; sin add-on se ignoran).

Reglas, en orden:

1. Sitio abierto; el negocio no es la demo (`DemoGuard` ya corta escrituras públicas sobre `isDemo`).
2. Cliente: con JWT de cliente de ESTE negocio → ese `customerId` (nombre/teléfono del DTO siguen
   siendo el snapshot). Sin sesión → buscar o crear la ficha (§ 0 Cliente). Con `createAccount` →
   crear la cuenta con `AuthService.register` (mismo flujo que el guest checkout; si el email ya
   tiene cuenta: `400 "Ya hay una cuenta con ese email. Iniciá sesión para sumar este turno."`) y
   devolver además `session` (el mismo objeto que el registro de cliente) para que el front quede logueado.
3. Límite de turnos activos: con `maxActivePerCustomer > 0`, contar turnos `PENDING`/`CONFIRMED`
   futuros del negocio con ese `customerPhone` (o `customerId`); si ya llegó →
   `400 "Ya tenés <N> turnos reservados. Cuando uses o canceles alguno vas a poder sacar otro."`.
4. § 1.1 con `modo: 'publico'`, `origin = STOREFRONT`. § 1.3 para precio, descuento y seña.
5. Si hay cobro online y MP está conectado: crear `AppointmentPayment` `PENDING` (`kind` DEPOSIT o
   FULL, `method` MERCADOPAGO) y la preferencia (§ P2.5). El turno nace `PENDING`. Respuesta con
   `payment.initPoint`.
6. Mensaje `confirmacion` (si el turno quedó `CONFIRMED`; con seña online pendiente sale cuando
   se aprueba el pago) con el enlace personal. Notificación al panel.

Errores: `400` validación (`"Faltan dígitos: son 10 con el código de área."`, `"Escribí la
dirección a la que tenemos que ir."`, …) · `400 "Ese horario no está disponible."` · `404` servicio
o agenda inexistente / no reservable online · `409 "Ese horario se acaba de ocupar. Elegí otro."`.

### P2.3 Mi turno, sin cuenta (por enlace personal)

Todo por `accessToken`. **404 ante cualquier mismatch** (token inexistente, de otro negocio que el
del slug, formato inválido): nunca se distingue "no existe" de "no es tuyo". El token va en la URL
porque ES el enlace que recibe la persona; el servidor no lo loguea (cuidar el logger de requests)
y las respuestas llevan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. Funcionan con
el negocio pausado (quien reservó tiene que poder ver y cancelar), no con el negocio borrado.

| Método y ruta | Auth · Throttle | Entrada | Respuesta |
|---|---|---|---|
| `GET storefront/:slug/appointments/mine/:token` | `@Public` · 30/min | — | `MiTurnoDto` |
| `POST storefront/:slug/appointments/mine` | `@Public` · 10/min | `{ tokens: string[] }` (1–20, cada uno 43–64 chars) | `{ token: string; booking: MiTurnoDto }[]` |
| `POST storefront/:slug/appointments/mine/:token/cancel` | `@Public` · 10/min | `{ reason?: string }` (≤300) | `MiTurnoDto` |
| `GET storefront/:slug/appointments/mine/:token/availability` | `@Public` · 30/min | `?date` o `?from&to` | `DisponibilidadDiaDto` / `DisponibilidadRangoDto` |
| `POST storefront/:slug/appointments/mine/:token/reschedule` | `@Public` · 10/min | `{ date, startMin }` | `MiTurnoDto` |
| `POST storefront/:slug/appointments/mine/:token/accept` | `@Public` · 10/min | — | `MiTurnoDto` (solo inscripciones en lista de espera con oferta vigente, § P3.1) |
| `POST storefront/:slug/appointments/mine/:token/pay` | `@Public` · 10/min | — | `{ paymentId, amount, initPoint }` |
| `POST storefront/:slug/appointments/mine/:token/sync-payment` | `@Public` · 20/min | — | `MiTurnoDto` |

- Un token puede ser de un turno o de una inscripción a una clase: se busca en `appointments` y,
  si no está, en `appointment_class_enrollments`, siempre con `businessId` en el `where`.
  `MiTurnoDto.kind` dice cuál es. `reschedule` y `availability` solo aplican a turnos (una clase se
  cancela y se anota a otra): con una inscripción → `400 "Una clase no se reprograma: cancelá y
  anotate a otra."`.
- `POST mine` (lista del dispositivo): devuelve SOLO los tokens que existen en ese negocio, sin
  decir cuáles fallaron (los que no, simplemente no vienen). Orden por `startsAt`. Sirve para que
  el sitio liste "los turnos reservados desde este dispositivo" con lo que guardó en
  `localStorage`. No acepta teléfono ni código.
- `MiTurnoDto` es chica a propósito: servicio, con quién/dónde, fecha y hora, estado, total, seña
  paga o pendiente, hasta cuándo se puede cancelar o cambiar, qué pasa con la seña y el texto de la
  política (`policy.changes` / `policy.late`: armar con la misma redacción de
  `demo/negocioDemo.ts → politicaTxt`). **No** trae sellos, beneficios, notas, datos del cliente
  ni el `accessToken`.
- `cancel`: § 1.4. Ya cancelado → idempotente, devuelve el turno. Atendido/ausente o ya empezó →
  `400 "Ese turno ya pasó: no se puede cancelar."`.
- `reschedule`: § 1.4. Errores: `400 "Este negocio no permite cambiar el horario desde acá.
  Escribiles."` · `400 "Ya cambiaste este turno <N> veces: es el máximo."` · `400 "Se puede cambiar
  hasta <N> h antes del turno."` · `409` horario ocupado. `availability` es la misma cuenta pública
  con `salvo = id del turno` y la agenda del turno (o `CUALQUIERA` si el negocio no deja elegir).
- `pay`: genera (o reutiliza, si no venció) la preferencia de MP para la seña pendiente del turno.
  Sin seña pendiente → `400 "Este turno no tiene nada para pagar."`. Sin MP conectado →
  `400 "Este negocio no cobra online. Coordiná el pago con ellos."`.
- `sync-payment`: al volver de MP, consulta el pago y aplica lo mismo que el webhook (por si no
  llegó). Patrón de `POST /mercadopago/orders/:orderId/sync-payment`.

### P2.4 Mis turnos, con cuenta

JWT de cliente existente (`assertCustomerContext`). Lista completa, sin tokens.

| Método y ruta | Entrada | Respuesta |
|---|---|---|
| `GET me/appointments` | — | `MiCuentaTurnosDto` |
| `POST me/appointments/:id/cancel` | `{ reason?, kind?: 'appointment' \| 'class' }` | `MiTurnoDto` |
| `GET me/appointments/:id/availability` | `?date` o `?from&to` | como en P2.3 |
| `POST me/appointments/:id/reschedule` | `{ date, startMin }` | `MiTurnoDto` |

Busca por `{ id, businessId, customerId }` (los tres del token): un id ajeno es `404`.
`MiCuentaTurnosDto` SÍ trae lo de la cuenta: tarjeta de sellos, descuento de bienvenida disponible,
crédito de señas, packs y membresía (los tres últimos vacíos sin add-on). `upcoming` =
`PENDING`/`CONFIRMED` futuros + inscripciones `ENROLLED`/`WAITLIST` futuras; `history` = el resto,
últimos 50. Los turnos reservados sin sesión con el mismo teléfono quedan vinculados a la ficha
(§ 0 Cliente) y aparecen acá.

### P2.5 Seña con Mercado Pago del negocio

- Preferencia: método nuevo `MercadopagoService.createAppointmentPreference(businessId, pago, ...)`
  calcado de `createOrderPreference` (token del negocio con `getValidAccessToken`; sin token →
  `null`, y quien llama degrada según § 1.3). `external_reference = "appt:<appointmentPaymentId>"`.
  `notification_url = <API>/api/v1/webhooks/mercadopago/appointments`. `back_urls` al sitio del
  negocio: `/mi-turno/<accessToken>?pago=ok|pendiente|error`. Vencimiento de la preferencia: 30 min.
- `POST webhooks/mercadopago/appointments` · `@Public` · responde 200 rápido. Misma validación de
  firma que `handlePaymentsWebhookRequest` (`MP_WEBHOOK_SECRET`, tolerancia de timestamp, filtro
  de `topic`): extraer esa validación a un helper compartido en vez de copiarla. Con el pago de MP:
  verificar que `external_reference` empiece con `appt:` y que el `AppointmentPayment` exista y sea
  de ese negocio (el del `user_id` de MP); idempotente por `mpPaymentId` (si ya está `APPROVED`, no
  hace nada). `approved` → pago `APPROVED`, `paidAt`, `mpFeeAmount`; turno: `depositPaidAt`,
  `depositMethod = MERCADOPAGO` y, si estaba `PENDING` por la seña y la confirmación es `auto`,
  `CONFIRMED` + mensaje `confirmacion`. `rejected` / `cancelled` → pago en ese estado; el turno
  sigue `PENDING`.
- Señas que nunca se pagan: un turno `PENDING` con pago online pendiente retiene el horario. Se
  libera a los 30 minutos (vencimiento de la preferencia): `cancelledBy = SYSTEM`,
  `cancelReason = "No se pagó la seña"`. Sin un cron frecuente se hace **perezoso**: antes de
  calcular disponibilidad (§ 1.1 b y los `GET availability`), cancelar los vencidos del negocio en
  esa misma transacción. Queda además en la corrida de las 22 h como red.
- Reembolso al cancelar a tiempo: `POST /v1/payments/:id/refunds` con el token del negocio, como
  hace `CancellationsService`. Falla → pago queda `APPROVED`, se notifica al negocio para que lo
  devuelva a mano y la cancelación sigue.

### P2.6 Mails y mensajes

`AppointmentMessagingService`, `WhatsappStubProvider` y los métodos nuevos de `MailService` (§ 1.6).
Plantillas de mail en `mail/templates/` con el mismo layout que las de pedidos: confirmación (con
el enlace personal, dirección o "vamos a tu domicilio", seña paga/pendiente, datos de
transferencia si corresponde), cancelación, reprogramación, recordatorio, lugar liberado. Sumar
fixtures a `mail-preview.fixtures.ts`. Recordatorio diario: § 1.7.

---

## P3 — Clases, clientes, equipo y ganancias

### P3.1 Clases con cupo (`agendaMode = CLASS`)

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/class-templates` | `appointments.agenda.view` | — | `PlantillaClaseDto[]` |
| `POST appointments/class-templates` | `appointments.services.manage` | `UpsertClassTemplateDto` | `PlantillaClaseDto` |
| `PUT appointments/class-templates/:id` | `appointments.services.manage` | `UpsertClassTemplateDto` | `PlantillaClaseDto` |
| `DELETE appointments/class-templates/:id` | `appointments.services.manage` | — | `{ ok: true }` |
| `GET appointments/classes` | `appointments.agenda.view` | `?from&to` (≤ 14 días) | `ClaseDelDiaDto[]` |
| `GET appointments/classes/:templateId/:date` | `appointments.agenda.view` | — | `ClaseDetalleDto` |
| `PUT appointments/classes/:templateId/:date` | `appointments.agenda.manage` | `{ capacity?: number \| null, cancelled?: boolean, cancelReason?: string }` | `ClaseDetalleDto` |
| `POST appointments/classes/:templateId/:date/enrollments` | `appointments.agenda.manage` | `EnrollDto` | `ClaseDetalleDto` |
| `DELETE appointments/class-enrollments/:id` | `appointments.agenda.manage` | — | `ClaseDetalleDto` |
| `PATCH appointments/class-enrollments/:id/attendance` | `appointments.agenda.manage` | `{ attended: boolean \| null }` | `AnotadoDto` |

Públicos (sitio abierto):

| Método y ruta | Auth · Throttle | Entrada | Respuesta |
|---|---|---|---|
| `GET storefront/:slug/appointments/classes` | `@Public` · 60/min | `?from&to` (≤ 14 días) | `ClaseDelDiaDto[]` |
| `POST storefront/:slug/appointments/classes/enroll` | `@OptionalAuth` · 10/min | `PublicEnrollDto` | `201 ReservaCreadaDto` |

- `UpsertClassTemplateDto`: `serviceId`, `weekday` (0–6), `startMin` (0–1439), `durationMin`
  (15–600), `instructorResourceId?` (PERSON), `roomResourceId?` (SPACE), `capacity` (1–500),
  `isActive?`. Reglas de la demo (`admin/Clases.tsx`): la clase tiene que caer dentro del horario
  del negocio de ese día (`400 "Ese día el negocio atiende <horario>. La clase tiene que entrar
  ahí."`) y no pisarse con otra de la misma sala (`400 "A esa hora la <sala> ya tiene <clase>."`)
  ni del mismo profe.
- Las clases de un rango se arman en memoria: plantillas activas × fechas, menos los días que el
  negocio no abre (`horarioDelNegocio`), más lo que diga la sesión materializada (`capacity`,
  `isCancelled`) y los conteos de inscripciones. Una sesión se **materializa** (upsert por
  `@@unique([templateId, date])`, con `startsAt`/`endsAt` copiados de la plantilla) recién al
  anotar a alguien o al tocar cupo/suspensión. `bookable` = no pasó, no está suspendida y
  `fecha <= hoy + classOpenDays`.
- Anotar (`EnrollDto` panel: `customerId` | `customer { name, phone?, email? }`; `PublicEnrollDto`:
  `templateId`, `date`, `name`, `phone`, `email?`, `note?`, `wantsReminder?`, `createAccount?`):
  en una transacción con lock por sesión (`pg_advisory_xact_lock(hashtext(sessionId))`), contar
  `ENROLLED`; si hay lugar → `ENROLLED`; si no y `waitlistEnabled` → `WAITLIST` con
  `waitlistPosition = max + 1` (sin seña); si no → `409 "La clase está completa."`. Ya anotado con
  ese teléfono → `400 "Ya estás anotado en esta clase."`. Precio y seña como § 1.3 con
  `servicio.price`. Genera `code` y `accessToken`. En el sitio, la reserva de una clase respeta
  `classOpenDays` (`400 "La reserva de esta clase se abre el <fecha>."`) y `maxActivePerCustomer`.
- Sacar / cancelar: `CANCELLED`. Si era `ENROLLED` y hay lista de espera: se le OFRECE el lugar al
  de `waitlistPosition` más baja (`offerExpiresAt = now + waitlistAcceptMin`, mensaje `espera` con
  su enlace personal); acepta desde "mi turno" (`POST mine/:token/accept` → pasa a `ENROLLED` si la
  oferta no venció y sigue habiendo lugar; `400 "El lugar ya se ocupó."` si no). Oferta vencida →
  pasa al siguiente; se evalúa perezosamente (al leer la clase o al próximo movimiento) y en el cron.
- Suspender una clase (`cancelled: true`): cancela las inscripciones (`cancelledBy = SYSTEM`),
  reembolsa señas, devuelve créditos de pack/membresía y manda `cancelacion`. La suspensión
  automática por `classMinEnrolled` "2 h antes" necesita un cron frecuente (ver Pendientes).
- Borrar una plantilla con inscripciones futuras → `400 "Hay <N> personas anotadas en clases que
  vienen. Suspendé esas clases primero."`.

### P3.2 Clientes

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/clients` | `appointments.clients.view` | `?q&filter=todos\|frecuentes\|nuevos&page&limit` | `Paginado<ClienteDto>` |
| `GET appointments/clients/:id` | `appointments.clients.view` | — | `ClienteFichaDto` |
| `POST appointments/clients` | `appointments.agenda.manage` | `CreateClientDto` | `ClienteDto` |
| `PUT appointments/clients/:id` | `appointments.agenda.manage` | `UpdateClientDto` | `ClienteFichaDto` |

- Sobre `customers` (los mismos de Tienda) + `appointment_customer_profiles`. No se usa
  `/customers` de Tienda: pide permisos `customers.*` y expone columnas que acá no van.
- Sin `clients.view_all`: solo quienes tienen algún turno en una agenda propia (la demo mira de 7
  días atrás a 14 adelante; acá, cualquier turno no cancelado). Cliente fuera de alcance → `404`.
- `q`: nombre (sin acentos, `contains` insensible) o parte del teléfono. `frecuentes` = 5 visitas o
  más; `nuevos` = 1 o ninguna. `visits` = turnos `COMPLETED` + clases con `attended: true`;
  `lastVisit` = el último; `spent` = suma de `total` de los `COMPLETED` (`null` sin `reports.view`).
  Calcular con `groupBy` sobre `appointments` filtrando por `businessId`, no cliente por cliente.
- `CreateClientDto`: `name` (3–120), `phone?` (≥8 dígitos si viene), `email?`, `note?` (≤1000),
  `insuranceName?`. Teléfono o email ya usados por otro cliente del negocio → `400 "Ya tenés un
  cliente con ese teléfono: <nombre>."`. `UpdateClientDto`: lo mismo + `insuranceNumber?`, `dni?`.
- Datos de salud (obra social, motivo): solo en la ficha y en el detalle del turno, nunca en
  listados ni en mensajes. Tratamiento como dato sensible (Ley 25.326): ver Pendientes.

### P3.3 Equipo y roles

Reutiliza `members` y `roles`. Lo propio de Turnos (la agenda y el pago) va en
`appointment_resources` con `kind = PERSON`.

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/team` | `appointments.agenda.view` | — | `PersonaDto[]` |
| `POST appointments/team/invite` | `appointments.team.manage` | `InvitePersonDto` | `{ person: PersonaDto; tempPassword?: string }` |
| `POST appointments/team` | `appointments.team.manage` | `UpsertPersonDto` | `PersonaDto` |
| `PUT appointments/team/:resourceId` | `appointments.team.manage` | `UpsertPersonDto` | `PersonaDto` |
| `PUT appointments/team/:resourceId/pay` | `appointments.earnings.settle` | `PayFormDto` | `PersonaDto` |
| `DELETE appointments/team/:resourceId` | `appointments.team.manage` | — | `{ ok: true }` |
| `GET appointments/roles` | `appointments.team.manage` | — | `RolTurnosDto[]` |
| `POST appointments/roles` | `appointments.team.manage` | `UpsertRoleDto` | `RolTurnosDto` |
| `PUT appointments/roles/:id` | `appointments.team.manage` | `UpsertRoleDto` | `RolTurnosDto` |
| `POST appointments/roles/:id/reset` | `appointments.team.manage` | — | `RolTurnosDto` |
| `DELETE appointments/roles/:id` | `appointments.team.manage` | — | `{ ok: true }` |

- `GET team` sin `view_all`: solo la propia ficha. `pay` va en `null` para quien no tiene
  `earnings.view_all` (salvo la propia con `earnings.view`). Email/teléfono según `clients.contact`
  NO aplica acá: son compañeros; se muestran con `team.manage`.
- `InvitePersonDto`: `name`, `email`, `roleId`. Llama a `MembersService.invite()` (mismo mail,
  misma contraseña temporal, mismo vencimiento) y crea el `AppointmentResource` PERSON con
  `memberId`, `isBookable = role.takesAppointments`, `roleLabel = role.name`, `workDays` = días
  que abre el negocio, pago inicial del rubro (`pagoInicialDe` de la demo: `PER_CLASS` 9000/mes en
  CLASS, `SALARY` 480000/mes en COURT, `COMMISSION` 50 %/semana en el resto). Todo en una
  transacción. OJO: `MembersController.invite` exige además `@Roles('owner','admin')`; este
  endpoint se abre con `appointments.team.manage` (el "Encargado/a" de fábrica lo tiene) y por eso
  llama al service, no al controller. Regla anti-escalada (como `members-escalation.e2e-spec`):
  nadie puede dar un rol con permisos que él mismo no tiene, ni tocar al dueño.
- `POST team` crea una persona SIN login (`memberId` null, `email`/`phone` propios).
- `UpsertPersonDto`: `name`, `roleId?` (cambia el rol del member vinculado), `email?`, `phone?`,
  `color?`, `photoUrl?`, `bio?` (≤400), `isBookable`, `workDays`, `ownSchedule?`,
  `assignedSpaceId?` (modo RESOURCE; tiene que ser un SPACE del negocio). Regla de la demo: no
  puede quedar el negocio sin nadie que atienda (`400 "Tiene que quedar al menos una persona que
  atienda."`) en modo PROFESSIONAL.
- `PayFormDto`: `payForm` ∈ las de `formasDe(rubro)` de la demo (COMMISSION, MIXED y RENT solo en
  PROFESSIONAL/RESOURCE; PER_CLASS solo en CLASS; SALARY siempre), `commissionPercent` 0–100,
  `salary`, `rent`, `perClass` ≥ 0, `payEvery`. El dueño no tiene forma de pago (`payForm` null):
  `400 "El dueño no se liquida: lo que factura queda para el negocio."`.
- `DELETE team`: soft-delete del recurso; si tiene `memberId`, además `MembersService.remove()`
  (que hoy exige `owner`: mantener esa regla → `403` para el resto). Con turnos futuros activos →
  `400` como en P1.3.
- Roles: sobre `roles` + `role_permissions`. `GET` devuelve los roles del negocio con
  `scopes = alcancesDe(permissions)`, `factoryKey = appointmentsRoleKey`, `changed` (comparando con
  `rolDeFabrica(rubro, key)`: nombre, descripción, `takesAppointments` y permisos). `UpsertRoleDto`:
  `name` (2–40), `description?` (≤200), `color?`, `takesAppointments`, `permissions: string[]`
  (solo códigos `appointments.*`; se pasan por `normalizarCodigos`). Nombres reservados y
  repetidos: las reglas de `RolesService`. El rol `owner` no se edita ni se borra. `reset` vuelve
  un rol de fábrica a `rolDeFabrica()`. Borrar un rol con gente → `400 "Hay <N> personas con este
  rol. Pasalas a otro antes de borrarlo."`.
- Los roles de fábrica del rubro los siembra el ALTA de un negocio de turnos (otra sesión), con
  `rolesDeFabrica(rubro)`.

### P3.4 Ganancias y liquidaciones

| Método y ruta | Permiso | Entrada | Respuesta |
|---|---|---|---|
| `GET appointments/earnings` | `appointments.earnings.view` | `?from&to` (≤ 366 días) | `GananciasDto` |
| `GET appointments/earnings/:resourceId` | `appointments.earnings.view` | `?from&to` | `GananciasPersonaDto` |
| `GET appointments/earnings/:resourceId/payouts` | `appointments.earnings.view` | `?page&limit` | `Paginado<PagoEquipoDto>` |
| `POST appointments/earnings/:resourceId/payouts` | `appointments.earnings.settle` | `RegisterPayoutDto` | `GananciasPersonaDto` |

Sin `earnings.view_all`: solo la propia (`totals: null`, `people` con un solo elemento; otra
persona → `404`). Los períodos de la demo (hoy, esta semana, este mes, mes pasado) los arma el
front con `from`/`to`.

**Liquidación** (`liquidarEntre` de `admin/equipoDemo.ts`, con fechas reales). Para una persona
`P` entre `from` y `to` (inclusive, días de Argentina):

```
turnos      = appointments COMPLETED con startsAt en el rango y
              resourceId IN (P.id, P.assignedSpaceId)            (cancelados y ausentes no suman)
precio(t)   = t.price - t.discountAmount
pct         = commissionPercent si payForm ∈ {COMMISSION, MIXED}; 100 si RENT; 0 si no
share(t)    = round(precio(t) * pct / 100)
billed      = Σ precio(t)
commission  = Σ share(t)                si payForm ∈ {COMMISSION, MIXED}; 0 si no
salary      = round(Σ_{día d del rango} P.salary / díasDelMes(d))   si payForm ∈ {SALARY, MIXED}
rent        = round(Σ_{día d del rango} P.rent   / díasDelMes(d))   si payForm = RENT
classes     = clases que dio: plantillas con instructorResourceId = P.id, por cada fecha del rango
              ≤ hoy en que la clase cae, el negocio abre, no está suspendida y ya terminó
perClass    = classes * P.perClass      si payForm = PER_CLASS; 0 si no
toPerson    = 0                         si payForm es null (dueño)
            = billed - rent             si RENT
            = commission + salary + perClass   en el resto
toBusiness  = billed - toPerson         (puede ser negativo: un sueldo sin turnos propios)
```

El sueldo y el alquiler son mensuales y se prorratean por día calendario: cada día del rango
aporta `monto / díasDelMes(ese día)` (un rango que cruza de un mes de 30 a uno de 31 usa el
divisor de cada día). Se suma sin redondear y se redondea al final. `rango vacío` (`to < from`) →
todo en cero.

`toPay` = `toPerson` si `payForm` ∉ {null, RENT}, si no 0. `toCollect` = `rent` si RENT, si no 0.
`paidUntil` = el `periodTo` más alto de sus `AppointmentStaffPayout`. `pending` = la liquidación
desde `paidUntil + 1 día` (o desde la fecha de alta del recurso si nunca se le pagó) hasta hoy.
`totals.toTeam` = Σ `toPay`; `totals.toBusiness` = facturado total − `toTeam` + Σ `toCollect`.

`RegisterPayoutDto`: `periodTo` (defecto hoy; > `paidUntil`, ≤ hoy), `amount?` (defecto lo que da
la liquidación pendiente hasta `periodTo`), `note?` (≤300). Crea el payout con `periodFrom =
paidUntil + 1`, `direction` = `PERSON_TO_BUSINESS` si RENT, si no `BUSINESS_TO_PERSON`, `breakdown`
= snapshot de la `LiquidacionTurnos`, `registeredByMemberId`. Errores: `400 "Ya está pagado hasta
el <fecha>."` · `400 "No hay nada pendiente para liquidar."` · `400` al dueño.

---

## P4 — Avanzado (`@RequiresAddon('ADVANCED')`)

Cada función tiene un interruptor en `settings.advanced[funcion].on`. El add-on habilita la
pantalla; el interruptor, que la función actúe. Los endpoints de escritura del panel piden además
`appointments.settings.manage`; las lecturas, solo el add-on.

| Método y ruta | Entrada | Respuesta |
|---|---|---|
| `GET appointments/advanced` | — | `{ hasAdvanced: boolean; functions: AvanzadoTurnos; recommended: FuncionAvanzada[] }` |
| `PUT appointments/advanced/:funcion` | `{ on: boolean; config?: object }` | `AvanzadoTurnos` |

`GET` NO lleva `@RequiresAddon` (el hub se muestra igual, con el candado). `config` se valida con
un DTO por función (`ConfigAvanzado`). `recommended` sale del rubro (`recomendada` de
`admin/avanzado/datosAvanzado.ts`).

### P4.1 Paquetes y bonos (`paquetes`)

`GET|POST appointments/packages`, `PUT|DELETE appointments/packages/:id` → `PaqueteDto`.
`GET appointments/package-purchases?customerId?&active=true` → `Paginado<PackCompradoDto>`.
`POST appointments/package-purchases` `{ packageId, customerId | customer, method }` (venta en el
local: crea la compra paga + `AppointmentPayment` `PACKAGE` `APPROVED`; pide además `cash.charge`).
Público: `GET storefront/:slug/appointments/packages` → `PaqueteDto[]` (sin `sold`);
`POST storefront/:slug/appointments/packages/:id/buy` `{ name, phone, email? }` → `{ purchaseId,
payment }` (preferencia de MP; `paidAt` lo pone el webhook; sin MP conectado → `400`).

DTO: `serviceId`, `sessions` (2–100), `price` (>0), `validDays` (0–730), `isActive`. Uso: al
reservar con `packagePurchaseId` el pack tiene que ser de ese cliente (por `customerId` de la
sesión, o por un token de compra en el front sin cuenta: fuera de alcance por ahora → solo con
cuenta), del mismo servicio, pago, no vencido y con sesiones libres (`sessionsUsed` + turnos
activos que lo usan < `sessionsTotal`). `sessionsUsed` sube al marcar `COMPLETED` (y con `NO_SHOW`:
la sesión se pierde). Cancelar a tiempo la libera.

### P4.2 Membresías y abonos (`membresias`)

`GET|POST appointments/membership-plans`, `PUT|DELETE .../:id` → `PlanMembresiaDto`.
`GET appointments/memberships?status?` → `Paginado<MembresiaDto>`;
`POST appointments/memberships` `{ planId, customerId | customer, method }`;
`POST appointments/memberships/:id/pause` `{ until }` (≤ `diasPausa`); `/resume`; `/cancel`;
`POST appointments/memberships/:id/payments` `{ method }` (registrar la cuota a mano: `cash.charge`).
Público: `GET storefront/:slug/appointments/membership-plans`.

DTO plan: `name` (2–80), `perWeek` (0–14; 0 = libre), `price` (>0), `isFeatured`. Regla: una
membresía `ACTIVE` cubre el precio de la clase (aPagar = 0) hasta `perWeek` clases por semana
(lunes a domingo); la siguiente se paga suelta. La "renovación automática" con débito (preapproval
de MP del negocio) NO está en este paquete: hoy la cuota se registra a mano y `nextChargeAt` sirve
para avisar el vencimiento (`PAST_DUE` si pasó sin pago). Ver Pendientes.

### P4.3 Gift cards (`gift-cards`)

`GET appointments/gift-cards?q&status` → `Paginado<GiftCardDto>`; `POST appointments/gift-cards`
(emitir en el local) ; `POST appointments/gift-cards/:id/void`.
Público: `POST storefront/:slug/appointments/gift-cards` (comprar: `{ kind, amount? | serviceId?,
style, recipientName?, senderName?, message?, buyerName, buyerPhone, buyerEmail }` → preferencia
MP) · `GET storefront/:slug/appointments/gift-cards/:code` (throttle 10/min; → `{ kind, balance,
serviceName, expiresAt }` o `404`).

`code`: 10 caracteres del alfabeto de § 1.5, único por negocio. `amount` dentro de
`config.montos` o libre si `montoLibre` (1.000–10.000.000). `expiresAt` = compra +
`mesesValidez`. Canje al reservar (`giftCardCode`): paga, no vencida, no anulada; `AMOUNT`
descuenta `min(balance, aPagar)` en la transacción del turno (`balance` con `updateMany` y
`where: { balance: { gte: x } }` para que dos reservas no gasten lo mismo); `SERVICE` exige el
mismo servicio y marca `redeemedAt`. Cancelar a tiempo devuelve el saldo.

### P4.4 Precios por horario (`precios-horario`)

`GET|POST appointments/price-rules`, `PUT|DELETE .../:id` → `ReglaPrecioDto`.
DTO: `weekdays` (0–6, ≥1), `fromMin` < `toMin` (0–1440), `adjustPercent` (−90..100, ≠ 0),
`isActive`. Aplicación: § 1.3. Se ve en `HorarioLibreDto.price` / `adjustPercent`.

### P4.5 Programa de fidelidad (`fidelidad`)

`GET appointments/loyalty?page&limit` → `Paginado<{ customerId, customerName, stamps, needed,
rewardsAvailable, lastStampAt }>`; `POST appointments/loyalty/:customerId/redeem` (canjear un
premio: `rewardsRedeemed + 1`; `400 "No tiene premios para canjear."`).

Fuente de la tarjeta: si `advanced.fidelidad.on` (y add-on), manda su `config` (sellos, premio,
desde qué monto suma, vencimiento); si no, la básica de la cuenta (`account.loyaltyStamps`, premio
a convenir, sin vencimiento). Un sello por turno `COMPLETED` de un cliente CON cuenta
(`customerId` con `passwordHash` o `googleId`); al llegar a `needed`: `stamps = 0`,
`rewardsEarned + 1`.

### P4.6 Turno fijo (`turno-fijo`)

`GET appointments/recurring` → `TurnoFijoDto[]`; `POST appointments/recurring` `{ customerId |
customer, resourceId, serviceId, frequency, startDate, startMin, occurrences }`;
`POST appointments/recurring/:id/end`. Público: `recurring` en `CreateBookingDto`.

Crea la serie y sus turnos (los próximos `min(occurrences, config.maximo)`, cada 7, 14 días o
mismo día del mes) con § 1.1 uno por uno en la MISMA transacción; los que no entran (ocupado,
feriado con `saltearFeriados`) se saltean y se informan en la respuesta (`skipped: Fecha[]`).
Cada turno es una fila normal con `recurringSeriesId`. `end` cancela los futuros. `frequency`
tiene que estar en `config.frecuencias` y el servicio en `config.serviceIds`.

### P4.7 Recuperar clientes (`recuperar`)

`GET appointments/winback` → `CampaniaRecuperarDto | null`; `PUT appointments/winback`
`{ inactiveDays ∈ {30,45,60,90,120}, message (≤600), couponEnabled, couponPercent (5–50),
couponValidDays (7–60), mode, isActive }`; `GET appointments/winback/audience?inactiveDays` →
`{ count, sample: { name, lastVisit, visits }[] }`; `POST appointments/winback/send` (throttle 3/día).

Audiencia: clientes con alguna visita cuyo último turno `COMPLETED` fue hace `inactiveDays` o más,
sin turnos futuros, con `acceptsPromos` y sin `AppointmentWinbackSend` de esa campaña. Envío por
§ 1.6 (plantilla `extranamos`), una fila en `appointment_winback_sends` por cliente con su
`couponCode` (8 caracteres) y `couponExpiresAt`. El cupón se canjea en `CreateBookingDto.couponCode`
(marca `couponUsedAt`). `mode = auto`: lo corre el cron de las 22 h.

### P4.8 Lista de espera de turnos

No es una función con interruptor de Avanzado: depende de `rules.waitlistEnabled`. Va en este
paquete por tamaño.

`GET appointments/waitlist?date?&status?` → `EsperaDto[]` (`agenda.view`);
`POST appointments/waitlist/:id/offer` `{ date, startMin, resourceId }` (`agenda.manage`);
`DELETE appointments/waitlist/:id`. Público: `POST storefront/:slug/appointments/waitlist`
`{ serviceId, resourceId?, date, fromMin?, toMin?, name, phone, email? }` (throttle 5/min; solo si
ese día no tiene horarios libres para ese pedido: `400 "Ese día todavía tiene horarios."`);
`POST storefront/:slug/appointments/waitlist/accept` `{ offer: string }`.

Al liberarse un horario (cancelación), ofrecer al primero en `WAITING` cuyo pedido lo contenga:
`OFFERED`, `offerExpiresAt = now + waitlistAcceptMin`, mensaje `espera` con un enlace que lleva
un token FIRMADO de la oferta (JWT HS256 con `JWT_SECRET`, `aud: 'appointments-waitlist'`,
`sub: <entryId>`, `exp = offerExpiresAt`; no hay columna para esto). `accept` valida el token,
crea el turno con § 1.1 (`409` si se ocupó) y marca `ACCEPTED` + `appointmentId`. Vencida →
`EXPIRED` y pasa al siguiente (perezoso + cron).

### P4.9 Plantillas del sitio (`plantillas`)

Sin endpoints propios: es la galería del front. El gate está en `PUT appointments/settings/site`
(§ P1.1).

---

## Pendientes de producto (decisiones que no son de código)

1. **Recordatorios con hora exacta.** El cron es uno solo, a las 22 h. "48 h / 12 h antes", el
   "último aviso" 2 h antes, la suspensión de clases 2 h antes y el vencimiento de ofertas de lista
   de espera piden un job de Cloud Scheduler cada 15–30 minutos (sería el cuarto). Mientras tanto:
   un recordatorio la noche anterior y vencimientos evaluados al vuelo.
2. **WhatsApp real.** Hoy STUB: los mensajes "por WhatsApp" se registran como `SIMULATED` y no
   salen. La demo promete confirmación y recordatorio por WhatsApp; hasta tener proveedor, el único
   canal automático real es el mail, que es OPCIONAL en la reserva. Quien reserva sin email no
   recibe nada automático: el enlace personal se le muestra en pantalla y el negocio puede
   mandárselo a mano (`GET appointments/:id/message`).
3. **Dos tarjetas de sellos.** "Cuenta y beneficios" (Reglas de reserva: sellos 5/6/8/10) y
   "Programa de fidelidad" (Avanzado: sellos, premio, vencimiento) configuran lo mismo. Acá manda
   Avanzado si está prendido. Conviene que la pantalla básica lo diga, o unificarlas.
4. **Débito automático de membresías.** La demo dice "renovación automática"; implica preapproval
   de Mercado Pago del negocio (hoy solo existe el de la suscripción a Órbita).
5. **Datos de salud.** Obra social, DNI y motivo de consulta son datos sensibles (Ley 25.326 /
   26.529). Se guardan en claro, visibles para todo el que vea la ficha. Falta decidir retención,
   quién los ve y el texto de consentimiento.
6. **Baja del negocio.** La purga conserva los turnos y sus pagos con el snapshot (nombre,
   teléfono, DNI), como los pedidos, y el nombre de cada agenda (persona del equipo). Confirmar si
   un turno es "comprobante" en el mismo sentido que un pedido o si corresponde borrar más.
7. **Quién invita.** En Tienda invitar gente exige ser owner/admin. En Turnos el "Encargado/a" de
   fábrica puede (`appointments.team.manage`). Confirmar.
8. **"Cuándo te acredita Mercado Pago"** (pestaña Pagos de la demo) no se guarda: es un dato de la
   cuenta de MP del negocio, no una configuración de Órbita.
9. **Formularios y consentimientos** (`preguntasDe`, `consentimientoDe` en `datosAvanzado.ts`) no
   están en el catálogo de funciones de la demo ni en el esquema.
