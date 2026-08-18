// Piezas de formulario compartidas por los modales de Equipo:
// labels, errores, inputs, radios de rol, campo de contraseña y toggle.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'
import type { Rol } from '../../types/equipo.types'

export function Lbl({ children, help }: { children: ReactNode; help?: string }) {
    return (
        <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</label>
            {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
        </div>
    )
}

export function Err({ children }: { children: ReactNode }) {
    return (
        <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} strokeWidth={2} /> {children}
        </div>
    )
}

interface InpProps {
    value:       string
    onChange?:   (v: string) => void
    placeholder?: string
    mono?:       boolean
    type?:       string
    error?:      boolean
    prefix?:     ReactNode
    autoFocus?:  boolean
}

export function Inp({ value, onChange, placeholder, mono, type = 'text', error, prefix, autoFocus }: InpProps) {
    const [f, setF] = useState(false)
    return (
        <div style={{
            display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', gap: 8,
            background: 'var(--color-bg)',
            border: `${f || error ? 2 : 1}px solid ${error ? 'var(--color-error)' : f ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 8, transition: 'border-color 150ms',
        }}>
            {prefix}
            <input
                type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
                onChange={e => onChange?.(e.target.value)}
                onFocus={() => setF(true)} onBlur={() => setF(false)}
                readOnly={!onChange}
                style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', minWidth: 0 }}
            />
        </div>
    )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!on)} style={{ width: 40, height: 22, borderRadius: 11, border: on ? 'none' : '1px solid var(--color-border)', background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', position: 'relative', flexShrink: 0, cursor: 'pointer', padding: 0, transition: 'background 200ms' }}>
            <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.18)', transition: 'left 200ms' }} />
        </button>
    )
}

export function ToggleRow({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</div>
                {help && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            </div>
            <Toggle on={on} onChange={onChange} />
        </label>
    )
}

// Radios compactos de rol (invitar / editar miembro).
export function RolRadios({ roles, value, onChange }: { roles: Rol[]; value: string; onChange: (id: string) => void }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {roles.map(r => {
                const a = value === r.id
                return (
                    // El elegido se marca con el color de la marca, no con el color
                    // del rol: los roles de fábrica se guardan en tonos oscuros
                    // (el dueño es negro puro) y usados como texto no se leían en
                    // modo oscuro ni se notaba cuál estaba seleccionado.
                    <button key={r.id} onClick={() => onChange(r.id)} aria-pressed={a} style={{ padding: '12px 10px', borderRadius: 10, border: `2px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`, background: a ? 'var(--color-primary-bg)' : 'var(--color-bg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 150ms ease, background 150ms ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0, boxShadow: '0 0 0 1px var(--color-border)' }} />
                            <span style={{ fontSize: 13, fontWeight: a ? 700 : 600, color: a ? 'var(--chip-primary-fg)' : 'var(--color-text)' }}>{r.nombre}</span>
                            {a && <Check size={13} strokeWidth={2.6} style={{ color: 'var(--color-primary)', marginLeft: 'auto', flexShrink: 0 }} />}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.descripcion}</div>
                    </button>
                )
            })}
        </div>
    )
}

// Contraseña temporal con regenerar + copiar.
export function PasswordField({ value, onRegen }: { value: string; onRegen: () => void }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 4px 0 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{value}</span>
                <button onClick={onRegen} title="Regenerar" style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><RefreshCw size={14} strokeWidth={1.6} /></button>
            </div>
            <button onClick={copy} style={{ height: 40, padding: '0 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: copied ? 'var(--color-success-bg)' : 'var(--color-bg)', color: copied ? 'var(--color-success)' : 'var(--color-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {copied ? <><Check size={14} strokeWidth={2.4} /> Copiado</> : <><Copy size={14} strokeWidth={1.6} /> Copiar</>}
            </button>
        </div>
    )
}
