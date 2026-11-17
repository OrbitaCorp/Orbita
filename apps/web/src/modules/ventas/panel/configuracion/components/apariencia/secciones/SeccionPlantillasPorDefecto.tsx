// "Plantillas por defecto": la primera tarjeta de Apariencia. Dos partes:
//
//  1. Las combinaciones ya armadas (plantillasPorDefecto.ts) de todo lo que se
//     elige en esta pantalla. Cualquier plan las usa: aplicar una es lo mismo
//     que tocar cada control a mano, y queda sin publicar hasta guardar.
//  2. Las plantillas premium (las portadas de Home). Se abre la demo y desde
//     ahí se aplica: las libres (libres.ts) con cualquier plan, el resto con el
//     paquete Avanzado. Sin el paquete, la demo avisa y ofrece ver los planes.

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, LayoutTemplate, Lock } from 'lucide-react'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { esPlantillaLibre } from '@/modules/ventas/panel/avanzado/plantillas/libres'
import { ApiError, panelGetAddons, panelSetHomeTemplate } from '@/lib/api'
import type { VistaConfig } from '../../ConfigTabs'
import { fontStack, loadFont, type Apariencia as Ap } from '../../../mock/apariencia.mock'
import { AYUDA_SECCIONES } from '../ayudas'
import { Divider, SecCard } from '../Controles'
import { PLANTILLAS_POR_DEFECTO, aplicarPlantilla, fondoDe, plantillaEnUso, type PlantillaPorDefecto } from '../plantillasPorDefecto'
import { tieneTransparencia } from '../transparencia'

const DemoPlantillaPremium = dynamic(() => import('../DemoPlantillaPremium'), { ssr: false })

// Las que se ofrecen (las ocultas tampoco se listan en Avanzado), con las
// gratis primero: son las que cualquiera puede usar ya.
const PREMIUM = PLANTILLAS.filter(x => !x.oculta)
    .sort((a, b) => Number(esPlantillaLibre(b.id)) - Number(esPlantillaLibre(a.id)))
// Cuántas se ven antes de "Ver todas": son fotos grandes, y la tarjeta es la
// primera de la pantalla.
const PREMIUM_A_LA_VISTA = 6

export function SeccionPlantillasPorDefecto({ ap, actualizar, dirty, ir, onToast, onPlantillaActivada }: {
    ap: Ap
    actualizar: (fn: (p: Ap) => Ap, campo?: keyof Ap) => void
    dirty: boolean
    ir: (v: VistaConfig) => void
    onToast: (m: string) => void
    // Una premium quedó activa: Apariencia pasa a editar su contenido.
    onPlantillaActivada: (id: string) => void
}) {
    const [tieneAvanzado, setTieneAvanzado] = useState(false)
    const [todasPremium, setTodasPremium] = useState(false)
    const [demo, setDemo] = useState<string | null>(null)

    // Qué fotos de los slides son transparentes: solo esas pueden ir con imagen
    // centrada (ver plantillasPorDefecto.ts). Se mide cada vez que cambian.
    const [transparentes, setTransparentes] = useState<ReadonlySet<string>>(new Set())
    const fotos = ap.sliders.map(s => s.img).filter((x): x is string => !!x)
    const claveFotos = fotos.join('|')
    useEffect(() => {
        let vivo = true
        Promise.all(fotos.map(async u => [u, await tieneTransparencia(u)] as const)).then(r => {
            if (vivo) setTransparentes(new Set(r.filter(([, t]) => t).map(([u]) => u)))
        })
        return () => { vivo = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveFotos])

    const enUso = plantillaEnUso(ap, transparentes)

    // Las letras de cada miniatura tienen que verse con su fuente de verdad.
    useEffect(() => {
        for (const p of PLANTILLAS_POR_DEFECTO) { loadFont(p.fuenteHeading); loadFont(p.fuenteBody) }
    }, [])

    // Para saber qué decir y qué ofrecer en la demo. El permiso real lo da la
    // API; si esto falla, la demo ofrece ver los planes, que sirve a cualquiera.
    useEffect(() => {
        let vivo = true
        panelGetAddons().then(r => { if (vivo) setTieneAvanzado(r.advanced) }).catch(() => {})
        return () => { vivo = false }
    }, [])

    const aplicar = (p: PlantillaPorDefecto) => {
        actualizar(a => aplicarPlantilla(a, p, transparentes), 'colorPrimario')
        const conFotoComun = p.hero.formato === 'centrada' && ap.sliders.some(s => s.img && !transparentes.has(s.img))
        onToast(conFotoComun
            ? `Aplicaste ${p.nombre}. Los slides con foto común quedan a imagen completa: la centrada es para fotos sin fondo (PNG). Tocá Guardar cambios para publicarla`
            : `Aplicaste ${p.nombre}. Mirala en la vista previa y tocá Guardar cambios para publicarla`)
    }

    async function usarPremium(id: string) {
        try {
            await panelSetHomeTemplate(id)
        } catch (e) {
            throw new Error(e instanceof ApiError ? e.message : 'No se pudo activar la plantilla')
        }
        setDemo(null)
        onToast(`Listo: tu tienda ya usa la plantilla ${PREMIUM.find(x => x.id === id)?.nombre ?? ''}`)
        onPlantillaActivada(id)
    }

    const premiumVisibles = useMemo(() => (todasPremium ? PREMIUM : PREMIUM.slice(0, PREMIUM_A_LA_VISTA)), [todasPremium])

    return (
        <SecCard id="ap-sec-plantillas" title="Plantillas por defecto" icon={LayoutTemplate} ayuda={AYUDA_SECCIONES.plantillas}>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 14 }}>
                Combinaciones ya armadas de colores, letras, header, sliders, grilla, categorías y banners. Elegí una y
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
            <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, marginTop: 10 }}>
                Las que traen el slider con imagen centrada la usan solo en los slides con foto sin fondo (PNG). Los
                slides con una foto común quedan a imagen completa.
            </div>

            <Divider />

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Plantillas premium</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, marginBottom: 14 }}>
                Portadas con un diseño propio. Abrí una para ver la demo y usarla en tu tienda desde ahí.
                {tieneAvanzado ? ' Tenés el paquete Avanzado: podés usar cualquiera.' : ' Las que dicen «Gratis» las usás con tu plan; el resto viene con el paquete Avanzado.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {premiumVisibles.map(x => {
                    const libre = esPlantillaLibre(x.id)
                    return (
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
                                    {libre
                                        ? <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-primary)' }}>Gratis</span>
                                        : !tieneAvanzado && <Lock size={11} strokeWidth={2} style={{ color: 'var(--color-muted)' }} aria-label="Con el paquete Avanzado" />}
                                </span>
                                <span style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.35 }}>{x.para}</span>
                            </span>
                        </button>
                    )
                })}
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
                    hayCambiosSinGuardar={dirty}
                    onCerrar={() => setDemo(null)}
                    onUsar={usarPremium}
                    onVerPlanes={() => { setDemo(null); ir('suscripcion') }}
                />
            )}
        </SecCard>
    )
}

// Una tienda en miniatura con lo que pone la plantilla: header según su forma,
// el slider (a imagen completa, o centrado: el color del slide con el producto
// al costado), el título y el botón con sus letras, y la grilla con su
// cantidad de columnas. No es una captura: se dibuja con los mismos valores
// que se van a aplicar.
function Miniatura({ p }: { p: PlantillaPorDefecto }) {
    const oscuro = p.modoColor === 'oscuro'
    const fondo = oscuro ? '#0B0F19' : fondoDe(p)
    const texto = oscuro ? '#F1F5F9' : p.colorSecundario
    const bloque = oscuro ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'
    const centradoHeader = p.layoutHeader === 'centered'
    const cols = p.layoutGrid === '3col' ? 3 : p.layoutGrid === '4col' ? 4 : 0
    const h = p.hero
    const heroCentrado = h.formato === 'centrada'
    const veloClaro = !heroCentrado && h.velo === 'blanco'
    const fotoIzq = h.posicion === 'left'
    const apilado = h.posicion === 'center'

    const textoHero = (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: apilado ? 'center' : 'flex-start', gap: 4 }}>
            <span style={{ fontFamily: fontStack(p.fuenteHeading), fontSize: 13, fontWeight: 700, lineHeight: 1, color: veloClaro ? p.colorSecundario : '#fff' }}>Aa</span>
            <span style={{ fontFamily: fontStack(p.fuenteBody), fontSize: 6.5, fontWeight: 600, color: '#fff', background: p.colorPrimario, borderRadius: 3, padding: '2px 5px', boxShadow: veloClaro ? 'none' : '0 0 0 1px rgba(255,255,255,0.35)' }}>Comprar</span>
        </span>
    )

    return (
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 5, height: 84, padding: 6, borderRadius: 7, background: fondo, overflow: 'hidden', border: oscuro ? 'none' : '1px solid rgba(15,23,42,0.06)' }}>
            {/* Header */}
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: centradoHeader ? 'center' : 'space-between', gap: 4, height: 8 }}>
                <span style={{ fontFamily: fontStack(p.fuenteHeading), fontSize: 8, fontWeight: 700, color: texto, lineHeight: 1, letterSpacing: p.marca.nombre === 'espaciado' ? '0.18em' : 0 }}>
                    {p.marca.nombre === 'mayusculas' || p.marca.nombre === 'espaciado' ? 'TIENDA' : 'Tienda'}
                </span>
                {!centradoHeader && p.layoutHeader !== 'minimal' && (
                    <span style={{ display: 'flex', gap: 3 }}>
                        {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 3, borderRadius: 2, background: bloque }} />)}
                    </span>
                )}
            </span>
            {/* Slider */}
            {heroCentrado ? (
                <span style={{
                    position: 'relative', display: 'flex', flexDirection: apilado ? 'column' : fotoIzq ? 'row-reverse' : 'row',
                    alignItems: 'center', justifyContent: apilado ? 'center' : 'space-between', gap: apilado ? 3 : 4,
                    flex: 1, borderRadius: 4, padding: '0 7px', background: h.fondo, overflow: 'hidden',
                }}>
                    {h.patron !== 'none' && (
                        <span style={{ position: 'absolute', inset: 0, opacity: 0.22, backgroundImage: `radial-gradient(${p.colorAccent} 1px, transparent 1.4px)`, backgroundSize: '6px 6px' }} />
                    )}
                    <span style={{ position: 'relative' }}>{textoHero}</span>
                    {/* El producto sin fondo, al costado */}
                    <span style={{ position: 'relative', width: apilado ? 14 : 20, height: apilado ? 10 : 20, borderRadius: '50% 50% 45% 45%', background: `linear-gradient(160deg, ${p.colorAccent}, ${p.colorPrimario})`, boxShadow: '0 2px 4px rgba(0,0,0,0.3)', flexShrink: 0 }} />
                </span>
            ) : (
                <span style={{
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: apilado ? 'center' : fotoIzq ? 'flex-start' : 'flex-start',
                    flex: 1, borderRadius: 4, padding: '0 7px',
                    background: veloClaro
                        ? `linear-gradient(90deg, rgba(255,255,255,0.92), ${p.colorAccent}55)`
                        : `linear-gradient(${h.velo === 'bottom' ? '0deg' : '120deg'}, ${p.colorSecundario}, ${p.colorPrimario})`,
                }}>
                    {textoHero}
                </span>
            )}
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
