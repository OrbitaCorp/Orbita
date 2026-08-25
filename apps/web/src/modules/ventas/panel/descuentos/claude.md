# CLAUDE.md — Módulo de Descuentos y Cupones

## Contexto

Este módulo pertenece a `Orbita-Frontend/src/modules/ventas/descuentos/`. Es un submódulo de Ventas, hermano de `pos/`. Antes de escribir cualquier código:

1. Leé `implementacion-descuentos.md` en esta carpeta — es el spec funcional completo.
2. Leé `CLAUDE.md` del módulo POS (`../pos/CLAUDE.md`) — las reglas globales de Orbita aplican acá también.
3. Revisá la carpeta `descuentos de claude design/` — contiene los diseños visuales de referencia (capturas exportadas de Claude Design). Usá los diseños como guía visual pero seguí el spec como fuente de verdad cuando haya discrepancia.

## Estructura de carpetas

Replicar la misma estructura que `../pos/`:

```
descuentos/
  components/           # Componentes internos del módulo
  docs/                 # Documentación (mover implementacion-descuentos.md acá)
  hooks/                # Hooks custom del módulo
  mock/                 # Datos mock hardcodeados
  CLAUDE.md
  components.md         # Registro de componentes del módulo
  index.ts              # Barrel export del módulo
  types.ts              # Tipos e interfaces del módulo
  DescuentosShell.tsx   # Layout/shell del módulo (tabs, breadcrumb, navegación interna)
  DescuentosListado.tsx # Tab Descuentos del listado
  CuponesListado.tsx    # Tab Cupones del listado
  DescuentosDetalle.tsx # Página de detalle de descuento (solo lectura)
  DescuentosCrear.tsx   # Formulario crear/editar descuento
  CuponesCrear.tsx      # Formulario crear/editar cupón
  DescuentosMetricas.tsx # Pantalla de métricas
```

NO crear carpeta `stores/`. Este módulo no usa Zustand.

## Stack técnico

- **Server state:** TanStack Query (`@tanstack/react-query`). Toda data que viene del backend (listados, detalle, métricas) se maneja con `useQuery` / `useMutation`.
- **Client state:** `useState` para estado local de componentes. `useSearchParams` para estado de URL (filtros, tab activo, paginación, ordenamiento). NO usar Zustand.
- **Formularios:** Estado local con `useState` o `useReducer` si el formulario es complejo. No instalar librerías de formularios adicionales.
- **API client:** Usar el cliente API centralizado de Orbita (mismo que usa POS). Revisar `../pos/hooks/` para ver el patrón.
- **Tipos:** Todo tipado en `types.ts`. No usar `any`. Named exports.

## Reglas de código (heredadas de Orbita global)

- Archivos < 300 líneas. Si un componente supera 300, extraer subcomponentes.
- Named exports SIEMPRE. No default exports.
- Barrel exports vía `index.ts`.
- Tokens de color: `var(--color-*)`. NUNCA hex hardcodeado.
- Valores monetarios y cantidades: fuente `Geist Mono`.
- Shimmer/skeletons de carga: SÍ importar los primitivos compartidos de
  `@/design-system/components/Skeleton.tsx` (`Skeleton`, `SkeletonText`,
  `SkeletonCircle`, `SkeletonChip`) — es el mismo componente que usan
  productos, pedidos y todo el storefront, un solo lugar para mantener el
  diseño del shimmer en todo el sistema (unificado 2026-08-25). Esta regla
  decía antes "no importar de `@/design-system/`, ese path no existe" — era
  incorrecto, el path existe y lo usa el resto del proyecto; quedó así
  porque este módulo se armó siguiendo el spec original al pie de la letra
  sin volver a chequear ese supuesto. Las COMPOSICIONES propias del módulo
  (tablas con sus columnas, modales de link, cards de sidebar — ver
  `components/DescuentosSkeleton.tsx`) siguen viviendo acá, armadas sobre
  esos primitivos — no hace falta moverlas a `@/design-system/` salvo que
  otro módulo las necesite.
- Componentes compartidos de Orbita están en `src/modules/ventas/_shared/components/`. Si un componente del módulo de descuentos es útil para otros módulos (POS, Pedidos), moverlo ahí.

## Datos mock

Crear archivos en `mock/` con datos hardcodeados que simulen respuestas de la API. Estructura:

```
mock/
  descuentos.ts        # Lista de descuentos mock (8-10 items con variedad de tipos y estados)
  cupones.ts           # Lista de cupones mock (6-8 items)
  metricas.ts          # Datos mock de métricas (KPIs, gráfico temporal, tabla rendimiento)
  productos.ts         # Árbol de categorías/productos/variantes mock para el selector
```

Los mocks deben ser realistas (tienda de ropa argentina con precios en ARS) y cubrir todos los estados y tipos definidos en el spec. Usar los mismos datos de ejemplo que aparecen en los diseños de Claude Design (ej: "Promo Invierno 2x1 Buzos", "BIENVENIDO10", etc.).

Los hooks deben consumir los mocks directamente por ahora. Cuando el backend esté listo, se reemplazan los mocks por llamadas reales al API client sin cambiar la interfaz del hook.

Patrón de hook con mock:

```typescript
// hooks/useDescuentos.ts
import { useQuery } from '@tanstack/react-query';
import { descuentosMock } from '../mock/descuentos';

export const useDescuentos = (filtros: DescuentosFiltros) => {
  return useQuery({
    queryKey: ['descuentos', filtros],
    queryFn: async () => {
      // TODO: Reemplazar por llamada real a API
      // return apiClient.post('/api/descuentos', filtros);
      return descuentosMock.filter(/* aplicar filtros */);
    },
  });
};
```

## Endpoints futuros (referencia para hooks)

Estos endpoints no existen aún. Los hooks deben simularlos con mocks pero usar estos nombres y firmas para que el reemplazo sea directo:

```
GET    /api/descuentos                  → lista con filtros (estado, tipo, paginación, orden)
GET    /api/descuentos/:id              → detalle de descuento
POST   /api/descuentos                  → crear descuento
PUT    /api/descuentos/:id              → editar descuento
PATCH  /api/descuentos/:id/toggle       → activar/desactivar
DELETE /api/descuentos/:id              → eliminar
POST   /api/descuentos/:id/duplicar     → duplicar

GET    /api/cupones                     → lista con filtros
GET    /api/cupones/:id                 → detalle de cupón (para edición)
POST   /api/cupones                     → crear cupón
PUT    /api/cupones/:id                 → editar cupón
PATCH  /api/cupones/:id/toggle          → activar/desactivar
DELETE /api/cupones/:id                 → eliminar
POST   /api/cupones/:id/duplicar        → duplicar
POST   /api/cupones/validar             → validar código (usado por POS)

POST   /api/descuentos/evaluar          → evaluar carrito (usado por POS y Storefront)

GET    /api/descuentos/metricas         → KPIs + gráfico temporal + tabla rendimiento
GET    /api/descuentos/metricas/:id     → detalle rendimiento de un descuento/cupón específico
GET    /api/descuentos/auditoria/:id    → log de auditoría de una entidad
```

## Componentes a crear

### Componentes internos (`components/`)

```
components/
  DescuentosTabla.tsx           # Tabla del listado de descuentos (columnas, hover, paginación)
  CuponesTabla.tsx              # Tabla del listado de cupones
  DescuentosFiltros.tsx         # Barra de filtros (estado, tipo, búsqueda)
  Paginacion.tsx                # Componente de paginación (mostrar N por página + nav)
  TipoDescuentoSelector.tsx     # Grid de 7 cards para seleccionar tipo de descuento
  TipoCuponSelector.tsx         # 2 cards: Porcentaje / Monto fijo
  AlcanceSelector.tsx           # 3 cards: Ticket completo / Categoría / Productos específicos
  ProductoArbol.tsx             # Árbol de categorías/productos/variantes con checkboxes
  CategoriaLista.tsx            # Lista plana de categorías con checkboxes (para alcance = categoría)
  ConfigLlevaXPagaY.tsx         # Campos de configuración para tipo Llevá X Pagá Y
  ConfigCompraXObtieneZ.tsx     # Campos de configuración para tipo Comprá X Obtené Z
  ConfigPorcentajeProducto.tsx  # Campos para tipo % sobre producto
  ConfigMontoFijoProducto.tsx   # Campos para tipo $ fijo sobre producto
  ConfigPorcentajeTicket.tsx    # Campos para tipo % sobre ticket
  ConfigMontoFijoTicket.tsx     # Campos para tipo $ fijo sobre ticket
  ConfigVolumen.tsx             # Campos para tipo volumen
  BeneficioBonusSelector.tsx    # Segmented control: Gratis / % / $ para bonus de Comprá X Obtené Z
  VigenciaForm.tsx              # Sección de vigencia: fechas, días, horario, límite usos
  AplicacionSelector.tsx        # Radio buttons: Automático / Manual
  PreviewPOS.tsx                # Sidebar de preview (dinámico según tipo)
  ResumenSidebar.tsx            # Card de resumen en sidebar (tipo, vigencia, usos, etc.)
  PreviewCupon.tsx              # Sidebar de preview para cupones
  DetalleEncabezado.tsx         # Card de encabezado de la página de detalle
  DetalleConfiguracion.tsx      # Card de configuración en detalle (solo lectura)
  DetalleProductos.tsx          # Card de productos afectados en detalle (solo lectura)
  DetalleVigencia.tsx           # Card de vigencia en detalle (solo lectura)
  DetalleAcciones.tsx           # Card de acciones rápidas (toggle, duplicar, eliminar)
  DetalleRendimiento.tsx        # Card de rendimiento en sidebar de detalle
  HistorialCambios.tsx          # Card colapsable de log de auditoría
  MetricasKPIs.tsx              # 4 cards de KPIs
  MetricasGrafico.tsx           # Gráfico de línea temporal
  MetricasTabla.tsx             # Tabla de rendimiento por descuento/cupón
  MetricasDrawer.tsx            # Drawer lateral de detalle de rendimiento
  ToggleConfirmacion.tsx        # Popover de confirmación al desactivar
  BadgeEstado.tsx               # Badge de estado (Activo, Inactivo, Programado, Expirado, Agotado)
  BadgeTipo.tsx                 # Badge de tipo de descuento (con ⚡ si automático)
  MenuContextual.tsx            # Menú de tres puntos (Duplicar, Ver métricas, Eliminar, Copiar código)
```

### Componentes potencialmente compartidos

Antes de crear estos componentes dentro del módulo, verificar si ya existen en `src/modules/ventas/_shared/components/`. Si no existen y son útiles para POS/Pedidos/Inventario, crearlos ahí:

- **Paginacion.tsx** — POS Historial probablemente necesita paginación también.
- **BadgeEstado.tsx** — Otros módulos pueden tener estados con badges.
- **MenuContextual.tsx** — Patrón reutilizable de menú de tres puntos.
- **ToggleConfirmacion.tsx** — Toggle con popover de confirmación.
- **ProductoArbol.tsx** — El selector de productos con árbol podría usarse en Inventario.
- **CategoriaLista.tsx** — Lista plana de categorías podría usarse en Catálogo.

Señalar explícitamente en `components.md` cuáles componentes son candidatos a compartidos y cuáles son exclusivos del módulo.

## Hooks a crear (`hooks/`)

```
hooks/
  useDescuentos.ts              # Lista de descuentos con filtros y paginación
  useDescuento.ts               # Detalle de un descuento por ID
  useCrearDescuento.ts          # Mutación: crear descuento
  useEditarDescuento.ts         # Mutación: editar descuento
  useToggleDescuento.ts         # Mutación: activar/desactivar
  useEliminarDescuento.ts       # Mutación: eliminar
  useDuplicarDescuento.ts       # Mutación: duplicar
  useCupones.ts                 # Lista de cupones con filtros y paginación
  useCupon.ts                   # Detalle de un cupón por ID (para edición)
  useCrearCupon.ts              # Mutación: crear cupón
  useEditarCupon.ts             # Mutación: editar cupón
  useToggleCupon.ts             # Mutación: activar/desactivar
  useEliminarCupon.ts           # Mutación: eliminar
  useDuplicarCupon.ts           # Mutación: duplicar
  useMetricas.ts                # KPIs + gráfico + tabla de rendimiento
  useMetricasDetalle.ts         # Detalle rendimiento de un descuento/cupón
  useAuditoria.ts               # Log de auditoría de una entidad
  useProductos.ts               # Árbol de categorías/productos/variantes (para selectores)
  useDescuentosFiltros.ts       # Estado de filtros vía useSearchParams (estado, tipo, búsqueda, página, orden)
```

## types.ts — Tipos principales

Definir al menos estos tipos. Revisar el spec (`implementacion-descuentos.md`) para los campos exactos:

```typescript
// Enums
type TipoDescuento = 'porcentaje_producto' | 'monto_fijo_producto' | 'porcentaje_ticket' | 'monto_fijo_ticket' | 'lleva_x_paga_y' | 'compra_x_obtiene_z' | 'volumen';
type EstadoDescuento = 'activo' | 'inactivo' | 'programado' | 'expirado';
type EstadoCupon = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado';
type Aplicacion = 'automatico' | 'manual';
type AlcanceDescuento = 'producto' | 'categoria' | 'ticket';
type NivelProducto = 'padre' | 'variante';
type BonusTipoBeneficio = 'gratis' | 'porcentaje' | 'monto_fijo';

// Entidades
interface Descuento { /* campos del spec */ }
interface Cupon { /* campos del spec */ }
interface LogAuditoria { /* campos del spec */ }

// Filtros y paginación
interface DescuentosFiltros { estado, tipo, busqueda, pagina, porPagina, ordenColumna, ordenDireccion }
interface CuponesFiltros { estado, tipo, busqueda, pagina, porPagina, ordenColumna, ordenDireccion }
interface MetricasFiltros { rangoFechas, canal, tipo, sucursal }

// Respuestas
interface PaginatedResponse<T> { data: T[], total: number, pagina: number, porPagina: number }
interface MetricasKPIs { revenueSacrificado, ventasConDescuento, ticketPromedio, tasaCanje }
interface MetricasGrafico { fechas: string[], valores: number[] }
interface RendimientoItem { nombre, tipo, usos, revenueSacrificado, revenueConDesc, ticketPromedio, estado }

// Árbol de productos
interface Categoria { id, nombre, productosCount, productos?: ProductoPadre[] }
interface ProductoPadre { id, nombre, categoriaId, variantes: Variante[] }
interface Variante { id, nombre, sku, precio, stock }
```

## Rutas

Definir en el router de Orbita (o en el shell del módulo):

```
/panel/ventas/descuentos                    → DescuentosShell (tab Descuentos por default)
/panel/ventas/descuentos?tab=cupones        → DescuentosShell (tab Cupones)
/panel/ventas/descuentos/crear              → DescuentosCrear
/panel/ventas/descuentos/:id                → DescuentosDetalle
/panel/ventas/descuentos/:id/editar         → DescuentosCrear (modo edición)
/panel/ventas/cupones/crear                 → CuponesCrear
/panel/ventas/cupones/:id/editar            → CuponesCrear (modo edición)
/panel/ventas/descuentos/metricas           → DescuentosMetricas
```

## Orden de implementación

Fase 1 — Base:
1. `types.ts` — Todos los tipos e interfaces.
2. `mock/` — Todos los archivos mock.
3. `hooks/useDescuentosFiltros.ts` — Estado de URL.
4. `hooks/useDescuentos.ts` y `hooks/useCupones.ts` — Hooks de listado.
5. `index.ts` — Barrel exports.

Fase 2 — Listado:
6. `BadgeEstado.tsx`, `BadgeTipo.tsx` — Componentes de badge.
7. `Paginacion.tsx` — Componente de paginación.
8. `MenuContextual.tsx`, `ToggleConfirmacion.tsx` — Acciones de fila.
9. `DescuentosFiltros.tsx` — Barra de filtros.
10. `DescuentosTabla.tsx`, `CuponesTabla.tsx` — Tablas.
11. `DescuentosShell.tsx` — Shell con tabs y layout.
12. `DescuentosListado.tsx`, `CuponesListado.tsx` — Páginas de listado.

Fase 3 — Formularios:
13. `ProductoArbol.tsx`, `CategoriaLista.tsx` — Selectores de productos.
14. `TipoDescuentoSelector.tsx`, `AlcanceSelector.tsx` — Selectores de cards.
15. `Config*.tsx` — Componentes de configuración por tipo (7 componentes).
16. `BeneficioBonusSelector.tsx` — Selector de beneficio del bonus.
17. `VigenciaForm.tsx`, `AplicacionSelector.tsx` — Secciones del formulario.
18. `PreviewPOS.tsx`, `ResumenSidebar.tsx` — Sidebar de preview.
19. `DescuentosCrear.tsx` — Formulario completo de descuento.
20. `PreviewCupon.tsx`, `TipoCuponSelector.tsx` — Componentes de cupón.
21. `CuponesCrear.tsx` — Formulario completo de cupón.

Fase 4 — Detalle:
22. `Detalle*.tsx` — Componentes de la página de detalle.
23. `HistorialCambios.tsx` — Log de auditoría.
24. `DescuentosDetalle.tsx` — Página de detalle completa.

Fase 5 — Métricas:
25. `MetricasKPIs.tsx`, `MetricasGrafico.tsx` — KPIs y gráfico.
26. `MetricasTabla.tsx` — Tabla de rendimiento.
27. `MetricasDrawer.tsx` — Drawer de detalle.
28. `DescuentosMetricas.tsx` — Página de métricas completa.

## Checklist antes de dar por terminada cada fase

- [ ] Todos los archivos < 300 líneas.
- [ ] Named exports solamente.
- [ ] `index.ts` actualizado con barrel exports.
- [ ] `components.md` actualizado con componentes nuevos y candidatos a compartidos señalados.
- [ ] Sin imports de `@/design-system/`.
- [ ] Colores con `var(--color-*)`, nunca hex.
- [ ] Valores monetarios con fuente `Geist Mono`.
- [ ] Tipos en `types.ts`, no inline.
- [ ] Mocks realistas con datos de tienda de ropa argentina.
- [ ] Sin Zustand. Server state en TanStack Query, client state en useState/useSearchParams.
- [ ] Formato de fechas DD/MM/YYYY en toda la UI.