# Alquileres: estadísticas de la estadía y ganancias de Airbnb — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un alojamiento importe el archivo de ganancias de Airbnb y vea sus estadísticas (ocupación, ingresos por canal, precio por noche) contando esa plata y esas noches una sola vez.

**Architecture:** un módulo nuevo de la API, `apps/api/src/alquileres/`, al lado del motor de reservas (como Gimnasio): una función pura que lee el CSV, dos tablas propias y cuatro rutas del panel. En el front, una función pura calcula las estadísticas con lo que el panel ya tiene cargado más lo importado; la pantalla "Ingresos" de la estadía pasa a ser "Estadísticas" y la pantalla "Airbnb" suma la importación.

**Tech Stack:** NestJS 11 + Prisma 6 (Postgres), Next.js pages router + React 19, jest (API), vitest (web), kit `rv-` de `design-system/reservas`.

**Spec:** `docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md` (y §§ 7.2 y 7.6 de `docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md`).

## Global Constraints

- Del motor compartido (`apps/api/src/reservas/`, `apps/web/src/lib/reservas*`) cambia **una sola cosa**: qué bloqueos borra la sincronización de un calendario de Airbnb (tarea 9). Nada más. Lo demás se usa por sus servicios exportados.
- Todo se mide **por noches** sobre el tramo `[desde, min(hasta, hoy)]`; la plata de una estadía se reparte entre sus noches.
- Toda consulta de Prisma filtra por `businessId` (lo cuida `test/unit/aislamiento-consultas.unit-spec.ts`). `businessId` sale del token (`assertMemberContext`), nunca de la URL ni del cuerpo.
- Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` en su migración (lo cuida `test/unit/rls-supabase.unit-spec.ts`).
- Permisos: ver lo importado, `reservas.view`; importar y borrar, `reservas.config`.
- La columna se reconoce **por nombre**, nunca por posición. Si falta una columna necesaria no se guarda nada.
- Nunca se suman montos de monedas distintas. Los totales en pesos suman solo filas con moneda `ARS`.
- Una noche que aparece por dos lados (reserva, bloqueo de Airbnb, estadía importada) cuenta una vez.
- El texto del archivo no se guarda ni se escribe en logs. El nombre del huésped no sale del panel.
- Topes: `MAXIMO_BYTES_CSV = 2_000_000`, `MAXIMO_FILAS_CSV = 5_000`.
- Textos en castellano rioplatense, listos para mostrar. Sin colores fijos: tokens del kit. Probado a 390, 768 y 1280 sin scroll horizontal, en claro y oscuro.
- Antes de tocar una pantalla: skill `ui-ux-pro-max`.
- Máquina de Alan: una suite pesada por vez, `--maxWorkers=2`; parar los servidores locales al terminar.
- Migración: se aplica en **dev** en la tarea 2. En producción, recién al subir (no es parte de este plan: se pide permiso).
- No se usa `prisma format` (reacomoda modelos ajenos).

## Review Focus

1. **Archivo en castellano con punto y coma y coma decimal** (lo que probablemente exporta un anfitrión argentino): tiene que leerse igual que el de inglés con comas. Test en la tarea 1.
2. **El mismo archivo importado dos veces**, y uno más nuevo con un monto corregido: no duplica y actualiza. Test en la tarea 3.
3. **Una estadía importada sobre noches de una reserva propia** de la misma propiedad: las noches cuentan una vez y el cruce se informa. Test en la tarea 4.
4. **Pesos y dólares en el mismo período:** el total en pesos no incluye los dólares, y el precio por noche tampoco. Test en la tarea 4.
5. **Un aviso unido a una propiedad de otro negocio, o a algo que no es un alojamiento:** se rechaza sin guardar nada. Test en la tarea 3.

---

### Task 1: Leer el archivo de Airbnb

**Files:**
- Create: `apps/api/src/alquileres/dominio/csv-airbnb.ts`
- Test: `apps/api/src/alquileres/dominio/csv-airbnb.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export const MAXIMO_BYTES_CSV = 2_000_000;
  export const MAXIMO_FILAS_CSV = 5_000;
  export interface EstadiaLeida {
    codigo: string; aviso: string;
    entrada: string; salida: string; noches: number;   // AAAA-MM-DD; salida = entrada + noches
    huesped: string | null;
    montoBruto: number; comision: number; limpieza: number; montoNeto: number;
    moneda: string;                                     // en mayúsculas, 3 letras
  }
  export interface FilaDescartada { linea: number; motivo: string }
  export type LecturaCsv =
    | { ok: true; estadias: EstadiaLeida[]; descartadas: FilaDescartada[]; otrasFilas: number }
    | { ok: false; motivo: string };
  export function leerCsvDeAirbnb(texto: string): LecturaCsv;
  ```

Nombres de columna aceptados (sin distinguir mayúsculas, acentos ni espacios de más):

| Dato | Encabezados |
|---|---|
| código | `Confirmation Code`, `Código de confirmación`, `Codigo de confirmacion` |
| inicio | `Start Date`, `Fecha de inicio`, `Fecha de llegada`, `Check-in` |
| fin (opcional) | `End Date`, `Fecha de finalización`, `Fecha de salida`, `Check-out` |
| noches | `Nights`, `Noches` |
| huésped (opcional) | `Guest`, `Huésped` |
| aviso | `Listing`, `Anuncio`, `Alojamiento` |
| moneda | `Currency`, `Moneda` |
| neto | `Amount`, `Monto`, `Importe` |
| comisión (opcional) | `Host Fee`, `Service Fee`, `Tarifa de servicio`, `Tarifa por servicio`, `Comisión de servicio` |
| limpieza (opcional) | `Cleaning Fee`, `Tarifa de limpieza`, `Gastos de limpieza` |
| bruto (opcional) | `Gross Earnings`, `Ganancias brutas`, `Ingresos brutos` |

- [ ] **Step 1: Write the failing tests**

```ts
const EN = [
  'Date,Type,Confirmation Code,Start Date,Nights,Guest,Listing,Details,Reference,Currency,Amount,Paid Out,Host Fee,Cleaning Fee',
  '12/28/2026,Reservation,HMABC12345,12/20/2026,7,Ana Pérez,"Cabaña del Monte, con pileta",,,ARS,580000.00,,17400.00,10000.00',
  '12/29/2026,Payout,,,,,,Transfer to bank,,ARS,,580000.00,,',
].join('\r\n');

it('lee una reserva: fechas, noches, salida, huésped, aviso con coma entre comillas y plata', () => {
  const r = leerCsvDeAirbnb(EN);
  expect(r).toEqual({ ok: true, otrasFilas: 1, descartadas: [], estadias: [{
    codigo: 'HMABC12345', aviso: 'Cabaña del Monte, con pileta', entrada: '2026-12-20', salida: '2026-12-27', noches: 7,
    huesped: 'Ana Pérez', montoNeto: 580000, comision: 17400, limpieza: 10000, montoBruto: 597400, moneda: 'ARS',
  }] });
});

it('en castellano, con punto y coma, coma decimal y marca de inicio de archivo, da lo mismo', () => {
  const ES = '﻿' + [
    'Fecha;Tipo;Código de confirmación;Fecha de inicio;Noches;Huésped;Anuncio;Moneda;Monto;Tarifa de servicio;Tarifa de limpieza',
    '28/12/2026;Reservación;HMABC12345;20/12/2026;7;Ana Pérez;Cabaña del Monte, con pileta;ARS;580.000,00;17.400,00;10.000,00',
  ].join('\n');
  const r = leerCsvDeAirbnb(ES);
  expect(r.ok && r.estadias).toEqual((leerCsvDeAirbnb(EN) as { estadias: unknown }).estadias);
});

it('las columnas se reconocen por nombre, en cualquier orden', () => { /* mismas columnas de EN en otro orden → mismo resultado */ });
it('una fila de ajuste con el mismo código se suma a su estadía, diga lo que diga su tipo; una devolución total la deja en cero', () => {
  /* Reservation HM1 580000 + "Resolution Adjustment" HM1 -580000 → una estadía con montoNeto 0 (se devuelve igual: quien la usa decide) */
});
it('el orden de las fechas se decide con todo el archivo: alcanza la fecha de un pago con día mayor que 12', () => {
  /* fila de pago "25/01/2027" + reserva con inicio "05/01/2027" → entrada 2027-01-05 (día/mes) */
});
it('si ninguna fecha lo define, un archivo en castellano se lee día/mes y uno en inglés, mes/día', () => {
  /* "Fecha de inicio" 05/01/2027 → 2027-01-05 ; "Start Date" 05/01/2027 → 2027-05-01 */
});
it('si viene la columna de ganancias brutas, se usa esa', () => { /* Gross Earnings 600000 → montoBruto 600000 */ });
it('dos filas con el mismo código se suman en una estadía', () => { /* 290000 + 290000 → montoNeto 580000, una estadía */ });
it('un archivo con día/mes/año (un primer número mayor que 12 en alguna fecha) se lee entero así', () => { /* 20/12/2026 y 05/01/2027 → 2027-01-05 */ });
it('una fecha que no se entiende deja esa fila afuera, con su línea y su motivo', () => {
  /* Start Date "pronto" → descartadas: [{ linea: 2, motivo: 'No se entiende la fecha de inicio.' }] y estadias: [] */
});
it('un monto negativo entre paréntesis o con signo se lee negativo', () => { /* "(1,200.50)" → -1200.5 ; "-1.200,50" → -1200.5 */ });
it('si falta una columna necesaria no se lee nada y se dice cuál', () => {
  expect(leerCsvDeAirbnb('Date,Type,Start Date,Nights,Listing,Currency,Amount\n1/1/2027,Reservation,1/1/2027,2,X,ARS,10'))
    .toEqual({ ok: false, motivo: 'Al archivo le falta la columna del código de confirmación. Descargalo de Airbnb con todas las columnas.' });
});
it('un archivo sin encabezado, vacío, o que no es un CSV se rechaza', () => {
  expect(leerCsvDeAirbnb('')).toEqual({ ok: false, motivo: 'El archivo está vacío.' });
  expect(leerCsvDeAirbnb('<html><body>Iniciá sesión</body></html>')).toMatchObject({ ok: false });
});
it('más de 5.000 filas o más de 2 MB se rechaza', () => { /* motivo: 'El archivo es demasiado grande. Descargalo por año.' */ });
it('sin columna de fin, la salida es la entrada más las noches; con columna de fin y sin noches, al revés', () => {});
it('la moneda sale en mayúsculas y un salto de línea dentro de comillas no corta la fila', () => {});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && pnpm exec jest --config ./test/jest-src.json --maxWorkers=2 alquileres/dominio`
Expected: FAIL, "Cannot find module './csv-airbnb'".

- [ ] **Step 3: Implement `leerCsvDeAirbnb` in `csv-airbnb.ts`**

Separador: el que más aparece en la primera línea fuera de comillas, entre `,` y `;`. Montos: el último `,` o `.` seguido de uno o dos dígitos al final es el decimal; el resto de los separadores se quitan. Fechas: el orden se decide una vez, mirando **todas** las columnas de fecha del archivo (inicio, fin y la primera columna, `Date`/`Fecha`): un primer número mayor que 12 en cualquiera → `D/M/AAAA`; un segundo mayor que 12 → `M/D/AAAA`; sin evidencia, `D/M` si los encabezados reconocidos están en castellano y `M/D` si están en inglés. También se acepta `AAAA-MM-DD`. Una fila es de una estadía si tiene código y fecha de inicio, sin mirar su tipo; las demás suman a `otrasFilas`. Las filas con el mismo código se suman (también si alguna es negativa). `linea` cuenta desde 1 con el encabezado como línea 1. Las columnas opcionales que faltan valen 0 (o `null` el huésped); `montoBruto` es la columna de brutas si viene y es mayor que 0, si no `montoNeto + comision`.

- [ ] **Step 4: Run to verify they pass**

Run: el mismo comando. Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/alquileres/dominio && git commit -m "feat(alquileres): leer el archivo de ganancias de Airbnb"
```

---

### Task 2: Las dos tablas

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (dos modelos al final del bloque de reservas; dos relaciones en `Business`; dos en `ReservaRecurso`)
- Create: `apps/api/prisma/migrations/20261126120000_alquileres_ingresos_externos/migration.sql`

**Interfaces:**
- Produces (nombres de Prisma que usa la tarea 3):
  ```prisma
  model AlquilerIngresoExterno {   // @@map("alquileres_ingresos_externos")
    id String @id @default(uuid())
    businessId String @map("business_id")
    recursoId String @map("recurso_id")
    canal String @db.VarChar(20)                 // hoy: "airbnb"
    codigoExterno String @map("codigo_externo") @db.VarChar(40)
    entrada String @db.VarChar(10)
    salida String @db.VarChar(10)
    noches Int
    huesped String? @db.VarChar(120)
    montoBruto Decimal @map("monto_bruto") @db.Decimal(14, 2)
    comision Decimal @db.Decimal(14, 2)
    limpieza Decimal @db.Decimal(14, 2)
    montoNeto Decimal @map("monto_neto") @db.Decimal(14, 2)
    moneda String @db.VarChar(3)
    importadoEn DateTime @map("importado_en")
    @@unique([businessId, canal, codigoExterno])
    @@index([businessId, entrada])
  }
  model AlquilerAvisoExterno {     // @@map("alquileres_avisos_externos")
    id String @id @default(uuid())
    businessId String @map("business_id")
    canal String @db.VarChar(20)
    nombreExterno String @map("nombre_externo") @db.VarChar(200)
    recursoId String @map("recurso_id")
    @@unique([businessId, canal, nombreExterno])
  }
  ```
  Las dos con relación a `Business` y a `ReservaRecurso` (`onDelete: Restrict`, como el resto).

- [ ] **Step 1: Agregar los modelos y las relaciones al schema** (a mano, sin `prisma format`).
- [ ] **Step 2: Escribir la migración**: `CREATE TABLE` de las dos, sus índices y claves foráneas, y `ALTER TABLE … ENABLE ROW LEVEL SECURITY` para cada una. Un comentario arriba que diga que son tablas nuevas de Alquileres y no tocan ninguna otra.
- [ ] **Step 3: Validar y aplicar en dev**

Run: `cd apps/api && pnpm exec prisma validate && pnpm exec prisma migrate deploy && pnpm exec prisma generate`
Expected: "The schema … is valid", "1 migration … applied" (la base es la de dev: el `.env` local).

- [ ] **Step 4: Confirmar que la migración y el schema dicen lo mismo, y los dos tests que cuidan las tablas**

Run: `pnpm exec prisma migrate status` → "Database schema is up to date!"
Run: `pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 rls-supabase` → PASS.
Run: `pnpm exec tsc --noEmit` → sin salida.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma && git commit -m "feat(alquileres): tablas de ingresos de afuera y de avisos unidos a propiedades"
```

---

### Task 3: Importar, listar y borrar (API)

**Files:**
- Create: `apps/api/src/alquileres/alquileres-ingresos.service.ts`, `apps/api/src/alquileres/alquileres-panel.controller.ts`, `apps/api/src/alquileres/alquileres.module.ts`, `apps/api/src/alquileres/dto/ingresos.dto.ts`, `apps/api/src/alquileres/README.md`
- Modify: `apps/api/src/app.module.ts` (registrar `AlquileresModule` después de `GimnasioModule`)
- Test: `apps/api/test/unit/alquileres.ingresos.unit-spec.ts`

**Interfaces:**
- Consumes: `leerCsvDeAirbnb`, `EstadiaLeida`, `FilaDescartada` (tarea 1); `prisma.alquilerIngresoExterno`, `prisma.alquilerAvisoExterno` (tarea 2); `ReservasCatalogoService.recurso(businessId, id)` (lo exporta `ReservasModule`; tira 404 si no es del negocio).
- Produces:
  ```ts
  export interface VistaPreviaDto {
    estadias: number; desde: string | null; hasta: string | null;          // primera entrada y última salida
    totales: { moneda: string; neto: number; estadias: number }[];
    descartadas: FilaDescartada[]; otrasFilas: number;
    avisos: { nombre: string; estadias: number; recursoId: string | null }[]; // recursoId: la unión guardada, si sigue existiendo
  }
  export interface ImportadoDto { creadas: number; actualizadas: number; sinImportar: number }
  export interface IngresoExternoDto {
    id: string; recursoId: string; canal: 'airbnb'; codigo: string;
    entrada: string; salida: string; noches: number; huesped: string | null;
    montoBruto: number; comision: number; limpieza: number; montoNeto: number; moneda: string;
  }
  export interface IngresosDto { filas: IngresoExternoDto[]; resumen: { estadias: number; ultimaImportacion: string | null; hasta: string | null } }

  class AlquileresIngresosService {
    vistaPrevia(businessId: string, texto: string): Promise<VistaPreviaDto>;
    importar(businessId: string, memberId: string, dto: { texto: string; avisos: { nombre: string; recursoId: string | null }[] }, ahora?: Date): Promise<ImportadoDto>;
    listar(businessId: string, desde: string, hasta: string): Promise<IngresosDto>;   // filas con entrada <= hasta y salida > desde; resumen de todo el negocio
    borrarTodo(businessId: string, memberId: string, canal: 'airbnb'): Promise<{ ok: true; borradas: number }>;
  }
  ```
  Rutas (controller `alquileres`, `businessId` del token):
  | Ruta | Permiso |
  |---|---|
  | `POST /alquileres/ingresos/airbnb/vista-previa` `{ texto }` | `reservas.config`, `@Throttle` 10/min |
  | `POST /alquileres/ingresos/airbnb/importar` `{ texto, avisos }` | `reservas.config`, `@Throttle` 6/min |
  | `GET /alquileres/ingresos?desde&hasta` | `reservas.view` |
  | `DELETE /alquileres/ingresos/airbnb` | `reservas.config` |

- [ ] **Step 1: Write the failing tests** (base simulada con un `tabla()` como el de `test/unit/reservas.calendarios.unit-spec.ts`, copiado al archivo; `catalogo.recurso` falso que tira `NotFoundException` si el recurso no es del negocio)

```ts
it('la vista previa cuenta estadías, rango y totales por moneda, y no guarda nada', async () => {
  // CSV: 2 estadías en ARS (580000 y 120000) y 1 en USD (300) → totales [{ARS, 700000, 2}, {USD, 300, 1}]
  // desde = la menor entrada, hasta = la mayor salida; ninguna tabla recibió create ni update
});
it('la vista previa trae cada aviso con la propiedad que ya tiene unida; una unión a una propiedad borrada no cuenta', async () => {});
it('un archivo que no se entiende es un 400 con el motivo del lector', async () => {
  await expect(svc.vistaPrevia(BIZ, 'hola')).rejects.toThrow(BadRequestException);
});
it('importar guarda una fila por estadía, con su propiedad, y la unión de cada aviso', async () => {
  // → { creadas: 2, actualizadas: 0, sinImportar: 0 }; filas con businessId BIZ, canal 'airbnb', importadoEn AHORA
});
it('importar el mismo archivo otra vez no duplica; uno más nuevo con otro monto actualiza', async () => {
  // segunda vez → { creadas: 0, actualizadas: 2, sinImportar: 0 }; sigue habiendo 2 filas; el monto es el nuevo
});
it('un aviso marcado "no importar" (recursoId null) deja sus estadías afuera y se cuenta', async () => {
  // → sinImportar: 1; no se guarda unión para ese aviso
});
it('un aviso del archivo que no viene en la lista es un 400: hay que decidir cada uno', async () => {
  // motivo: 'Falta decir a qué propiedad corresponde "Depto Centro".'
});
it('una propiedad de otro negocio, o que no es un alojamiento, es un rechazo y no se guarda nada', async () => {
  // catalogo.recurso tira NotFound → se propaga; recurso tipo 'CANCHA' → BadRequest 'Las ganancias de Airbnb se unen a un alojamiento.'
  // en los dos casos: alquilerIngresoExterno.filas y alquilerAvisoExterno.filas quedan vacías
});
it('cambiar la unión de un aviso al reimportar mueve sus estadías a la otra propiedad', async () => {});
it('listar devuelve las que tocan el rango, con los montos como números, y el resumen de todo', async () => {
  // rango 2026-12-01..2026-12-31: entra la que sale el 2 de diciembre y la que entra el 31; no la que sale el 1
});
it('borrar todo quita las estadías del canal y conserva las uniones', async () => {});
it('nada de un negocio se ve ni se borra desde otro', async () => {});
it('permisos: ver pide reservas.view; vista previa, importar y borrar, reservas.config', () => {
  // Reflect.getMetadata(PERMISSION_KEY, AlquileresPanelController.prototype[metodo])
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 alquileres.ingresos`
Expected: FAIL, no existe el service.

- [ ] **Step 3: Implement** el service, los DTO (`texto`: `@IsString() @MaxLength(MAXIMO_BYTES_CSV)`; `avisos`: arreglo de hasta 200 con `nombre` de hasta 200 y `recursoId` uuid o `null`), el controller y el módulo (`imports: [ReservasModule]`).

`importar` valida todo antes de escribir (cada aviso del archivo tiene decisión; cada recurso es del negocio, de módulo `ALQUILERES` y tipo `ALOJAMIENTO`) y escribe en **una transacción**: uniones (upsert por negocio, canal y nombre) y estadías (upsert por negocio, canal y código). Registra en auditoría una sola entrada (`entityType: 'alquiler_ingresos'`, `action: 'CREATE'`, con las cantidades; sin nombres de huéspedes ni el texto). `borrarTodo` registra `action: 'DELETE'`.

- [ ] **Step 4: Run to verify they pass, y lo que cuida el aislamiento**

Run: `pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 alquileres.ingresos aislamiento-consultas`
Expected: PASS.
Run: `pnpm exec tsc --noEmit` → sin salida.

- [ ] **Step 5: Escribir `apps/api/src/alquileres/README.md`**: qué es el módulo, las cuatro rutas con su permiso, las reglas (por nombre de columna, todo o nada, una fila por código, monedas sin mezclar, el archivo no se guarda) y que no toca el motor.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/alquileres apps/api/src/app.module.ts apps/api/test/unit/alquileres.ingresos.unit-spec.ts
git commit -m "feat(alquileres): importar las ganancias de Airbnb desde el panel"
```

---

### Task 4: Las cuentas de las estadísticas (front, función pura)

**Files:**
- Create: `apps/web/src/modules/alquileres/datos/estadisticas.ts`
- Modify: `apps/web/src/modules/alquileres/datos/index.ts` (tipo `IngresoExterno`; `NegocioAlquiler.ingresosExternos?: IngresoExterno[]`; dos estadías de ejemplo en la demo de estadía, en la propiedad `c2`, una del mes anterior a `HOY` y una del mes de `HOY`)
- Test: `apps/web/src/modules/alquileres/datos/__tests__/estadisticas.test.ts`

**Interfaces:**
- Consumes: `Reserva` (con `canal?`, `entrada`, `salida`, `creada`, `total`, `estado`), `Bloqueo` (con `origen`, `externoTipo?`), `Propiedad` de `datos/index.ts`; `diasEntre`, `sumarDias` de `@/lib/reservas/fechas`.
- Produces:
  ```ts
  // datos/index.ts
  export interface IngresoExterno {
    id: string; unidadId: string; canal: 'airbnb'; codigo: string;
    entrada: ISO; salida: ISO; noches: number; huesped?: string;
    neto: number; bruto: number; comision: number; moneda: string;
  }
  // datos/estadisticas.ts
  export type Canal = 'directo' | 'sitio' | 'airbnb';
  export interface NumerosDePropiedad { unidadId: string; nombre: string; nochesDisponibles: number; nochesOcupadas: number; ocupacion: number; ingresos: number; precioPorNoche: number | null }
  export interface EstadisticasEstadia {
    nochesDisponibles: number; nochesOcupadas: number; ocupacion: number;      // 0..1
    ingresos: number;                                                            // pesos: propias + Airbnb en ARS (neto), repartidos por noche
    porCanal: Record<Canal, { estadias: number; ingresos: number }>;             // ingresos en pesos
    otrasMonedas: { moneda: string; neto: number; estadias: number }[];
    nochesVendidas: number; precioPorNoche: number | null; ingresoPorNocheDisponible: number | null;
    estadiaPromedio: number | null; anticipacionPromedio: number | null;
    /** Lo ya reservado de mañana al fin del período (pesos y noches); ceros si el período ya terminó. */
    porVenir: { ingresos: number; noches: number };
    porPropiedad: NumerosDePropiedad[];
    cruces: { codigo: string; unidadId: string; entrada: ISO; salida: ISO; reservaId: string }[];
  }
  export function estadisticasDeEstadia(
    n: Pick<NegocioAlquiler, 'propiedades' | 'bloqueos' | 'ingresosExternos'>, reservas: Reserva[],
    desde: ISO, hasta: ISO, hoy: ISO,
  ): EstadisticasEstadia;
  /** La estadía importada que corresponde a un bloqueo de Airbnb: misma propiedad y mismas fechas. */
  export function estadiaDelBloqueo(b: Bloqueo, externos: IngresoExterno[] | undefined): IngresoExterno | undefined;
  ```

Reglas (de la spec, "Que nada se cuente dos veces" y "Estadísticas"):

- **El tramo** son las noches de `desde` a `min(hasta, hoy)`, las dos incluidas. Todo lo de abajo, salvo `porVenir`, mira solo esas noches.
- **Cuentan** las reservas `confirmada` y `completada`, y las estadías importadas con `neto > 0`.
- **Noches ocupadas** de una propiedad: el conjunto de las noches del tramo de sus reservas que cuentan, de sus bloqueos `ical` con `externoTipo !== 'CERRADO'` y de sus estadías importadas que cuentan.
- **Noches disponibles:** las del tramo menos las bloqueadas (por el dueño, o `ical` con `externoTipo === 'CERRADO'`) que no estén ocupadas.
- **Plata repartida:** una estadía aporta `monto × (sus noches en el tramo ÷ sus noches)`. `monto` es `total` en una reserva y `neto` en una importada.
- **`ingresos`:** reservas propias más importadas en `ARS`. **`nochesVendidas`:** las noches en el tramo de esas mismas estadías (suma, no conjunto). `precioPorNoche = ingresos ÷ nochesVendidas`; `ingresoPorNocheDisponible = ingresos ÷ nochesDisponibles`; `null` si el divisor es 0.
- **`porCanal`:** una reserva sin `canal` es `directo`. `estadias` cuenta las que tienen alguna noche en el tramo. Una importada que no es `ARS` suma a `estadias` de `airbnb` y a `otrasMonedas` (su neto repartido), no a `ingresos`.
- **`estadiaPromedio`:** el largo entero de las estadías con alguna noche en el tramo (propias e importadas). **`anticipacionPromedio`:** `diasEntre(creada, entrada)` de las propias con alguna noche en el tramo.
- **`porVenir`:** lo mismo que `ingresos` y `nochesVendidas`, para las noches de mañana a `hasta`.
- **Un cruce:** una estadía importada que cuenta y comparte al menos una noche con una reserva propia que cuenta, en la misma propiedad, si alguna de las dos toca `[desde, hasta]`.
- Sin redondear adentro: la pantalla redondea al mostrar.

- [ ] **Step 1: Write the failing tests**

```ts
// Dos propiedades (p1, p2). Período: 2026-12-01 a 2026-12-31. hoy: 2026-12-31, salvo que se diga → 31 noches por propiedad.
it('ocupación: noches ocupadas sobre disponibles, sin contar lo que bloqueó el dueño', () => {
  // p1: reserva 10→15 (5 noches) + bloqueo del dueño 20→22 (2). p2: nada.
  // nochesDisponibles = 31 - 2 + 31 = 60; nochesOcupadas = 5; ocupacion = 5/60
});
it('lo que el dueño cerró a mano en Airbnb tampoco es disponible, ni es ocupación', () => {
  // p1: bloqueo ical CERRADO 20→22 → nochesDisponibles 60; nochesOcupadas 0
});
it('todo mira hasta hoy, y lo que falta del período va aparte', () => {
  // hoy 2026-12-10. p1: reserva 10→15, total 250000.
  // nochesDisponibles 20 (10 por propiedad); nochesOcupadas 1 (la del 10); ingresos 50000 (1 de 5 noches)
  // porVenir { ingresos: 200000, noches: 4 }
});
it('una noche que está por dos lados cuenta una vez', () => {
  // p1: bloqueo ical RESERVADO 10→15 y estadía importada HM1 10→15 → nochesOcupadas 5, no 10
});
it('las noches de una estadía importada cuentan aunque no haya bloqueo', () => {});
it('ingresos por canal, con la plata repartida por noche en el borde del período', () => {
  // directo: 12/10→12/12, 100000. sitio: 12/12→12/13, 50000. HM1 (ARS): 12/20→12/27, neto 580000.
  // directo que entra 11/28 y sale 12/02, total 80000: de sus 4 noches, 1 cae en diciembre → 20000.
  // → ingresos 750000; porCanal: directo { estadias: 2, ingresos: 120000 }, sitio { 1, 50000 }, airbnb { 1, 580000 }
});
it('pesos y dólares no se suman: lo que no es ARS va aparte y no entra en los promedios', () => {
  // directo 12/10→12/12, 100000 (2 noches) + HM2 12/15→12/18, neto 300 USD (3 noches)
  // → ingresos 100000; otrasMonedas [{ moneda: 'USD', neto: 300, estadias: 1 }]; precioPorNoche 50000
  //   porCanal.airbnb { estadias: 1, ingresos: 0 }; nochesOcupadas 5
});
it('precio por noche, ingreso por noche disponible, estadía promedio y anticipación', () => {
  // A: creada 12/01, 12/10→12/15, 250000. B: creada 12/05, 12/20→12/23, 150000.
  // nochesVendidas 8; precioPorNoche 50000; ingresoPorNocheDisponible 400000 / 62; estadiaPromedio 4; anticipacionPromedio 12
});
it('sin nada en el período no inventa promedios', () => { /* precioPorNoche, estadiaPromedio, anticipacionPromedio → null; ocupacion 0 */ });
it('por propiedad: cada una con sus noches, su ocupación, sus ingresos y su precio por noche', () => {});
it('una pendiente o cancelada no cuenta, ni una importada con neto en cero (una devolución)', () => {});
it('una estadía importada que pisa una reserva propia es un cruce, y sus noches cuentan una vez', () => {
  // r1 10→15 en p1 y HM1 12→14 en p1 → nochesOcupadas 5; cruces [{ codigo: 'HM1', unidadId: 'p1', entrada: '2026-12-12', salida: '2026-12-14', reservaId: 'r1' }]
});
it('estadiaDelBloqueo: la importada de la misma propiedad y las mismas fechas; si no hay, undefined', () => {});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --maxWorkers=2 src/modules/alquileres/datos/__tests__/estadisticas.test.ts`
Expected: FAIL, no existe `../estadisticas`.

- [ ] **Step 3: Implement** `estadisticas.ts` y los cambios de tipos y de la demo en `datos/index.ts`.
- [ ] **Step 4: Run to verify they pass**: el mismo comando → PASS, 13 tests. Y `pnpm exec tsc --noEmit` → sin salida.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/alquileres/datos && git commit -m "feat(alquileres): las cuentas de las estadísticas de la estadía"
```

---

### Task 5: El panel lee y escribe las ganancias (cliente y origen)

**Files:**
- Create: `apps/web/src/modules/alquileres/datos/origen/alquileresApi.ts`
- Modify: `apps/web/src/modules/alquileres/datos/origen/mapear.ts` (`ingresoDeApi`), `apps/web/src/modules/alquileres/datos/origen/api.ts` (`cargarApi` trae los ingresos; `origenApi` expone `ganancias`), `apps/web/src/modules/alquileres/datos/origen/index.ts` (`DatosPanelAlquiler.ganancias?`)
- Test: `apps/web/src/modules/alquileres/datos/origen/__tests__/api.test.ts`, `.../__tests__/mapear.test.ts`

**Interfaces:**
- Consumes: las rutas y los DTO de la tarea 3; `IngresoExterno` de la tarea 4; `HechoConAviso` no hace falta.
- Produces:
  ```ts
  // alquileresApi.ts (mismo patrón que modules/gimnasio/datos/origen/gimnasioApi.ts)
  export interface VistaPreviaApi { estadias: number; desde: string | null; hasta: string | null; totales: { moneda: string; neto: number; estadias: number }[]; descartadas: { linea: number; motivo: string }[]; otrasFilas: number; avisos: { nombre: string; estadias: number; recursoId: string | null }[] }
  export interface ImportadoApi { creadas: number; actualizadas: number; sinImportar: number }
  export interface IngresoExternoApi { id: string; recursoId: string; canal: 'airbnb'; codigo: string; entrada: string; salida: string; noches: number; huesped: string | null; montoBruto: number; comision: number; limpieza: number; montoNeto: number; moneda: string }
  export interface IngresosApi { filas: IngresoExternoApi[]; resumen: { estadias: number; ultimaImportacion: string | null; hasta: string | null } }
  export const alquileresPanel = {
    ingresos: (desde: ISO, hasta: ISO) => Promise<IngresosApi>,
    vistaPreviaDeAirbnb: (texto: string) => Promise<VistaPreviaApi>,
    importarDeAirbnb: (texto: string, avisos: { nombre: string; recursoId: string | null }[]) => Promise<ImportadoApi>,
    borrarLoDeAirbnb: () => Promise<{ ok: true; borradas: number }>,
  };
  // mapear.ts
  export function ingresoDeApi(i: IngresoExternoApi): IngresoExterno;   // montoNeto → neto, montoBruto → bruto, huesped null → sin la clave
  // origen/index.ts
  export interface Ganancias {
    resumen: { estadias: number; ultimaImportacion: string | null; hasta: string | null };
    vistaPrevia(texto: string): Promise<VistaPreviaApi>;
    importar(texto: string, avisos: { nombre: string; recursoId: string | null }[]): Promise<ImportadoApi>;   // al terminar, recarga
    borrar(): Promise<void>;                                                                                       // al terminar, recarga
  }
  // DatosPanelAlquiler: ganancias?: Ganancias  (solo el origen de la API, y solo si el negocio es de estadía)
  ```

- [ ] **Step 1: Write the failing tests** (en `api.test.ts`, con `alquileresPanel` simulado igual que `panel`)

```ts
it('carga las estadías importadas del mismo rango que las reservas y las deja en el negocio', async () => {
  // alquileresPanel.ingresos llamado con (hoy - 186, hoy + 186); datos.negocio.ingresosExternos con unidadId = recursoId y neto = montoNeto
});
it('si la API todavía no tiene esa ruta (404), el panel carga igual, sin ganancias', async () => {});
it('cualquier otra falla al traerlas hace fallar la carga', async () => {});
it('importar llama a la API con el texto y las uniones, y recarga', async () => {});
it('si la API rechaza el archivo, llega su mensaje y no se recarga', async () => {});
it('borrar llama a la API y recarga', async () => {});
it('un negocio de canchas no pide ganancias', async () => { /* alquileresPanel.ingresos no se llama */ });
```
En `mapear.test.ts`: `ingresoDeApi` traduce una fila y no deja `huesped` cuando viene `null`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && pnpm exec vitest run --maxWorkers=2 src/modules/alquileres/datos/origen`
Expected: FAIL en los tests nuevos.

- [ ] **Step 3: Implement.** En `cargarApi`, el pedido de ingresos va en el mismo `Promise.all`, solo si el modo es estadía, con la misma tolerancia al 404 que ya tienen los calendarios. `ganancias` se arma en `useDatos` del origen de la API, con `recargar`.
- [ ] **Step 4: Run to verify they pass**: el mismo comando → PASS. `pnpm exec tsc --noEmit` → sin salida.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/alquileres/datos/origen && git commit -m "feat(alquileres): el panel trae e importa las ganancias de Airbnb"
```

---

### Task 6: La pantalla Estadísticas

**Files:**
- Create: `apps/web/src/modules/alquileres/admin/Estadisticas.tsx`
- Modify: `apps/web/src/modules/alquileres/admin/Panel.tsx` (en estadía, la vista `ingresos` monta `Estadisticas`), `apps/web/src/modules/alquileres/admin/navegacion.ts` (en estadía la sección `ingresos` se llama "Estadísticas"), `apps/web/src/modules/alquileres/admin/Ingresos.tsx` (exportar `periodoDe`, `periodoAnterior`, `variacion`, `PERIODOS` y `VS` para reusarlos; sacar la rama de estadía, que ya no se usa)
- Test: `apps/web/src/modules/alquileres/admin/__tests__/navegacion.test.ts` (si no existe, crearlo)

**Interfaces:**
- Consumes: `estadisticasDeEstadia`, `EstadisticasEstadia` (tarea 4); `negocio.ingresosExternos`; `Kpi`, `Barras`, `Encabezado`, `Filtros`, `Segmentado`, `Chip`, `Nota` del kit; `pesos` de `@/lib/reservas/precio`.
- Produces: `export default function Estadisticas(p: { negocio: NegocioAlquiler; reservas: Reserva[]; clientes: Cliente[]; onAbrirReserva: (id: string) => void; onIrAAirbnb?: () => void; importadoHasta?: string | null })`. `importadoHasta` es `ganancias?.resumen.hasta` (la demo no lo pasa).

Antes de escribir: skill `ui-ux-pro-max`.

Qué muestra, de arriba abajo, con el mismo armado que Ingresos:

1. Encabezado "Estadísticas" con el selector de período de siempre.
2. Si hay cruces: una nota de aviso, "Airbnb tiene una estadía sobre noches que también tenés reservadas acá", con código, propiedad y fechas de cada uno, y "Revisá a qué propiedad uniste ese aviso o si fue una doble reserva".
3. Cuatro números, todos sobre las noches del período hasta hoy: **Ocupación** (%, con "X de Y noches hasta hoy"), **Ingresos** (pesos, con "de las noches hasta hoy: propias + Airbnb neto de comisión"), **Precio por noche** (con "ingresos ÷ noches vendidas"), **Por noche disponible** (con "ingresos ÷ noches disponibles"). Cada uno con su variación contra el período anterior; sin datos antes, sin porcentaje.
4. Si el período no terminó y hay algo por venir: una línea, "Ya reservado para lo que queda del período: $ 200.000 en 4 noches."
5. Si hay otras monedas: una nota informativa, "Además, Airbnb te pagó USD 300 por 1 estadía. No se suma a los pesos."
6. Si hay algo importado y el período pasa de la última fecha importada (`ganancias.resumen.hasta`): "Las ganancias de Airbnb están importadas hasta el 5 de enero: lo de después cuenta como ocupación, sin plata."
7. Dos tarjetas: **De dónde vienen** (barras por canal: Directo, Tu sitio, Airbnb, en pesos, con la cantidad de estadías en el rótulo) y **Por propiedad** (una fila por propiedad: ocupación %, ingresos, precio por noche).
8. Dos números chicos: **Estadía promedio** ("3,5 noches") y **Anticipación** ("reservan 12 días antes", con "solo reservas propias").
9. **Por cobrar** y **Llegadas y salidas**, movidos tal cual desde Ingresos.
10. Si no hay nada importado y el negocio tiene un calendario de Airbnb conectado: nota "Las estadías de Airbnb que ya pasaron no figuran: importá tus ganancias para verlas", con el botón "Importar ganancias" (`onIrAAirbnb`).

- [ ] **Step 1: Write the failing test**

```ts
it('en la estadía, la sección de plata se llama Estadísticas; en canchas y salones sigue siendo Ingresos', () => {
  expect(seccionesDe('estadia').find(s => s.id === 'ingresos')?.label).toBe('Estadísticas');
  expect(seccionesDe('estadia', undefined, true).find(s => s.id === 'ingresos')?.label).toBe('Estadísticas');
  expect(seccionesDe('cancha').find(s => s.id === 'ingresos')?.label).toBe('Ingresos');
  expect(seccionesDe('bloque').find(s => s.id === 'ingresos')?.label).toBe('Ingresos');
});
```

- [ ] **Step 2: Run to verify it fails**: `cd apps/web && pnpm exec vitest run --maxWorkers=2 src/modules/alquileres/admin` → FAIL ("Ingresos" en estadía).
- [ ] **Step 3: Implement** la pantalla, el cambio de nombre y el montaje en `Panel.tsx` (`onIrAAirbnb={() => irA('calendarios')}`, solo en el panel real).
- [ ] **Step 4: Run to verify**: el mismo comando → PASS. `pnpm exec tsc --noEmit` → sin salida. `pnpm exec eslint src/modules/alquileres/admin` → sin errores.
- [ ] **Step 5: Mirarla en la demo** (`/alquileres-demo` en estadía, con las dos estadías de ejemplo): a 1280 y a 390, en claro y en oscuro, sin scroll horizontal; cambiar de período.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/alquileres/admin && git commit -m "feat(alquileres): Estadísticas de la estadía, con Airbnb y por canal"
```

---

### Task 7: Importar desde la pantalla de Airbnb

**Files:**
- Create: `apps/web/src/modules/alquileres/admin/configuracion/GananciasAirbnb.tsx`
- Modify: `apps/web/src/modules/alquileres/admin/configuracion/Airbnb.tsx` (monta la sección al final, si recibe `ganancias`), `apps/web/src/modules/alquileres/admin/Panel.tsx` (le pasa `n.ganancias` y `avisar`)
- Test: `apps/web/src/modules/alquileres/admin/__tests__/ganancias.test.ts`

**Interfaces:**
- Consumes: `Ganancias`, `VistaPreviaApi` (tarea 5); `ejecutar`, `Avisar` de `admin/acciones.ts`; `Seccion`, `Nota`, `Chip` del kit; `BotonConfirmar` de `admin/piezas`.
- Produces:
  ```ts
  export default function GananciasAirbnb(p: { ganancias: Ganancias; propiedades: { id: string; nombre: string }[]; avisar: Avisar }): JSX.Element;
  /** Las uniones que se mandan: la elegida para cada aviso; null si se eligió no importarlo; undefined si falta decidir alguno. */
  export function unionesListas(avisos: { nombre: string }[], elegidas: Record<string, string | null | undefined>): { nombre: string; recursoId: string | null }[] | undefined;
  /** Con una sola propiedad y sin unión guardada, se propone esa. */
  export function unionesPropuestas(avisos: { nombre: string; recursoId: string | null }[], propiedades: { id: string }[]): Record<string, string | null | undefined>;
  ```

Antes de escribir: skill `ui-ux-pro-max`.

Qué muestra: la sección "Ganancias de Airbnb", con tres pasos ("En Airbnb, andá a Ingresos…", "Descargá el archivo CSV con todas las columnas", "Elegilo acá"), el botón "Elegir archivo" (`<input type="file" accept=".csv,text/csv">`, leído con `file.text()`), y abajo "Última importación: hace 3 días · 14 estadías · hasta el 5 de enero" o "Todavía no importaste nada". Después de elegir: la vista previa ("14 estadías del 3 de julio al 5 de enero · $ 2.340.000 · USD 300"), las filas que quedaron afuera con su motivo (hasta 5 y "y N más"), un selector por aviso ("¿Cuál es *Cabaña del Monte, con pileta*?" → cada propiedad, o "No es de este negocio: no importar") y los botones "Importar" (deshabilitado hasta decidir todos los avisos; dice "Importando…" mientras tanto) y "Cancelar". Un archivo de más de 2 MB se rechaza en el navegador con el mismo mensaje del servidor, sin mandarlo. "Borrar todo lo importado" con confirmación, solo si hay algo.

- [ ] **Step 1: Write the failing tests**

```ts
it('unionesListas: con todos decididos devuelve la lista; si falta uno, undefined', () => {
  expect(unionesListas([{ nombre: 'A' }, { nombre: 'B' }], { A: 'p1', B: null })).toEqual([{ nombre: 'A', recursoId: 'p1' }, { nombre: 'B', recursoId: null }]);
  expect(unionesListas([{ nombre: 'A' }, { nombre: 'B' }], { A: 'p1' })).toBeUndefined();
});
it('unionesPropuestas: respeta la unión guardada; con una sola propiedad propone esa; con varias no adivina', () => {
  expect(unionesPropuestas([{ nombre: 'A', recursoId: 'p2' }], [{ id: 'p1' }, { id: 'p2' }])).toEqual({ A: 'p2' });
  expect(unionesPropuestas([{ nombre: 'A', recursoId: null }], [{ id: 'p1' }])).toEqual({ A: 'p1' });
  expect(unionesPropuestas([{ nombre: 'A', recursoId: null }], [{ id: 'p1' }, { id: 'p2' }])).toEqual({});
});
```

- [ ] **Step 2: Run to verify they fail**: `cd apps/web && pnpm exec vitest run --maxWorkers=2 src/modules/alquileres/admin` → FAIL.
- [ ] **Step 3: Implement.** Importar y borrar pasan por `ejecutar` (el aviso de error es de error; el de éxito dice "Ganancias importadas" con "N nuevas, M actualizadas").
- [ ] **Step 4: Run to verify**: el mismo comando → PASS. `tsc --noEmit` y `eslint` de la carpeta → sin errores.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/alquileres/admin && git commit -m "feat(alquileres): importar las ganancias de Airbnb desde su pantalla"
```

---

### Task 8: El bloqueo de Airbnb muestra su estadía

**Files:**
- Modify: `apps/web/src/modules/alquileres/admin/Reservas.tsx` (`ModalBloqueo` recibe `estadia?: IngresoExterno`; los dos lugares que lo montan le pasan `estadiaDelBloqueo(bloqueo, negocio.ingresosExternos)`)

**Interfaces:**
- Consumes: `estadiaDelBloqueo` (tarea 4, ya con su test).
- Produces: nada.

- [ ] **Step 1: Implement.** En la ficha de un bloqueo `ical`, si hay estadía: dos líneas más, "Huésped: Ana Pérez" (si vino) y "Airbnb pagó $ 580.000 (neto de comisión)" o con su moneda si no es ARS. Sin estadía, la ficha queda como está.
- [ ] **Step 2: Verificar**: `cd apps/web && pnpm exec tsc --noEmit` → sin salida; `pnpm exec vitest run --maxWorkers=2 src/modules/alquileres` → PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/alquileres/admin/Reservas.tsx && git commit -m "feat(alquileres): el bloqueo de Airbnb muestra el huésped y lo cobrado si se importó"
```

---

### Task 9: Las noches de Airbnb que ya pasaron se conservan

**Files:**
- Modify: `apps/api/src/reservas/calendarios/reservas-calendarios.service.ts` (`sincronizarUno`: qué se borra al reemplazar), `apps/api/src/reservas/README.md` (§ Calendarios externos)
- Test: `apps/api/test/unit/reservas.calendarios.unit-spec.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: ningún cambio de firma. Cambia un comportamiento: después de sincronizar, los bloqueos de ese calendario con `fin <= ahora` cuyo `externoUid` ya no viene en el archivo **siguen existiendo**.

Es el único cambio en el motor compartido. Solo corre en alojamientos con un calendario de Airbnb conectado.

- [ ] **Step 1: Write the failing tests**

```ts
it('una estadía de Airbnb que ya terminó y que Airbnb dejó de publicar queda como historia', async () => {
  // bloqueo del calendario cal-1 con fin anterior a AHORA y externoUid 'viejo'; el archivo trae solo 'a' (futuro)
  // después de sincronizar: quedan 'viejo' y 'a'
});
it('una que todavía no terminó y ya no viene en el archivo se libera, como siempre', async () => {
  // bloqueo futuro 'se-cancelo' que el archivo ya no trae → después de sincronizar no está
});
it('una que termina hoy y sigue viniendo en el archivo no queda duplicada', async () => {
  // bloqueo con fin anterior a AHORA y externoUid 'hoy'; el archivo trae 'hoy' → queda uno solo
});
it('desconectar el calendario se lleva también la historia', async () => {});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 reservas.calendarios`
Expected: FAIL en el primero (hoy se borra todo) y en el tercero si no se cuida el duplicado.

- [ ] **Step 3: Implement.** En la transacción de `sincronizarUno`, el borrado pasa de "todos los del calendario" a "los del calendario que no terminaron (`fin > ahora`) o cuyo `externoUid` viene en el archivo". Lo demás queda igual, incluido el candado del recurso.
- [ ] **Step 4: Run to verify they pass**: el mismo comando → PASS (los anteriores también). `pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 reservas aislamiento-consultas` → PASS. `pnpm exec tsc --noEmit` → sin salida.
- [ ] **Step 5: README**: en § Calendarios externos, "reemplaza los bloqueos" pasa a decir qué se conserva y por qué (la ocupación de las Estadísticas de Alquileres).
- [ ] **Step 6: Commit**

```bash
git add apps/api/src/reservas apps/api/test/unit/reservas.calendarios.unit-spec.ts
git commit -m "feat(reservas): las noches de Airbnb que ya pasaron quedan como historia del calendario"
```

---

### Task 10: Probarlo entero contra dev y dejarlo documentado

**Files:**
- Modify: `apps/web/src/modules/superadmin/modulos/entradas.ts` (una entrada al final: `auditoria.alquileres.2026-11-26-estadisticas-y-ganancias-de-airbnb`), `docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md` (en "Etapa 4 en adelante", marcar lo hecho)
- Create: capturas en `apps/web/public/auditoria/modulos/alquileres/` (`estadisticas-1280.webp`, `estadisticas-390.webp`, `ganancias-airbnb-1280.webp`), sin datos reales

**Interfaces:** ninguna.

- [ ] **Step 1: Levantar la API y el front en local** (previews `backend-alquileres` y `frontend-alquileres`), contra dev.
- [ ] **Step 2: Por API, con el negocio `cabanas-prueba`** (script en el scratchpad, con un CSV de ejemplo armado con fechas alrededor de hoy):
  vista previa → cuenta y totales correctos, nada guardado; importar uniendo cada aviso → creadas; importar de nuevo → todas actualizadas, ninguna nueva; `GET ingresos` del rango → las filas; un archivo sin la columna del código → 400 con su mensaje; un aviso unido a un recurso de otro negocio → rechazo; borrar todo → 0 filas.
  Expected: cada paso como dice, y dev limpio al terminar.
- [ ] **Step 3: En pantalla**, a 1280 y a 390: elegir el archivo, ver la vista previa, unir los avisos, importar; ir a Estadísticas y ver la ocupación y los ingresos por canal con Airbnb; un archivo con dólares muestra la nota y no suma a los pesos; el bloqueo de Airbnb con las mismas fechas muestra el huésped; con el Airbnb de mentira, una estadía que ya terminó sigue contando en la ocupación después de sincronizar; borrar todo. Sin scroll horizontal, en claro y en oscuro.
- [ ] **Step 4: Todas las suites, una por vez**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm exec jest --config ./test/jest-unit.json --maxWorkers=2 && pnpm exec jest --config ./test/jest-src.json --maxWorkers=2`
Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec vitest run --maxWorkers=2`
Expected: todo en verde (incluidos los tests de Turnos y Gimnasio).

- [ ] **Step 5: Auditoría y plan.** La entrada dice qué se hizo, qué cambia para Turnos y Gimnasio (una migración con dos tablas de Alquileres; del motor, solo qué borra la sincronización de un calendario de Airbnb), qué se verificó y qué no (un archivo real de Airbnb). `pnpm exec vitest run --maxWorkers=2 src/modules/superadmin/modulos` → PASS.
- [ ] **Step 6: Parar los servidores locales y commit**

```bash
git add apps/web/src/modules/superadmin/modulos/entradas.ts apps/web/public/auditoria/modulos/alquileres docs/superpowers/plans
git commit -m "docs(alquileres): Auditoría de las estadísticas y las ganancias de Airbnb"
```

---

## Lo que queda afuera

- Subir a producción (push de `main`, la migración con `prisma-prod.sh` y `deploy.sh`): se pide permiso al terminar.
- Ajustar los nombres de columna con un archivo real de Airbnb: cuando Alan consiga uno.
- Otros canales además de Airbnb, convertir moneda, estadísticas de canchas y salones, y el manual de Alquileres para Orbi.
