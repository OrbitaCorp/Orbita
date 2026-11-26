# Alquileres · Calendario de Airbnb sincronizado — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans`, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que las noches que un dueño tiene tomadas en Airbnb se bloqueen solas en Órbita, y que
las reservas de Órbita se bloqueen solas en Airbnb, usando el calendario `.ics` de cada aviso.

**Arquitectura:** todo vive en el motor compartido (`apps/api/src/reservas`). Órbita publica un
`.ics` por propiedad (exportar) y baja cada 30 minutos el `.ics` que el dueño pegó (importar); lo
importado entra como bloqueos con `origen = ICAL`, que el motor ya respeta al reservar. El panel de
Alquileres reemplaza la pantalla simulada "Calendarios (.ics)" por la real.

**Stack:** NestJS + Prisma (API), Next.js pages router + Vitest (web). Sin librerías nuevas: el
parser y el generador de `.ics` ya existen en `apps/web/src/lib/reservas/ics.ts` y se portan.

**Spec:** `docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md` § 7.1 (y § 6,
faltante F9). Este plan es la etapa 4 de `docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md`.

## Lo que este plan decide distinto de la spec (y por qué)

| Tema | Spec | Este plan | Motivo |
|---|---|---|---|
| Token en la URL que se exporta | `?t=<token>` guardado en `datos` del recurso | **Sin token** | El `.ics` muestra solo noches ocupadas, sin nombres: es lo mismo que ya publica `GET .../disponibilidad/noches`. Y `datos` del recurso sale en la API pública, así que el token no sería secreto. |
| El eco de vuelta | Descartar el evento que coincide con algo que Órbita exportó | Lo mismo, **también contra reservas canceladas**, y solo para los eventos "no disponible" | Verificado en foros de anfitriones (25/11): Airbnb reexporta como `Airbnb (Not available)` lo que importó y a veces **no lo libera** cuando el origen lo quita. Sin esto, cancelar una reserva en Órbita dejaría las noches bloqueadas para siempre. |
| De qué sitios se baja | No lo dice | **Solo Airbnb**, por lista fija de dominios | El servidor baja una URL que escribe un usuario: sin lista sería una puerta para pedirle cosas a la red interna. Alan pidió solo Airbnb. |

**El costo de la regla del eco, a sabiendas:** si el dueño cierra a mano en Airbnb exactamente las
mismas noches de una reserva que canceló en Órbita, ese cierre se toma por eco y no bloquea. Es raro
y se ve en el calendario; la alternativa (bloquear todo lo "no disponible") deja noches trabadas
cada vez que alguien cancela. Lo que Airbnb marca como **reservado** se bloquea siempre.

**Lo que no se pudo verificar sin un aviso real:** cómo titula Airbnb sus eventos hoy y cada cuánto
relee el calendario de Órbita (los foros dicen "cada pocas horas"). Por eso la tarea 10 incluye una
prueba con un aviso de verdad, que tiene que hacer Alan.

## Restricciones globales

- Solo alojamiento por noche (`ALOJAMIENTO`). Canchas y salones no cambian.
- Los eventos del `.ics` son de día entero: `DTSTART` es la entrada y `DTEND` la salida, **exclusiva**
  (la noche de la salida queda libre). Igual que una estadía en Órbita.
- Un bloqueo importado ocupa lo mismo que una estadía: de la hora de entrada del primer día a la de
  salida del último (`instante(desde, checkIn)` a `instante(hasta, checkOut)`), como `bloqueoParaApi`.
- **Nunca se borran bloqueos por un error:** si la descarga o el parseo fallan, quedan los de antes.
- **Ante la duda, se bloquea:** un evento que no se puede clasificar entra como bloqueo.
- Intervalo de sincronización: **30 minutos** por calendario; hasta **5 calendarios por corrida** del
  job de 5 minutos; **8 segundos** de espera y **1 MB** como máximo por descarga; hasta **500
  eventos** por archivo; hasta **3 calendarios** por propiedad.
- Mensajes al usuario en castellano rioplatense, listos para mostrar (como el resto del motor).
- Migraciones aditivas (tabla nueva, columnas opcionales o con default). Antes de aplicarla en
  producción se avisa a Mateo y a Ale: toca `reservas_bloqueos`, que usan los tres módulos.
- Máquina de Alan: `--maxWorkers=2` en jest y vitest, un comando pesado por vez.
- El `.env` local es dev. Producción solo con `apps/api/deploy/prisma-prod.sh`.

## Foco de revisión

Lo que la spec no dice y más probablemente le pase a un dueño:

1. **Cancela en Órbita una reserva que Airbnb ya había importado.** Esperado: las noches quedan
   libres en Órbita aunque Airbnb las siga publicando como "no disponible". → test en la tarea 4.
2. **Airbnb responde otra cosa que un calendario** (página de error en HTML, 403, redirección).
   Esperado: se guarda el motivo, se muestra, y los bloqueos anteriores no se tocan. → tarea 3 y 4.
3. **El dueño pega una URL que no es de Airbnb**, o `http`, o la de un aviso ajeno mal copiada.
   Esperado: se rechaza al guardar, con un mensaje que dice qué pegar. → tarea 3.
4. **Dos calendarios bloquean las mismas noches, o el mismo evento llega repetido.** Esperado: un
   solo bloqueo por evento y desconectar uno no saca lo del otro. → tarea 4.
5. **Borra la propiedad o desconecta el calendario mientras corre la sincronización.** Esperado:
   no quedan bloqueos huérfanos que ocupen noches de algo que ya no existe. → tarea 4 y 6.

---

## Archivos

| Archivo | Qué es |
|---|---|
| `apps/api/src/reservas/dominio/ics.ts` (+ `.spec.ts`) | Nuevo. Leer y generar `.ics`, clasificar eventos, regla del eco. Puro. |
| `apps/api/src/reservas/calendarios/descarga.ts` (+ `.spec.ts`) | Nuevo. Validar la URL y bajar el archivo con sus límites. |
| `apps/api/src/reservas/calendarios/reservas-calendarios.service.ts` | Nuevo. Conectar, desconectar, sincronizar, exportar, conflictos. |
| `apps/api/test/unit/reservas.calendarios.unit-spec.ts` | Nuevo. El service sin base. |
| `apps/api/prisma/schema.prisma` + `migrations/20261125120000_reservas_calendarios_externos/` | Tabla nueva y columnas en `reservas_bloqueos`. |
| `apps/api/src/reservas/dto/calendarios.dto.ts` | Nuevo. `ConectarCalendarioDto`. |
| `apps/api/src/reservas/reservas-panel.controller.ts`, `reservas-publico.controller.ts`, `reservas.module.ts`, `reservas.types.ts`, `reservas-catalogo.service.ts`, `README.md` | Rutas, DTO del bloqueo con `origen`, guardas. |
| `apps/api/src/internal-cron/internal-cron.controller.ts` | Un paso más en `instagram-cada-5-minutos`. |
| `apps/web/src/lib/reservasApi/{tipos,cliente}.ts` | El contrato nuevo. |
| `apps/web/src/modules/alquileres/datos/origen/{mapear,escribir,api}.ts` (+ tests) | Leer y escribir calendarios. |
| `apps/web/src/modules/alquileres/admin/configuracion/Calendarios.tsx`, `Bloqueos.tsx`, `admin/navegacion.ts`, `admin/Panel.tsx`, `datos/index.ts`, `datos/origen/index.ts` | La pantalla real y el aviso de conflicto. |

---

### Tarea 1: Leer, generar y clasificar `.ics` en el servidor

**Archivos:** crear `apps/api/src/reservas/dominio/ics.ts` y `ics.spec.ts`.

**Interfaces — produce:**

```ts
export interface EventoLeido { uid: string; titulo: string; desde: string; hasta: string; diaEntero: boolean }
export function leerICS(texto: string): EventoLeido[]
export interface EventoParaExportar { uid: string; titulo: string; desde: string; hasta: string }
export function generarICS(eventos: EventoParaExportar[], o: { nombre: string; ahora?: Date }): string
export type TipoExterno = 'RESERVADO' | 'CERRADO'
export function clasificarEvento(titulo: string): TipoExterno
export interface NochesExportadas { desde: string; hasta: string }
/** Saca los eventos CERRADO cuyas fechas son exactamente las de algo que Órbita exportó alguna vez. */
export function sinEco<T extends { desde: string; hasta: string; tipo: TipoExterno }>(eventos: T[], exportadas: NochesExportadas[]): T[]
export const MAX_EVENTOS = 500
```

- [ ] **Paso 1: tests que fallan.** Portar los casos de lectura y de generación de
  `apps/web/src/lib/reservas/__tests__/ics.test.ts` (mismo texto de entrada, mismas expectativas) y sumar:

```ts
it('clasifica: una reserva de Airbnb es RESERVADO; lo demás, CERRADO', () => {
  expect(clasificarEvento('Reserved')).toBe('RESERVADO')
  expect(clasificarEvento('Reservado')).toBe('RESERVADO')
  expect(clasificarEvento('Airbnb (Not available)')).toBe('CERRADO')
  expect(clasificarEvento('')).toBe('CERRADO')
})
it('el eco: un CERRADO con las fechas exactas de algo exportado se descarta; un RESERVADO, nunca', () => {
  const exportadas = [{ desde: '2026-12-10', hasta: '2026-12-13' }]
  const ev = (desde: string, hasta: string, tipo: TipoExterno) => ({ desde, hasta, tipo })
  expect(sinEco([ev('2026-12-10', '2026-12-13', 'CERRADO')], exportadas)).toEqual([])
  expect(sinEco([ev('2026-12-10', '2026-12-13', 'RESERVADO')], exportadas)).toHaveLength(1)
  // Airbnb juntó nuestro rango con un día que el dueño cerró a mano: no coincide exacto, se bloquea.
  expect(sinEco([ev('2026-12-10', '2026-12-15', 'CERRADO')], exportadas)).toHaveLength(1)
})
it('un archivo con más de 500 eventos se corta en 500', () => { /* 600 VEVENT → 500 */ })
it('un evento con hora (no de día entero) ocupa del día de inicio al día siguiente al de fin', () => { /* DTSTART:20261210T150000Z, DTEND:20261212T100000Z → desde 12-10, hasta 12-12 */ })
it('DTEND anterior o igual a DTSTART: una sola noche', () => { /* hasta = desde + 1 */ })
```

- [ ] **Paso 2:** `pnpm exec jest --config test/jest-src.json --maxWorkers=2 src/reservas/dominio/ics` → falla (módulo inexistente).
- [ ] **Paso 3:** implementar. `leerICS` y `generarICS` son los de la web, sin la descarga del
  navegador; `generarICS` emite solo eventos de día entero (`DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE`).
  `clasificarEvento`: `RESERVADO` si el título, sin mayúsculas, empieza con `reserv`; si no, `CERRADO`.
- [ ] **Paso 4:** mismos comandos → pasa. **Paso 5:** commit `feat(reservas): leer y generar .ics en el servidor`.

### Tarea 2: La tabla y las columnas

**Archivos:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261125120000_reservas_calendarios_externos/migration.sql`.

**Interfaces — produce** (nombres de Prisma que usan las tareas 4 a 6):

```prisma
enum ReservaBloqueoOrigen { DUENO  ICAL }

model ReservaCalendarioExterno {
  id          String   @id @default(uuid())
  businessId  String   @map("business_id")
  modulo      ReservaModulo
  recursoId   String   @map("recurso_id")
  nombre      String   @db.VarChar(80)
  url         String   @db.VarChar(600)
  activo      Boolean  @default(true)
  ultimaSync  DateTime? @map("ultima_sync")
  ultimoError String?  @map("ultimo_error") @db.VarChar(300)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@index([businessId, modulo])
  @@index([activo, ultimaSync])
  @@map("reservas_calendarios_externos")
}

// En ReservaBloqueo:
  origen       ReservaBloqueoOrigen @default(DUENO)
  calendarioId String?  @map("calendario_id")
  externoTipo  String?  @map("externo_tipo") @db.VarChar(12)   // 'RESERVADO' | 'CERRADO'
  externoUid   String?  @map("externo_uid") @db.VarChar(255)
  @@index([calendarioId])
```

- [ ] **Paso 1:** editar el schema (con sus relaciones a `Business` y `ReservaRecurso`) y escribir la
  migración a mano: `CREATE TYPE`, `CREATE TABLE`, cuatro `ALTER TABLE ... ADD COLUMN`, los índices.
  Encabezado con el porqué y "ninguna fila existente cambia: todo bloqueo actual queda `DUENO`".
- [ ] **Paso 2:** `pnpm exec prisma generate` y `pnpm exec tsc --noEmit` → 0 errores.
- [ ] **Paso 3:** `pnpm exec prisma migrate deploy` (dev) → "successfully applied".
- [ ] **Paso 4:** commit `feat(reservas): tabla de calendarios externos y origen de los bloqueos`.

### Tarea 3: Bajar el `.ics` sin abrirle una puerta al servidor

**Archivos:** crear `apps/api/src/reservas/calendarios/descarga.ts` y `descarga.spec.ts`.

**Interfaces — produce:**

```ts
/** null si sirve; si no, el mensaje para mostrar. */
export function errorDeUrl(url: string, env?: NodeJS.ProcessEnv): string | null
export type Descarga = { ok: true; texto: string } | { ok: false; motivo: string }
export function descargarCalendario(url: string, deps?: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv }): Promise<Descarga>
export const ESPERA_MS = 8_000
export const MAXIMO_BYTES = 1_000_000
```

Reglas de `errorDeUrl`: `https`, sin usuario ni puerto, la ruta termina en `.ics`, hasta 600
caracteres, y el host es `www.airbnb.<sufijo>` con sufijo en la lista fija `com, com.ar, com.br, es,
mx, cl, com.co, com.pe, com.uy, com.py, com.bo, com.ec, pt, it, fr, de, co.uk`. Fuera de producción
(`NODE_ENV !== 'production'`) también vale el host de `RESERVAS_ICAL_HOST_DE_PRUEBA`, para probar en
local con un archivo propio. Mensaje único de rechazo: `Pegá el enlace de Airbnb que termina en .ics
(en Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar calendario).`

- [ ] **Paso 1: tests que fallan.**

```ts
it.each([
  'https://www.airbnb.com/calendar/ical/123.ics?s=abc',
  'https://www.airbnb.com.ar/calendar/ical/123.ics?s=abc',
])('acepta %s', (u) => expect(errorDeUrl(u)).toBeNull())
it.each([
  'http://www.airbnb.com/calendar/ical/1.ics',          // sin https
  'https://airbnb.evil.com/calendar/ical/1.ics',         // otro dominio
  'https://www.airbnb.com.evil.io/calendar/ical/1.ics',
  'https://www.airbnb.com/rooms/1',                      // no es .ics
  'https://user:pw@www.airbnb.com/a.ics', 'https://www.airbnb.com:8443/a.ics',
  'https://localhost/a.ics', 'https://169.254.169.254/a.ics', 'no es una url',
])('rechaza %s', (u) => expect(errorDeUrl(u)).toMatch(/enlace de Airbnb/))
it('el host de prueba vale solo fuera de producción', () => { /* env con NODE_ENV dev → null; production → rechaza */ })
it('no sigue redirecciones', async () => { /* fetch falso → 302 → { ok:false, motivo: /no respondió con el calendario/ } y se llamó con redirect:'manual' */ })
it('una página HTML o un archivo sin BEGIN:VCALENDAR no es un calendario', async () => { /* → ok:false */ })
it('más de 1 MB se corta', async () => { /* → ok:false, motivo /demasiado grande/ */ })
it('si tarda más de 8 segundos, se corta', async () => { /* fetch que no resuelve + timers falsos → ok:false, /no respondió a tiempo/ */ })
it('un 403 o un 500 de Airbnb se cuenta con su número', async () => { /* → motivo 'Airbnb respondió 403.' */ })
```

- [ ] **Paso 2:** correr → falla. **Paso 3:** implementar con `fetch` nativo, `redirect: 'manual'`,
  `AbortSignal.timeout(ESPERA_MS)` y lectura por partes hasta `MAXIMO_BYTES`. Nunca tira.
- [ ] **Paso 4:** correr → pasa. **Paso 5:** commit `feat(reservas): descarga acotada del calendario de Airbnb`.

### Tarea 4: Conectar, sincronizar y desconectar

**Archivos:** crear `apps/api/src/reservas/calendarios/reservas-calendarios.service.ts` y
`apps/api/test/unit/reservas.calendarios.unit-spec.ts`; registrar en `reservas.module.ts`
(provider y export); sumar el archivo a `EXCEPCIONES` de `test/unit/aislamiento-consultas.unit-spec.ts`
**solo** por `sincronizarVencidos` (barre los calendarios de todos los negocios, como el job de Instagram).

**Consume:** tarea 1 (`leerICS`, `clasificarEvento`, `sinEco`), tarea 3 (`errorDeUrl`, `descargarCalendario`),
`datosAlojamiento` de `reservas-catalogo.service.ts`, `instante` y `fechaYMinutos` de `dominio/tiempo.ts`.

**Produce:**

```ts
export interface CalendarioDto {
  id: string; recursoId: string; nombre: string; url: string; activo: boolean
  ultimaSync: string | null; ultimoError: string | null
  /** Reservas activas de Órbita que pisan noches que el calendario trae como RESERVADO. */
  conflictos: { reservaId: string; codigo: string; desde: string; hasta: string }[]
}
export const MINUTOS_ENTRE_SYNC = 30
export const POR_CORRIDA = 5
export const MAXIMO_POR_RECURSO = 3
@Injectable() export class ReservasCalendariosService {
  listar(businessId: string, modulo: ReservaModulo): Promise<CalendarioDto[]>
  conectar(businessId: string, memberId: string, dto: { modulo: ReservaModulo; recursoId: string; nombre: string; url: string }): Promise<CalendarioDto>
  desconectar(businessId: string, memberId: string, id: string): Promise<{ ok: true; bloqueos: number }>
  sincronizar(businessId: string, id: string, ahora?: Date): Promise<CalendarioDto>
  sincronizarVencidos(ahora?: Date): Promise<{ revisados: number; conError: number }>
  feed(businessId: string, recursoId: string, ahora?: Date): Promise<string>   // tarea 5
}
```

Cómo sincroniza un calendario (el único algoritmo que el test no alcanza a determinar):

1. Baja el archivo. Si falla: guarda `ultimoError` y `ultimaSync = ahora`, **no toca los bloqueos**, devuelve.
2. `leerICS` → se quedan los eventos con `hasta` posterior a ayer → cada uno con su `clasificarEvento`.
3. `exportadas` = las noches de **todas** las reservas de ese recurso (cualquier estado, también
   canceladas y vencidas) con salida posterior a hace 60 días, más los bloqueos `DUENO` del recurso.
   Se aplica `sinEco`.
4. En una transacción: borra los bloqueos con ese `calendarioId` y crea los nuevos (`origen: ICAL`,
   `externoTipo`, `externoUid`, `motivo: 'Airbnb'`), un bloqueo por `externoUid` (el repetido se saltea).
   Si el calendario ya no existe al entrar a la transacción, no crea nada.
5. Guarda `ultimaSync = ahora` y `ultimoError = null`.

- [ ] **Paso 1: tests que fallan** (prisma y `descargarCalendario` simulados, como en `reservas.service.unit-spec.ts`):

```ts
it('conectar rechaza una URL que no es de Airbnb, un recurso que no es ALOJAMIENTO y el cuarto calendario de una propiedad')
it('conectar sincroniza en el momento y devuelve el calendario con su estado')
it('reemplaza los bloqueos del calendario: borra los suyos y crea uno por evento, de check-in a check-out')
it('no toca los bloqueos del dueño ni los de otro calendario')
it('si la descarga falla, guarda el motivo y deja los bloqueos como estaban')          // foco 2
it('cancelar en Órbita libera las noches aunque Airbnb las siga publicando como no disponibles')  // foco 1
it('el mismo UID dos veces crea un solo bloqueo')                                       // foco 4
it('si el calendario se desconectó mientras bajaba, no deja bloqueos')                  // foco 5
it('un RESERVADO que pisa una reserva activa de Órbita aparece en conflictos, con su código')
it('desconectar borra el calendario y solo sus bloqueos, y dice cuántos eran')
it('sincronizarVencidos toma hasta 5, los de hace más de 30 minutos o nunca, primero los más viejos; un error en uno no frena a los demás')
```

- [ ] **Paso 2:** `pnpm exec jest --config test/jest-unit.json --maxWorkers=2 test/unit/reservas.calendarios` → falla.
- [ ] **Paso 3:** implementar. Toda consulta filtra por `businessId` salvo `sincronizarVencidos`.
- [ ] **Paso 4:** ese test y `test/unit/aislamiento-consultas` → pasan. **Paso 5:** commit `feat(reservas): sincronizar el calendario de Airbnb como bloqueos`.

### Tarea 5: El `.ics` que Órbita le da a Airbnb

**Archivos:** `reservas-calendarios.service.ts` (`feed`), `reservas-publico.controller.ts`, test en `reservas.calendarios.unit-spec.ts`.

**Produce:** `GET /api/v1/storefront/:slug/reservas/ical/:archivo` con `:archivo` = `<uuid del recurso>.ics`,
público, `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: no-store`. 404 si el archivo no
termina en `.ics`, si el uuid no es de un `ALOJAMIENTO` activo de ese negocio. Responde aunque el
negocio esté pausado (las noches siguen ocupadas).

Qué incluye `feed`: las reservas que ocupan (`RETENIDA` sin vencer, `PENDIENTE`, `CONFIRMADA`) y los
bloqueos `DUENO` de ese recurso o de todo el negocio, con salida de ayer en adelante y hasta 365 días.
Cada uno como evento de día entero, `SUMMARY:Reservado` (reservas) o `No disponible` (bloqueos),
`UID:<id>@orbita.site`. **Nunca** los bloqueos `ICAL`. **Nunca** nombres, teléfonos, notas ni montos.

- [ ] **Paso 1: tests que fallan.**

```ts
it('exporta reservas activas y bloqueos del dueño como eventos de día entero, sin datos personales')
// la reserva de "Ana Ríos" 10→13/12 sale como DTSTART;VALUE=DATE:20261210 / DTEND;VALUE=DATE:20261213 / SUMMARY:Reservado
// y el texto NO contiene 'Ana', ni el teléfono, ni el precio
it('no exporta los bloqueos que vinieron de Airbnb ni las reservas canceladas o vencidas')
it('un recurso de otro negocio, inactivo o que no es alojamiento es 404')
it('sin nada ocupado devuelve un calendario válido y vacío (BEGIN:VCALENDAR … END:VCALENDAR)')
```

- [ ] **Paso 2:** correr → falla. **Paso 3:** implementar. **Paso 4:** correr → pasa.
- [ ] **Paso 5:** commit `feat(reservas): calendario .ics público por propiedad`.

### Tarea 6: Rutas del panel, bloqueos con origen y el job

**Archivos:** crear `dto/calendarios.dto.ts`; modificar `reservas-panel.controller.ts`, `reservas.types.ts`
(el DTO del bloqueo suma `origen`, `calendarioId`, `externoTipo`), `reservas-catalogo.service.ts`
(`borrarBloqueo` y `borrarRecurso`), `internal-cron.controller.ts`, `internal-cron.module.ts`, `README.md`.

**Produce (rutas del panel):**

| Ruta | Permiso | Devuelve |
|---|---|---|
| `GET /reservas/calendarios?modulo=` | `reservas.view` | `CalendarioDto[]` |
| `POST /reservas/calendarios` (`{ modulo, recursoId, nombre, url }`) | `reservas.config` | `CalendarioDto` |
| `DELETE /reservas/calendarios/:id` | `reservas.config` | `{ ok: true, bloqueos: number }` |
| `POST /reservas/calendarios/:id/sincronizar` | `reservas.manage`, con `@Throttle` de 6 por minuto | `CalendarioDto` |

- `DELETE /reservas/bloqueos/:id` sobre un bloqueo `ICAL` → 400 `Ese bloqueo viene de Airbnb: se va solo
  cuando Airbnb libera esas noches, o desconectando el calendario.`
- Borrar un recurso desconecta sus calendarios y borra sus bloqueos `ICAL` en la misma operación (foco 5).
- En `instagram-cada-5-minutos`: un bloque `try` más, igual a los que ya hay, que llama
  `reservasCalendarios?.sincronizarVencidos()` y, si falla, lo anota y sigue. Su resultado va en la respuesta.

- [ ] **Paso 1: tests que fallan** — en `reservas.calendarios.unit-spec.ts`: el bloqueo `ICAL` no se
  borra a mano; borrar el recurso se lleva sus calendarios y sus bloqueos importados. En el test de roles
  que ya lista las rutas del panel por permiso, las cuatro rutas nuevas con el suyo.
- [ ] **Paso 2:** correr → falla. **Paso 3:** implementar. **Paso 4:** `jest-unit` y `jest-src` completos
  con `--maxWorkers=2` → todo verde (ahí están los tests de Turnos y Gimnasio).
- [ ] **Paso 5:** README del motor: una fila en la tabla de permisos y una sección "Calendarios externos".
  Commit `feat(reservas): rutas de calendarios externos y sincronización en el job de 5 minutos`.

### Tarea 7: El contrato y el origen en la web

**Archivos:** `apps/web/src/lib/reservasApi/{tipos,cliente}.ts`; `modules/alquileres/datos/index.ts`
(`CalendarioExterno`), `datos/origen/{mapear,escribir,api,index}.ts` y sus tests.

**Produce:**

```ts
// lib/reservasApi/tipos.ts
export interface CalendarioExterno { id: string; recursoId: string; nombre: string; url: string; activo: boolean; ultimaSync: string | null; ultimoError: string | null; conflictos: { reservaId: string; codigo: string; desde: string; hasta: string }[] }
// Bloqueo suma: origen: 'DUENO' | 'ICAL'; calendarioId: string | null; externoTipo: 'RESERVADO' | 'CERRADO' | null
// lib/reservasApi/cliente.ts → panel.calendarios(modulo), panel.conectarCalendario(datos), panel.desconectarCalendario(id), panel.sincronizarCalendario(id)
export const urlDelCalendario = (slug: string, recursoId: string): string   // `${API_BASE}/storefront/<slug>/reservas/ical/<recursoId>.ics`

// modules/alquileres/datos/index.ts
export interface CalendarioExterno { id: string; unidadId: string; nombre: string; url: string; ultimaSync: ISO; ultimaSyncHora?: string; error?: string; conflictos?: { reservaId: string; codigo: string; entrada: ISO; salida: ISO }[] }
// datos/origen/index.ts → Escrituras suma: sincronizarCalendario(id: string): void | Promise<void>   (en la demo: marca la sync como recién hecha)
```

- [ ] **Paso 1: tests que fallan.** `mapear.test.ts`: `bloqueosDeApi` da `origen: 'ical'` y
  `calendarioId` a un bloqueo `ICAL`; `calendarioDeApi` traduce estado, error y conflictos.
  `api.test.ts`: `cargarApi` trae los calendarios; `agregarCalendario` llama `panel.conectarCalendario`
  con `{ modulo: 'ALQUILERES', recursoId, nombre, url }` y recarga; `quitarCalendario` y
  `sincronizarCalendario` llaman a los suyos; un 400 de la API llega con su mensaje.
- [ ] **Paso 2:** `pnpm exec vitest run src/modules/alquileres src/lib/reservasApi --maxWorkers=2` → falla.
- [ ] **Paso 3:** implementar. **Paso 4:** correr → pasa; `tsc --noEmit` → 0.
- [ ] **Paso 5:** commit `feat(alquileres): el panel lee y escribe los calendarios de Airbnb`.

### Tarea 8: La pantalla de Airbnb en el panel real

**Antes de tocar UI:** invocar la skill `ui-ux-pro-max` (regla del repo).

**Archivos:** `admin/configuracion/Calendarios.tsx`, `admin/configuracion/Bloqueos.tsx`, `admin/navegacion.ts`
(+ test), `admin/Panel.tsx`, `admin/Reservas.tsx` (el aviso de conflicto arriba del calendario).

Qué cambia para un negocio real (la demo queda como está):

- `calendarios` sale de `SIN_API` y en estadía se llama **"Airbnb"**.
- Por propiedad, dos bloques en este orden:
  1. **"De Órbita a Airbnb"**: la URL de `urlDelCalendario` con "Copiar", y los tres pasos para pegarla
     en Airbnb (Calendario → Disponibilidad → Conectar calendarios → Importar calendario).
  2. **"De Airbnb a Órbita"**: campo para pegar el enlace, estado ("Sincronizado hace 12 min" o el
     error), "Sincronizar ahora" y "Desconectar" (con `BotonConfirmar`: "¿Desconectar? Se liberan N
     noches que venían de Airbnb.").
- Una nota fija: `Se sincroniza cada 30 minutos, y Airbnb lee el de Órbita cada pocas horas. En ese
  rato pueden entrar dos reservas para las mismas noches: si pasa, te avisamos acá y arriba del calendario.`
- Con conflictos: aviso arriba del Calendario y en esta pantalla, `Airbnb tiene reservadas noches que
  también tenés acá: <código> · <fechas>`, con link a la reserva.
- En Bloqueos y en el Calendario, lo que vino de Airbnb se ve como "Airbnb" y no tiene "Quitar".

- [ ] **Paso 1: tests que fallan** — `navegacion.test.ts`: en real, estadía incluye `calendarios` con
  label `Airbnb`; canchas y salones no lo incluyen todavía. Texto puro en `datos/textos.ts`:
  `hace(ultimaSync, ahora)` → `'recién'`, `'hace 12 min'`, `'hace 3 h'`, `'todavía no se sincronizó'`.
- [ ] **Paso 2:** correr → falla. **Paso 3:** implementar. **Paso 4:** correr → pasa; eslint sin errores.
- [ ] **Paso 5:** commit `feat(alquileres): pantalla de Airbnb en el panel real`.

### Tarea 9: Probarlo de punta a punta en dev

**Archivos:** un `.ics` de ejemplo en `apps/api/test/fixtures/airbnb-ejemplo.ics` (dos `Reserved`, un
`Airbnb (Not available)` con las fechas de una reserva de Órbita y otro suelto).

- [ ] **Paso 1:** servir el fixture en local (`npx serve` o un servidor de Node de 10 líneas en el
  scratchpad, por https no hace falta: usar `RESERVAS_ICAL_HOST_DE_PRUEBA` en el `.env` local, que
  solo vale fuera de producción).
- [ ] **Paso 2:** con el negocio de prueba de dev (`zz-alq-mwtom7tc`): conectar el calendario desde el
  panel, ver los bloqueos "Airbnb" en el Calendario, comprobar que el sitio no deja reservar esas
  noches y que el eco no bloqueó las de la reserva propia.
- [ ] **Paso 3:** bajar el `.ics` exportado con `curl` y revisar que no tenga nombres ni montos, y que
  no traiga lo importado.
- [ ] **Paso 4:** cancelar la reserva propia, sincronizar, y ver que sus noches quedan libres (foco 1).
- [ ] **Paso 5:** Playwright a 390 px y a 1280 px sobre la pantalla nueva; capturas al scratchpad.

### Tarea 10: Aviso real de Airbnb, Auditoría y producción

- [ ] **Paso 1 (lo hace Alan, no un agente):** conectar la propiedad de prueba de producción con un
  aviso real de Airbnb en las dos direcciones, y mirar un día después qué publica Airbnb. Anotar en la
  Auditoría: cómo titula sus eventos, si reexporta lo que importó, y si lo libera al cancelar. Si lo que
  se ve contradice la regla del eco, se ajusta `clasificarEvento` o `sinEco` y sus tests.
- [ ] **Paso 2:** entrada de Auditoría (`modulos/entradas.ts`) y documentar la tarea F9 en `plan.ts`.
- [ ] **Paso 3:** avisar a Mateo y a Ale de la migración. Después, el orden del `CLAUDE.md`: push de
  `main` → CI verde → `prisma-prod.sh migrate deploy` → `deploy.sh` → verificar revisión y tráfico.
- [ ] **Paso 4:** en producción, con el negocio de prueba: conectar, sincronizar y desconectar.

---

## Qué queda fuera

- Importar las ganancias de Airbnb por CSV (spec § 7.2): etapa siguiente, con su plan.
- Otros sitios (Booking, calendarios de Google): la lista de dominios es fija a propósito.
- Calendarios para canchas y salones.
- Un job propio de sincronización: mientras haya pocos calendarios alcanza con el de 5 minutos
  (5 por corrida = 30 calendarios cada 30 minutos). Si se pasa, se sube `POR_CORRIDA` o se separa.
- Avisar por email o WhatsApp cuando hay un conflicto: por ahora se ve en el panel.

## Después de la revisión del código (25/11)

Una revisión independiente de toda la rama no encontró problemas de seguridad ni críticos, y sí estos, que se
corrigieron antes de producción (cada uno con su test, primero en rojo):

| Qué estaba mal | Qué quedó |
|---|---|
| La memoria del eco salía del estado actual de la base: se olvidaba de un bloqueo propio borrado o de una reserva reprogramada (sus noches volvían como bloqueo de Airbnb, imposible de quitar) y "recordaba" retenciones que Airbnb nunca vio (un cierre real con esas fechas no bloqueaba) | Se anota lo que el `.ics` **mostró** en cada lectura (tabla nueva `reservas_ical_exportadas`, migración `20261125120200`) y el eco se compara contra eso |
| El dueño no podía cargar en su panel una reserva sobre noches que él mismo había cerrado en Airbnb | Desde el panel, un "no disponible" de Airbnb no tapa; una reserva de Airbnb sí |
| El `.ics` de una propiedad en pausa daba 404 | Responde igual: las noches tomadas siguen tomadas |
| Un archivo que llegaba cortado se tomaba por bueno y podía liberar noches | Tiene que traer su `END:VCALENDAR` |
| "Calendario conectado" aunque Airbnb no hubiera dejado bajarlo | Se avisa con el motivo y el calendario queda a la vista con su error |
| La pantalla volvía a la primera propiedad después de cada acción | Ya no se vuelve a montar |

Lo que había quedado anotado sin corregir se corrigió el mismo 25/11, después de probar la pantalla en
producción con el negocio de prueba (cada punto con su test, primero en rojo):

| Qué estaba mal | Qué quedó |
|---|---|
| El panel trataba cualquier falla de `GET calendarios` como "no hay calendarios" | Solo un 404 (una API anterior); cualquier otra falla se ve y se puede reintentar |
| La campanita decía "sincronizado" aunque la descarga hubiera fallado | Dice "no se pudo sincronizar", con el motivo, y hace cuánto fue |
| Dos sincronizaciones a la vez del mismo calendario podían duplicar sus bloqueos | Se reemplazan con el candado del recurso tomado (`candado.ts`) |
| Uno que fallaba al guardar quedaba primero en la cola y trababa a los demás | Pasa al final con su motivo |
| El mismo aviso conectado por `airbnb.com` y por `airbnb.com.ar` contaba doble | Es el mismo calendario (misma ruta y clave): no se conecta dos veces |
| La API le devolvía el enlace de Airbnb con su clave a quien pudiera ver reservas | Devuelve el enlace sin la clave |
| Si Airbnb redirigía un dominio de país al `.com`, el calendario fallaba | Se sigue esa redirección, una sola vez y solo hacia otro enlace que cumple las mismas reglas |
| Las noches que se liberan al desconectar salían de lo que el panel tenía cargado (medio año) | Las cuenta el servidor |
| El campo del enlace se vaciaba antes de saber si había conectado | Se vacía recién cuando conectó; un enlace rechazado queda para corregirlo |
| Un rechazo salía con el ícono de éxito, y "Sincronizar ahora" decía "Calendario sincronizado" aunque Airbnb no lo hubiera dejado bajar (visto en producción) | El aviso de error es de error, y sincronizar dice el motivo. Los botones dicen "Conectando…", "Sincronizando…" y "Desconectando…" mientras tanto |

Sigue sin verificar: cómo titula Airbnb sus eventos hoy y cada cuánto relee el calendario de Órbita. Se ve
con un aviso real (tarea 10).
