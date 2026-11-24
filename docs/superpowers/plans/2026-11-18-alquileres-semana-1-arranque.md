# Alquileres sobre el backend · Semana 1 (arranque) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel de Alquileres pueda leer de la API de reservas (sin tocar la demo), con un negocio de prueba por modo en dev y el mapa del módulo registrado en Auditoría.

**Architecture:** Igual que Turnos (Mateo, 13/11): una capa de datos por origen en `modules/alquileres/datos/origen/` (interfaz + `demo.ts` + `api.ts` + `mapear.ts` puro). El panel pide sus datos al origen del contexto; por defecto la demo (así `/alquileres-demo` queda igual). El origen de la API **solo lee** esta semana: las escrituras se conectan sección por sección en las semanas 2 a 4. Una página local (`/panel/alquileres`, `notFound` en producción) monta el panel con el origen de la API.

**Tech Stack:** Next.js (pages router) + React 19 + Vitest en `apps/web`; NestJS + Prisma en `apps/api`; cliente tipado `apps/web/src/lib/reservasApi/`.

**Spec:** `docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md` (§ 4 patrón, § 5 mapa, § 6 faltantes, § 8 orden).

## Global Constraints

- Trabajar en la rama `feat/alquileres-backend`, cortada de `origin/main` (el `main` local está atrasado y tiene cambios sin commitear de Alan que no se tocan).
- Los módulos no se importan entre sí: nada de `@/modules/turnos/...` desde Alquileres (se replica lo poco que haga falta).
- Nada del motor compartido (`apps/api/src/reservas`, `schema.prisma`, `lib/reservasApi`) se modifica esta semana: lo compartido lo decide Ale (spec § 9).
- El seed solo corre contra la base de **dev** (`hhaqlzrcskmwnvhgydon`), lo chequea antes de tocar nada y no imprime ni la URL ni la contraseña.
- Textos, comentarios y commits en castellano rioplatense, como el resto del repo. Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No se pushea nada (se pushea solo `main`, y solo si Alan lo pide).
- `/alquileres-demo` tiene que verse y comportarse exactamente igual que antes.

## Review Focus

1. **Negocio sin config de Alquileres** (`GET /reservas/config?modulo=ALQUILERES` da `null`): el panel muestra "Este negocio todavía no tiene Alquileres configurado." con Reintentar, no se rompe. → test en Task 3.
2. **Reserva de estadía que termina en otro mes / salida a las 10:00:** la salida es el día de `fin` en Argentina (UTC−3), no el de UTC; `2026-11-20T13:00:00Z` → `2026-11-20`, `2026-11-21T02:30:00Z` → `2026-11-20`. → test en Task 1.
3. **Bloqueo de todo el negocio** (`recursoId: null`): se expande a un bloqueo por unidad, como hace la demo. → test en Task 1.
4. **Reserva sin cliente con ficha** (`clienteId: null`): el cliente se identifica por teléfono, si no por email, si no por nombre; dos reservas con el mismo teléfono son un solo cliente. → test en Task 1.
5. **Más de 93 días de reservas:** la API rechaza pedidos de más de 93 días; la carga va en tramos de 90 y pagina de a 100. → test en Task 3.

---

### Task 1: Traducciones puras API → tipos del panel (`mapear.ts`)

**Files:**
- Create: `apps/web/src/modules/alquileres/datos/origen/mapear.ts`
- Test: `apps/web/src/modules/alquileres/datos/origen/__tests__/mapear.test.ts`

**Interfaces:**
- Consumes: tipos de `@/lib/reservasApi/tipos` (`Recurso`, `Servicio`, `Reserva` as `ReservaApi`, `Bloqueo` as `BloqueoApi`, `Config`); tipos de `../index` del módulo (`TipoAlquiler`, `NegocioAlquiler`, `Unidad`, `Salon`, `Propiedad`, `Reserva`, `Cliente`, `Bloqueo`, `Apertura`, `EstadoReserva`), `mensajesDeFabrica`, `RUBROS_ALQUILERES`.
- Produces:
  - `fechaArgentina(iso: string): ISO`
  - `tipoDeRecurso(tipo: TipoAlquiler): 'CANCHA' | 'SALON' | 'ALOJAMIENTO'`
  - `tipoDeRubro(subrubros: string[] | null | undefined): { tipo: TipoAlquiler; rubro: string }` (primera clave de `subrubros` que exista en `RUBROS_ALQUILERES`; si ninguna, `{ tipo: 'cancha', rubro: 'canchas' }`)
  - `estadoDeApi(estado: ReservaApi['estado']): EstadoReserva | null`
  - `unidadDeApi(r: Recurso): Unidad`
  - `salonDeApi(r: Recurso, servicios: Servicio[]): Salon`
  - `propiedadDeApi(r: Recurso): Propiedad`
  - `clienteIdDe(r: ReservaApi): string`
  - `clientesDeReservas(rs: ReservaApi[]): Cliente[]`
  - `reservaDeApi(r: ReservaApi, recurso: Recurso | undefined): Reserva | null`
  - `bloqueosDeApi(bs: BloqueoApi[], unidadIds: string[]): Bloqueo[]`
  - `aperturaDeHorario(horario: unknown): Apertura`
  - `negocioDeApi(p: { tipo: TipoAlquiler; rubro: string; negocio: { nombre: string; slug: string; telefono?: string | null; direccion?: string | null; ciudad?: string | null; descripcion?: string | null; logo?: string | null }; config: Config; recursos: Recurso[]; servicios: Servicio[]; bloqueos: BloqueoApi[] }): NegocioAlquiler`

Reglas que fija este diseño (spec § 5 y § 6):
- Estados: `VENCIDA` → `null` (no se muestra); `RETENIDA` y `PENDIENTE` → `'pendiente'`; `CONFIRMADA` → `'confirmada'`; `COMPLETADA` → `'completada'`; `AUSENTE` → `'cancelada'` (decisión provisoria: el panel de Alquileres no tiene "no vino"; se revisa en Ingresos, semana 6); `CANCELADA` → `'cancelada'`.
- Cancha: `tarifaHora = round(precio * 60 / (duracionMinutos ?? 60))`; `detalle = descripcion ?? ''`; `foto = datos.foto ?? ''`.
- Salón: `capacidad = datos.capacidad ?? 0`, `duracionBloque = duracionMinutos ?? 240`, `limpieza = margenMinutos ?? 0`, `deposito = datos.deposito ?? 0`, `fotos = datos.fotos ?? []`; paquetes = los servicios activos cuyo `recursoIds` incluye el salón (F3 del spec): `{ id, nombre, precio, hastaInvitados: capacidad, incluye: (descripcion ?? '').split('\n').filter(Boolean) }`.
- Propiedad: todo lo descriptivo sale de `datos` (`tipo` default `'Cabaña'`, `huespedes`, `ambientes`, `camas`, `banos`, `comodidades`, `fotos`, `direccion`, `ciudad`, `latLng`, `modalidad` default `'noche'`, `mensual`); `checkIn`/`checkOut` de `datos` con default 840 y 600 (los del servidor); `tarifa = { precioNoche: precio, temporadas: datos.tarifa?.temporadas ?? [], finDeSemanaPct: datos.tarifa?.finDeSemanaPct ?? 0, limpieza: datos.tarifa?.limpieza ?? 0, minNoches: datos.nochesMinimas ?? 1 }`. Todo `datos` se lee defensivo (si un campo no tiene el tipo esperado, va el default).
- Reserva: cancha y salón → `fecha`, `inicio = inicioMinutos`, `fin = finMinutos`; estadía → `entrada = fecha`, `salida = fechaArgentina(fin)`. `total = precio`, `sena`, `senaPagada = sena > 0 && pagado >= sena`, `saldoPagado = pagado >= precio`, `extras` = ids de `extras` (array de `{ id }`), `nota = notaInterna ?? notas ?? undefined`, `creada = fechaArgentina(creadaEn)`, `clienteId = clienteIdDe(r)`.
- `clienteIdDe`: `clienteId` si viene; si no `tel:<solo dígitos>`; si no `mail:<email en minúscula>`; si no `nom:<nombre en minúscula>`.
- Negocio: `senaPct = config.senaPorcentaje`, `cancelaHastaHoras = config.cancelacionHastaHoras`, `apertura = aperturaDeHorario(config.horario)` (días con algún tramo; `desde` = el menor inicio, `hasta` = el mayor fin; sin tramos `{ dias: [], desde: 540, hasta: 1080 }`); canchas: `pasoMin`, `duracionMin`, `maxFranjas` del primer recurso `CANCHA` (o 60, 60, 1), `extras` = unión por id de `datos.extras` de las canchas, `reglasPrecio = []` (F2); `mensajes = mensajesDeFabrica(tipo)` (F10); `pagos = { senaSobre: 'total', formas: ['efectivo', 'transferencia'], alias: '', titular: '', mpConectado: false, cancelaATiempo: config.senaReembolsable ? 'devolver' : 'credito', cancelaTarde: 'pierde' }` (F11); `equipo = []` (F12); `calendariosExternos = []` (F9); `fotoPortada` = la primera foto de la primera unidad, o `''`; `latLng` de la primera propiedad o `[-25.5972, -54.5786]`.

- [ ] **Step 1: Write the failing tests** — en `mapear.test.ts`, un `describe` por función, con estos casos como mínimo:
  - `fechaArgentina('2026-11-20T13:00:00.000Z') === '2026-11-20'` y `fechaArgentina('2026-11-21T02:30:00.000Z') === '2026-11-20'`.
  - `estadoDeApi`: los siete estados según la tabla de arriba (`'VENCIDA'` → `null`, `'AUSENTE'` → `'cancelada'`).
  - `unidadDeApi` con `precio: 30000, duracionMinutos: 30` → `tarifaHora === 60000`.
  - `salonDeApi`: dos servicios, uno con `recursoIds: [salon.id]` y `descripcion: 'Torta\nDJ'`, otro con otro salón → un solo paquete con `incluye: ['Torta', 'DJ']` y `hastaInvitados === datos.capacidad`.
  - `propiedadDeApi` con `datos: { checkIn: 900, nochesMinimas: 2, tarifa: { limpieza: 15000 } }`, `precio: 80000` → `checkIn 900`, `checkOut 600`, `tarifa.minNoches 2`, `tarifa.limpieza 15000`, `tarifa.precioNoche 80000`; con `datos: { huespedes: 'cuatro' }` → `huespedes` es el default.
  - `reservaDeApi` de un `ALOJAMIENTO` con `fecha '2026-11-20'`, `fin '2026-11-23T13:00:00.000Z'` → `entrada '2026-11-20'`, `salida '2026-11-23'`, sin `fecha`; de una `CANCHA` → `fecha`, `inicio`, `fin`; `estado: 'VENCIDA'` → `null`; `sena 10000, pagado 10000, precio 40000` → `senaPagada true`, `saldoPagado false`.
  - `clientesDeReservas`: dos reservas sin `clienteId` con teléfonos `'3757 55-0101'` y `'3757550101'` → un solo cliente con id `'tel:3757550101'`.
  - `bloqueosDeApi`: un bloqueo con `recursoId: null` y unidades `['a', 'b']` → dos bloqueos (`unidadId` `'a'` y `'b'`), `origen 'dueno'`, `desde`/`hasta` en fechas de Argentina.
  - `aperturaDeHorario({ '1': [[540, 780], [960, 1320]], '6': [[600, 1200]] })` → `{ dias: [1, 6], desde: 540, hasta: 1320 }`; `aperturaDeHorario(null)` → `{ dias: [], desde: 540, hasta: 1080 }`.
  - `tipoDeRubro(['cabana'])` → `{ tipo: 'estadia', rubro: 'cabana' }`; `tipoDeRubro(['no-existe'])` → `{ tipo: 'cancha', rubro: 'canchas' }`.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd apps/web && pnpm exec vitest run src/modules/alquileres/datos/origen/__tests__/mapear.test.ts`
  Expected: FAIL (no existe `../mapear`).

- [ ] **Step 3: Implement `mapear.ts`** con las firmas y reglas de arriba. Comentario de cabecera en el estilo del módulo (qué traduce y qué no, con la referencia a los faltantes F2, F3, F9–F12 del spec). Para leer `datos` defensivo, un helper local `campo<T>(datos: unknown, clave: string, esValido: (v: unknown) => v is T, def: T): T`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: el mismo comando. Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/web/src/modules/alquileres/datos/origen/mapear.ts apps/web/src/modules/alquileres/datos/origen/__tests__/mapear.test.ts`
  `git commit -m "feat(alquileres): traducciones de la API de reservas a los tipos del panel"`

---

### Task 2: El origen de datos y el panel leyendo de él (demo por defecto)

**Files:**
- Create: `apps/web/src/modules/alquileres/datos/origen/index.ts`
- Create: `apps/web/src/modules/alquileres/datos/origen/demo.ts`
- Modify: `apps/web/src/modules/alquileres/admin/Panel.tsx` (la línea `const n = useNegocio()` y la condición de `cargando`)
- Test: `apps/web/src/modules/alquileres/datos/origen/__tests__/demo.test.ts`

**Interfaces:**
- Consumes: `useNegocio` (`../../demo/useNegocio`) y `useCargaSimulada` (`@/design-system/reservas/skeleton`).
- Produces (en `origen/index.ts`):
  ```ts
  export type Escrituras = Pick<ReturnType<typeof useDemoAlquiler>, 'configurar' | 'reservar' | 'cambiarReserva' | 'agregarBloqueo' | 'quitarBloqueo' | 'agregarCalendario' | 'quitarCalendario'>
  export interface DatosPanelAlquiler extends Escrituras {
    tipo: TipoAlquiler
    negocio: NegocioAlquiler
    reservas: Reserva[]
    clientes: Cliente[]
    /** false mientras llegan los datos (o en la demo, antes de leer lo guardado). */
    listo: boolean
    error: string | null
    reintentar: () => void
    /** Solo en la demo: el almacén del navegador (lo usa el panel para la campanita y la barra de la demo). */
    demo?: DemoAlquiler
    /** true si las escrituras todavía no llegan a la API (origen de la API, semana 1). */
    soloLectura: boolean
  }
  export interface OrigenAlquileres { tipo: 'demo' | 'api'; useDatos(): DatosPanelAlquiler }
  export function OrigenAlquileresProvider(p: { origen: OrigenAlquileres; children: ReactNode }): ReactElement
  export const useOrigenAlquileres: () => OrigenAlquileres
  ```
  (en `origen/demo.ts`): `export const origenDemo: OrigenAlquileres` cuyo `useDatos()` envuelve `useNegocio()` tal cual (`listo = hidratado`, `error: null`, `soloLectura: false`, `reintentar` vacío).

- [ ] **Step 1: Write the failing test** — `demo.test.ts` con `@testing-library/react` (`renderHook`), sin proveedor (el contexto da `origenDemo`): `useOrigenAlquileres().tipo === 'demo'`; con `?tipo=` ausente, `useDatos()` devuelve el mismo `negocio.nombre` que `NEGOCIOS_DEMO.cancha.nombre` y las mismas reservas (por id) que `reservasDelDemo({ negocios: {}, reservas: {}, cambios: {}, clientes: [], alta: null }, 'cancha')` (el estado inicial del almacén, que `negocio.ts` no exporta). Si el hook de la URL (`useTipoDemo`) necesita el router, mockear `next/router` como ya lo hacen otros tests del repo (buscar `vi.mock('next/router'` en `apps/web/src`).

- [ ] **Step 2: Run test to verify it fails**
  Run: `cd apps/web && pnpm exec vitest run src/modules/alquileres/datos/origen/__tests__/demo.test.ts`
  Expected: FAIL (no existe `../index`).

- [ ] **Step 3: Implement `index.ts` y `demo.ts`**, y en `Panel.tsx` reemplazar `useNegocio()` por `useOrigenAlquileres().useDatos()`. `cargando = useCargaSimulada() || !n.listo` en la demo; con el origen de la API, `cargando = !n.listo` (la espera fingida es solo de la demo: `origen.tipo === 'demo'`). Si `n.error`, el panel muestra el mensaje con un botón "Reintentar" (`n.reintentar`) usando las piezas de `@/design-system/reservas/piezas` que ya use el panel para avisos. Si `n.soloLectura`, una franja fija arriba del contenido: "Prueba con la API: lo que cambies acá todavía no se guarda." La `key` que hoy usa `hidratado` pasa a usar `n.listo`.

- [ ] **Step 4: Run tests**
  Run: `cd apps/web && pnpm exec vitest run src/modules/alquileres`
  Expected: PASS (incluido `navegacion.test.ts`).

- [ ] **Step 5: Verificar la demo en el navegador** — `preview_start` del front, abrir `/alquileres-demo/panel?tipo=cancha`, `?tipo=bloque` y `?tipo=estadia`: sin errores en consola, mismas secciones y datos que antes; crear un bloqueo y verlo en la lista (las escrituras de la demo siguen andando).

- [ ] **Step 6: Commit**
  `git commit -m "feat(alquileres): el panel lee de un origen (demo o API), la demo por defecto"`

---

### Task 3: El origen de la API (solo lectura)

**Files:**
- Create: `apps/web/src/modules/alquileres/datos/origen/api.ts`
- Test: `apps/web/src/modules/alquileres/datos/origen/__tests__/api.test.ts`

**Interfaces:**
- Consumes: `panel` de `@/lib/reservasApi/cliente` (`config`, `recursos`, `servicios`, `bloqueos`, `agenda`), `getBusiness` de `@/lib/api`, todo `mapear.ts` (Task 1), `DatosPanelAlquiler`/`OrigenAlquileres` (Task 2).
- Produces:
  - `export const DIAS_ATRAS = 186` y `export const DIAS_ADELANTE = 186` (Ingresos compara tres meses contra los tres anteriores; la estadía mira medio año adelante).
  - `export const DIAS_POR_PEDIDO = 90`
  - `export function tramosDeFechas(desde: ISO, hasta: ISO, porTramo?: number): [ISO, ISO][]` (misma regla que Turnos, replicada: los módulos no se importan entre sí)
  - `export async function reservasEntre(desde: ISO, hasta: ISO): Promise<ReservaApi[]>` (módulo `ALQUILERES`, de a 100 por página, todas las páginas de cada tramo)
  - `export async function cargarApi(hoy: ISO): Promise<Pick<DatosPanelAlquiler, 'tipo' | 'negocio' | 'reservas' | 'clientes'>>` — el tipo sale de `tipoDeRubro(business.subrubros)`; filtra los recursos por `tipoDeRecurso(tipo)`; sin config tira `Error('Este negocio todavía no tiene Alquileres configurado.')`.
  - `export const origenApi: OrigenAlquileres` (`tipo: 'api'`, `soloLectura: true`; las siete escrituras no hacen nada y dejan un `console.warn` con el nombre de la escritura; `reintentar` vuelve a cargar).

- [ ] **Step 1: Write the failing tests** — `api.test.ts`, con `vi.mock('@/lib/reservasApi/cliente')` y `vi.mock('@/lib/api')`:
  - `tramosDeFechas('2026-01-01', '2026-07-01')` → 3 tramos; el primero `['2026-01-01', '2026-03-31']`; el último termina en `'2026-07-01'`; ningún tramo de más de 90 días.
  - `reservasEntre` con un `agenda` falso que devuelve 100 y después 30 en el primer tramo → junta 130 y pide la página 2.
  - `cargarApi('2026-11-18')` con `config` → `null` rechaza con `'Este negocio todavía no tiene Alquileres configurado.'`
  - `cargarApi` con `subrubros: ['cabana']`, un recurso `ALOJAMIENTO` y uno `CANCHA` → `tipo 'estadia'`, `negocio.propiedades.length === 1`, `negocio.unidades.length === 0`.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd apps/web && pnpm exec vitest run src/modules/alquileres/datos/origen/__tests__/api.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `api.ts`.** `useDatos()` carga una vez por montaje con `useEffect` + `useEffectEvent` (como `useDatosPanel` de Turnos), con `listo: false` hasta que llega; `hoy` = la fecha de Argentina de `Date.now()` (`fechaArgentina(new Date().toISOString())`). `reservas` = `reservaDeApi` de cada una (sin los `null`), con el recurso por id.

- [ ] **Step 4: Run tests**
  Run: `cd apps/web && pnpm exec vitest run src/modules/alquileres`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git commit -m "feat(alquileres): origen de la API de reservas, solo lectura"`

---

### Task 4: Negocios de prueba en dev (uno por modo)

**Files:**
- Create: `apps/api/prisma/seed-alquileres-prueba.ts`
- Modify: `apps/api/package.json` (script `"seed:alquileres-prueba": "ts-node prisma/seed-alquileres-prueba.ts"`)

**Interfaces:**
- Consumes: Prisma (`Business`, `Member` y lo que use `seed-turnos-prueba.ts` para crear negocio y dueño; leerlo y copiar la forma), `ReservaConfig`, `ReservaRecurso`, `ReservaServicio`, `Reserva`, `ReservaBloqueo`.
- Produces: tres negocios en dev, que se pueden volver a sembrar:

  | slug | nombre | `industry` / `subrubros` | recursos |
  |---|---|---|---|
  | `canchas-prueba` | Complejo de Prueba | `alquileres` / `["canchas"]` | 4 `CANCHA` (los de `NEGOCIOS_DEMO.cancha`, 60 min, paso 60, hasta 3 seguidos, extras en `datos.extras`) |
  | `salones-prueba` | Salones de Prueba | `alquileres` / `["salon-cumples"]` | 2 `SALON` (bloque 240, margen 60, `datos.capacidad`), 2 paquetes por salón como `ReservaServicio` con `recursoIds` |
  | `cabanas-prueba` | Cabañas de Prueba | `alquileres` / `["cabana"]` | 3 `ALOJAMIENTO` (`datos`: `checkIn 840`, `checkOut 600`, `nochesMinimas 2`, tipo, huéspedes, camas, baños, comodidades, `latLng` de Iguazú) |

  Cada uno con `ReservaConfig` de `ALQUILERES` (`activo: true`, confirmación automática, retención 15 min, cancelación 48 h, seña 30 %), dueño `dueno@<slug>.invalid`, ~2 bloqueos y reservas en todos los estados (≈150 canchas, ≈40 salones, ≈25 estadías) entre 90 días atrás y 90 adelante, sin pisarse (respetar `reservas_sin_solapamiento`), clientes inventados con teléfonos que empiezan con `0000`.

- [ ] **Step 1: Write the seed**, copiando de `seed-turnos-prueba.ts` (en `origin/main`): el chequeo de la base de dev (`DEV_REF`/`PROD_REF`), la creación idempotente de negocio y dueño, la contraseña desde `ALQUILERES_PRUEBA_PASSWORD` (obligatoria la primera vez, nunca impresa), y el borrado + re-armado de recursos, servicios, bloqueos y reservas alrededor de hoy.

- [ ] **Step 2: Generar la contraseña de prueba y guardarla en `apps/api/.env`** como `ALQUILERES_PRUEBA_PASSWORD` (archivo local, fuera de git). No escribirla en el chat ni en ningún archivo commiteado.

- [ ] **Step 3: Run it against dev**
  Run: `cd apps/api && pnpm seed:alquileres-prueba`
  Expected: termina sin error e imprime, por negocio, cuántos recursos, bloqueos y reservas creó (sin URL ni contraseña).

- [ ] **Step 4: Run it again** (idempotencia) — Expected: mismos conteos, sin duplicar negocios ni dueños.

- [ ] **Step 5: Commit**
  `git commit -m "feat(alquileres): negocios de prueba en dev, uno por modo (pnpm seed:alquileres-prueba)"`

---

### Task 5: Página local del panel con la API

**Files:**
- Create: `apps/web/src/pages/panel/alquileres.tsx`

**Interfaces:**
- Consumes: `RequireAuth` (`@/lib/auth/RequireAuth`), `Panel` de Alquileres, `OrigenAlquileresProvider` (Task 2), `origenApi` (Task 3).
- Produces: `/panel/alquileres` en local (`notFound` cuando `NODE_ENV === 'production'`), con comentario de cabecera que explica cómo probarla (como `pages/panel/turnos.tsx`).

- [ ] **Step 1: Create the page** igual que `pages/panel/turnos.tsx` de `origin/main`, con `RequireAuth type="member"` y `<OrigenAlquileresProvider origen={origenApi}><Panel /></OrigenAlquileresProvider>`.

- [ ] **Step 2: Verify in the browser** — API y front en local; entrar como el dueño de cada negocio de prueba (contraseña de `apps/api/.env`, no se escribe en el chat) en `<slug>.orbita.local:3001/panel/alquileres`:
  - `cabanas-prueba`: sidebar de estadía, las 3 propiedades en Propiedades, el calendario con las estadías sembradas, la franja de "todavía no se guarda".
  - `canchas-prueba` y `salones-prueba`: lo mismo en su modo.
  - Sin errores en consola; captura de cada uno.

- [ ] **Step 3: Commit**
  `git commit -m "feat(alquileres): /panel/alquileres en local con el origen de la API"`

---

### Task 6: Auditoría y decisiones (Superadmin → Módulos)

**Files:**
- Modify: `apps/web/src/modules/superadmin/modulos/entradas.ts` (tres entradas de Alquileres, fecha 18/11)
- Modify: `apps/web/src/modules/superadmin/modulos/plan.ts` (envolver con `documentada()` las tareas de Alquileres del 05/11 y 06/11 que se hicieron)
- Modify: `apps/web/src/modules/superadmin/modulos/decisiones.ts` (una `decisionAbierta` de Alquileres para Ale)
- Test: `apps/web/src/modules/superadmin/modulos/datos.test.ts` (ya existe; tiene que seguir en verde)

**Interfaces:**
- Consumes: `entrada(...)`, `documentada(tarea, clave)`, `decisionAbierta(...)` con la forma que ya usan las de Turnos (mirar `mapa-sobre-el-backend` y `capa-de-datos-por-origen` de Mateo).
- Produces:
  - `auditoria.alquileres.2026-11-18-mapa-sobre-el-backend` (tipo tarea): el mapa de la § 5 del spec y los faltantes F1–F18 de la § 6, resumidos al formato de la entrada de Turnos.
  - `auditoria.alquileres.2026-11-18-capa-de-datos-por-origen` (tipo tarea): lo de las Tasks 1–3 y 5.
  - `auditoria.alquileres.2026-11-18-negocios-de-prueba` (tipo tarea): lo de la Task 4.
  - Decisión abierta `alquileres-lo-que-decide-ale` (decide Ale): la lista de la § 9 del spec, en ese orden.
  - En `plan.ts`: `documentada()` en "Leer el contrato… mapa pantalla → ruta" (05/11), "Crear el negocio de prueba…" (05/11) y "Separar en el panel… la capa de datos" (06/11). La del 06/11 "Definir con Ale…" queda sin documentar (es la decisión abierta).

- [ ] **Step 1: Write the entries and the decision.**
- [ ] **Step 2: Run tests**
  Run: `cd apps/web && pnpm exec vitest run src/modules/superadmin`
  Expected: PASS.
- [ ] **Step 3: Commit**
  `git commit -m "docs(alquileres): el mapa sobre el backend, la capa de datos y los negocios de prueba en Auditoría; lo que decide Ale"`

---

### Task 7: Verificación final

- [ ] **Step 1:** `cd apps/web && pnpm exec tsc --noEmit` → sin errores.
- [ ] **Step 2:** `cd apps/web && pnpm exec eslint src/modules/alquileres src/pages/panel/alquileres.tsx src/modules/superadmin/modulos` → sin errores.
- [ ] **Step 3:** `cd apps/web && pnpm test` → en verde (incluye el chequeo del manual del panel; no se tocó ninguna pantalla del manual).
- [ ] **Step 4:** `cd apps/api && pnpm exec tsc --noEmit` → sin errores (el seed compila).
- [ ] **Step 5:** `/alquileres-demo` en el navegador, los tres modos, igual que antes.
- [ ] **Step 6:** `graphify update .`
