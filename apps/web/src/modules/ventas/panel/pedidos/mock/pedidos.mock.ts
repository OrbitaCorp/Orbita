// src/modules/ventas/panel/pedidos/mock/pedidos.mock.ts
// TODO: eliminar cuando el backend esté listo.
// Datos de ejemplo del módulo de pedidos — Rama Indumentaria.

import type { Pedido, Devolucion, NotaCredito } from '../types/pedidos.types'

export const MOCK_PEDIDOS: Pedido[] = [
    {
        id: '1284', clienteId: 'c1', cliente: 'María Fernández', email: 'maria.f@gmail.com',
        productos: [
            { nombre: 'Remera oversize negra', cantidad: 2, precio: 12200, hue: 220 },
            { nombre: 'Pantalón cargo',        cantidad: 1, precio: 24500, hue: 140 },
        ],
        canal: 'Tienda', monto: 48900, estado: 'pendiente', fecha: '2026-05-17T14:32:00',
    },
    {
        id: '1283', clienteId: 'c2', cliente: 'Joaquín Pérez Iglesias', email: 'joaco.p@hotmail.com',
        productos: [{ nombre: 'Buzo capucha azul', cantidad: 1, precio: 22500, hue: 215 }],
        canal: 'Tienda', monto: 22500, estado: 'confirmado', fecha: '2026-05-17T13:08:00',
    },
    {
        id: '1282', clienteId: 'c3', cliente: 'Camila Rodríguez', email: 'cami.rod@gmail.com',
        productos: [
            { nombre: 'Zapatillas urbanas', cantidad: 1, precio: 45400, hue: 30 },
            { nombre: 'Medias pack x3',     cantidad: 2, precio: 11000, hue: 50 },
        ],
        canal: 'Manual', monto: 67400, estado: 'preparacion', fecha: '2026-05-17T11:45:00',
    },
    {
        id: '1281', clienteId: 'c4', cliente: 'Lucas Giménez', email: 'lucas.g@outlook.com',
        productos: [{ nombre: 'Campera rompevientos', cantidad: 1, precio: 89000, hue: 200 }],
        canal: 'Tienda', monto: 89000, estado: 'enviado', fecha: '2026-05-17T10:12:00',
    },
    {
        id: '1280', clienteId: 'c5', cliente: 'Sofía Martínez', email: 'sofi.mtz@gmail.com',
        productos: [
            { nombre: 'Vestido midi', cantidad: 1, precio: 38200, hue: 280 },
            { nombre: 'Cartera',      cantidad: 1, precio: 16000, hue: 40 },
        ],
        canal: 'Tienda', monto: 54200, estado: 'entregado', fecha: '2026-05-16T19:50:00',
    },
    {
        id: '1279', clienteId: 'c11', cliente: 'Tomás Álvarez', email: 't.alvarez@gmail.com',
        productos: [
            { nombre: 'Mate imperial', cantidad: 1, precio: 24800, hue: 140 },
            { nombre: 'Bombilla',      cantidad: 1, precio: 7000,  hue: 60 },
        ],
        canal: 'Manual', monto: 31800, estado: 'entregado', fecha: '2026-05-16T17:22:00',
    },
    {
        id: '1278', clienteId: 'c6', cliente: 'Valentina Sosa', email: 'valen.sosa@gmail.com',
        productos: [{ nombre: 'Set skincare', cantidad: 1, precio: 42600, hue: 330 }],
        canal: 'Tienda', monto: 42600, estado: 'cancelado', fecha: '2026-05-16T16:01:00',
    },
    {
        id: '1277', clienteId: 'c12', cliente: 'Mateo Rojas', email: 'mateo.r@gmail.com',
        productos: [{ nombre: 'Auriculares', cantidad: 1, precio: 38900, hue: 220 }],
        canal: 'Tienda', monto: 38900, estado: 'pendiente', fecha: '2026-05-16T14:18:00',
    },
]

export const MOCK_DEVOLUCIONES: Devolucion[] = [
    { id: 'DEV-0012', cliente: 'Camila Rodríguez', producto: 'Zapatillas urbanas', cantidad: 1, monto: 34900, hue: 30,  motivo: 'Talle incorrecto',   estado: 'pendiente' },
    { id: 'DEV-0011', cliente: 'Sofía Martínez',   producto: 'Vestido midi',       cantidad: 1, monto: 28900, hue: 280, motivo: 'No era lo esperado', estado: 'proceso'   },
    { id: 'DEV-0010', cliente: 'Mateo Rojas',      producto: 'Auriculares',        cantidad: 1, monto: 38900, hue: 220, motivo: 'Defectuoso',         estado: 'pendiente' },
]

export const MOCK_NOTAS_CREDITO: NotaCredito[] = [
    { id: 'NC-0034', cliente: 'Valentina Sosa', pedidoId: '1278', monto: 42600, tipo: 'Saldo a favor', estado: 'emitida',  vence: '30 jun' },
    { id: 'NC-0033', cliente: 'Tomás Álvarez',  pedidoId: '1279', monto: 15000, tipo: 'Reembolso',     estado: 'aplicada', vence: '—'      },
    { id: 'NC-0032', cliente: 'Lucas Giménez',  pedidoId: '1281', monto: 8900,  tipo: 'Saldo a favor', estado: 'emitida',  vence: '15 jul' },
]

// Reparto inicial de la cola de preparación (kanban) por id de pedido.
export const MOCK_COLA_INICIAL: Record<'preparar' | 'listo' | 'despachado', string[]> = {
    preparar:   ['1284', '1277'],
    listo:      ['1282'],
    despachado: ['1280', '1279'],
}

// Catálogo reducido para el paso de productos del alta manual de pedidos.
export interface ProductoRapido {
    id:     string
    nombre: string
    precio: number
    hue:    number
}

export const MOCK_PRODUCTOS_RAPIDOS: ProductoRapido[] = [
    { id: 'p1', nombre: 'Campera bomber beige arena', precio: 89000, hue: 35  },
    { id: 'p2', nombre: 'Remera oversize negra',      precio: 24900, hue: 220 },
    { id: 'p3', nombre: 'Buzo frisa con capucha',     precio: 38500, hue: 215 },
    { id: 'p4', nombre: 'Jean tiro medio celeste',    precio: 56000, hue: 200 },
    { id: 'p5', nombre: 'Jogger gris melange',        precio: 34500, hue: 210 },
    { id: 'p6', nombre: 'Gorra trucker bordada',      precio: 15900, hue: 30  },
]
