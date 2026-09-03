// src/modules/ventas/panel/configuracion/Equipo.tsx — Vista 17
// Equipo y permisos: tabla de miembros (rol, último acceso, acciones) y
// gestión de roles con matriz de permisos. Modales: invitar, editar, rol, email.
//
// (Fase 4 — Ale) La pestaña Miembros ahora también trabaja contra la base
// real: la lista sale de GET /members, invitar hace el alta de verdad (el
// backend genera la contraseña temporal y manda el email), editar guarda
// nombre y rol, quitar elimina, y resetear contraseña genera una temporal
// nueva para copiar o enviar por email. La pestaña Roles ya era real (Fase 1).

import { useEffect, useRef, useState } from 'react'
import { Shield, UserPlus, Pencil, Mail, MoreVertical, Key, Trash2, Plus, Check } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Avatar } from '@/design-system/components/Avatar'
import { Modal } from '@/design-system/components/Modal'
import { SkeletonCircle, SkeletonText, SkeletonChip } from '@/design-system/components/Skeleton'

import type { VistaConfig } from './components/ConfigTabs'
import { RolChip, RolCard } from './components/equipo/RolBits'
import { ModalInvitar } from './components/equipo/ModalInvitar'
import { ModalRol } from './components/equipo/ModalRol'
import { ModalEditarMiembro } from './components/equipo/ModalEditarMiembro'
import { ROLES0, PERMISOS, GRUPOS, fmtAcceso } from './mock/equipo.mock'
import { useAuth } from '@/hooks/useAuth'
import {
    ApiError, getRoles, getPermissionsCatalog, createRole, updateRole, deleteRole,
    getMembers, inviteMember, updateMember, removeMember, resetMemberPassword,
    type ApiRole, type ApiMember,
} from '@/lib/api'
import type { Rol, Miembro, Permiso, GrupoPermiso } from './types/equipo.types'

const COLS = '1.6fr 1.4fr 130px 150px 110px 100px'

type ModalState =
    | { type: 'invitar' }
    | { type: 'editar-miembro'; m: Miembro }
    | { type: 'rol'; rol?: Rol; mode: 'create' | 'edit' | 'view' }
    | null

// Convierte un miembro como viene del backend al formato de estas pantallas.
const mapMiembro = (m: ApiMember): Miembro => ({
    id: m.id,
    nombre: m.name,
    email: m.email,
    rol: m.role.id,
    estado: m.status === 'ACTIVE' ? 'activo' : 'pendiente',
    passwordTemp: m.hasTempPassword,
    ultimoAcceso: m.lastAccessAt,
})

interface EquipoProps {
    ir:      (v: VistaConfig) => void
    onToast: (m: string) => void
}

export default function Equipo({ ir, onToast }: EquipoProps) {
    const [roles, setRoles] = useState<Rol[]>(ROLES0)
    const [miembros, setMiembros] = useState<Miembro[]>([])
    const [sub, setSub] = useState<'miembros' | 'roles'>('miembros')
    const [modal, setModal] = useState<ModalState>(null)

    const { status: authStatus, user } = useAuth()
    const esDueno = authStatus === 'authenticated' && user?.type === 'member'
    const [rolesReales, setRolesReales] = useState(false)
    const [catalogo, setCatalogo] = useState<Permiso[]>(PERMISOS)
    const [grupos, setGrupos] = useState<GrupoPermiso[]>(GRUPOS)
    const [guardandoRol, setGuardandoRol] = useState(false)
    const [guardandoMiembro, setGuardandoMiembro] = useState(false)

    const [cargandoMiembros, setCargandoMiembros] = useState(true)
    const [errorMiembros, setErrorMiembros] = useState<string | null>(null)
    const [reintento, setReintento] = useState(0)

    // Los roles que vienen de fábrica llegan con el nombre en inglés (owner, admin...):
    // acá los muestro en español. A los roles creados a mano no les cambio nada.
    // owner y admin son el MISMO rol para el negocio (acceso total): los dos se
    // llaman "Propietario" — decisión del equipo, una sola palabra en toda la app.
    const NOMBRES_ROL: Record<string, string> = { owner: 'Propietario', admin: 'Propietario', empleado: 'Empleado' }
    // Colores canónicos de los roles de fábrica. Los negocios creados antes
    // del arreglo del seed quedaron con negro/grises guardados en la base
    // ("todo apagado", ilegible en dark): para owner/admin/empleado manda el
    // color canónico; un rol custom usa el color que eligió el negocio.
    const COLORES_ROL: Record<string, string> = { owner: '#3B82F6', admin: '#3B82F6', empleado: '#10B981' }
    const mapRol = (r: ApiRole): Rol => ({
        id: r.id,
        nombre: NOMBRES_ROL[r.name] ?? r.name,
        descripcion: r.description ?? '',
        color: COLORES_ROL[r.name] ?? r.color ?? '#3B82F6',
        esDefault: r.isDefault,
        permisos: r.permissions,
        miembros: r.memberCount,
    })

    // Trae de la base los roles y el catálogo completo de permisos.
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

    // Los miembros reales, con su silueta mientras cargan.
    useEffect(() => {
        if (!esDueno) return
        let cancelado = false
        setCargandoMiembros(true)
        getMembers()
            .then(ms => { if (!cancelado) { setMiembros(ms.map(mapMiembro)); setErrorMiembros(null) } })
            .catch(e => { if (!cancelado) setErrorMiembros(e instanceof ApiError ? e.message : 'No se pudo cargar el equipo') })
            .finally(() => { if (!cancelado) setCargandoMiembros(false) })
        return () => { cancelado = true }
    }, [esDueno, reintento])

    async function recargarMiembros() {
        try { setMiembros((await getMembers()).map(mapMiembro)) } catch { /* la próxima acción lo reintenta */ }
    }

    const rolById = (id: string) => roles.find(r => r.id === id) ?? roles[0]
    const esFilaDueno = (m: Miembro) => rolById(m.rol)?.nombre === 'Propietario'

    const cambiarRol = async (mid: string, rid: string) => {
        const previo = miembros
        setMiembros(ms => ms.map(m => m.id === mid ? { ...m, rol: rid } : m))
        try {
            await updateMember(mid, { roleId: rid })
            onToast('Rol actualizado')
            void cargarRoles()   // actualiza el contador de miembros por rol
        } catch (e) {
            setMiembros(previo)
            onToast(e instanceof ApiError ? e.message : 'No se pudo cambiar el rol')
        }
    }

    // Quitar pide confirmación primero (es destructivo): el menú setea
    // `confirmQuitar` y el modal de abajo es el que ejecuta de verdad.
    const [confirmQuitar, setConfirmQuitar] = useState<Miembro | null>(null)
    const [quitando, setQuitando] = useState(false)

    const quitar = async (mid: string) => {
        const m = miembros.find(x => x.id === mid)
        setQuitando(true)
        try {
            await removeMember(mid)
            setMiembros(ms => ms.filter(x => x.id !== mid))
            onToast(m ? `${m.nombre} fue quitado del equipo` : 'Miembro quitado del equipo')
            void cargarRoles()
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo quitar al miembro')
        } finally {
            setQuitando(false)
            setConfirmQuitar(null)
        }
    }

    // "Reenviar invitación" para pendientes: genera clave temporal nueva y la
    // manda por email — es exactamente lo que necesita alguien que no la recibió.
    const reenviarInvitacion = async (m: Miembro) => {
        try {
            await resetMemberPassword(m.id, true)
            onToast(`Invitación reenviada a ${m.email}`)
            void recargarMiembros()
        } catch (e) {
            onToast(e instanceof ApiError ? e.message : 'No se pudo reenviar la invitación')
        }
    }

    return (
        <div className="eq-page panel-page">
            <style>{`
                @media (max-width: 768px) {
                    .eq-head    { align-items: stretch !important; }
                    .eq-head h1 { font-size: 21px !important; }
                    /* Los permisos por rol en tres columnas quedaban de 110px. */
                    .eq-perm-cols { grid-template-columns: minmax(0,1fr) !important; }

                    /* Ficha de miembro: nombre y rol en el primer renglón, el
                       mail en el segundo, y al pie estado, último acceso y las
                       acciones. Se arma reordenando las mismas celdas de la
                       tabla con flex-wrap y order, sin JSX aparte. */
                    .ds-tabla-fila.eq-fila {
                        flex-direction: row !important;
                        flex-wrap: wrap !important;
                        align-items: center !important;
                        gap: 7px 10px !important;
                        padding: 14px !important;
                    }
                    .eq-fila > [data-col] { text-align: left !important; }
                    /* Las etiquetas sobran: cada dato se reconoce solo. */
                    .eq-fila > [data-col]::before { display: none !important; }
                    .eq-fila > [data-col="Miembro"]        { flex: 1 1 auto !important; min-width: 50% !important; }
                    .eq-fila > [data-col="Rol"]            { flex: 0 0 auto !important; margin-left: auto !important; }
                    .eq-fila > [data-col="Email"]          { order: 3; flex: 1 1 100% !important; font-size: 12px !important; }
                    /* Separador fino antes del pie, para que estado y acceso no
                       se lean como parte del mail. */
                    .eq-fila > [data-col="Estado"] {
                        order: 4; flex: 0 0 auto !important;
                        padding-top: 8px !important;
                        border-top: 1px solid var(--color-border);
                        width: 100% !important;
                    }
                    .eq-fila > [data-col="Último acceso"]  { order: 5; flex: 1 1 auto !important; font-size: 11.5px !important; }
                    .eq-fila > [data-col=""]               { order: 6; flex: 0 0 auto !important; margin-left: auto !important; }
                }
            `}</style>
            {/* Header */}
            <div className="eq-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
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
                    return <button key={id} onClick={() => setSub(id)} className="ds-hover" style={{ height: 32, padding: '0 16px', borderRadius: 6, border: 'none', background: a ? 'var(--color-bg)' : 'transparent', color: a ? 'var(--color-text)' : 'var(--color-muted)', fontSize: 13, fontWeight: a ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>{l}</button>
                })}
            </div>

            {sub === 'miembros' ? (
                /* ── Tabla de miembros ── */
                <div className="ds-tabla" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'visible' }}>
                    <div className="ds-tabla-head" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '0 20px', height: 44, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderRadius: '12px 12px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Miembro</span><span>Email</span><span>Rol</span><span>Último acceso</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
                    </div>

                    {errorMiembros && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
                            <span style={{ fontSize: 13, color: 'var(--color-error)', flex: 1 }}>{errorMiembros}</span>
                            <Button variant="outline" size="sm" onClick={() => setReintento(n => n + 1)}>Reintentar</Button>
                        </div>
                    )}

                    {cargandoMiembros && !errorMiembros ? (
                        /* Silueta de la tabla real: avatar + nombre, email, rol, acceso, estado */
                        <div aria-hidden="true">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="ds-tabla-fila eq-fila" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '0 20px', height: 64, borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <SkeletonCircle size={36} delay={i * 110} />
                                        <SkeletonText width={`${[52, 40, 60][i]}%`} height={12} delay={i * 110 + 40} />
                                    </div>
                                    <SkeletonText width="70%" height={11} delay={i * 110 + 60} />
                                    <SkeletonChip width={92} delay={i * 110 + 80} />
                                    <SkeletonText width={64} height={11} delay={i * 110 + 100} />
                                    <SkeletonChip width={64} delay={i * 110 + 120} />
                                    <span />
                                </div>
                            ))}
                        </div>
                    ) : !errorMiembros && miembros.length === 0 ? (
                        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--color-muted)' }}>
                            Todavía no hay miembros en el equipo. Invitá al primero con el botón de arriba.
                        </div>
                    ) : (
                        miembros.map((m, i) => {
                            const rol = rolById(m.rol)
                            const dueno = esFilaDueno(m)
                            return (
                                <div key={m.id} className="ds-tabla-fila eq-fila" style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', gap: 12, padding: '0 20px', height: 64, borderBottom: i < miembros.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                    <div data-col="Miembro" data-principal style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <Avatar name={m.nombre} size={36} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nombre}</div>
                                            {m.passwordTemp && <span style={{ display: 'inline-flex', alignItems: 'center', height: 16, padding: '0 6px', borderRadius: 9999, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>Debe cambiar contraseña</span>}
                                        </div>
                                    </div>
                                    <span data-col="Email" style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
                                    <div data-col="Rol"><RolDropdown rol={rol} roles={roles} disabled={dueno} onPick={rid => void cambiarRol(m.id, rid)} /></div>
                                    <span data-col="Último acceso" style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{fmtAcceso(m.ultimoAcceso)}</span>
                                    <span data-col="Estado" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: m.estado === 'activo' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.estado === 'activo' ? '#10B981' : '#F59E0B' }} />
                                        {m.estado === 'activo' ? 'Activo' : 'Pendiente'}
                                    </span>
                                    <div data-col="" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                        <button title="Editar" onClick={() => setModal({ type: 'editar-miembro', m })} className="ds-hover" style={iconBtn}><Pencil size={14} strokeWidth={1.6} /></button>
                                        {/* El email libre a un miembro no tiene endpoint todavía: se quitó
                                            el botón para no mostrar un "enviado" falso. El acceso/clave sí
                                            se manda por email desde "Resetear contraseña". */}
                                        <RowMenu
                                            m={m}
                                            esDueno={dueno}
                                            onReenviar={() => void reenviarInvitacion(m)}
                                            onReset={() => setModal({ type: 'editar-miembro', m })}
                                            onQuitar={() => setConfirmQuitar(m)}
                                        />
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            ) : (
                /* ── Grid de roles ── */
                <div className="eq-perm-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                    {roles.map(r => (
                        <RolCard
                            key={r.id}
                            r={r}
                            catalogo={catalogo}
                            // El dueño es solo lectura (no te podés dejar afuera de tu
                            // propio negocio); admin y empleado abren en edición para
                            // tildar/destildar permisos — el backend igual protege el
                            // nombre y el color de los roles de fábrica.
                            onEdit={() => setModal({ type: 'rol', rol: r, mode: r.esDefault && r.nombre === 'Propietario' ? 'view' : 'edit' })}
                            onDelete={async () => {
                                if (r.miembros > 0) { onToast(`No se puede eliminar: ${r.miembros} miembro(s) con este rol`); return }
                                if (!rolesReales) {
                                    onToast('No se pudieron cargar los roles del negocio. Recargá e intentá de nuevo.')
                                    return
                                }
                                try { await deleteRole(r.id); await cargarRoles() }
                                catch (e) { onToast(e instanceof ApiError ? e.message : 'No se pudo eliminar el rol'); return }
                                onToast(`Rol "${r.nombre}" eliminado`)
                            }}
                        />
                    ))}
                    <button onClick={() => setModal({ type: 'rol', mode: 'create' })} className="ds-hover" style={{ border: '1.5px dashed var(--color-border-strong)', borderRadius: 14, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 200, color: 'var(--color-muted)' }}>
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
                    catalogo={catalogo}
                    onClose={() => setModal(null)}
                    onInvite={async ({ nombre, email, rolId }) => {
                        const r = await inviteMember({ name: nombre, email, roleId: rolId })
                        onToast(`Invitación enviada a ${email}`)
                        void recargarMiembros()
                        void cargarRoles()
                        return { tempPassword: r.tempPassword }
                    }}
                />
            )}
            {modal?.type === 'editar-miembro' && (
                <ModalEditarMiembro
                    miembro={modal.m}
                    roles={roles}
                    esDueno={esFilaDueno(modal.m)}
                    saving={guardandoMiembro}
                    catalogo={catalogo}
                    grupos={grupos}
                    onClose={() => setModal(null)}
                    onSave={async upd => {
                        setGuardandoMiembro(true)
                        try {
                            await updateMember(upd.id, { name: upd.nombre, roleId: upd.rol })
                            await recargarMiembros()
                            void cargarRoles()
                            setModal(null)
                            onToast(`Cambios guardados para ${upd.nombre}`)
                        } catch (e) {
                            onToast(e instanceof ApiError ? e.message : 'No se pudieron guardar los cambios')
                        } finally {
                            setGuardandoMiembro(false)
                        }
                    }}
                    onToast={onToast}
                    onResetPassword={async sendEmail => {
                        const r = await resetMemberPassword(modal.m.id, sendEmail)
                        void recargarMiembros()
                        return r
                    }}
                />
            )}
            {/* Confirmación antes de quitar: es destructivo (pierde el acceso
                al toque) y antes se ejecutaba directo desde el menú. */}
            <Modal
                isOpen={confirmQuitar !== null}
                onClose={() => { if (!quitando) setConfirmQuitar(null) }}
                title={confirmQuitar ? `¿Quitar a ${confirmQuitar.nombre} del equipo?` : ''}
                variant="danger"
                footer={
                    <>
                        <Button variant="secondary" disabled={quitando} onClick={() => setConfirmQuitar(null)}>Cancelar</Button>
                        <Button variant="danger" loading={quitando} onClick={() => { if (confirmQuitar) void quitar(confirmQuitar.id) }}>Sí, quitar</Button>
                    </>
                }
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    Pierde el acceso al panel en el momento. Si más adelante lo necesitás de
                    vuelta, lo invitás de nuevo desde acá.
                </div>
            </Modal>
            {modal?.type === 'rol' && (
                <ModalRol
                    rol={modal.rol}
                    mode={modal.mode}
                    catalogo={catalogo}
                    grupos={grupos}
                    saving={guardandoRol}
                    onClose={() => setModal(null)}
                    onSave={async (r, isNew) => {
                        // Sin roles reales cargados (backend caído / sin sesión) NO
                        // se hace un alta local de mentira: se avisa y se corta, en
                        // vez de mostrar "Rol creado" sobre datos de muestra.
                        if (!rolesReales) {
                            onToast('No se pudieron cargar los roles del negocio. Recargá e intentá de nuevo.')
                            return
                        }
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
                        setModal(null)
                        onToast(isNew ? `Rol "${r.nombre}" creado` : `Rol "${r.nombre}" actualizado`)
                    }}
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
            {/* borderRadius de pill para que el velo de hover siga la forma del chip */}
            <button onClick={() => !disabled && setOpen(!open)} className="ds-hover" data-disabled={disabled || undefined} style={{ background: 'none', border: 'none', padding: 0, borderRadius: 9999, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RolChip rol={rol} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 160 }}>
                    {roles.filter(r => r.nombre !== 'Propietario').map(r => (
                        <button key={r.id} onClick={() => { onPick(r.id); setOpen(false) }} className="ds-hover" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
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

function RowMenu({ m, esDueno, onReenviar, onReset, onQuitar }: { m: Miembro; esDueno: boolean; onReenviar: () => void; onReset: () => void; onQuitar: () => void }) {
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
            <button onClick={() => setOpen(!open)} className="ds-hover" style={iconBtn}><MoreVertical size={14} strokeWidth={1.6} /></button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 200 }}>
                    {m.estado === 'pendiente' && <MenuItem icon={<Mail size={14} strokeWidth={1.6} style={{ color: 'var(--color-muted)' }} />} onClick={() => { setOpen(false); onReenviar() }}>Reenviar invitación</MenuItem>}
                    {!esDueno && <MenuItem icon={<Key size={14} strokeWidth={1.6} style={{ color: 'var(--color-muted)' }} />} onClick={() => { setOpen(false); onReset() }}>Resetear contraseña</MenuItem>}
                    {!esDueno && (
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
        <button onClick={onClick} className="ds-hover" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: danger ? 'var(--color-error)' : 'var(--color-text)', fontFamily: 'inherit' }}>
            {icon} {children}
        </button>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }
