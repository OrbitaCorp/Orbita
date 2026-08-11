// src/modules/ventas/panel/configuracion/mock/equipo.mock.ts
// TODO: reemplazar por el backend cuando esté listo.
// Catálogo de permisos, roles base y miembros del equipo — Rama Indumentaria.

import type { Permiso, Rol, Miembro, GrupoPermiso } from '../types/equipo.types'

export const PERMISOS: Permiso[] = [
    { id: 'ver_pedidos',      grupo: 'Pedidos',       label: 'Ver pedidos',            desc: 'Acceder a la lista de pedidos' },
    { id: 'editar_pedidos',   grupo: 'Pedidos',       label: 'Gestionar pedidos',      desc: 'Confirmar, cancelar y editar pedidos' },
    { id: 'nuevo_pedido',     grupo: 'Pedidos',       label: 'Crear pedidos manuales', desc: 'Crear pedidos desde el panel' },
    { id: 'ver_historial',    grupo: 'Pedidos',       label: 'Ver historial',          desc: 'Acceder al historial completo' },
    { id: 'devoluciones',     grupo: 'Pedidos',       label: 'Gestionar devoluciones', desc: 'Aprobar o rechazar devoluciones' },
    { id: 'ver_clientes',     grupo: 'Clientes',      label: 'Ver clientes',           desc: 'Acceder a la base de clientes' },
    { id: 'editar_clientes',  grupo: 'Clientes',      label: 'Editar clientes',        desc: 'Modificar datos y notas' },
    { id: 'exportar',         grupo: 'Clientes',      label: 'Exportar datos',         desc: 'Descargar listas en CSV/PDF' },
    { id: 'ver_reportes',     grupo: 'Reportes',      label: 'Ver reportes',           desc: 'Acceder a reportes de ventas' },
    { id: 'ver_inventario',   grupo: 'Inventario',    label: 'Ver inventario',         desc: 'Ver stock y movimientos' },
    { id: 'editar_stock',     grupo: 'Inventario',    label: 'Modificar stock',        desc: 'Entradas y ajustes de stock' },
    { id: 'ver_descuentos',   grupo: 'Descuentos',    label: 'Ver descuentos',         desc: 'Ver cupones y promos' },
    { id: 'crear_descuentos', grupo: 'Descuentos',    label: 'Crear descuentos',       desc: 'Crear y editar cupones' },
    { id: 'ver_config',       grupo: 'Configuración', label: 'Ver configuración',      desc: 'Acceder a ajustes generales' },
    { id: 'editar_config',    grupo: 'Configuración', label: 'Editar configuración',   desc: 'Modificar ajustes del negocio' },
    { id: 'gestionar_equipo', grupo: 'Configuración', label: 'Gestionar equipo',       desc: 'Invitar y quitar miembros' },
]

export const GRUPOS: GrupoPermiso[] = ['Pedidos', 'Clientes', 'Reportes', 'Inventario', 'Descuentos', 'Configuración']

export const ROL_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0F172A', '#6B7280']

export const ROLES0: Rol[] = [
    {
        id: 'dueno', nombre: 'Dueño', color: '#3B82F6', esDefault: true, miembros: 1,
        descripcion: 'Acceso completo a todo el panel. No se puede modificar.',
        permisos: PERMISOS.map(p => p.id),
    },
    {
        id: 'admin', nombre: 'Administrador', color: '#8B5CF6', esDefault: false, miembros: 0,
        descripcion: 'Acceso completo excepto zona peligrosa y permisos de equipo.',
        permisos: PERMISOS.filter(p => !['editar_config', 'gestionar_equipo'].includes(p.id)).map(p => p.id),
    },
    {
        id: 'vendedor', nombre: 'Vendedor', color: '#10B981', esDefault: false, miembros: 1,
        descripcion: 'Solo pedidos y cola. Sin reportes ni configuración.',
        permisos: ['ver_pedidos', 'editar_pedidos', 'nuevo_pedido', 'ver_clientes'],
    },
]

export const MIEMBROS0: Miembro[] = [
    { id: 'm1', nombre: 'Alexander Ibarra', email: 'alex@rama.com',   rol: 'dueno',    estado: 'activo',    passwordTemp: false, ultimoAcceso: '2026-05-17T14:32:00' },
    { id: 'm2', nombre: 'Rosa Manzano',     email: 'rosa@rama.com',   rol: 'vendedor', estado: 'activo',    passwordTemp: false, ultimoAcceso: '2026-05-17T09:15:00' },
    { id: 'm3', nombre: 'Carlos Vega',      email: 'carlos@rama.com', rol: 'vendedor', estado: 'pendiente', passwordTemp: true,  ultimoAcceso: null },
]

// ─── Helpers del dominio ──────────────────────────────────────────────────────

// Fecha de último acceso en lenguaje natural. "Hoy" relativo a la fecha mock.
export function fmtAcceso(iso: string | null): string {
    if (!iso) return 'Nunca'
    const d = new Date(iso)
    // Contra la fecha REAL de hoy — antes quedaba anclada a una fecha fija de
    // la época del mock y la cuenta daba negativa ("Hace -87 días").
    const today = new Date()
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (diff <= 0) return `Hoy a las ${hm}`
    if (diff === 1) return `Ayer a las ${hm}`
    return `Hace ${diff} días`
}

// Contraseña temporal legible (sin caracteres ambiguos como 0/O, 1/l).
export function genPassword(): string {
    const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let p = ''
    for (let i = 0; i < 12; i++) p += ch[Math.floor(Math.random() * ch.length)]
    return p
}
