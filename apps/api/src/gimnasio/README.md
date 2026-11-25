# Gimnasio: planes, alumnos y pases

Lo que el módulo Gimnasio guarda y **no es una reserva**. Las clases, los lugares, el cupo y la
lista de espera son del motor compartido (`../reservas`, con `modulo=GIMNASIO`): este módulo lo
usa por sus servicios y solo decide **con qué se paga cada lugar**.

Decisión de Ale del 16/11/2026: tablas propias de Gimnasio, al lado del motor y sin tocarlo.

## Qué hay

| Tabla | Qué guarda |
|---|---|
| `gimnasio_planes` | Lo que el negocio vende: la clase de prueba, la clase suelta, un pack de N clases o una membresía (con tope semanal; 0 es libre). Precio, vigencia en días y si se ofrece en el sitio. Borrado blando. |
| `gimnasio_alumnos` | Un alumno del negocio: la ficha de cliente (`customers`) que el motor ya vincula a cada reserva por celular o email, más la nota y el día de alta. Uno por ficha. |
| `gimnasio_suscripciones` | El plan de un alumno: una fila por compra o renovación, con una foto del plan (si después cambia el precio del plan, lo vendido no cambia) y desde y hasta qué día vale. |

Migración `20261124130000_gimnasio_planes_alumnos` (aditiva). Sin permisos nuevos: usa
`reservas.view`, `reservas.manage` y `reservas.config`.

## Cómo se cuenta un pack (y por qué no hay tabla de movimientos)

Cada reserva dice con qué se pagó en su campo libre, que el motor guarda sin interpretar:

```json
{ "gimnasio": { "pago": "plan", "suscripcionId": "…", "planId": "…" } }
```

`pago` es `plan` (con el pack o la membresía del alumno), `aparte` (se cobra en el gimnasio como
clase suelta) o `prueba` (la clase de prueba). Sin `datos.gimnasio`, el lugar está **sin
definir**: es el de quien pasó de la lista de espera o reservó desde el sitio.

Las clases usadas de un plan **se cuentan de las reservas**: las que tienen ese `suscripcionId`
y están `PENDIENTE`, `CONFIRMADA`, `COMPLETADA` o `AUSENTE`. No hay un contador guardado, así que
no puede desfasarse de lo reservado:

- Si la reserva se cancela, la clase vuelve sola. El cliente solo puede cancelar dentro del plazo
  del negocio (después tiene que llamar), y si el negocio libera el lugar es que decidió
  devolvérsela.
- Quien falta sin avisar queda `AUSENTE`, y esa sí cuenta.
- Mover la reserva de día la sigue contando una sola vez (y, en una membresía, en su semana nueva).

Las cuentas (cuándo arranca un plan, cuántas clases quedan, el tope de la semana, con qué
suscripción se paga) están en `dominio/planes.ts`, puras y con su test.

## La integridad

| Situación | Qué lo cubre |
|---|---|
| **Dos pedidos a la vez con la última clase de un pack** | Anotar con plan, pasar un lugar al plan y asignar un plan toman primero el candado del alumno (`SELECT … FOR UPDATE` sobre su fila): entran de a uno, y el segundo ya ve la reserva del primero. Probado con cuatro pedidos simultáneos (`test/gimnasio.e2e-spec.ts`). |
| **Doble clic o reintento** | `clave` (un uuid por intento): repetir devuelve la misma reserva, sin descontar dos veces. |
| **La clase se llenó mientras tanto** | Lo decide el motor: 409 "No queda lugar en ese horario", y el plan no se toca (no hay reserva, no hay uso). |
| **Sin clases, plan vencido, tope de la semana** | 409 con el motivo ya escrito para mostrar, y no se reserva. El negocio puede anotarlo igual con `pago: "aparte"`. |
| **Cambiar el precio o las clases de un plan** | Lo ya vendido no cambia: la suscripción guarda su foto del plan. |
| **Renovar antes de que venza** | La misma membresía continúa: arranca al día siguiente de que termine la que tiene. Una membresía de otro plan reemplaza a la que tenía. Un pack convive con lo que haya, y se gasta primero el que vence antes. |
| **Otro negocio** | Todo filtra por el `businessId` del token; la ficha de cliente y el plan se buscan siempre con el negocio. |

## Rutas

### Panel (`/api/v1/gimnasio`, token de miembro)

| Permiso | Ruta | Qué hace |
|---|---|---|
| `reservas.view` | `GET planes` | Los planes, en su orden |
| `reservas.config` | `PUT planes` | La lista entera como queda (`{ planes: [...] }`): con `id` se cambia, sin `id` se crea, lo que no viene se quita. Todo o nada |
| `reservas.view` | `GET alumnos` | Cada alumno con sus planes vigentes (`planes`, del que vence primero al último), lo usado y lo que queda de cada uno, el último que tuvo si no le queda ninguno (`ultimo`) y si ya tomó la clase de prueba (`probo`) |
| `reservas.manage` | `POST alumnos` | Da de alta: `clienteId` (una ficha que ya existe) o `cliente` (nombre y un celular o un email), `nota` y `planId` opcionales. Si ya era alumno, devuelve el mismo |
| `reservas.manage` | `PATCH alumnos/:id` | La nota |
| `reservas.manage` | `POST alumnos/:id/plan` | Asigna o renueva (`{ planId }`): un pack o una membresía |
| `reservas.manage` | `DELETE alumnos/:id/planes/:suscripcionId` | Quita un plan asignado por error. Los lugares ya pagados con él siguen reservados |
| `reservas.manage` | `POST reservas` | Anota en una clase diciendo cómo se paga: `recursoId, fecha, inicioMinutos, clave, pago` y quién (`alumnoId`, `clienteId` o `cliente`), `cantidad` opcional. Devuelve `{ reserva, pago }`: `pago.plan` es el plan como quedó |
| `reservas.manage` | `POST reservas/:id/pago` | Dice o corrige cómo se paga un lugar ya reservado (`{ pago }`). Pasarlo al plan descuenta con las mismas reglas |

Lo demás de una clase (ver quién viene, liberar un lugar, presente y ausente, la lista de
espera, los días sin clases) son las rutas del motor.

### Sitio (`/api/v1/storefront/:slug/gimnasio`, sin login)

| Ruta | Qué hace |
|---|---|
| `GET planes` | Los planes que el negocio ofrece en el sitio |
| `GET grilla?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | Las sesiones de todas las clases entre esos días (hasta 35, los dos incluidos): `{ desde, hasta, dias: [{ fecha, cerrado, motivo, sesiones: [{ recursoId, inicioMinutos, finMinutos, libres, cupo }] }] }`. Con las reglas del sitio: no trae las clases que ya no se pueden reservar. `cerrado` y `motivo` son el día sin clases que cargó el negocio |

La grilla la arma el motor (`DisponibilidadService.sesionesEntre`) en un solo pedido: el sitio no
pregunta clase por clase. Qué es cada clase (actividad, profe, sala) lo dicen los recursos del
motor (`GET /storefront/:slug/reservas/recursos?modulo=GIMNASIO`), que el sitio cruza por
`recursoId`.

Reservar desde el sitio es el motor (`/storefront/:slug/reservas`): `retener` toma el lugar
mientras la persona carga sus datos, `mi/:token/confirmar` lo deja firme y, con la clase llena,
`espera` la anota en la lista. Esos lugares nacen sin definir: el plan se usa desde el panel (o,
más adelante, con la sesión del alumno). No se descuenta un pack con solo escribir el celular de
alguien.

## Tests

- `dominio/planes.spec.ts` (jest-src): las cuentas.
- `test/unit/gimnasio.unit-spec.ts`: lo que el servicio decide, sin base.
- `test/unit/reservas-sesiones.unit-spec.ts`: la grilla del sitio, sin base (qué arma con lo
  que lee, y que lo lee una vez).
- `test/gimnasio.e2e-spec.ts`: contra la base de dev (los filtros sobre `datos`, el candado del
  alumno, los permisos, y el camino del sitio: la grilla, retener, confirmar y la lista de
  espera). Se corre a mano, como los demás e2e (`DEPLOYMENT.md` § Correr los e2e contra dev).
