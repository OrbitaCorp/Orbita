// src/modules/ventas/panel/configuracion/Equipo.tsx — Vista 17
// Equipo y permisos: tabla de miembros (rol, último acceso, acciones) y
// gestión de roles con matriz de permisos. Modales: invitar, editar, rol, email.

import { useEffect, useRef, useState } from 'react'
import { Shield, UserPlus, Pencil, Mail, MoreVertical, Key, Trash2, Plus, Check } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'

import type { VistaConfig } from './components/ConfigTabs'
import { RolChip, RolCard } from './components/equipo/RolBits'
import { ModalInvitar } from './components/equipo/ModalInvitar'
import { ModalRol } from './components/equipo/ModalRol'
import { ModalEditarMiembro } from './components/equipo/ModalEditarMiembro'
import { ModalEmailMiembro } from './components/equipo/ModalEmailMiembro'
import { ROLES0, MIEMBROS0, PERMISOS, GRUPOS, fmtAcceso, genPassword } from './mock/equipo.mock'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, getRoles, getPermissionsCatalog, createRole, updateRole, deleteRole, type ApiRole } from '@/lib/api'
import type { Rol, Miembro, Permiso, GrupoPermiso } from './types/equipo.types'

const COLS = '1.6fr 1.4fr 130px 150px 110px 100px'

type ModalState =
    | { type: 'invitar' }
    | { type: 'editar-miembro'; m: Miembro }
    | { type: 'rol'; rol?: Rol; mode: 'create' | 'edit' | 'view' }
    | { type: 'email'; m: Miembro }
    | null

interface EquipoProps {
    ir:      (v: VistaConfig) => void
    onToast: (m: string) => void
}

export default function Equipo({ ir, onToast }: EquipoProps) {
    const [roles, setRoles] = useState<Rol[]>(ROLES0)
    const [miembros, setMiembros] = useState<Miembro[]>(MIEMBROS0)
    const [sub, setSub] = useState<'miembros' | 'roles'>('miembros')
    const [modal, setModal] = useState<ModalState>(null)

    // ── Roles de verdad (Fase 1 — tarea 5): la pestaña Roles ya trabaja contra la
    // base real. Miembros sigue con datos de muestra: esa parte es de la Fase 5.
    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'
    const [rolesReales, setRolesReales] = useState(false)
    const [catalogo, setCatalogo] = useState<Permiso[]>(PERMISOS)
    const [grupos, setGrupos] = useState<GrupoPermiso[]>(GRUPOS)
    const [guardandoRol, setGuardandoRol] = useState(false)

    // Los roles que vienen de fábrica llegan con el nombre en inglés (owner, admin...):
    // acá los muestro en español. A los roles creados a mano no les cambio nada.
    const NOMBRES_ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', empleado: 'Empleado' }
    // Convierte un rol tal como viene del backend al formato que usan estas pantallas.
    const mapRol = (r: ApiRole): Rol => ({
        id: r.id,
        nombre: NOMBRES_ROL[r.name] ?? r.name,
        descripcion: r.description ?? '',
        color: r.color ?? '#3B82F6',
        esDefault: r.isDefault,
        permisos: r.permissions,
        miembros: r.memberCount,
    })

    // Trae de la base los roles y el catálogo completo de permisos, listos para mostrar.
    async function cargarRoles() {
        const [rs, perms] = await Promise.all([getRoles(), getPermissionsCatalog()])
        setCatalogo(perms.map(pm => ({ id: pm.code, grupo: pm.group as GrupoPermiso, label: pm.label })))
        setGrupos([...new Set(perms.map(pm => pm.group))] as GrupoPermiso[])
        setRoles(rs.map(mapRol))
        setRolesReales(true)
    }
    useEffect(() => {
        if (!esDueno) return
        cargarRoles().catch(() => { /* sin sesión o backend caído: la vista sigue con datos de muestra */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [esDueno])

    // Va actualizando cuántos miembros tiene cada rol (solo con los datos de
    // muestra: con roles reales ese número ya viene contado desde el backend).
    useEffect(() => {
        if (rolesReales) return
        setRoles(rs => rs.map(r => ({ ...r, miembros: miembros.filter(m => m.rol === r.id).length })))
    }, [miembros, rolesReales])

    // Los miembros de muestra apuntan a roles de muestra viejos ('dueno', 'vendedor');
    // acá los emparejo con el rol real que corresponde para que la tabla no se rompa.
    const ALIAS_MOCK: Record<string, string> = { dueno: 'Dueño', admin: 'Administrador', vendedor: 'Empleado' }
    const rolById = (id: string) => roles.find(r => r.id === id) ?? roles.find(r => r.nombre === ALIAS_MOCK[id]) ?? roles[0]

    const cambiarRol = (mid: string, rid: string) => {
        setMiembros(ms => ms.map(m => m.id === mid ? { ...m, rol: rid } : m))
        onToast('Rol actualizado')
    }
    const quitar = (mid: string) => {
        setMiembros(ms => ms.filter(m => m.id !== mid))
        onToast('Miembro quitado del equipo')
    }
    const resetPassword = (mid: string) => {
        setMiembros(ms => ms.map(x => x.id === mid ? { ...x, passwordTemp: true } : x))
        onToast(`Contraseña reseteada · ${genPassword()}`)
    }

    return (
        <div style={pageWrap}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Equipo y permisos</h1>
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 4 }}>Gestioná quién tiene acceso y qué puede hacer.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" icon={<Shield size={15} />} onClick={() => setSub('roles')}>Gestionar roles</Button>
                    <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setModal({ type: 'invitar' })}>Invitar miembro</Button>
                </div>
            </div>

            {/* Segmented */}
            <div style={{ display: 'inline-flex', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3, marginBottom: 20 }}>
                {([['miembros', `Miembros (${miembros.length})`], ['roles', `Roles (${roles.length})`]] as ['miembros' | 'roles', string][]).map(([id, l]) => {
                    const a = sub === id
                    return <button key={id} onClick={() => setSub(id)} style={{ height: 32, padding: '0 16px', borderRadius: 6, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{l}</button>
                })}
            </div>

            {sub === 'miembros' ? (
                /* ── Tabla de miembros ── */
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'visible' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '0 20px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderRadius: '12px 12px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Miembro</span><span>Email</span><span>Rol</span><span>Último acceso</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
                    </div>
                    {miembros.map((m, i) => {
                        const rol = rolById(m.rol)
                        return (
                            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '0 20px', height: 64, borderBottom: i < miembros.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <Avatar name={m.nombre} size={36} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nombre}</div>
                                        {m.passwordTemp && <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, padding: '0 6px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>Debe cambiar contraseña</span>}
                                    </div>
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
                                <div><RolDropdown rol={rol} roles={roles} disabled={m.rol === 'dueno'} onPick={rid => cambiarRol(m.id, rid)} /></div>
                                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtAcceso(m.ultimoAcceso)}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: m.estado === 'activo' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.estado === 'activo' ? '#10B981' : '#F59E0B' }} />
                                    {m.estado === 'activo' ? 'Activo' : 'Pendiente'}
                                </span>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                    <button title="Editar" onClick={() => setModal({ type: 'editar-miembro', m })} style={iconBtn}><Pencil size={14} strokeWidth={1.6} /></button>
                                    <button title="Email" onClick={() => setModal({ type: 'email', m })} style={iconBtn}><Mail size={14} strokeWidth={1.6} /></button>
                                    <RowMenu m={m} onReset={() => resetPassword(m.id)} onQuitar={() => quitar(m.id)} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* ── Grid de roles ── */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                    {roles.map(r => (
                        <RolCard
                            key={r.id}
                            r={r}
                            catalogo={catalogo}
                            onEdit={() => setModal({ type: 'rol', rol: r, mode: r.esDefault ? 'view' : 'edit' })}
                            onDelete={async () => {
                                if (r.miembros > 0) { onToast(`No se puede eliminar: ${r.miembros} miembro(s) con este rol`); return }
                                if (rolesReales) {
                                    try { await deleteRole(r.id); await cargarRoles() }
                                    catch (e) { onToast(e instanceof ApiError ? e.message : 'No se pudo eliminar el rol'); return }
                                } else {
                                    setRoles(rs => rs.filter(x => x.id !== r.id))
                                }
                                onToast(`Rol "${r.nombre}" eliminado`)
                            }}
                        />
                    ))}
                    <button onClick={() => setModal({ type: 'rol', mode: 'create' })} style={{ border: '1.5px dashed var(--color-border-strong)', borderRadius: 14, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 200, color: 'var(--color-muted)' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center' }}><Plus size={22} strokeWidth={2} /></div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Nuevo rol</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: 'center' }}>Definí permisos personalizados</div>
                    </button>
                </div>
            )}

            {/* Modales */}
            {modal?.type === 'invitar' && (
                <ModalInvitar
                    roles={roles}
                    existing={miembros}
                    onClose={() => setModal(null)}
                    onInvite={nm => { setMiembros(ms => [...ms, nm]); setModal(null); onToast(`Invitación enviada a ${nm.email}`) }}
                />
            )}
            {modal?.type === 'editar-miembro' && (
                <ModalEditarMiembro
                    miembro={modal.m}
                    roles={roles}
                    onClose={() => setModal(null)}
                    onSave={upd => { setMiembros(ms => ms.map(x => x.id === upd.id ? upd : x)); setModal(null); onToast(`Cambios guardados para ${upd.nombre}`) }}
                    onToast={onToast}
                />
            )}
            {modal?.type === 'rol' && (
                <ModalRol
                    rol={modal.rol}
                    mode={modal.mode}
                    catalogo={catalogo}
                    grupos={grupos}
                    saving={guardandoRol}
                    onClose={() => setModal(null)}
                    onSave={async (r, isNew) => {
                        if (rolesReales) {
                            // Guarda el rol en la base de verdad y vuelve a traer la lista actualizada.
                            setGuardandoRol(true)
                            try {
                                const input = { name: r.nombre, description: r.descripcion || undefined, color: r.color, permissions: r.permisos }
                                if (isNew) await createRole(input)
                                else await updateRole(r.id, input)
                                await cargarRoles()
                            } catch (e) {
                                onToast(e instanceof ApiError ? e.message : 'No se pudo guardar el rol')
                                setGuardandoRol(false)
                                return
                            }
                            setGuardandoRol(false)
                        } else {
                            if (isNew) setRoles(rs => [...rs, r])
                            else setRoles(rs => rs.map(x => x.id === r.id ? r : x))
                        }
                        setModal(null)
                        onToast(isNew ? `Rol "${r.nombre}" creado` : `Rol "${r.nombre}" actualizado`)
                    }}
                />
            )}
            {modal?.type === 'email' && (
                <ModalEmailMiembro
                    miembro={modal.m}
                    onClose={() => setModal(null)}
                    onSend={em => { setModal(null); onToast(`Email enviado a ${em}`) }}
                />
            )}
        </div>
    )
}

// ─── Dropdown de rol inline en la tabla ───────────────────────────────────────

function RolDropdown({ rol, roles, disabled, onPick }: { rol: Rol; roles: Rol[]; disabled?: boolean; onPick: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        window.addEventListener('mousedown', c)
        return () => window.removeEventListener('mousedown', c)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => !disabled && setOpen(!open)} style={{ background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RolChip rol={rol} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 160 }}>
                    {roles.filter(r => r.nombre !== 'Dueño').map(r => (
                        <button key={r.id} onClick={() => { onPick(r.id); setOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                            <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>{r.nombre}</span>
                            {rol.id === r.id && <Check size={14} strokeWidth={2.4} style={{ color: 'var(--color-primary)' }} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Menú contextual de la fila ───────────────────────────────────────────────

function RowMenu({ m, onReset, onQuitar }: { m: Miembro; onReset: () => void; onQuitar: () => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        window.addEventListener('mousedown', c)
        return () => window.removeEventListener('mousedown', c)
    }, [open])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(!open)} style={iconBtn}><MoreVertical size={14} strokeWidth={1.6} /></button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 200 }}>
                    {m.estado === 'pendiente' && <MenuItem icon={<Mail size={14} strokeWidth={1.6} style={{ color: 'var(--color-muted)' }} />} onClick={() => { setOpen(false); onReset() }}>Reenviar invitación</MenuItem>}
                    <MenuItem icon={<Key size={14} strokeWidth={1.6} style={{ color: 'var(--color-muted)' }} />} onClick={() => { setOpen(false); onReset() }}>Resetear contraseña</MenuItem>
                    {m.rol !== 'dueno' && (
                        <>
                            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                            <MenuItem danger icon={<Trash2 size={14} strokeWidth={1.6} style={{ color: 'var(--color-error)' }} />} onClick={() => { setOpen(false); onQuitar() }}>Quitar del equipo</MenuItem>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function MenuItem({ icon, children, danger, onClick }: { icon: React.ReactNode; children: React.ReactNode; danger?: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: danger ? 'var(--color-error)' : 'var(--color-text)', fontFamily: 'inherit' }}>
            {icon} {children}
        </button>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
