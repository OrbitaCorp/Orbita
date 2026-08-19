// src/modules/ventas/panel/pedidos/types/pedidos.types.ts
// Tipos del módulo de pedidos del panel admin.

import type { BadgeStatus } from '@/design-system/components/Badge'

// El estado de un pedido es un subconjunto de BadgeStatus —
// así podemos pasar `estado` directo a <Badge status={estado} />.
export type EstadoPedido = Extract<
    BadgeStatus,
    'pendiente' | 'confirmado' | 'preparacion' | 'enviado' | 'entregado' | 'cancelado'
>

// Cómo entró la venta: 'Tienda' = la compró el cliente por el storefront,
// 'Manual' = la cargó el negocio desde el panel. Sale del campo `origin` del
// backend (no de `channel`, que es el tipo de flujo y hoy es siempre ONLINE).
export type CanalVenta = 'Tienda' | 'Manual'

// Línea de producto dentro de un pedido.
export interface LineaPedido {
    nombre:   string
    cantidad: number
    precio:   number   // precio unitario
    hue:      number   // tono para el thumbnail generado
}

export interface Pedido {
    id:         string
    numero?:    string   // número de pedido para mostrar (con datos reales, id es el uuid)
    clienteId:  string
    cliente:    string
    email:      string
    productos:  LineaPedido[]
    canal:      CanalVenta
    monto:      number   // total — suma de cantidad * precio
    estado:     EstadoPedido
    fecha:      string   // ISO 8601
    // Opcionales: solo la Lista los trae del backend (ver ApiOrderSummary) —
    // antes "Entregado" era indistinguible de "Entregado con devolución
    // aprobada", había que abrir cada pedido para enterarse.
    devolucionPendiente?: boolean
    devolucionAprobada?:  boolean
}

// ─── Devoluciones ───────────────────────────────────────────────────────────

export type EstadoDevolucion = 'pendiente' | 'proceso' | 'aprobada' | 'rechazada'

export interface Devolucion {
    id:       string
    cliente:  string
    producto: string
    cantidad: number
    monto:    number
    hue:      number
    motivo:   string
    estado:   EstadoDevolucion
}

export type MetodoReembolso = 'nota_credito' | 'reembolso'

// ─── Notas de crédito ───────────────────────────────────────────────────────

export type TipoNota   = 'Saldo a favor' | 'Reembolso'
export type EstadoNota  = 'emitida' | 'aplicada'

export interface NotaCredito {
    id:       string
    cliente:  string
    pedidoId: string
    monto:    number
    tipo:     TipoNota
    estado:   EstadoNota
    vence:    string
}

