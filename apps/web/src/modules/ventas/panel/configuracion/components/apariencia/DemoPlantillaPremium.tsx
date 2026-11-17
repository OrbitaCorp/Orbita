// La demo de una plantilla de Home del paquete Avanzado, abierta desde
// Apariencia → Plantillas por defecto. Es la MISMA portada de muestra que se ve
// en Avanzado → Plantillas (el `Home` de homes.tsx, con sus fotos y productos
// de ejemplo), a pantalla completa, para que quien no tiene el paquete vea qué
// se lleva antes de pagarlo.
//
// Solo se mira: activarla sigue siendo cosa de Avanzado → Plantillas (el
// endpoint exige el add-on, ver RequiresAddon en businesses.controller.ts). El
// botón de abajo lleva ahí si el negocio ya tiene Avanzado, o a Suscripción si
// no lo tiene.
//
// Se importa con next/dynamic desde SeccionPlantillasPorDefecto: homes.tsx son
// miles de líneas de JSX que Apariencia no necesita hasta que alguien abre una.

import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Monitor, Smartphone, X } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { CSS, Celular, cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import { Home } from '@/modules/ventas/panel/avanzado/plantillas/homes'
import type { Plantilla } from '@/modules/ventas/panel/avanzado/plantillas/tipos'

export default function DemoPlantillaPremium({ plantillas, inicial, tieneAvanzado, onCerrar, onSeguir }: {
    plantillas: Plantilla[]
    inicial: string
    tieneAvanzado: boolean
    onCerrar: () => void
    // Avanzado → Plantillas (con el paquete) o Suscripción (sin él).
    onSeguir: () => void
}) {
    const [id, setId] = useState(inicial)
    const [celular, setCelular] = useState(false)
    const i = Math.max(0, plantillas.findIndex(x => x.id === id))
    const p = plantillas[i]
    const ir = (d: number) => setId(plantillas[(i + d + plantillas.length) % plantillas.length].id)

    useEffect(() => { cargarFuentes() }, [])

    // Esc cierra; ←/→ pasan de plantilla, igual que en Avanzado → Plantillas.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCerrar()
            else if (e.key === 'ArrowRight') setId(prev => { const k = plantillas.findIndex(x => x.id === prev); return plantillas[(k + 1) % plantillas.length].id })
            else if (e.key === 'ArrowLeft') setId(prev => { const k = plantillas.findIndex(x => x.id === prev); return plantillas[(k - 1 + plantillas.length) % plantillas.length].id })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCerrar, plantillas])

    // Sin scroll de fondo mientras la demo ocupa la pantalla.
    useEffect(() => {
        const antes = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = antes }
    }, [])

    if (!p) return null

    return (
        <div role="dialog" aria-modal="true" aria-label={`Demo de la plantilla ${p.nombre}`}
            style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button className="ds-hover" onClick={() => ir(-1)} aria-label="Plantilla anterior" style={flecha}><ChevronLeft size={16} strokeWidth={2} /></button>
                    <button className="ds-hover" onClick={() => ir(1)} aria-label="Plantilla siguiente" style={flecha}><ChevronRight size={16} strokeWidth={2} /></button>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{p.nombre}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                        Demo con fotos y productos de muestra · {i + 1} de {plantillas.length}
                    </div>
                </div>
                <div style={{ display: 'inline-flex', background: 'var(--color-surface-alt)', borderRadius: 8, padding: 3 }}>
                    {([[false, 'Computadora', Monitor], [true, 'Celular', Smartphone]] as const).map(([m, label, Icon]) => (
                        <button key={label} onClick={() => setCelular(m)} aria-pressed={celular === m}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, background: celular === m ? 'var(--color-bg)' : 'transparent', color: celular === m ? 'var(--color-text)' : 'var(--color-muted)', boxShadow: celular === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
                            <Icon size={14} strokeWidth={1.9} /> {label}
                        </button>
                    ))}
                </div>
                <Button variant="primary" size="sm" icon={<ArrowRight size={13} strokeWidth={2.2} />} onClick={onSeguir}>
                    {tieneAvanzado ? 'Usarla en mi tienda' : 'Desbloquear con Avanzado'}
                </Button>
                <button className="ds-hover" onClick={onCerrar} aria-label="Cerrar la demo" style={flecha}><X size={16} strokeWidth={2} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: celular ? 'var(--color-surface-alt)' : p.tema.bg }}>
                {celular
                    ? <div style={{ padding: '24px 0' }}><Celular><Home key={`${p.id}-m`} p={p} movil /></Celular></div>
                    : <Home key={p.id} p={p} movil={false} />}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-muted)', background: 'var(--color-bg)' }}>
                {tieneAvanzado
                    ? 'Ya tenés el paquete Avanzado: la activás desde Avanzado → Plantillas y tu portada se arma con tu catálogo real.'
                    : 'Las plantillas premium vienen con el paquete Avanzado. Al activarla, tu portada se arma con tu catálogo real, no con estas fotos.'}
            </div>
        </div>
    )
}

const flecha: CSSProperties = {
    width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer',
}
