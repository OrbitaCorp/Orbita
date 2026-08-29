// Modal para invitar un nuevo miembro: datos, rol y envío.
//
// (Fase 4 — Ale) Antes era maqueta: generaba una contraseña local y el
// "enviar" solo agregaba una fila en memoria. Ahora el alta la hace el
// backend (POST /members/invite): él genera la contraseña temporal, manda el
// email de invitación y la devuelve — acá se muestra al final para poder
// copiarla y pasársela al miembro por otro canal si hace falta.

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Lbl, Err, Inp, RolRadios } from './FormBits'
import type { Rol, Miembro } from '../../types/equipo.types'

interface ModalInvitarProps {
    roles:    Rol[]
    existing: Miembro[]
    catalogo: { id: string; label: string }[]
    onClose:  () => void
    // Hace el alta real contra el backend y devuelve la contraseña temporal.
    onInvite: (data: { nombre: string; email: string; rolId: string }) => Promise<{ tempPassword: string }>
}

export function ModalInvitar({ roles, existing, catalogo, onClose, onInvite }: ModalInvitarProps) {
    const rolesElegibles = roles.filter(r => r.nombre !== 'Dueño')
    const [nombre, setNombre] = useState('')
    const [email, setEmail] = useState('')
    const [rol, setRol] = useState(rolesElegibles.find(r => r.nombre === 'Empleado')?.id ?? rolesElegibles[0]?.id ?? '')
    const [err, setErr] = useState<{ nombre?: string; email?: string; general?: string }>({})
    const [enviando, setEnviando] = useState(false)
    // Cuando el backend confirma, se pasa a la pantalla de éxito con la clave.
    const [resultado, setResultado] = useState<{ email: string; tempPassword: string } | null>(null)
    const [copiada, setCopiada] = useState(false)

    const rolObj = roles.find(r => r.id === rol) ?? rolesElegibles[0]
    const permObjs = rolObj ? catalogo.filter(p => rolObj.permisos.includes(p.id)) : []

    const submit = async () => {
        if (enviando) return
        const e: { nombre?: string; email?: string } = {}
        if (!nombre.trim()) e.nombre = 'Ingresá el nombre'
        if (!email.trim()) e.email = 'Ingresá el email'
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Email inválido'
        else if (existing.some(m => m.email.toLowerCase() === email.toLowerCase())) e.email = 'Este email ya tiene acceso al panel'
        setErr(e)
        if (Object.keys(e).length) return

        setEnviando(true)
        try {
            const r = await onInvite({ nombre: nombre.trim(), email: email.trim(), rolId: rol })
            setResultado({ email: email.trim(), tempPassword: r.tempPassword })
        } catch (error) {
            setErr({ general: error instanceof Error ? error.message : 'No se pudo enviar la invitación' })
        } finally {
            setEnviando(false)
        }
    }

    const copiar = async () => {
        if (!resultado) return
        try {
            await navigator.clipboard.writeText(resultado.tempPassword)
            setCopiada(true)
            setTimeout(() => setCopiada(false), 2000)
        } catch { /* clipboard bloqueado: la clave queda visible para copiar a mano */ }
    }

    // ── Pantalla de éxito: la invitación ya salió, mostrar la clave temporal ──
    if (resultado) {
        return (
            <Modal
                isOpen
                onClose={onClose}
                title="Invitación enviada"
                maxWidth={480}
                footer={<Button variant="primary" onClick={onClose}>Listo</Button>}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.10)', color: 'var(--color-success)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Check size={18} strokeWidth={2.2} />
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                        Le mandamos a <strong style={{ color: 'var(--color-text)' }}>{resultado.email}</strong> un email con el acceso al panel y su contraseña temporal.
                    </div>
                </div>

                <Lbl help="Por si el email no le llega, pasásela por otro canal">Contraseña temporal</Lbl>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ flex: 1, padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', letterSpacing: '0.04em' }}>
                        {resultado.tempPassword}
                    </code>
                    <Button variant="outline" icon={copiada ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copiar()}>
                        {copiada ? 'Copiada' : 'Copiar'}
                    </Button>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
                    Deberá cambiarla en su primer acceso.
                </div>
            </Modal>
        )
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Invitar nuevo miembro"
            maxWidth={560}
            footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={enviando} onClick={() => void submit()}>Enviar invitación</Button></>}
        >
            <Lbl>Nombre completo</Lbl>
            <Inp value={nombre} onChange={setNombre} placeholder="Rosa Manzano" error={!!err.nombre} autoFocus />
            {err.nombre && <Err>{err.nombre}</Err>}
            <div style={{ height: 14 }} />

            <Lbl>Email</Lbl>
            <Inp value={email} onChange={setEmail} placeholder="rosa@tutienda.com" type="email" error={!!err.email} />
            {err.email && <Err>{err.email}</Err>}
            <div style={{ height: 18 }} />

            <Lbl>Rol asignado</Lbl>
            <RolRadios roles={rolesElegibles} value={rol} onChange={setRol} />
            {permObjs.length > 0 && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-body)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{permObjs.length} permisos incluidos</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {permObjs.slice(0, 6).map(p => <span key={p.id} style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--chip-primary-fg)', border: '1px solid var(--color-border)' }}>{p.label}</span>)}
                        {permObjs.length > 6 && <span style={{ fontSize: 11, color: 'var(--color-muted)', padding: '3px 4px' }}>+{permObjs.length - 6} más</span>}
                    </div>
                </div>
            )}

            {err.general && <div style={{ marginTop: 14 }}><Err>{err.general}</Err></div>}

            <div style={{ marginTop: 18, padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                El miembro recibirá un email con el acceso y una contraseña temporal generada automáticamente, que deberá cambiar en su primer ingreso. Al enviarla, la vas a poder copiar desde acá también.
            </div>
        </Modal>
    )
}
