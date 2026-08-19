// (Fase 3 — Ale, 31/07) Esta barra de tabs quedó pegada arriba de CADA sub-vista
// del módulo de pedidos (Lista, Detalle, Historial, Devoluciones, Notas, Nuevo),
// duplicando la navegación que el Sidebar ya ofrece bajo "Pedidos" (Cola de
// prep. / Historial / Devoluciones / Notas de crédito / Nuevo +) — mismo motivo
// por el que ya se había sacado de Cola de preparación antes. Se quitó de las
// vistas que quedaban; el tipo sigue viviendo acá porque `ir`/`VistaPedido` se
// siguen usando para la navegación programática (ir a "detalle" al hacer click
// en una fila, volver a "lista", etc.).

export type VistaPedido =
    | 'lista'
    | 'detalle'
    | 'nuevo'
    | 'historial'
    | 'devoluciones'
    | 'notas'
    | 'cancelaciones'
