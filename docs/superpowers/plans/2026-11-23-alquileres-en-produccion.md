# Alquileres en producción: plan por etapas

**Fecha:** 23/11/2026 · **Responsable:** Alan · **Lo compartido:** aprobado por Ale (según Alan, 23/11)

## Qué se quiere

Poder probar Alquileres **en producción ya**, sin que esté a la vista del público: crear un negocio
con la categoría de alquiler desde el panel administrativo, ver su panel y ver cómo queda su sitio
público.

## Decisiones de Alan (23/11)

1. **Atajo:** abrir ya la demo actual en producción, visible solo para superadmin; el negocio real
   llega por etapas.
2. **Modo:** el negocio real arranca por **estadía** (cabañas y deptos por noche). Canchas y salones
   siguen después con el mismo armazón.
3. **Creación:** desde **Superadmin**, no desde el alta pública (que sigue en "Próximamente").
4. **Lo compartido:** Ale aprobó los cambios al motor de reservas y a las páginas, así que el plan
   los incluye (temporadas en el servidor, campo libre en la reserva, etc.).

## Por qué va por etapas

Hoy, en producción, Alquileres no existe para nadie:

- `/alquileres-demo/*` y `/panel/alquileres` devuelven 404 cuando la app corre como producción.
- `/panel` manda siempre al panel de Tienda, y `<slug>.orbita.site` muestra siempre la tienda.
- No hay forma de crear un negocio con `industry: "alquileres"` fuera del seed de dev.
- El panel conectado a la API **solo lee**: no crea propiedades ni reservas.

## Cómo queda "no a la vista del público"

- El negocio nace con `hiddenFromSearch: true` (ya existe en `Business`): sin buscadores, sin
  sitemap y sin el directorio de tiendas. Se entra solo con el link.
- Suscripción de cortesía (`COMP`), sin cobro.
- La demo en producción pide sesión de superadmin y lleva `noindex`.
- El alta pública no cambia: Alquileres sigue en "Próximamente".

---

## Etapa 0 · La demo en producción, solo para superadmin (1 día)

**Qué vas a poder probar:** entrás a `orbita.site` como superadmin y abrís
`orbita.site/alquileres-demo` (también desde un botón en Superadmin → Módulos → Alquileres). Los tres
modos, panel y sitio, con los arreglos de UX de la semana pasada. Los datos son de ejemplo y viven en
tu navegador. Cualquier otra persona ve el login o un 404.

**Qué se hace**

- `apps/web/src/modules/alquileres/demo/SoloEquipo.tsx` (nuevo): en desarrollo deja pasar; en
  producción envuelve en `RequireAuth type="platform_admin"`.
- Las seis páginas de `apps/web/src/pages/alquileres-demo/` dejan de devolver `notFound` en producción
  y se envuelven en `SoloEquipo`, con `<meta name="robots" content="noindex">`.
- Botón "Abrir la demo" en Superadmin → Módulos → Alquileres.
- Test: en producción sin sesión de superadmin no se renderiza la demo.

**A verificar en staging antes de producción:** que la sesión de superadmin se reconozca en una ruta
fuera de `/superadmin` (la sesión se resuelve por canal según la ruta, `lib/tenant.ts`).

**No toca:** la API, la base, ni las demos de Turnos y Gimnasio (si Mateo y Ale las quieren abrir,
usan la misma pieza).

---

## Etapa 1 · Negocio real de estadía: crearlo y usar su panel (≈ 1 semana)

**Qué vas a poder probar:** en Superadmin tocás "Crear negocio de Alquileres", ponés nombre,
subdominio, rubro (cabañas, depto, casa…) y el email del dueño. Entrás como ese dueño a
`<slug>.orbita.site/panel` y cargás propiedades, reglas, reservas a mano y bloqueos, **guardando en
la base de producción**.

**API (`apps/api`)**

- `POST /api/v1/platform/businesses/alquileres` (solo superadmin): crea el negocio
  (`industry: "alquileres"`, `subrubros: [rubro]`, `hiddenFromSearch: true`), su sucursal, el rol
  dueño con todos los permisos, el dueño (con mail para que ponga su contraseña), las configs de
  negocio y de sitio, la suscripción `COMP` y la `ReservaConfig` de Alquileres. Reusa lo que hace
  el alta y lo que ya probó `prisma/seed-alquileres-prueba.ts`. Queda en el log de superadmin.
- Tests unitarios del servicio: subdominio repetido, email repetido, rubro que no es de Alquileres.
- Sin migraciones en esta etapa.

**Web: rutas**

- `pages/panel/index.tsx`: si el negocio de la sesión es de Alquileres, va a `/panel/alquileres`; si
  no, todo como hoy. Es el único cambio en una página que usa Tienda: una condición, con test.
- `pages/panel/alquileres.tsx`: deja de ser solo local. Pide sesión de miembro y que el negocio sea
  de Alquileres; si no, vuelve a `/panel`.
- Superadmin: el formulario de creación y, en la lista de negocios, el rubro y un link al sitio.

**Web: el panel escribe en la API (solo estadía)**

`datos/origen/api.ts` deja de ser solo lectura, sección por sección:

| Sección | Escribe en |
|---|---|
| Propiedades (crear, editar, pausar, fotos) | `POST/PUT/DELETE /reservas/recursos` (`ALOJAMIENTO`); fotos al almacenamiento de Órbita |
| Reglas (cancelación, noches mínimas, check-in y check-out) | `PUT /reservas/config` y `PUT /reservas/recursos/:id` |
| Nueva reserva a mano | `POST /reservas` (con `fecha` y `fechaHasta`) |
| Ficha: registrar seña y saldo, marcar realizada, cancelar, nota | `POST /reservas/:id/pago`, `completar`, `cancelar`, `PATCH nota` |
| Bloqueos | `POST` y `DELETE /reservas/bloqueos` |
| Pagos y señas (porcentaje y si se devuelve) | `PUT /reservas/config` |
| Datos del negocio | El endpoint de negocio que ya usa Tienda |

- Un 409 ("esas noches se acaban de ocupar") se muestra con el mensaje de la API.
- El "hoy" pasa a ser el real cuando el origen es la API (la demo sigue con su día fijo).
- Se sacan la franja "todavía no se guarda" y los avisos de guardado falsos.

**Lo que el panel real todavía no muestra** (se oculta del menú para no prometer lo que no anda):
Temporadas, Recordatorios y mensajes, Calendarios (.ics), Equipo, alquiler por mes, y de Pagos solo
queda la seña. El precio es **fijo por noche**: es lo que el servidor sabe calcular hoy.

**Módulos:** actualizar el plan del ciclo (`superadmin/modulos/plan.ts`) con este orden, y una
entrada de Auditoría por etapa.

---

## Etapa 2 · El sitio público del negocio reserva de verdad (≈ 1 semana)

**Qué vas a poder probar:** abrís `<slug>.orbita.site` y ves el sitio de las cabañas con sus fotos,
precio y calendario real. Reservás como huésped, la reserva aparece en el panel, te llega el mail
con el link, y desde ese link podés verla y cancelarla.

- `pages/tienda/[slug]/index.tsx`: si el negocio es de Alquileres, muestra el sitio de Alquileres;
  si no, la tienda como hoy. Segundo y último cambio en una página de Tienda, con test.
- El sitio lee de la API pública (`/storefront/:slug/reservas/...`): config, propiedades y noches
  ocupadas.
- Reserva: elegir noches → `retener` → datos del huésped → `confirmar`, con clave de idempotencia
  (doble clic no duplica) y aviso si la retención vence.
- Seña por transferencia: la reserva queda pendiente, el sitio muestra el alias y el dueño la
  confirma desde el panel (decisión del 18/11: la libera el dueño).
- Página nueva `/mi-reserva/<token>` (a la que ya apuntan los mails): ver, cancelar y reprogramar
  según la política.
- El sitio de un negocio oculto lleva `noindex` (ya lo resuelve la API con `hiddenFromSearch`).

---

## Etapa 3 · Lo que aprobó Ale del motor compartido (≈ 1 a 2 semanas)

- **Precio en el servidor:** temporadas, recargo de fin de semana y limpieza, con los mismos tests
  que `apps/web/src/lib/reservas/estadia.ts`. Vuelve la sección Temporadas.
- **Campo libre (`datos`) en `Reserva` y en `ReservaConfig`** (dos migraciones chicas): huéspedes,
  canal de la reserva (sitio, WhatsApp, teléfono, en el lugar), formas de pago y alias, plantillas de
  mensajes.
- **Bloqueos con el permiso de gestión**, para que un encargado pueda cerrar fechas.
- Turnos y Gimnasio comparten el motor: sus tests tienen que seguir en verde después de cada cambio,
  y Mateo se entera antes de cada migración.

## Etapa 4 en adelante

En este orden: calendario de Airbnb de verdad (URL para copiar, sincronización, avisos) → vista de
todas las propiedades juntas y estadísticas → seña online con Mercado Pago → canchas → salones.
Cada una con su plan propio; las ideas están en `docs/alquileres/informe-ux-alquileres.md`.

| Etapa | Estado |
|---|---|
| 4 · Calendario de Airbnb | Hecha, en producción (25/11). `plans/2026-11-25-alquileres-airbnb-calendario.md` |
| Vista de todas las propiedades juntas | Hecha, en producción (25/11): la grilla de ocupación |
| 5 · Estadísticas y ganancias de Airbnb | Hecha (26/11), en producción desde el 27/11. `plans/2026-11-26-alquileres-estadisticas-y-csv-airbnb.md`. El mismo 27/11 las ganancias de Airbnb pasaron de la pantalla Airbnb a su propia entrada del menú (`?vista=ganancias`) |
| Seña online con Mercado Pago | Pendiente. Es transversal: la decide Ale |
| Canchas | Pendiente |
| Salones | Pendiente |

---

## Cómo sale cada etapa a producción

Siempre el orden del `CLAUDE.md`:

1. Rama de trabajo → `git fetch` y merge de `origin/main` → typecheck de web y API, y tests de la API
   si se tocó.
2. Probar en **staging** (`apps/api/deploy/staging.sh`, usa la base de dev): crear un negocio, cargar
   una propiedad, hacer una reserva.
3. Si hay migraciones (etapa 3): primero en dev, y en producción con
   `apps/api/deploy/prisma-prod.sh migrate deploy` justo antes del deploy de la API.
4. Push **solo de `main`** → verificar que Vercel diga `Production` y CI en verde.
5. Si se tocó la API: `apps/api/deploy/deploy.sh` y verificar que la revisión nueva tenga el 100% del
   tráfico.
6. Probar en producción con la lista de "qué vas a poder probar" de la etapa.

## Riesgos y cómo se cuidan

| Riesgo | Cuidado |
|---|---|
| Romper Tienda al tocar `/panel` y `/tienda/[slug]` | Una sola condición en cada una (el negocio es de Alquileres), con test, y probado en staging con un negocio de Tienda |
| Que un negocio de prueba aparezca en Google | Nace oculto de buscadores; el sitio lleva `noindex` |
| Datos de prueba en la base de producción | Los negocios de prueba se crean y se cancelan desde Superadmin; quedan en el log |
| Que alguien cree negocios de Alquileres sin permiso | El endpoint es solo de superadmin; el alta pública no cambia |
| El límite de 60 pedidos por minuto de la API | El panel ya pide las reservas de a un tramo por vez |
| Precio del sitio distinto al que cobra el servidor | Hasta la etapa 3 el precio es fijo por noche en los dos lados |

## Qué queda fuera de este plan

- Sacar Alquileres de "Próximamente" en el alta pública (lo decide Ale al final).
- Cobrarle a un negocio de Alquileres (planes y precios).
- Google Maps: según Google, solo sirve a complejos con atención, no a un dueño individual.
