// Modal de creación/edición/vista de un rol con su matriz de permisos
// agrupada por módulo, búsqueda y resumen con barras de progreso.

import { useState } from 'react'
import { Search, Check, Package, Users, LayoutGrid, Tag, Settings, ShoppingBag } from 'lucide-react'
import type { ComponentType } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Lbl, Inp, Toggle } from './FormBits'
import { ROL_COLORS } from '../../mock/equipo.mock'
import type { Rol, Permiso, GrupoPermiso } from '../../types/equipo.types'

const MODULE_ICONS: Record<GrupoPermiso, ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
    'Pedidos': Package, 'Clientes': Users, 'Reportes': LayoutGrid, 'Inventario': Package,
    'Descuentos': Tag, 'Configuración': Settings, 'Catálogo': ShoppingBag,
}

interface ModalRolProps {
    rol?:     Rol
    mode:     'create' | 'edit' | 'view'
    catalogo: Permiso[]          // catálogo de permisos (real desde la API, o de muestra)
    grupos:   GrupoPermiso[]
    saving?:  boolean
    onClose:  () => void
    onSave:   (r: Rol, isNew: boolean) => void
}

export function ModalRol({ rol, mode, catalogo, grupos, saving, onClose, onSave }: ModalRolProps) {
    const view = mode === 'view'
    const [nombre, setNombre] = useState(rol?.nombre ?? '')
    const [color, setColor] = useState(rol?.color ?? '#3B82F6')
    const [desc, setDesc] = useState(rol?.descripcion ?? '')
    const [perms, setPerms] = useState<string[]>(rol?.permisos ?? [])
    const [q, setQ] = useState('')

    const filtered = (g: GrupoPermiso) => catalogo.filter(p => p.grupo === g && (!q || p.label.toLowerCase().includes(q.toLowerCase())))
    const toggle = (id: string) => { if (view) return; setPerms(ps => ps.includes(id) ? ps.filter(x => x !== id) : [...ps, id]) }
    const toggleGroup = (g: GrupoPermiso) => {
        const gp = catalogo.filter(p => p.grupo === g).map(p => p.id)
        const all = gp.every(id => perms.includes(id))
        setPerms(ps => all ? ps.filter(x => !gp.includes(x)) : [...new Set([...ps, ...gp])])
    }
    const submit = () => {
        if (!nombre.trim() || perms.length === 0) return
        onSave({ id: rol?.id ?? 'rol' + Date.now(), nombre, color, descripcion: desc, esDefault: rol?.esDefault ?? false, permisos: perms, miembros: rol?.miembros ?? 0 }, mode === 'create')
    }

    const title = mode === 'create' ? 'Crear nuevo rol' : view ? `Permisos: ${rol?.nombre}` : `Editar rol: ${rol?.nombre}`

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={title}
            maxWidth={600}
            footer={view
                ? <Button variant="primary" onClick={onClose}>Cerrar</Button>
                : <><span style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--color-muted)' }}>{!nombre.trim() ? 'Poné un nombre al rol' : perms.length === 0 ? 'Elegí al menos un permiso' : ''}</span><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={saving} disabled={!nombre.trim() || perms.length === 0} onClick={submit}>{mode === 'create' ? 'Crear rol' : 'Guardar cambios'}</Button></>}
        >
            {/* Arreglo: la ventana era más alta que la pantalla y el título quedaba
                afuera. Ahora la lista de permisos se desliza adentro, y el título y los
                botones quedan siempre a la vista. */}
            <div style={{ maxHeight: '58vh', overflowY: 'auto', paddingRight: 6 }}>
            {!view && (
                <>
                    <Lbl>Nombre del rol</Lbl>
                    <Inp value={nombre} onChange={setNombre} placeholder="Ej: Encargado de depósito" autoFocus />
                    <div style={{ height: 16 }} />
                    <Lbl>Color del rol</Lbl>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        {ROL_COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer' }} />)}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <span style={{ display: 'inline-flex', height: 24, padding: '0 10px', borderRadius: 9999, background: color + '1F', color, border: `1px solid ${color}33`, fontSize: 12, fontWeight: 600, alignItems: 'center' }}>{nombre || 'Nuevo rol'}</span>
                    </div>
                    <Lbl>Descripción</Lbl>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 52, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none' }} />
                    <div style={{ height: 18 }} />
                </>
            )}

            {/* Búsqueda + acciones masivas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <Inp value={q} onChange={setQ} placeholder="Buscar permiso…" prefix={<Search size={15} strokeWidth={1.6} style={{ color: 'var(--color-muted)' }} />} />
                </div>
                {!view && (
                    <>
                        <button onClick={() => setPerms(catalogo.map(p => p.id))} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Todos</button>
                        <button onClick={() => setPerms([])} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Ninguno</button>
                    </>
                )}
            </div>

            {/* Permisos por grupo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {grupos.map(g => {
                    const gp = filtered(g)
                    if (!gp.length) return null
                    const allg = catalogo.filter(p => p.grupo === g)
                    const act = allg.filter(p => perms.includes(p.id)).length
                    const I = MODULE_ICONS[g] ?? Package
                    return (
                        <div key={g}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <I size={16} strokeWidth={1.6} style={{ color }} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{g}</span>
                                <span style={{ fontSize: 11, fontFamily: '"Geist Mono", monospace', color: 'var(--color-muted)', padding: '2px 7px', borderRadius: 9999, background: 'var(--color-surface-alt)' }}>{act}/{allg.length}</span>
                                <div style={{ flex: 1 }} />
                                {!view && <Toggle on={allg.every(p => perms.includes(p.id))} onChange={() => toggleGroup(g)} />}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {gp.map(p => {
                                    const on = perms.includes(p.id)
                                    return (
                                        <button key={p.id} onClick={() => toggle(p.id)} disabled={view} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${on ? color + '33' : 'var(--color-border)'}`, background: on ? color + '0F' : 'var(--color-bg)', cursor: view ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                            <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: on ? color : 'transparent', border: on ? 'none' : '1.5px solid var(--color-border)', display: 'grid', placeItems: 'center' }}>{on && <Check size={13} strokeWidth={2.6} color="#fff" />}</span>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{p.label}</div>
                                                {p.desc ? <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.3 }}>{p.desc}</div> : null}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Resumen */}
            <div style={{ marginTop: 18, padding: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Resumen del rol {nombre || ''}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>Acceso a {perms.length} de {catalogo.length} funcionalidades</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {grupos.map(g => {
                        const allg = catalogo.filter(p => p.grupo === g)
                        const act = allg.filter(p => perms.includes(p.id)).length
                        return (
                            <div key={g}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                    <span style={{ color: 'var(--color-body)' }}>{g}</span>
                                    <span style={{ color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{act}/{allg.length}</span>
                                </div>
                                <div style={{ height: 4, background: 'var(--color-surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${act / allg.length * 100}%`, background: color, borderRadius: 2, transition: 'width 200ms' }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            </div>
        </Modal>
    )
}
