// Los controles básicos del formulario de Apariencia: la tarjeta de sección,
// el rótulo de campo, el separador, el input y la fila de interruptor.

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { AyudaBoton, AyudaPanel, type Ayuda } from './AyudaSeccion'
import { useCtxApariencia } from './contexto'
import { FOCO_POR_TARJETA, type ObjetivoPreview } from './focoPreview'
import type { IconT } from './utils'

export function SecCard({ id, title, icon: I, badge, ayuda, children }: { id?: string; title: string; icon: IconT; badge?: ReactNode; ayuda?: Ayuda; children: ReactNode }) {
    // La explicación de la sección, cerrada por default: el ícono de
    // exclamación al lado del título la abre (ver AyudaSeccion.tsx).
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    const cuerpoId = useId()
    const { movil, abierta, alternar, pedirFoco } = useCtxApariencia()
    // En el celular las tarjetas son plegables, de a una: sin eso la pantalla
    // eran doce tarjetas largas apiladas. En escritorio están siempre abiertas
    // (ahí el índice de la izquierda es el que ordena).
    const plegable = movil && !!id
    const abierto = !plegable || abierta === id

    // Al abrir una tarjeta en el celular se la lleva arriba de la pantalla:
    // sin esto queda el título fuera de vista, porque la que estaba abierta
    // antes se cierra y el contenido de más abajo sube.
    const tarjetaRef = useRef<HTMLDivElement>(null)
    const estabaAbierto = useRef(abierto)
    useEffect(() => {
        if (plegable && abierto && !estabaAbierto.current) {
            const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            tarjetaRef.current?.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' })
        }
        estabaAbierto.current = abierto
    }, [plegable, abierto])

    return (
        // `id` + `scrollMarginTop`: ancla para el índice de secciones del
        // IndiceDeVista (ver INDICES ahí) — sin el margen, el
        // scroll-into-view deja el título de la tarjeta pegado contra el
        // borde de arriba de la ventana.
        //
        // onFocusCapture: entrar a la tarjeta (o a una de sus zonas, ver
        // data-ap-foco) lleva la vista previa a esa parte de la tienda, antes
        // de tocar nada (ver focoPreview.ts).
        <div
            ref={tarjetaRef}
            id={id}
            className="ap-sec-card"
            data-abierta={abierto}
            onFocusCapture={e => {
                const zona = (e.target as HTMLElement).closest?.('[data-ap-foco]')?.getAttribute('data-ap-foco')
                const objetivo = (zona ?? (id ? FOCO_POR_TARJETA[id] : undefined)) as ObjetivoPreview | undefined
                if (objetivo) pedirFoco(objetivo)
            }}
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, scrollMarginTop: 12 }}
        >
            <div className="ap-sec-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: abierto ? 18 : 0 }}>
                {/* Sin caja de color: el ícono es solo una pista para ubicar la
                    tarjeta, en el gris de siempre. */}
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: 0, flex: 1, minWidth: 0 }}>
                    {plegable ? (
                        <button type="button" className="ap-sec-toggle" aria-expanded={abierto} aria-controls={cuerpoId} onClick={() => alternar(id!)}>
                            <I size={18} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
                            <ChevronDown size={18} strokeWidth={1.8} className="ap-sec-chevron" style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                        </button>
                    ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <I size={18} strokeWidth={1.6} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                            {title}
                        </span>
                    )}
                </h3>
                {ayuda && abierto && <AyudaBoton nombre={title} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />}
                {abierto && badge}
            </div>
            {/* hidden y no desmontar: lo que está a medias en una tarjeta cerrada
                (una subida, un slide abierto) no se pierde al plegarla. */}
            <div id={cuerpoId} className="ap-sec-body" hidden={!abierto}>
                {ayuda && <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ marginBottom: 18 }} />}
                {children}
            </div>
        </div>
    )
}

// El rótulo de un campo. `help` es la línea de siempre, corta y siempre a la
// vista; `ayuda` es el ícono de exclamación con la explicación larga, para los
// campos que son una sección entera aunque no tengan su propia tarjeta (los
// sliders del hero, sin ir más lejos: es el bloque más grande de la pantalla
// y vive adentro de "Identidad de marca").
export function FieldLabel({ children, help, ayuda }: { children: ReactNode; help?: string; ayuda?: Ayuda }) {
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    // Sin `ayuda` queda EXACTAMENTE como estaba: un div y nada más. Son
    // decenas de rótulos en esta pantalla, no tiene sentido envolverlos a
    // todos en un flex por un ícono que no está.
    if (!ayuda) {
        return (
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</div>
                {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            </div>
        )
    }
    return (
        <div style={{ marginBottom: 8 }}>
            {/* -6px a la izquierda: el ícono tiene su propio relleno de 30px
                (40 en mobile), así que sin esto el texto del rótulo queda
                despegado del margen de la tarjeta respecto de los demás. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: -6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }}>{children}</div>
                <AyudaBoton nombre={typeof children === 'string' ? children : 'esta sección'} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />
            </div>
            {help && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{help}</div>}
            <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ marginTop: 8 }} />
        </div>
    )
}

export function Divider() {
    return <div style={{ height: 1, background: 'var(--color-border)', margin: '18px 0' }} />
}

export function Inp({ value, onChange, maxLength, suffix, mono, prefix, placeholder }: { value: string; onChange: (v: string) => void; maxLength?: number; suffix?: ReactNode; mono?: boolean; prefix?: ReactNode; placeholder?: string }) {
    return (
        <div className="ds-field" style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            {prefix}
            <input value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? '"Geist Mono", monospace' : 'inherit', minWidth: 0 }} />
            {suffix}
        </div>
    )
}

// Fila de interruptor, con su explicación opcional debajo (`ayuda`).
//
// La fila entera es UN <button role="switch"> y ya no un <label> con un
// botón adentro. El cambio lo forzó el ícono de ayuda: un <button> es un
// elemento "labelable", así que el <label> le reenviaba el click al primero
// que encontraba adentro — tocar la explicación prendía o apagaba la opción,
// o al revés. Como botón único, cada cosa hace lo suyo (el ícono queda
// afuera del botón), y de paso el interruptor anuncia bien su estado
// (role/aria-checked) a un lector de pantalla, que antes veía un <button>
// pelado sin decir si estaba prendido.
export function ToggleRow({ label, on, onChange, ayuda, disabled = false }: { label: string; on: boolean; onChange: (v: boolean) => void; ayuda?: Ayuda; disabled?: boolean }) {
    const [ayudaAbierta, setAyudaAbierta] = useState(false)
    const panelAyudaId = useId()
    const fila = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                onClick={() => onChange(!on)}
                disabled={disabled}
                className="ds-hover"
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', borderRadius: 6, border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', textAlign: 'left' }}
            >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
                <span aria-hidden style={{ display: 'block', width: 40, height: 22, borderRadius: 11, border: on ? 'none' : '1px solid var(--color-border)', background: on ? 'var(--color-success)' : 'var(--color-surface-alt)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: on ? 3 : 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.18)', transition: 'left 200ms' }} />
                </span>
            </button>
            {ayuda && <AyudaBoton nombre={label} abierta={ayudaAbierta} onToggle={() => setAyudaAbierta(a => !a)} panelId={panelAyudaId} />}
        </div>
    )
    if (!ayuda) return fila
    return (
        <div>
            {fila}
            <AyudaPanel ayuda={ayuda} id={panelAyudaId} abierta={ayudaAbierta} style={{ margin: '2px 4px 12px' }} />
        </div>
    )
}
