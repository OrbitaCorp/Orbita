// src/modules/ventas/panel/avanzado/plantillas/PlantillasConfig.tsx —
// "Plantillas de Home" (paquete Avanzado).
//
// Es una VITRINA: se miran las plantillas, nada más. No aplica ninguna al
// home ni guarda una elección. Decisión explícita del dueño: enganchar una
// plantilla con la tienda real es otra cosa —una columna nueva en
// storefront_config, el storefront leyéndola y armando cada sección con el
// catálogo de verdad— y no se mete acá de prepo. Si aparece un botón de
// "aplicar" en esta pantalla, es porque esa lógica ya existe; si no, no va.
//
// Tres cosas más que conviene tener claras:
//
//  1. SOLO cambia el home. Catálogo, ficha de producto, carrito, checkout y
//     perfil son iguales con cualquiera de las veinte. Por eso todas traen
//     las mismas acciones de tienda arriba (ingresar / mis pedidos /
//     carrito, ver AccionesTienda en piezas.tsx): la portada cambia, la
//     forma de comprar no.
//
//  2. Vive DENTRO de Avanzado, sin ruta propia — mismo patrón que
//     JuegosConfig: `?vista=plantillas` y un "volver" que saca el query
//     param. El dueño nunca sale de la pantalla en la que estaba.
//
//  3. Navegación en dos niveles: galería → una plantilla. "Volver" de la
//     plantilla vuelve a la galería, no a Avanzado.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, LayoutTemplate, Monitor, Smartphone, Maximize2, ArrowRight, Check, ChevronLeft, ChevronRight, SlidersHorizontal, ExternalLink } from 'lucide-react'
import { Volver } from '../../_shared/Volver'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Modal } from '@/design-system/components/Modal'
import { Toast } from '@/design-system/components/Toast'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, panelGetAppearance, panelSetHomeTemplate } from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import Apariencia from '../../configuracion/Apariencia'
import type { Plantilla } from './tipos'
import { PLANTILLAS } from './datos'

// Únicas plantillas con lógica real detrás (ver businesses.service.ts
// setHomeTemplate) — el resto del catálogo de abajo sigue siendo vitrina.
const PLANTILLAS_ENGANCHADAS = new Set(['vidriera'])

// Las que el dueño guardó pero no quiere ofrecer hoy no se listan ni se
// pueden abrir (ver `oculta` en tipos.ts). No se borran: destapar una es
// sacarle el campo en datos.tsx.
const VISIBLES = PLANTILLAS.filter(x => !x.oculta)
import { CSS, Notebook, Celular, cargarFuentes } from './piezas'
import { Home } from './homes'

type Dispositivo = 'escritorio' | 'celular'

export default function PlantillasConfig({ onVolver }: { onVolver: () => void }) {
    const { user } = useAuth()
    const [abierta, setAbierta] = useState<string | null>(null)
    const [dispositivo, setDispositivo] = useState<Dispositivo>('escritorio')
    const [pantallaCompleta, setPantallaCompleta] = useState(false)
    // Galería: filtro claras/oscuras (tema.oscuro ya lo trae cada plantilla) y
    // la tarjeta con el mouse encima, que muestra su portada REAL en miniatura.
    const [filtro, setFiltro] = useState<'todas' | 'claras' | 'oscuras'>('todas')
    const [conMouse, setConMouse] = useState<string | null>(null)

    // Plantilla realmente activa en storefront_config (null = home clásico).
    // Se carga acá arriba (no solo dentro de la vista de detalle) porque
    // también hace falta en la vitrina, para marcar cuál está en uso.
    const [homeTemplate, setHomeTemplateEstado] = useState<string | null>(null)
    const [activando, setActivando] = useState(false)
    const [modalActivar, setModalActivar] = useState(false)
    // Desactivar vivía SOLO en Configuración → Apariencia, que es la pantalla
    // que la plantilla bloquea: para salir había que ir a la pantalla
    // bloqueada a buscar el botón. Ahora también está acá, donde se activó y
    // donde se edita — que es donde uno lo busca.
    const [modalDesactivar, setModalDesactivar] = useState(false)
    const [desactivando, setDesactivando] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        cargarFuentes()
        panelGetAppearance().then(dto => setHomeTemplateEstado(dto.homeTemplate)).catch(() => {})
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    async function activarPlantilla(id: string) {
        setModalActivar(false)
        setActivando(true)
        try {
            const r = await panelSetHomeTemplate(id)
            setHomeTemplateEstado(r.homeTemplate)
            setToast('Plantilla activada — tu tienda ya la está usando')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo activar la plantilla')
        } finally {
            setActivando(false)
        }
    }

    // `null` = sin plantilla: el home vuelve al clásico y Apariencia se
    // desbloquea. No borra nada — el anuncio, el hero y la barra de confianza
    // son los MISMOS campos de storefront_config que edita Apariencia, así
    // que lo cargado con la plantilla puesta queda igual y reaparece si se
    // vuelve a activar (ver businesses.service.ts#setHomeTemplate).
    async function desactivarPlantilla() {
        setModalDesactivar(false)
        setDesactivando(true)
        try {
            await panelSetHomeTemplate(null)
            setHomeTemplateEstado(null)
            setToast('Volviste a la apariencia clásica — ya podés editarla en Configuración → Apariencia')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo desactivar la plantilla')
        } finally {
            setDesactivando(false)
        }
    }

    const salirDeFullscreen = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setPantallaCompleta(false)
    }, [])
    useEffect(() => {
        if (!pantallaCompleta) return
        window.addEventListener('keydown', salirDeFullscreen)
        return () => window.removeEventListener('keydown', salirDeFullscreen)
    }, [pantallaCompleta, salirDeFullscreen])

    const p = VISIBLES.find(x => x.id === abierta) ?? null
    const idx = p ? VISIBLES.findIndex(x => x.id === p.id) : -1

    // Anterior/siguiente sin volver a la galería: comparar portadas una atrás
    // de otra es la forma más rápida de entender en qué se diferencian.
    const irA = useCallback((d: number) => {
        setAbierta(prev => {
            const i = VISIBLES.findIndex(x => x.id === prev)
            if (i === -1) return prev
            return VISIBLES[(i + d + VISIBLES.length) % VISIBLES.length].id
        })
    }, [])

    // Teclado en el detalle: ←/→ pasan de plantilla, Esc vuelve a la galería.
    // Ni en pantalla completa (su Esc lo maneja salirDeFullscreen) ni con el
    // modal de activar abierto (su Esc lo maneja el Modal del design system).
    useEffect(() => {
        if (!abierta || pantallaCompleta || modalActivar) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') irA(1)
            else if (e.key === 'ArrowLeft') irA(-1)
            else if (e.key === 'Escape') setAbierta(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [abierta, pantallaCompleta, modalActivar, irA])

    // Secciones que SOLO esta plantilla tiene (regla de la casa: cada una trae
    // al menos una propia) — en los chips se marcan con ✦ para que se vea de
    // un vistazo qué la hace distinta, sin leer la bajada.
    const seccionesUnicas = useMemo(() => {
        if (!p) return new Set<string>()
        const delResto = new Set(VISIBLES.filter(x => x.id !== p.id).flatMap(x => x.secciones))
        return new Set(p.secciones.filter(s => !delResto.has(s)))
    }, [p])

    // ─── Galería ─────────────────────────────────────────────────────────────
    if (!p) {
        const filtradas = VISIBLES.filter(x => filtro === 'todas' || (filtro === 'oscuras') === x.tema.oscuro)
        const cuenta = (f: 'todas' | 'claras' | 'oscuras') =>
            f === 'todas' ? VISIBLES.length : VISIBLES.filter(x => (f === 'oscuras') === x.tema.oscuro).length

        return (
            <div style={pageWrap}>
                <style dangerouslySetInnerHTML={{ __html: CSS }} />
                <style>{`
                    @keyframes plantillaVivoIn { from { opacity: 0; } to { opacity: 1; } }
                    .plantilla-vivo { animation: plantillaVivoIn 220ms ease-out; }
                    @media (prefers-reduced-motion: reduce) { .plantilla-vivo { animation: none !important; } }
                `}</style>
                <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />
                <Encabezado
                    titulo="Plantillas de Home"
                    bajada="Veinte portadas distintas para tu tienda. Pasá el mouse por una tarjeta para verla viva en miniatura, o abrila para recorrerla en computadora y celular. El resto del sitio —catálogo, ficha, carrito y checkout— no cambia."
                />

                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                    {([['todas', 'Todas'], ['claras', 'Claras'], ['oscuras', 'Oscuras']] as const).map(([f, label]) => (
                        <button
                            key={f}
                            className="ds-hover"
                            onClick={() => setFiltro(f)}
                            aria-pressed={filtro === f}
                            style={{
                                border: `1px solid ${filtro === f ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                background: filtro === f ? 'var(--color-primary-bg)' : 'transparent',
                                color: filtro === f ? 'var(--color-primary)' : 'var(--color-muted)',
                                borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            {label} · {cuenta(f)}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18, maxWidth: 1180 }}>
                    {filtradas.map(x => (
                            <Card key={x.id} hoverable style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div
                                    style={{ position: 'relative', height: 150, cursor: 'pointer' }}
                                    onMouseEnter={() => setConMouse(x.id)}
                                    onMouseLeave={() => setConMouse(prev => (prev === x.id ? null : prev))}
                                    onClick={() => { setAbierta(x.id); setDispositivo('escritorio') }}
                                >
                                    <img src={x.slides[0].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 55%)' }} />
                                    {/* La portada real en miniatura, montada solo con el mouse
                                        encima (una sola a la vez: veinte Homes vivos juntos
                                        serían un yunque). Verla moverse dice más que la bajada. */}
                                    {conMouse === x.id && <MiniViva p={x} />}
                                    <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 5, pointerEvents: 'none' }}>
                                        {[x.tema.primary, x.tema.accent, x.tema.bg].map((c, k) => (
                                            <span key={k} style={{ width: 15, height: 15, borderRadius: 4, background: c, border: '1px solid rgba(255,255,255,0.45)' }} />
                                        ))}
                                    </div>
                                    {/* Specimen tipográfico: la letra de títulos de ESTA plantilla.
                                        La tipografía es media identidad de una portada — mejor
                                        mostrarla que describirla. */}
                                    <span aria-hidden style={{
                                        position: 'absolute', bottom: 8, right: 12, pointerEvents: 'none',
                                        fontFamily: x.tema.fh, fontSize: 21, fontWeight: 700, lineHeight: 1,
                                        color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.55)',
                                    }}>
                                        Aa
                                    </span>
                                    {/* Después de la MiniViva a propósito: la marca de "en uso"
                                        tiene que verse también durante la vista previa. */}
                                    {homeTemplate === x.id && (
                                        <span style={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--color-success)', borderRadius: 999, padding: '3px 9px', pointerEvents: 'none' }}>
                                            <Check size={11} strokeWidth={3} /> Activa
                                        </span>
                                    )}
                                </div>
                                <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{x.nombre}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 3 }}>{x.para}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--color-body)', marginTop: 10, lineHeight: 1.55, flex: 1 }}>
                                        {x.queCambia.split('. ')[0]}.
                                    </div>
                                    {/* La plantilla activa lleva a lo mismo (el detalle), pero
                                        ahí lo que el dueño va a hacer es editar el contenido de
                                        SU home, no mirar una muestra — el botón lo dice. */}
                                    <Button
                                        variant={homeTemplate === x.id ? 'primary' : 'outline'} size="sm"
                                        icon={homeTemplate === x.id ? <SlidersHorizontal size={13} strokeWidth={2.2} /> : <ArrowRight size={13} strokeWidth={2.2} />}
                                        style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                                        onClick={() => { setAbierta(x.id); setDispositivo('escritorio') }}
                                    >
                                        {homeTemplate === x.id ? 'Editar apariencia' : 'Ver cómo queda'}
                                    </Button>
                                </div>
                            </Card>
                    ))}
                </div>

                {toast && (
                    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                        <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                    </div>
                )}
            </div>
        )
    }

    // ─── Una plantilla ───────────────────────────────────────────────────────
    // El subdominio sale de la sesión y no de la ruta: por /admin/{negocioId}
    // el primer segmento es el id, y arriba del marco quedaría un UUID en vez
    // del dominio que el dueño ve en su tienda.
    const subdominio = user?.type === 'member' ? user.business.subdomain : null
    const dominio = `${subdominio ?? 'tu-tienda'}.orbita.site`
    // Con la plantilla ACTIVA esta pantalla deja de ser una vitrina y pasa a
    // ser el editor del home: el preview de muestra (con productos y fotos
    // que no son los de esta tienda) quedaba abajo de todo, lejos del
    // formulario y mostrando cosas que el dueño no tiene — más ruido que
    // ayuda. La vista previa de verdad es la tienda, que está a un click.
    const editando = homeTemplate === p.id

    return (
        <div style={pageWrap}>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />

            {pantallaCompleta && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: '#000', overflowY: 'auto' }}>
                    <button onClick={() => setPantallaCompleta(false)} style={salirFullBtn}>Salir · Esc</button>
                    {dispositivo === 'celular'
                        ? <div style={{ padding: '28px 0' }}><Celular><Home key={p.id} p={p} movil /></Celular></div>
                        : <Home key={p.id} p={p} movil={false} />}
                </div>
            )}

            <Volver a="Plantillas" onClick={() => setAbierta(null)} espacio="suelto" />
            <Encabezado titulo={p.nombre} bajada={p.queCambia} />

            {/* Única sección con lógica real detrás (ver PLANTILLAS_ENGANCHADAS) —
                el resto de la pantalla (chips, preview mock, dispositivo) sigue
                siendo la vitrina de siempre para las 20. */}
            {PLANTILLAS_ENGANCHADAS.has(p.id) && (
                <Card style={{ maxWidth: editando ? 1180 : 780, marginBottom: 18, padding: 20 }}>
                    {homeTemplate === p.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', borderRadius: 999, padding: '4px 12px', flexShrink: 0 }}>
                                <Check size={12} strokeWidth={3} /> Plantilla activa
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--color-muted)', flex: 1, minWidth: 240 }}>Tu tienda ya está usando esta plantilla — editá el anuncio, el hero y la barra de confianza acá abajo.</span>
                            {/* La vista previa de verdad es la tienda: ya dibuja
                                esta misma plantilla con el catálogo real, así
                                que una maqueta con productos ajenos al lado
                                solo confundía. */}
                            <Button
                                variant="outline" size="sm" icon={<ExternalLink size={13} strokeWidth={2} />}
                                onClick={() => window.open(`https://${dominio}`, '_blank', 'noopener')}
                            >
                                Ver mi tienda
                            </Button>
                            <Button variant="secondary" size="sm" loading={desactivando} onClick={() => setModalDesactivar(true)}>
                                Desactivar
                            </Button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.5, maxWidth: 520 }}>
                                Es la única plantilla con datos reales por ahora: al activarla, tu tienda usa TU catálogo y
                                categorías — no las fotos de muestra que ves más abajo. Mientras esté activa, Apariencia
                                queda bloqueada (se edita desde acá).
                            </div>
                            <Button variant="primary" loading={activando} onClick={() => setModalActivar(true)}>Usar esta plantilla</Button>
                        </div>
                    )}
                </Card>
            )}

            {editando && (
                <div style={{ maxWidth: 1180, marginBottom: 8, border: '1px solid var(--color-border)', borderRadius: 12 }}>
                    <Apariencia ir={() => {}} onToast={setToast} soloContenido />
                </div>
            )}

            {/* Vitrina (plantilla NO activa): chips, selector de dispositivo,
                pantalla completa y la maqueta. Con la plantilla activa nada de
                esto va — arriba está el editor y la vista previa real es la
                tienda, no una maqueta con productos ajenos. */}
            {!editando && (<>
            <div style={barra}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1, minWidth: 240 }}>
                    {p.secciones.map(s => seccionesUnicas.has(s)
                        ? (
                            <span key={s} title="Solo esta plantilla la tiene" style={{ ...chipSeccion, borderColor: 'var(--color-primary)', fontWeight: 600 }}>
                                ✦ {s}
                            </span>
                        )
                        : <span key={s} style={chipSeccion}>{s}</span>)}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Pasar de plantilla sin volver a la galería (también ←/→
                        del teclado): comparar seguido es lo que hace entender
                        rápido en qué se diferencian. */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button className="ds-hover" onClick={() => irA(-1)} aria-label="Plantilla anterior" style={flechaNav}>
                            <ChevronLeft size={15} strokeWidth={2} />
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', whiteSpace: 'nowrap' }}>
                            {idx + 1} / {VISIBLES.length}
                        </span>
                        <button className="ds-hover" onClick={() => irA(1)} aria-label="Plantilla siguiente" style={flechaNav}>
                            <ChevronRight size={15} strokeWidth={2} />
                        </button>
                    </div>
                    <div style={selectorDispositivo}>
                        {([['escritorio', 'Computadora', Monitor], ['celular', 'Celular', Smartphone]] as const).map(([v, label, Icon]) => (
                            <button
                                key={v}
                                onClick={() => setDispositivo(v)}
                                style={{
                                    ...botonDispositivo,
                                    background: dispositivo === v ? 'var(--color-surface)' : 'transparent',
                                    color: dispositivo === v ? 'var(--color-text)' : 'var(--color-muted)',
                                    boxShadow: dispositivo === v ? 'var(--shadow-card)' : 'none',
                                }}
                            >
                                <Icon size={14} strokeWidth={1.9} /> {label}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" size="sm" icon={<Maximize2 size={13} strokeWidth={2} />} onClick={() => setPantallaCompleta(true)}>
                        Pantalla completa
                    </Button>
                </div>
            </div>

            <div style={{ maxWidth: 1180 }}>
                {dispositivo === 'escritorio'
                    ? <Notebook url={dominio}><Home key={p.id} p={p} movil={false} /></Notebook>
                    : <div style={{ padding: '6px 0 10px' }}><Celular><Home key={`${p.id}-m`} p={p} movil /></Celular></div>}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 14, maxWidth: 760, lineHeight: 1.6 }}>
                Las fotos y los productos que ves son de muestra: cuando actives la plantilla, el home se arma
                con tu catálogo, tus categorías y tus colores.
                {' '}Con el teclado también:
                <span style={{ fontFamily: '"Geist Mono", monospace' }}> ← → </span> pasa de plantilla y
                <span style={{ fontFamily: '"Geist Mono", monospace' }}> Esc </span> vuelve a la galería.
            </div>
            </>)}

            <Modal
                isOpen={modalActivar}
                onClose={() => setModalActivar(false)}
                title={`¿Usar la plantilla ${p.nombre}?`}
                footer={<>
                    <Button variant="secondary" onClick={() => setModalActivar(false)}>Cancelar</Button>
                    <Button variant="primary" loading={activando} onClick={() => activarPlantilla(p.id)}>Sí, usar esta plantilla</Button>
                </>}
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    Tu home pasa a usar este diseño con tu catálogo real. Mientras esté activa, la pantalla de
                    Configuración → Apariencia queda bloqueada (el anuncio, el hero y la barra de confianza se
                    editan desde acá). Podés volver a la apariencia clásica cuando quieras.
                </div>
            </Modal>

            <Modal
                isOpen={modalDesactivar}
                onClose={() => setModalDesactivar(false)}
                title={`¿Desactivar la plantilla ${p.nombre}?`}
                footer={<>
                    <Button variant="secondary" onClick={() => setModalDesactivar(false)}>Cancelar</Button>
                    <Button variant="primary" loading={desactivando} onClick={desactivarPlantilla}>Sí, volver a Apariencia</Button>
                </>}
            >
                <div style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6 }}>
                    Tu home vuelve al diseño de siempre y <strong>Configuración → Apariencia se desbloquea</strong>:
                    los colores, la tipografía y el resto del diseño vuelven a editarse desde ahí.
                    {' '}<strong>No se borra nada</strong> — el anuncio, el hero y la barra de confianza que cargaste
                    quedan guardados igual, y si volvés a activar la plantilla los vas a encontrar tal cual.
                </div>
            </Modal>

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// La portada real de la plantilla, escalada para entrar en la tarjeta de la
// galería. Se monta una sola por vez (con el mouse encima) porque cada Home
// trae carruseles y reveals andando — veinte a la vez clavarían la pantalla.
// El ancho de diseño de los homes es ~1200px: se mide la tarjeta y se escala.
function MiniViva({ p }: { p: Plantilla }) {
    const marco = useRef<HTMLDivElement>(null)
    const [escala, setEscala] = useState(0)
    useEffect(() => {
        if (marco.current) setEscala(marco.current.clientWidth / 1200)
    }, [])

    return (
        <div
            ref={marco}
            aria-hidden
            className="plantilla-vivo"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: p.tema.bg }}
        >
            {escala > 0 && (
                <div style={{ width: 1200, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
                    <Home p={p} movil={false} />
                </div>
            )}
            {/* Arriba a la IZQUIERDA: la esquina derecha es del badge "Activa". */}
            <span style={{
                position: 'absolute', top: 8, left: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#fff', background: 'rgba(15,23,42,0.62)',
                borderRadius: 999, padding: '3px 9px', backdropFilter: 'blur(4px)',
            }}>
                En vivo
            </span>
        </div>
    )
}

function Encabezado({ titulo, bajada }: { titulo: string; bajada: string }) {
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <LayoutTemplate size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>{titulo}</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px', maxWidth: 780, lineHeight: 1.6 }}>{bajada}</p>
        </>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const barra: React.CSSProperties = {
    display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, maxWidth: 1180,
    padding: '12px 14px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
}
const chipSeccion: React.CSSProperties = {
    fontSize: 11.5, color: 'var(--color-primary)', background: 'var(--color-primary-bg)',
    border: '1px solid var(--color-border)', borderRadius: 999, padding: '4px 11px',
}
const flechaNav: React.CSSProperties = {
    width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent',
    color: 'var(--color-body)', cursor: 'pointer', padding: 0,
}
const selectorDispositivo: React.CSSProperties = {
    display: 'flex', gap: 2, padding: 3, borderRadius: 999,
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
}
const botonDispositivo: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
    borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    transition: 'background 140ms, color 140ms',
}
const salirFullBtn: React.CSSProperties = {
    position: 'fixed', top: 16, right: 18, zIndex: 9510, background: 'rgba(15,23,42,0.86)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '9px 18px', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(6px)',
}
