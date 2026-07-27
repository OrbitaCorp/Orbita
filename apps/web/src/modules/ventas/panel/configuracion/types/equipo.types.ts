// src/modules/ventas/panel/configuracion/types/equipo.types.ts
// Tipos del sistema de equipo, roles y permisos.

export type GrupoPermiso =
    | 'Pedidos'
    | 'Clientes'
    | 'Reportes'
    | 'Inventario'
    | 'Descuentos'
    | 'Configuración'
    | 'Catálogo'   // agregado en Fase 1: el backend también tiene permisos de catálogo

export interface Permiso {
    id:    string
    grupo: GrupoPermiso
    label: string
    desc?: string          // opcional: los permisos reales del backend vienen sin descripción
}

export interface Rol {
    id:          string
    nombre:      string
    descripcion: string
    color:       string
    esDefault:   boolean    // los roles default (Dueño) no se editan ni eliminan
    permisos:    string[]   // ids de Permiso
    miembros:    number     // derivado — se recalcula al cambiar miembros
}

export type EstadoMiembro = 'activo' | 'pendiente'

export interface Miembro {
    id:           string
    nombre:       string
    email:        string
    rol:          string          // id de Rol
    estado:       EstadoMiembro
    passwordTemp: boolean         // debe cambiar contraseña en el próximo acceso
    ultimoAcceso: string | null   // ISO 8601 — null si nunca entró
}
