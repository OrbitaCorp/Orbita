// Controles reutilizables de configuración: Toggle (la llavecita) y CfgField (campo).
//
// (Fase 1 — Alex) Ahora se pueden usar de dos maneras:
//  - Como siempre: el control se maneja solo con su valor inicial. Las otras
//    pantallas que ya los usaban siguen igual, no les cambia nada.
//  - Conectados (nuevo): pasándoles onChange, la pantalla que los usa se entera
//    de cada cambio. Lo necesitaba para poder guardar de verdad en Configuración.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function Toggle({ defaultOn = false, on, onChange, disabled = false }: {
    defaultOn?: boolean
    on?: boolean
    onChange?: (on: boolean) => void
    disabled?: boolean
}) {
    const [interno, setInterno] = useState(defaultOn)
    const activo = on ?? interno
    const click = () => {
        if (disabled) return
        if (onChange) onChange(!activo)
        else setInterno(o => !o)
    }
    return (
        <span
            onClick={click}
            className="ds-hover"
            data-disabled={disabled || undefined}
            style={{
                width: 40, height: 22, borderRadius: 11,
                background: activo ? 'var(--color-success)' : 'var(--color-surface-alt)',
                border: activo ? 'none' : '1px solid var(--color-border)',
                position: 'relative', flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-block',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <span style={{ position: 'absolute', top: activo ? 3 : 2, left: activo ? 21 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.15)', transition: 'left 200ms' }} />
        </span>
    )
}

interface CfgFieldProps {
    label:     string
    value:     string
    area?:     boolean
    select?:   boolean
    onChange?: (value: string) => void
    disabled?: boolean
    // Ejemplo del formato esperado, para campos que quedan vacíos ("1500",
    // "Palermo, Caballito…") — sin esto no había ninguna guía de qué cargar.
    placeholder?: string
}

export function CfgField({ label, value, area, select, onChange, disabled, placeholder }: CfgFieldProps) {
    const base: React.CSSProperties = {
        width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)',
        border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14,
        color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
    }
    // Si le pasan onChange, el campo avisa cada cambio a su pantalla; si no, se
    // comporta como siempre, para no romper las otras pantallas que ya lo usaban.
    const bind = onChange
        ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value), disabled, placeholder }
        : { defaultValue: value, disabled, placeholder }
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>{label}</label>
            {area ? (
                <textarea {...bind} rows={2} className="ds-field" style={{ ...base, resize: 'vertical', minHeight: 52, padding: '10px 12px' }} />
            ) : (
                <div style={{ position: 'relative' }}>
                    <input {...bind} className="ds-field" style={{ ...base, height: 40, padding: '0 12px' }} />
                    {select && <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />}
                </div>
            )}
        </div>
    )
}
