# components.md — Módulo Descuentos y Cupones (Fases 1–5)

Registro de todos los componentes creados hasta Fase 2.

## En `_shared/components/` (compartidos con otros módulos)

| Componente | Descripción | Candidato a shared |
|---|---|---|
| `Paginacion` | Selector de "Mostrar N por página" + botones primera/anterior/siguiente/última | Ya en `_shared` ✅ |
| `MenuContextual` | Botón ⋮ que abre dropdown con items, soporte para items destructivos y separadores | Ya en `_shared` ✅ |
| `ToggleConfirmacion` | Toggle switch que al desactivar muestra un popover de confirmación antes de ejecutar | Ya en `_shared` ✅ |

> **Por qué se movieron a `_shared`:** POS Historial, Pedidos e Inventario necesitarán paginación. El menú contextual es un patrón recurrente en todas las tablas de admin. El toggle con confirmación aplica a cualquier activación/desactivación sensible.

## En `components/` (internos del módulo)

| Componente | Descripción | Candidato a shared |
|---|---|---|
| `BadgeEstado` | Badge pill con punto de color para `activo/inactivo/programado/expirado/agotado`. Colores via `var(--color-*)`. | Potencial — los estados específicos (programado, expirado, agotado) no los cubre `StatusBadge` de `_shared`. Migrar si otros módulos adoptan los mismos estados. |
| `BadgeTipo` | Badge gris para tipo de descuento/cupón. Si `aplicacion === 'automatico'`, agrega ⚡ (Zap) antes del texto. Acepta tipo o label string. | No — específico a descuentos/cupones. |
| `DescuentosFiltros` | Barra de filtros (Estado, Tipo, Búsqueda). Adapta las opciones según el tab activo. Consume `useDescuentosFiltros`. | No — acoplado al hook de filtros de este módulo. |
| `DescuentosTabla` | Tabla de descuentos con 7 columnas en CSS grid. Filas clickeables, hover, stopPropagation en acciones. Integra toggle, lápiz y menú contextual. | No — columnas y lógica específicas del dominio. |
| `CuponesTabla` | Tabla de cupones con 8 columnas. Código en Geist Mono, valor formateado, subtexto de "N por cliente" en usos. | No — ídem. |
| `DescuentosSkeleton` | **(2026-08-24)** Piezas de shimmer del módulo (`SkeletonCard`, `SkeletonColumna`, `SkeletonTablaDescuentos`, `SkeletonTablaCupones`, `SkeletonModalLink`) — reimplementación local de `design-system/Skeleton` sobre la clase global `.skel`, ya que el módulo no puede importar de `@/design-system/`. Usado en tablas, detalle, formularios crear/editar y los modales de compartir link. | Potencial — si se relaja la regla de "no importar design-system", podría reemplazarse por el `Skeleton` compartido. |

## Pantallas

| Componente | Descripción |
|---|---|
| `DescuentosListado` | Container: llama `useDescuentos` + `useDescuentosFiltros`, compone `DescuentosFiltros` + `DescuentosTabla` + `Paginacion`. |
| `CuponesListado` | Container: llama `useCupones` + `useDescuentosFiltros`, compone `DescuentosFiltros` + `CuponesTabla` + `Paginacion`. |
| `DescuentosShell` | Shell del módulo. Barra de tabs (Descuentos/Cupones) + botones (Métricas, Crear). Gestiona navegación interna entre vistas (`listado / detalle / editar / crear / metricas`) via `useState`. |

## Fase 3 — Formularios

### Componentes compartidos nuevos en `_shared/components/`

| Componente | Descripción |
|---|---|
| `Toggle` | Toggle switch simple. Props: `checked`, `onChange`, `size ('sm'|'md')`, `disabled`. Sin lógica de confirmación. Candidato a `_shared` ✅ |

### Primitivas de formulario (internas al módulo)

| Componente | Descripción |
|---|---|
| `FormField` | Input con label, prefix, suffix, error, focus ring, disabled state. Acepta todas las props de `<input>`. |
| `SectionCard` | Card contenedora con título y subtítulo opcionales para secciones del formulario. |
| `LabelRow` | Fila de label + slot right (para colocar un toggle junto al label). |

### Selectores

| Componente | Descripción | Candidato a shared |
|---|---|---|
| `ProductoArbol` | **(2026-07-30, ya no es mock)** Árbol 2 niveles: Categoría → Producto, con checkboxes (estado indeterminado en categorías). Categorías via `useCategoriasDescuento`; productos por categoría se cargan al expandir (`useProductosPorCategoria`, pagina de a 100). Con búsqueda activa pega al servidor (`useBuscarProductosDescuento`) y agrupa por categoría. Se sacó el nivel de variante/toggle "Todas las variantes": era decorativo (nunca cambiaba la selección real, siempre operó a nivel producto padre) y el listado bulk de productos no trae variantes. | Potencial — candidato a `_shared` si Inventario/Catálogo también necesitan selector de productos. |
| `CategoriaLista` | **(2026-07-30, ya no es mock)** Lista plana de categorías activas del negocio, via `useCategoriasDescuento`. Sin conteo de productos por categoría (el endpoint de categorías no lo trae). | Potencial — misma lógica. |
| `TipoDescuentoSelector` | Grid de 7 cards (fila 4 + fila 3) para seleccionar tipo de descuento. Active state con borde primario y fondo `primary-bg`. | No — específico a descuentos. |
| `TipoCuponSelector` | Grid de 2 cards: Porcentaje / Monto fijo. Mismo design que TipoDescuentoSelector. | No — específico a cupones. |
| `AlcanceSelector` | Grid de N cards (ticket/categoría/producto). Prop `opciones` filtra cuáles mostrar. | No — específico a descuentos/cupones. |
| `SelectorProductoOCategoria` | Composición de AlcanceSelector + CategoriaLista/ProductoArbol. Centraliza la lógica de "qué mostrar según alcance". Resetea selección al cambiar alcance. | No — wrapper interno. |
| `BeneficioBonusSelector` | Segmented control de 3 opciones (Gratis / % / $) + input condicional para el valor. | No — específico a tipo `compra_x_obtiene_z`. |

**`AplicacionSelector` — eliminado (2026-07-30).** Era el selector Automático/Manual; "Manual" significaba "el vendedor lo aplica desde el POS", y el POS ya no existe. Se sacó la sección "Modo de aplicación" del formulario y `DescuentosCrear.tsx` manda `aplicacion: 'automatico'` fijo (coincide con el default del backend). El campo `aplicacion`/tipo `Aplicacion` se mantiene en `types.ts` y el backend porque `BadgeTipo`/`ResumenSidebar`/etc. todavía lo leen para mostrar el rayo ⚡.

### Componentes de configuración por tipo

| Componente | Tipo |
|---|---|
| `ConfigPorcentajeProducto` | `porcentaje_producto` — input % + SelectorProductoOCategoria |
| `ConfigMontoFijoProducto` | `monto_fijo_producto` — input $ + SelectorProductoOCategoria |
| `ConfigPorcentajeTicket` | `porcentaje_ticket` — input % + toggle compra mínima |
| `ConfigMontoFijoTicket` | `monto_fijo_ticket` — input $ + toggle compra mínima |
| `ConfigLlevaXPagaY` | `lleva_x_paga_y` — inputs Llevá/Pagá + card de resumen verde + SelectorProductoOCategoria |
| `ConfigCompraXObtieneZ` | `compra_x_obtiene_z` — cantidad min + selector trigger + selector bonus + BeneficioBonusSelector |
| `ConfigVolumen` | `volumen` — SelectorProductoOCategoria + tabla editable de escalas |

### Componentes de vigencia y previews

| Componente | Descripción |
|---|---|
| `VigenciaForm` | Fechas inicio/fin (toggle "Sin vencimiento" DESHABILITA el input, no lo oculta). Chips de días de semana. Horario (toggle "Todo el día" OCULTA los time pickers). Límite de usos con toggle "Ilimitado". |
| `PreviewPOS` | Preview dinámico del POS según tipo. Muestra subtotal, descuento y total con ejemplos hardcodeados. Mono para precios. |
| `ResumenSidebar` | Card resumen de solo lectura: nombre, tipo, aplicación, vigencia, días, límite de usos. |
| `PreviewCupon` | Preview visual de ticket con corte (línea punteada + semicírculos). Código en Geist Mono. |

### Páginas de formulario (Fase 3)

| Componente | Descripción |
|---|---|
| `DescuentosCrear` | Formulario completo de descuento. `useReducer` con `reducerDescuento.ts`. Sidebar sticky (preview + resumen). Modo edición via prop `id`. |
| `CuponesCrear` | Formulario de cupón. Estado con `useState` (sin reducer — menos campos). Generador de código, preview ticket-cut. Modo edición via prop `id`. |

### Soporte de formulario

| Archivo | Descripción |
|---|---|
| `reducerDescuento.ts` | `DescuentoFormState`, `DescuentoFormAction`, `initialDescuentoState`, `reducerDescuento()`, `validarDescuentoForm()`. |
| `utils.ts` | `generarCodigoCupon()`, `isoADisplay()`, `displayAIso()`. |

### Hooks de query/mutación (Fase 3)

| Hook | Descripción |
|---|---|
| `useDescuento(id)` | **(2026-07-30, ya no es mock)** GET `/discounts/:id` real, mapeado por `discountApi.ts`. Habilitado solo si `id` está definido. |
| `useCrearDescuento()` | **(2026-07-30, ya no es mock)** POST `/discounts` real. Invalida `['descuentos']`. |
| `useEditarDescuento()` | **(2026-07-30, ya no es mock)** PUT `/discounts/:id` real. Invalida `['descuentos']` y `['descuento', id]`. |
| `useCategoriasDescuento()` | **(nuevo, 2026-07-30)** GET `/categories?flat=true` real, solo activas. Usado por `CategoriaLista`/`ProductoArbol`/`DetalleProductos`. |
| `useProductosPorCategoria(categoryId, enabled)` | **(nuevo, 2026-07-30)** GET `/products?categoryId=...` real (pagina de a 100). Carga lazy al expandir la categoría en `ProductoArbol`. |
| `useBuscarProductosDescuento(query)` | **(nuevo, 2026-07-30)** GET `/products?search=...` real. Búsqueda del árbol de productos, ya no filtra un mock en memoria. |
| `useProductosPorIds(ids)` | **(nuevo, 2026-07-30)** GET `/products/:id` en paralelo por cada id — resuelve nombres reales para `DetalleProductos` (no hay endpoint bulk-por-ids). |
| `useCupon(id)` | GET un cupón por ID desde mock (sin cambios — no hay backend de cupones, RBT-615/616). Habilitado solo si `id` está definido. |
| `useCrearCupon()` | POST al mock (sin cambios). Invalida `['cupones']`. |
| `useEditarCupon()` | PUT al mock (sin cambios). Invalida `['cupones']` y `['cupon', id]`. |

---

## Hooks de mutación (Fase 2)

| Hook | Descripción |
|---|---|
| `useToggleDescuento` | **(2026-07-30, ya no es mock)** PATCH `/discounts/:id/toggle` real (invierte `isActive` tal cual está). Invalida `['descuentos']` y `['descuento', id]`. |
| `useToggleCupon` | PATCH activo en mock (sin cambios — no hay backend de cupones). Invalida `['cupones']`. |
| `useEliminarDescuento` | **(2026-07-30, ya no es mock)** DELETE `/discounts/:id` real (soft-delete). Invalida `['descuentos']`. |
| `useEliminarCupon` | DELETE de mock (sin cambios). Invalida `['cupones']`. |
| `useDuplicarDescuento` | Sigue sobre mock a propósito — el backend no implementa duplicar (`POST /discounts/:id/duplicate` es un stub `not implemented`). Copia con nuevo ID y nombre "(copia)". Invalida `['descuentos']`. |
| `useDuplicarCupon` | Copia con nuevo ID, código "-COPIA" y nombre "(copia)". Invalida `['cupones']`. |

---

## Fase 4 — Detalle (solo lectura)

### Componentes de detalle

| Componente | Descripción | Candidato a shared |
|---|---|---|
| `DetalleEncabezado` | Card con nombre, `BadgeTipo` + `BadgeEstado`, fecha de creación + usuario, botón "Editar" outline. | No — campos específicos de descuentos. |
| `DetalleConfiguracion` | Filas en grid `160px 1fr` según el `tipo`. Helper `getRows(d)` retorna pares label/valor. Incluye fila de "Aplicación". | No — lógica específica de tipos de descuento. |
| `DetalleProductos` | Álbum de productos agrupados por categoría (read-only). Expande al click si hay más de 5 productos. Muestra chips de categorías si `alcance === 'categoria'`, mensaje si `alcance === 'ticket'`. | Potencial — si Pedidos/Inventario necesitan mostrar árbol de productos. |
| `DetalleVigencia` | Filas de vigencia: inicio, fin (o "Sin vencimiento"), chips de días de la semana (azul=activo/gris=inactivo), horario condicional, límite de usos. | No — semántica de vigencia de descuentos. |
| `HistorialCambios` | Colapsable con dot-timeline (reverse cronológico). Muestra cambios de campos si los hay. Acepta `tituloEntidad` para personalizar textos ("descuento" / "cupón"). Reutilizable entre detalle y edición. | Potencial — patrón de log de auditoría útil en Pedidos/Inventario. |
| `DetalleAcciones` | Card de acciones rápidas: `Toggle` de estado (sin popover, cambio inmediato), Duplicar, y Eliminar con confirmación inline. Fondo `success-bg` cuando el descuento está activo. | No — acciones específicas a descuentos. |
| `DetalleRendimiento` | Barra de progreso de usos (rojo si >90%, amarillo si >70%), 3 filas KPI (revenue sacrificado en rojo, revenue con descuento en verde, ticket promedio). Botón "Ver métricas completas". | No — datos específicos de descuentos. |

### Página

| Componente | Descripción |
|---|---|
| `DescuentosDetalle` | Grid `1fr 340px`. Izquierda: Encabezado + Configuración + Productos + Vigencia + Historial. Derecha sticky: Acciones + PreviewPOS + Rendimiento. Carga via `useDescuento(id)` + `useAuditoria(id, 'descuento')`. |

### Hooks de Fase 4

| Hook | Descripción |
|---|---|
| `useAuditoria(entidadId, entidadTipo)` | GET logs de auditoría por ID y tipo desde `mock/auditoria.ts`. Ordena descendente por timestamp. Habilitado solo si `entidadId` está definido. |

### Mocks de Fase 4

| Archivo | Descripción |
|---|---|
| `mock/auditoria.ts` | Logs mock para descuentos d1, d2 y cupón c1. Acciones cubiertas: crear, editar, activar, desactivar. |

---

## Fase 5 — Métricas

### Componentes de métricas

| Componente | Descripción | Candidato a shared |
|---|---|---|
| `MetricasKPIs` | 4 `MiniKpi` en grid `1fr 1fr`: revenue sacrificado (con variación %), ventas con desc, ticket promedio, tasa de canje. | Potencial — MiniKpi es un patrón genérico de dashboard. |
| `MetricasGrafico` | SVG puro sin librería. Gradiente `linearGradient` bajo la línea, tooltip flotante con rect+text al hover, labels de ejes X/Y. Vista de revenue sacrificado en el tiempo. | No — específico de métricas de descuentos. |
| `MetricasFiltros` | Barra de filtros: rango de fechas (preset + personalizado con date pickers), canal (todos/POS/storefront), tipo (todos/descuentos/cupones). | Potencial — patrón de filtros de rango + canal reutilizable en otros dashboards. |
| `MetricasTabla` | Grid `1.8fr 0.9fr 0.7fr 1fr 1fr 0.9fr 0.7fr`. Encabezados ordenables (ChevronUp/Down activo, ChevronsUpDown neutral). Paginación de 10 filas. Revenue sacrificado en rojo, ticket en mono. | No — columnas y semántica específicas. |
| `MetricasDrawer` | Drawer fixed `560px` derecha con backdrop `rgba(0,0,0,.12)` z-199. Cierre con X, Escape, o click fuera. KPIs 2×2, sparkline SVG de usos por día, tabla de productos descontados. Botón de navegación a detalle. | Potencial — el patrón de drawer podría extraerse a `_shared`. |

### Página

| Componente | Descripción |
|---|---|
| `DescuentosMetricas` | Header con "← Volver" + título. `MetricasFiltros` con estado local. `MetricasKPIs` + `MetricasGrafico` + `MetricasTabla`. `MetricasDrawer` controlado por `drawerItemId`. |

### Hooks de Fase 5

| Hook | Descripción |
|---|---|
| `useMetricas(filtros?)` | GET `MetricasResumen` desde `mock/metricas.ts`. QueryKey incluye filtros para invalidar al filtrar. |
| `useMetricasDetalle(id)` | GET datos de detalle para el drawer: item de rendimiento + usos por día + productos descontados. Mock interno en el hook. Habilitado solo si `id` no es null. |

### Navegación completa (Fase 4 + 5)

`DescuentosShell` conecta ahora todas las vistas:
- `listado` ← → `detalle` (via `onVerDetalle(id)` desde la tabla de descuentos)
- `detalle` → `editar` (via botón Editar en `DetalleEncabezado`)
- `detalle` → `metricas` (via "Ver métricas completas" en `DetalleRendimiento`)
- `metricas` → `detalle` (via "Ver detalle completo" en `MetricasDrawer`)
- Cualquier vista → `listado` (via "← Volver")

