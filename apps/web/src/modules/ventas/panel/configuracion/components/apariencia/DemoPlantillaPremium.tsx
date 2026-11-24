// La demo de una plantilla de Home (las del paquete Avanzado), abierta desde
// Apariencia → Plantillas por defecto. Es la MISMA portada de muestra que se ve
// en Avanzado → Plantillas (el `Home` de homes.tsx, con sus fotos y productos
// de ejemplo), a pantalla completa, para ver qué se lleva antes de elegirla.
//
// "Usarla en mi tienda" la aplica ahí mismo, sin pasar por Avanzado: si se
// puede (es una de las libres o el negocio tiene el paquete), pide confirmar y
// la activa; si no, avisa que viene con el paquete Avanzado y ofrece ver los
// planes. El permiso real lo decide la API (puedeElegirPlantilla en
// businesses.service.ts).
//
// Se importa con next/dynamic desde SeccionPlantillasPorDefecto: homes.tsx son
// miles de líneas de JSX que Apariencia no necesita hasta que alguien abre una.

import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Monitor, Smartphone, X } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { CSS, Celular, cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'
import { Home } from '@/modules/ventas/panel/avanzado/plantillas/homes'
import { esPlantillaLibre } from '@/modules/ventas/panel/avanzado/plantillas/libres'
import type { Plantilla } from '@/modules/ventas/panel/avanzado/plantillas/tipos'

export default function DemoPlantillaPremium({ plantillas, inicial, tieneAvanzado, hayCambiosSinGuardar, onCerrar, onUsar, onVerPlanes }: {
    plantillas: Plantilla[]
    inicial: string
    tieneAvanzado: boolean
    // Lo que el dueño tocó en Apariencia y no guardó: al activar una
    // plantilla, Apariencia queda en manos de ella y eso no se publica.
    hayCambiosSinGuardar: boolean
    onCerrar: () => void
    // Activa la plantilla. Si falla, rechaza con el mensaje para mostrar.
    onUsar: (id: string) => Promise<void>
    onVerPlanes: () => void
}) {
    const [id, setId] = useState(inicial)
    const [celular, setCelular] = useState(false)
    const [confirmar, setConfirmar] = useState(false)
    const [activando, setActivando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const i = Math.max(0, plantillas.findIndex(x => x.id === id))
    const p = plantillas[i]
    const libre = esPlantillaLibre(p.id)
    const puedeUsar = libre || tieneAvanzado
    const ir = (d: number) => { setId(plantillas[(i + d + plantillas.length) % plantillas.length].id); setError(null) }

    useEffect(() => { cargarFuentes() }, [])

    // Esc cierra (primero el aviso, si está abierto); ←/→ pasan de plantilla,
    // igual que en Avanzado → Plantillas.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (activando) return
            if (e.key === 'Escape') { if (confirmar) setConfirmar(false); else onCerrar() }
            else if (confirmar) return
            else if (e.key === 'ArrowRight') setId(prev => { const k = plantillas.findIndex(x => x.id === prev); return plantillas[(k + 1) % plantillas.length].id })
            else if (e.key === 'ArrowLeft') setId(prev => { const k = plantillas.findIndex(x => x.id === prev); return plantillas[(k - 1 + plantillas.length) % plantillas.length].id })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCerrar, plantillas, confirmar, activando])

    // Sin scroll de fondo mientras la demo ocupa la pantalla.
    useEffect(() => {
        const antes = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = antes }
    }, [])

    async function usar() {
        setActivando(true)
        setError(null)
        try {
            await onUsar(p.id)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo activar la plantilla')
            setActivando(false)
        }
    }

    if (!p) return null

    return (
        <div role="dialog" aria-modal="true" aria-label={`Demo de la plantilla ${p.nombre}`}
            style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button className="ds-hover" onClick={() => ir(-1)} aria-label="Plantilla anterior" style={cuadrado}><ChevronLeft size={16} strokeWidth={2} /></button>
                    <button className="ds-hover" onClick={() => ir(1)} aria-label="Plantilla siguiente" style={cuadrado}><ChevronRight size={16} strokeWidth={2} /></button>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                        {p.nombre}
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-muted)', marginLeft: 8 }}>
                            {libre ? 'Gratis en tu plan' : tieneAvanzado ? 'Incluida en Avanzado' : 'Con el paquete Avanzado'}
                        </span>
                    </div>
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
                <Button variant="primary" size="sm" icon={<ArrowRight size={13} strokeWidth={2.2} />} onClick={() => { setError(null); setConfirmar(true) }}>
                    Usarla en mi tienda
                </Button>
                <button className="ds-hover" onClick={onCerrar} aria-label="Cerrar la demo" style={cuadrado}><X size={16} strokeWidth={2} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: celular ? 'var(--color-surface-alt)' : p.tema.bg }}>
                {celular
                    ? <div style={{ padding: '24px 0' }}><Celular><Home key={`${p.id}-m`} p={p} movil /></Celular></div>
                    : <Home key={p.id} p={p} movil={false} />}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-muted)', background: 'var(--color-bg)' }}>
                Al usarla, tu portada se arma con tu catálogo, tus categorías y tus fotos, no con las de esta muestra.
            </div>

            {confirmar && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9600, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,0.45)' }}
                    onClick={e => { if (e.target === e.currentTarget && !activando) setConfirmar(false) }}>
                    <div role="alertdialog" aria-modal="true" aria-labelledby="demo-confirmar-titulo"
                        style={{ width: '100%', maxWidth: 460, background: 'var(--color-bg)', borderRadius: 12, padding: 22, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.45)' }}>
                        {puedeUsar ? (<>
                            <div id="demo-confirmar-titulo" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                ¿Usar la plantilla {p.nombre} en tu tienda?
                            </div>
                            <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
                                Tu portada pasa a usar este diseño, con tu catálogo real, apenas confirmes. Mientras esté
                                activa, en Apariencia editás su contenido (hero, header, textos y pie); los colores y las letras
                                los pone ella. Podés volver a la apariencia clásica cuando quieras, sin perder nada.
                                {hayCambiosSinGuardar && <><br /><br />Tenés cambios sin guardar en Apariencia: no se publican.</>}
                            </div>
                            {error && <div style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 12 }}>{error}</div>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                                <Button variant="secondary" disabled={activando} onClick={() => setConfirmar(false)}>Cancelar</Button>
                                <Button variant="primary" loading={activando} onClick={usar}>Sí, usarla</Button>
                            </div>
                        </>) : (<>
                            <div id="demo-confirmar-titulo" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                {p.nombre} viene con el paquete Avanzado
                            </div>
                            <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.6 }}>
                                Todavía no tenés el paquete Avanzado. Con él la activás desde acá mismo, igual que las
                                plantillas gratis de tu plan, y además tenés juegos con premio, modales de anuncios, 2x1 y más.
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                                <Button variant="secondary" onClick={() => setConfirmar(false)}>Cerrar</Button>
                                <Button variant="primary" onClick={onVerPlanes}>Ver planes</Button>
                            </div>
                        </>)}
                    </div>
                </div>
            )}
        </div>
    )
}

const cuadrado: CSSProperties = {
    width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer',
}
