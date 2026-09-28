// InfoTip — ícono de exclamación chico que abre una explicación al pasar el mouse
// (escritorio) o al tocarlo (celular: un botón nativo puede no quedar "focuseado"
// al tocar en algunos navegadores, así que el click también alterna).
//
// El cuadro se ancla al contenedor más cercano con `position: relative` (la
// tarjeta que lo usa), pegado a su borde derecho, no al ícono: así no se sale de
// la pantalla cuando la tarjeta está en la última columna. Se cierra con Escape.

import { useEffect, useId, useState, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export function InfoTip({ titulo, children, label }: { titulo: string; children: ReactNode; label?: string }) {
    const [abierto, setAbierto] = useState(false)
    const id = useId()

    useEffect(() => {
        if (!abierto) return
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [abierto])

    return (
        <span onMouseEnter={() => setAbierto(true)} onMouseLeave={() => setAbierto(false)} style={{ display: 'inline-flex' }}>
            <button
                type="button"
                aria-label={label ?? `Qué significa ${titulo}`}
                aria-describedby={abierto ? id : undefined}
                onClick={e => { e.stopPropagation(); setAbierto(a => !a) }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setAbierto(false)}
                style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, padding: 0, border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'help', borderRadius: '50%' }}
            >
                <AlertCircle size={14} strokeWidth={1.8} />
            </button>
            {abierto && (
                <div
                    id={id}
                    role="tooltip"
                    style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 40,
                        width: 'min(320px, calc(100vw - 32px))', padding: '14px 16px', borderRadius: 12,
                        background: 'var(--color-bg)', color: 'var(--color-body)', border: '1px solid var(--color-border-strong)',
                        boxShadow: 'var(--shadow-card-hover)', textAlign: 'left', textTransform: 'none', letterSpacing: 'normal',
                        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 400, lineHeight: 1.55, whiteSpace: 'normal', cursor: 'default',
                    }}
                >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>{titulo}</div>
                    {children}
                </div>
            )}
        </span>
    )
}
