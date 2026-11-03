# Reservas: el backend compartido de Turnos, Alquileres y Gimnasio

Un solo motor de reservas para los tres módulos (pedido de Ale, 03/11/2026: *"uno profesional
de lo que es los 3 y que compartan, cubriendo toda la integridad de turnos: si dos tocan el
botón al mismo tiempo, si se cancela, si no completa"*). Cada módulo tiene su panel y su sitio
en `apps/web/src/modules/<modulo>/`; acá vive lo que los tres resuelven igual y donde no puede
haber tres versiones: **qué se reserva, cuándo, con qué cupo, en qué estado está y las reglas
que lo mantienen íntegro**.

El backend de Turnos que existía antes (`appointments`, cinco ramas `feat/turnos-real*`) se borró
el 26/10 y no se reemplaza: este módulo lo cubre para los tres.

| Qué | Dónde |
|---|---|
| Modelos y tablas | `prisma/schema.prisma`, bloque "Reservas" (tablas `reservas_*`) |
| Migración (tablas, restricción de exclusión, RLS, permisos) | `prisma/migrations/20261103120000_reservas/` |
| Reglas puras (tiempo, horario, estados, precio, franjas) | `src/reservas/dominio/` (con sus `*.spec.ts`) |
| Reglas del negocio, recursos, servicios y bloqueos | `reservas-catalogo.service.ts` |
| Qué se puede reservar y cuándo | `disponibilidad.service.ts` |
| El motor: crear, confirmar, cancelar, reprogramar, cobrar, lista de espera | `reservas.service.ts` |
| Avisos por email | `reservas-avisos.service.ts` |
| Barrido de retenidas vencidas (Cloud Scheduler) | `reservas-mantenimiento.service.ts` |
| Rutas del panel | `reservas-panel.controller.ts` (`/api/v1/reservas/...`) |
| Rutas del sitio público | `reservas-publico.controller.ts` (`/api/v1/storefront/:slug/reservas/...`) |
| Lo que devuelve cada ruta | `reservas.types.ts` (copiado en `apps/web/src/lib/reservasApi/tipos.ts`) |
| Tests | `src/reservas/dominio/*.spec.ts`, `test/unit/reservas.service.unit-spec.ts`, `test/reservas.e2e-spec.ts` |

## El modelo, en una pantalla

- **`ReservaConfig`** (una por negocio y módulo): existe = el negocio usa ese módulo. Reglas:
  confirmación automática o manual, minutos de retención, anticipación mínima y máxima, hasta
  cuántas horas antes se cancela o reprograma, seña (porcentaje y si se devuelve), tope de
  reservas activas por persona, lista de espera, margen entre reservas y el **horario semanal**
  por defecto (`{ "1": [[540, 1080]], … }`, 0 = domingo, minutos de Argentina).
- **`ReservaRecurso`**: lo que se reserva. `tipo` dice de qué módulo es: `PROFESIONAL` y
  `ESPACIO` (Turnos), `CANCHA`, `SALON` y `ALOJAMIENTO` (Alquileres), `CLASE` (Gimnasio). Tiene
  `cupo` (1 = exclusivo; solo una clase puede tener más), duración y paso de la franja, margen,
  cuántas franjas seguidas se pueden tomar, precio, horario propio (en una clase, cada tramo es
  una sesión) y `datos` libres por módulo (check-in/check-out y noches mínimas de un
  alojamiento, `extras: [{ id, nombre, precio }]`, profesor, superficie…).
- **`ReservaServicio`**: lo que se elige antes en Turnos (corte, consulta), con duración y
  precio; opcionalmente limitado a algunos recursos. Alquileres y Gimnasio pueden no tener.
- **`Reserva`**: un recurso, un rango `[inicio, fin)` (instantes UTC; `fecha` es el día de
  Argentina), `cantidad` de lugares, estado, la foto del cliente y del servicio, precio, seña,
  pagado, `codigo` visible (6 letras), `tokenAcceso` (el secreto del enlace personal),
  `claveIdempotencia`, `version`.
- **`ReservaHistorial`**: cada cambio de estado con quién y por qué (solo se agrega).
- **`ReservaEspera`**: lista de espera por sesión. **`ReservaBloqueo`**: rangos en que no se
  reserva (feriado, mantenimiento), de un recurso o de todos.

### Estados

```
RETENIDA ──(confirmar)──▶ CONFIRMADA ──▶ COMPLETADA | AUSENTE
   │  └──(confirmación manual)──▶ PENDIENTE ──▶ CONFIRMADA
   └──(vence)──▶ VENCIDA              cualquiera de los que ocupan ──▶ CANCELADA
```

Ocupan lugar: `RETENIDA`, `PENDIENTE`, `CONFIRMADA`. La tabla está en `dominio/estados.ts` y la
mira la restricción de exclusión de la base.

## La integridad: qué pasa si…

| Situación | Qué lo cubre |
|---|---|
| **Dos tocan el botón a la vez** por el mismo lugar | Crear y reprogramar corren en una transacción que primero toma el candado de la fila del recurso (`SELECT … FOR UPDATE`): entran de a uno, el segundo cuenta cuando el primero ya escribió y recibe **409** "Ese horario se acaba de ocupar". Debajo, para los recursos exclusivos (cupo 1), la base tiene `reservas_sin_solapamiento` (`EXCLUDE USING gist` sobre `recurso_id` y `[inicio, fin)` para las filas que ocupan lugar): aunque algún camino se saltee el service, el `INSERT` falla (`23P01` → 409). Probado con seis pedidos simultáneos y con ocho personas por tres lugares de una clase (`test/reservas.e2e-spec.ts`). |
| **Doble clic / reintento** del mismo pedido | `claveIdempotencia` (un uuid por intento que manda el cliente): repetir devuelve la misma reserva. |
| **No completa** (eligió horario y cerró la pestaña) | Nace `RETENIDA` con `retenidaHasta` = ahora + `retencionMinutos`. Vencida, deja de ocupar lugar en el acto: la disponibilidad la filtra y el motor la vence (por recurso, con candado) antes de contar. El cron de cada 5 minutos la marca `VENCIDA` y deja el historial prolijo; nada depende de él. |
| **Se cancela** | Compare-and-set sobre el estado (y la `version` si viene): la segunda de dos acciones simultáneas recibe 409 con el estado real. Desde el sitio vale la política (`cancelacionHastaHoras`); el negocio cancela siempre. La seña paga queda `DEVUELTA`, `PERDIDA` o `SIN_SENA` en el historial y en el aviso. Si hay lista de espera para ese horario, **el primero toma el lugar en la misma transacción** (con el recurso tomado: nadie se mete en el medio). |
| Confirmar, completar, marcar ausente, cobrar | Mismo compare-and-set; completar o marcar ausente solo después del inicio; el pago nunca pasa del total. Repetir una acción ya hecha no rompe nada (idempotente). |
| Reservar fuera de horario, en un bloqueo, demasiado pronto o lejos, en una sesión que no existe | 400 con el motivo en castellano. El panel puede saltearse la apertura (`fueraDeHorario`, un turno excepcional), nunca el cupo ni los bloqueos. |
| Precio y seña | Se calculan **siempre en el servidor** a partir del servicio o del recurso y de sus extras; lo que mande el cliente se ignora. Un precio a mano desde el panel exige `reservas.config`. |
| Otro negocio | Todo filtra por `businessId` del token (lo vigila `aislamiento-consultas.unit-spec.ts`); el sitio resuelve el negocio por el `:slug` y nunca busca reservas por código ni por teléfono: solo por el token del enlace personal. |

## Rutas

### Sitio público (`/api/v1/storefront/:slug/reservas`, sin login; con sesión de cliente queda vinculada)

| Método y ruta | Qué hace |
|---|---|
| `GET config?modulo=` | Reglas públicas (confirmación, retención, anticipación, cancelación, seña, horario) |
| `GET recursos?modulo=` · `GET servicios?modulo=` | Qué se puede reservar |
| `GET disponibilidad?modulo&recursoId&fecha[&servicioId][&duracionMinutos]` | Franjas del día con `libres` y `cupo` (`seguidas` en canchas) |
| `GET disponibilidad/rango?modulo&recursoId&desde&hasta` | Por día, cuántas franjas con lugar (para pintar el calendario) |
| `GET disponibilidad/noches?modulo&recursoId&desde&hasta` | Alojamientos: noches ocupadas, mínimo, check-in y check-out |
| `POST retener` | Paso 1: toma el lugar (`RETENIDA`). Body: `modulo, recursoId, fecha, inicioMinutos, clave` (+ `servicioId`, `duracionMinutos`, `fechaHasta`, `cantidad`, `extras`, `notas`). Devuelve la reserva con `token` y `retenidaHasta` |
| `POST mi/:token/confirmar` | Paso 2: `{ cliente: { nombre, telefono?, email? }, notas? }` → `CONFIRMADA` (o `PENDIENTE`) |
| `POST reservar` | En un paso: lo de retener + `cliente` |
| `GET mi/:token` | La reserva, su `politica` (qué puede hacer ahora y hasta cuándo), el recurso y el negocio |
| `POST mi/:token/cancelar` · `POST mi/:token/reprogramar` | Según la política del negocio |
| `POST espera` · `GET espera/:token` · `DELETE espera/:token` | Lista de espera de una sesión llena |

### Panel (`/api/v1/reservas`, token de miembro)

| Permiso | Rutas |
|---|---|
| `reservas.view` | `GET config`, `GET recursos`, `GET servicios`, `GET bloqueos`, `GET disponibilidad[/rango|/noches]`, `GET /` (agenda, por `desde`/`hasta`/`recursoId`/`estado`/`q`), `GET :id` (con historial), `GET resumen`, `GET espera` |
| `reservas.manage` | `POST /` (nace `CONFIRMADA` o `PENDIENTE`), `POST :id/confirmar|completar|ausente|cancelar|reprogramar|pago`, `PATCH :id/nota`, `DELETE espera/:id` |
| `reservas.config` | `PUT config`, `POST|PUT|DELETE recursos`, `POST|PUT|DELETE servicios`, `POST|DELETE bloqueos` (y el `precio` a mano al crear) |

Los roles de fábrica: `owner`/`admin` tienen los tres; `empleado` ve y gestiona, no configura
(migración `20261103120000_reservas` para los negocios existentes; `common/permisos/catalogo.ts`
y `onboarding.service.ts` para los nuevos).

Fechas: días `AAAA-MM-DD` y horas en minutos desde las 00:00, **siempre de Argentina**; la API
traduce a instantes y devuelve las dos cosas (`inicio` ISO y `fecha` + `inicioMinutos`).
Errores: `{ error, statusCode, message }` con el `message` listo para mostrar.

## Cómo lo usa cada módulo

El cliente tipado está en `apps/web/src/lib/reservasApi/` (`tipos.ts` copia `reservas.types.ts`;
`cliente.ts` envuelve las rutas). Los módulos siguen sin importarse entre sí: cada uno usa ese
cliente con su `modulo` y sus tipos de recurso.

- **Turnos (Mateo):** recursos `PROFESIONAL`/`ESPACIO` + `servicios` (duración y precio salen del
  servicio). El sitio: servicio → profesional → `disponibilidad` → `retener` → `confirmar`. El
  enlace personal es `<slug>.orbita.site/mi-turno/<token>`.
- **Alquileres (Alan):** `CANCHA` (franjas seguidas: `duracionMinutos` múltiplo de la duración,
  hasta `maximoSeguidos`), `SALON` (bloques: duración del recurso = el bloque, `margenMinutos` =
  limpieza) y `ALOJAMIENTO` (`fecha` + `fechaHasta`, noches desde `disponibilidad/noches`, check-in
  y check-out en `datos`). Extras en `datos.extras`. Enlace: `/mi-reserva/<token>`.
- **Gimnasio (Ale):** `CLASE` con `cupo` y el horario como sesiones; `cantidad` de lugares;
  `espera` cuando está llena; al cancelar, el primero toma el lugar. Enlace: `/mi-clase/<token>`.
  Planes, pases y socios siguen siendo del módulo (no son reservas).

Cada módulo tiene que servir en su sitio la ruta de "mi reserva" (`RUTA_MI_RESERVA` en
`reservas-avisos.service.ts`): es a donde llevan los emails.

## Qué no hace (todavía)

- No cobra: la seña y el pago se **registran** (`POST :id/pago`); el cobro online con Mercado Pago
  y la devolución automática quedan para después (hoy "DEVUELTA" es un aviso al negocio).
- No avisa por WhatsApp ni en la campanita del panel: solo email (`sendCustomEmail`, en STUB en
  local). Los recordatorios del día anterior tampoco: van colgados del cron de las 22 h cuando se
  hagan.
- No crea negocios de Turnos/Alquileres/Gimnasio: el alta real los muestra como "Próximamente".
  La config se crea desde el panel (`PUT config`).

## Cómo se prueba

```bash
cd apps/api
pnpm exec jest --config ./test/jest-src.json src/reservas/dominio          # reglas puras
pnpm exec jest --config ./test/jest-unit.json reservas.service             # el motor sin base
# contra la base de DEV (nunca producción): ver DEPLOYMENT.md § Correr los e2e contra dev
E2E_DATABASE_URL=… E2E_DIRECT_URL=… pnpm test:e2e -- reservas
```
