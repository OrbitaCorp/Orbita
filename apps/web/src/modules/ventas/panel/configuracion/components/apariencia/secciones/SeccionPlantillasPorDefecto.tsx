// "Plantillas por defecto": la primera tarjeta de Apariencia. Dos partes:
//
//  1. Las combinaciones ya armadas (plantillasPorDefecto.ts) de todo lo que se
//     elige en esta pantalla. Cualquier plan las usa: aplicar una es lo mismo
//     que tocar cada control a mano, y queda sin publicar hasta guardar.
//  2. Las plantillas premium (las portadas del paquete Avanzado), solo para
//     mirar la demo. Activarlas sigue siendo cosa de Avanzado → Plantillas.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Check, LayoutTemplate, Lock } from 'lucide-react'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { panelGetAddons } from '@/lib/api'
import { adminPath, currentSlug } from '@/lib/tenant'
import type { VistaConfig } from '../../ConfigTabs'
import { fontStack, loadFont, type Apariencia as Ap } from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES } from '../ayudas'
import { Divider, SecCard } from '../Controles'
import { PLANTILLAS_POR_DEFECTO, aplicarPlantilla, fondoDe, plantillaEnUso, type PlantillaPorDefecto } from '../plantillasPorDefecto'

const DemoPlantillaPremium = dynamic(() => import('../DemoPlantillaPremium'), { ssr: false })

// Las premium que se ofrecen (las ocultas tampoco se listan en Avanzado).
const PREMIUM = PLANTILLAS.filter(x => !x.oculta)
// Cuántas se ven antes de "Ver todas": son fotos grandes, y la tarjeta es la
// primera de la pantalla.
const PREMIUM_A_LA_VISTA = 6

export function SeccionPlantillasPorDefecto({ ap, actualizar, ir, onToast }: {
    ap: Ap
    actualizar: (fn: (p: Ap) => Ap, campo?: keyof Ap) => void
    ir: (v: VistaConfig) => void
    onToast: (m: string) => void
}) {
    const router = useRouter()
    const enUso = plantillaEnUso(ap)
    const [tieneAvanzado, setTieneAvanzado] = useState(false)
    const [todasPremium, setTodasPremium] = useState(false)
    const [demo, setDemo] = useState<string | null>(null)

    // Las letras de cada miniatura tienen que verse con su fuente de verdad.
    useEffect(() => {
        for (const p of PLANTILLAS_POR_DEFECTO) { loadFont(p.fuenteHeading); loadFont(p.fuenteBody) }
    }, [])

    // Solo para el texto del botón de la demo: el permiso real de activar una
    // plantilla lo da el backend (RequiresAddon). Si falla, se ofrece el camino
    // de Suscripción, que es el que sirve a cualquiera.
    useEffect(() => {
        let vivo = true
        panelGetAddons().then(r => { if (vivo) setTieneAvanzado(r.advanced) }).catch(() => {})
        return () => { vivo = false }
    }, [])

    const aplicar = (p: PlantillaPorDefecto) => {
        actualizar(a => aplicarPlantilla(a, p), 'colorPrimario')
        onToast(`Aplicaste ${p.nombre}. Mirala en la vista previa y tocá Guardar cambios para publicarla`)
    }

    const seguirAvanzado = () => {
        setDemo(null)
        if (!tieneAvanzado) { ir('suscripcion'); return }
        const negocioId = currentSlug() ?? (router.query.negocioId as string)
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'avanzado'), query: { vista: 'plantillas' } })
    }

    const premiumVisibles = useMemo(() => (todasPremium ? PREMIUM : PREMIUM.slice(0, PREMIUM_A_LA_VISTA)), [todasPremium])

    return (
        <SecCard id="ap-sec-plantillas" title="Plantillas por defecto" icon={LayoutTemplate} ayuda={AYUDA_SECCIONES.plantillas}>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 14 }}>
                Combinaciones ya armadas de colores, letras, header, hero, grilla, categorías y banners. Elegí una y
                después cambiá lo que quieras. Tus textos, fotos y lo que tenés prendido no se tocan.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {PLANTILLAS_POR_DEFECTO.map(p => {
                    const a = enUso === p.id
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => aplicar(p)}
                            aria-pressed={a}
                            className="ds-hover"
                            style={{
                                display: 'flex', flexDirection: 'column', gap: 8, padding: 6, textAlign: 'left',
                                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                border: `${a ? 2 : 1}px solid ${a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                margin: a ? 0 : 1, background: 'var(--color-bg)',
                            }}
                        >
                            <Miniatura p={p} />
                            <span style={{ padding: '0 4px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                    {p.nombre}
                                    {a && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 500, color: 'var(--color-primary)' }}><Check size={12} strokeWidth={2.4} /> En uso</span>}
                                </span>
                                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.35 }}>{p.para}</span>
                            </span>
                        </button>
                    )
                })}
            </div>

            <Divider />

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Plantillas premium</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 14 }}>
                {tieneAvanzado
                    ? 'Portadas con un diseño propio, incluidas en tu paquete Avanzado. Abrí una para ver la demo.'
                    : 'Portadas con un diseño propio, que vienen con el paquete Avanzado. Abrí una para ver la demo completa.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {premiumVisibles.map(x => (
                    <button
                        key={x.id}
                        type="button"
                        onClick={() => setDemo(x.id)}
                        className="ds-hover"
                        aria-label={`Ver la demo de la plantilla ${x.nombre}`}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 6, textAlign: 'left', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--color-border)', margin: 1, background: 'var(--color-bg)' }}
                    >
                        <span style={{ position: 'relative', display: 'block', height: 84, borderRadius: 7, overflow: 'hidden', background: x.tema.bg }}>
                            <img src={x.slides[0].img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <span aria-hidden style={{ position: 'absolute', left: 8, bottom: 6, fontFamily: x.tema.fh, fontSize: 18, fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.6)', lineHeight: 1 }}>Aa</span>
                        </span>
                        <span style={{ padding: '0 4px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                {x.nombre}
                                {!tieneAvanzado && <Lock size={11} strokeWidth={2} style={{ color: 'var(--color-muted)' }} aria-label="Con el paquete Avanzado" />}
                            </span>
                            <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.35 }}>{x.para}</span>
                        </span>
                    </button>
                ))}
            </div>

            {PREMIUM.length > PREMIUM_A_LA_VISTA && (
                <button
                    type="button"
                    onClick={() => setTodasPremium(t => !t)}
                    style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}
                >
                    {todasPremium ? 'Ver menos' : `Ver las ${PREMIUM.length} plantillas premium`}
                </button>
            )}

            {demo && (
                <DemoPlantillaPremium
                    plantillas={PREMIUM}
                    inicial={demo}
                    tieneAvanzado={tieneAvanzado}
                    onCerrar={() => setDemo(null)}
                    onSeguir={seguirAvanzado}
                />
            )}
        </SecCard>
    )
}

// Una tienda en miniatura con lo que pone la plantilla: header según su forma,
// el hero con el color del tema, el título y el botón con sus letras, y la
// grilla con la cantidad de columnas que elige. No es una captura: se dibuja
// con los mismos valores que se van a aplicar.
function Miniatura({ p }: { p: PlantillaPorDefecto }) {
    const oscuro = p.modoColor === 'oscuro'
    const fondo = oscuro ? '#0B0F19' : fondoDe(p)
    const texto = oscuro ? '#F1F5F9' : p.colorSecundario
    const bloque = oscuro ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'
    const centrado = p.layoutHeader === 'centered'
    const cols = p.layoutGrid === '3col' ? 3 : p.layoutGrid === '4col' ? 4 : 0
    const veloClaro = p.heroVelo === 'blanco'

    return (
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 5, height: 84, padding: 6, borderRadius: 7, background: fondo, overflow: 'hidden', border: oscuro ? 'none' : '1px solid rgba(15,23,42,0.06)' }}>
            {/* Header */}
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: centrado ? 'center' : 'space-between', gap: 4, height: 8 }}>
                <span style={{ fontFamily: fontStack(p.fuenteHeading), fontSize: 8, fontWeight: 700, color: texto, lineHeight: 1, letterSpacing: p.marca.nombre === 'espaciado' ? '0.18em' : 0 }}>
                    {p.marca.nombre === 'mayusculas' || p.marca.nombre === 'espaciado' ? 'TIENDA' : 'Tienda'}
                </span>
                {!centrado && p.layoutHeader !== 'minimal' && (
                    <span style={{ display: 'flex', gap: 3 }}>
                        {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 3, borderRadius: 2, background: bloque }} />)}
                    </span>
                )}
            </span>
            {/* Hero */}
            <span style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, flex: 1, borderRadius: 4, padding: '0 7px',
                background: veloClaro
                    ? `linear-gradient(90deg, rgba(255,255,255,0.92), ${p.colorAccent}55)`
                    : `linear-gradient(120deg, ${p.colorSecundario}, ${p.colorPrimario})`,
            }}>
                <span style={{ fontFamily: fontStack(p.fuenteHeading), fontSize: 13, fontWeight: 700, lineHeight: 1, color: veloClaro ? p.colorSecundario : '#fff' }}>Aa</span>
                <span style={{ alignSelf: 'flex-start', fontFamily: fontStack(p.fuenteBody), fontSize: 6.5, fontWeight: 600, color: '#fff', background: p.colorPrimario, borderRadius: 3, padding: '2px 5px', boxShadow: veloClaro ? 'none' : '0 0 0 1px rgba(255,255,255,0.35)' }}>Comprar</span>
            </span>
            {/* Grilla de productos */}
            {cols > 0 ? (
                <span style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, height: 14 }}>
                    {Array.from({ length: cols }, (_, i) => (
                        <span key={i} style={{ borderRadius: 2, background: i === 0 ? p.colorAccent : bloque, opacity: i === 0 ? 0.85 : 1 }} />
                    ))}
                </span>
            ) : (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, height: 14 }}>
                    {[0, 1].map(i => <span key={i} style={{ flex: 1, borderRadius: 2, background: i === 0 ? p.colorAccent : bloque, opacity: i === 0 ? 0.85 : 1 }} />)}
                </span>
            )}
        </span>
    )
}
