// src/modules/ventas/panel/avanzado/PromoModalConfig.tsx — Configuración de
// "Modales de anuncios" (paquete Avanzado).
//
// Hermana más simple de JuegosConfig.tsx: un solo modal por negocio (no hay
// concepto de "mecánica" acá, así que no hay selector ni pestaña de
// Reportes), pero mismo mecanismo de vigencia/campaña ("Relanzar" vuelve a
// mostrarlo a quien ya lo cerró) y misma UX de guardado (dirty-check contra
// un snapshot). Todo el contenido es texto libre — no se ata a ningún
// Discount/Cupón real: es un anuncio, no algo que el checkout ejecute
// (RBT-675 — el motor no tiene "2x1" implementado, ver discount-engine.ts).
// Vive DENTRO del modal de la home (Inicio.tsx), sin URL propia — mismo
// criterio que Juegos con premio.

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, MessageSquareText, RotateCcw, Info } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle, CfgField } from '../configuracion/components/ConfigControls'
import { RangoFechasPicker } from '@/modules/ventas/_shared/components'
import {
    ApiError, panelGetPromoModal, panelUpsertPromoModal, panelRelanzarPromoModal,
    type ApiPromoModal,
} from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { currentSlug, tenantUrl } from '@/lib/tenant'

const CONFIG_VACIA = { title: '', message: '', badge: '', code: '', ctaText: '', ctaLink: '', isActive: false, startDate: '', endDate: '' }

export default function PromoModalConfig({ onVolver }: { onVolver: () => void }) {
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [relanzando, setRelanzando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    // Configuración ya guardada — null hasta cargar, o si el negocio nunca
    // configuró nada todavía (mismo criterio que "Relanzar" deshabilitado
    // en Juegos si no hay nada configurado).
    const [guardado, setGuardado] = useState<ApiPromoModal | null>(null)

    const [titulo, setTitulo] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [badge, setBadge] = useState('')
    const [codigo, setCodigo] = useState('')
    const [ctaTexto, setCtaTexto] = useState('')
    const [ctaLink, setCtaLink] = useState('')
    const [activo, setActivo] = useState(false)
    // Vigencia opcional ("desde"/"hasta", 'YYYY-MM-DD' o '' si no hay límite)
    // — mismo criterio que JuegosConfig.tsx: cargar fechas nuevas, o volver
    // a activar el modal, cuenta como relanzamiento de cara al storefront
    // (ver campaignVersion en el backend).
    const [desde, setDesde] = useState('')
    const [hasta, setHasta] = useState('')
    // Snapshot de lo último cargado/guardado — mismo patrón que
    // JuegosConfig.tsx/ConfigGeneral.tsx para saber si hay cambios sin guardar.
    const [original, setOriginal] = useState('')

    useEffect(() => {
        let cancelado = false
        panelGetPromoModal()
            .then(m => {
                if (cancelado) return
                setGuardado(m)
                const cargado = m
                    ? {
                        title: m.title, message: m.message ?? '', badge: m.badge ?? '', code: m.code ?? '', ctaText: m.ctaText ?? '', ctaLink: m.ctaLink ?? '', isActive: m.isActive,
                        // El backend devuelve ISO completo — RangoFechasPicker espera solo 'YYYY-MM-DD'.
                        startDate: m.startDate ? m.startDate.slice(0, 10) : '', endDate: m.endDate ? m.endDate.slice(0, 10) : '',
                    }
                    : CONFIG_VACIA
                setTitulo(cargado.title)
                setMensaje(cargado.message)
                setBadge(cargado.badge)
                setCodigo(cargado.code)
                setCtaTexto(cargado.ctaText)
                setCtaLink(cargado.ctaLink)
                setActivo(cargado.isActive)
                setDesde(cargado.startDate)
                setHasta(cargado.endDate)
                setOriginal(JSON.stringify(cargado))
            })
            .catch(e => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración'))
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    // El modal no tiene URL propia — vive en el modal del home (mismo
    // criterio que Juegos, ver Inicio.tsx). Se omite si no se puede
    // resolver el slug por subdominio, en vez de armar un link roto.
    const slug = currentSlug()
    const tiendaUrl = slug ? tenantUrl(slug, '/') : null

    // Vigencia: o las dos fechas vacías (sin límite) o las dos cargadas, con
    // "hasta" posterior a "desde" — mismo criterio que valida el backend.
    const vigenciaValida = (desde === '' && hasta === '') || (desde !== '' && hasta !== '' && hasta > desde)
    const valoresValidos = titulo.trim() !== '' && vigenciaValida
    const hayCambios = original !== '' && JSON.stringify({ title: titulo, message: mensaje, badge, code: codigo, ctaText: ctaTexto, ctaLink, isActive: activo, startDate: desde, endDate: hasta }) !== original
    const estado = estadoVigencia(desde, hasta)

    async function guardarModal() {
        if (!valoresValidos || !hayCambios || guardando) return
        setGuardando(true)
        try {
            const res = await panelUpsertPromoModal({
                title: titulo.trim(),
                message: mensaje.trim() || undefined,
                badge: badge.trim() || undefined,
                code: codigo.trim() || undefined,
                ctaText: ctaTexto.trim() || undefined,
                ctaLink: ctaLink.trim() || undefined,
                isActive: activo,
                startDate: desde || undefined,
                endDate: hasta || undefined,
            })
            setGuardado(res)
            setOriginal(JSON.stringify({
                title: res.title, message: res.message ?? '', badge: res.badge ?? '', code: res.code ?? '', ctaText: res.ctaText ?? '', ctaLink: res.ctaLink ?? '', isActive: res.isActive,
                startDate: res.startDate ? res.startDate.slice(0, 10) : '', endDate: res.endDate ? res.endDate.slice(0, 10) : '',
            }))
            setDesde(res.startDate ? res.startDate.slice(0, 10) : '')
            setHasta(res.endDate ? res.endDate.slice(0, 10) : '')
            setToast('Configuración guardada')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    // Solo incrementa campaignVersion (ver PromoModalService#relanzar) — no
    // toca ninguna otra config, mismo criterio que JuegosConfig.tsx.
    async function relanzar() {
        if (relanzando || !guardado) return
        setRelanzando(true)
        try {
            const res = await panelRelanzarPromoModal()
            setGuardado(res)
            setToast('Listo, arrancó una campaña nueva: el aviso vuelve a aparecer')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo relanzar')
        } finally {
            setRelanzando(false)
        }
    }

    return (
        <div style={pageWrap}>
            <style>{`
                @media (max-width: 900px) {
                    .promo-modal-cols { grid-template-columns: minmax(0,1fr) !important; }
                }
                @media (max-width: 768px) {
                    /* Dos campos por fila dejan ~140px cada uno: etiquetas como
                       "Codigo a mostrar (opcional)" se parten en tres renglones
                       y el input queda mas angosto que su propio placeholder. */
                    .promo-2col { grid-template-columns: minmax(0,1fr) !important; gap: 12px !important; }
                }
            `}</style>
            <button onClick={onVolver} style={volverBtn}>
                <ArrowLeft size={14} strokeWidth={2} /> Avanzado
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <MessageSquareText size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Modales de anuncios</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 22px' }}>
                Un aviso que aparece como modal la primera vez que alguien entra a tu tienda — 2x1, bienvenida con descuento, o cualquier anuncio puntual.
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md">
                    <SkeletonText width="30%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 10 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : (
                <div className="promo-modal-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
                    {/* ── Columna principal: el formulario ── */}
                    <Card padding="md">
                        <CfgField label="Título" value={titulo} onChange={setTitulo} placeholder="¡2x1 en toda la tienda!" />
                        <CfgField label="Mensaje (opcional)" value={mensaje} onChange={setMensaje} area placeholder="Válido hasta agotar stock, en toda la tienda." />
                        <div className="promo-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <CfgField label="Etiqueta (opcional)" value={badge} onChange={setBadge} placeholder="2X1" />
                            <CfgField label="Código a mostrar (opcional)" value={codigo} onChange={setCodigo} placeholder="VERANO2X1" />
                        </div>
                        <div className="promo-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <CfgField label="Texto del botón (opcional)" value={ctaTexto} onChange={setCtaTexto} placeholder="Ver catálogo" />
                            <CfgField label="Link del botón (opcional)" value={ctaLink} onChange={setCtaLink} placeholder="/catalogo" />
                        </div>

                        {/* Aviso de responsabilidad — a propósito, ver el
                            comentario del archivo: esto es texto libre, no
                            se valida contra ningún descuento real. */}
                        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: 14 }}>
                            <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                                Esto es un anuncio: el título, el mensaje y el código son texto libre, no se validan contra ningún descuento real. Asegurate de poder cumplir lo que promete — por ejemplo, hoy no hay un motor de &ldquo;2x1&rdquo; automático; si anunciás un código, que exista de verdad como descuento en Descuentos o se resuelva a mano.
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 2px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Vigencia (opcional)</div>
                            {(desde || hasta) && (
                                <button type="button" onClick={() => { setDesde(''); setHasta('') }} style={quitarVigenciaBtn}>
                                    Quitar vigencia
                                </button>
                            )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 10 }}>
                            Dejalo vacío para manejarlo solo con el toggle de abajo. Cargar fechas nuevas — o volver a activarlo — cuenta como un relanzamiento: a quien ya le apareció el aviso y lo cerró, le vuelve a aparecer.
                        </div>
                        <div style={{ marginBottom: 6 }}>
                            <RangoFechasPicker
                                fechaInicio={desde}
                                fechaFin={hasta}
                                onChangeInicio={setDesde}
                                onChangeFin={setHasta}
                                error={!vigenciaValida ? 'Cargá las dos fechas, con "hasta" posterior a "desde"' : undefined}
                            />
                        </div>
                        {estado && <div style={{ fontSize: 12, fontWeight: 500, color: estado.color, margin: '0 0 14px' }}>{estado.texto}</div>}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={activo} onChange={setActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Modal activo</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, el modal le aparece a cualquiera que entre por primera vez a tu tienda.</div>
                            </div>
                        </div>
                        <DirtyHint show={hayCambios} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Button variant="primary" loading={guardando} disabled={!valoresValidos || !hayCambios} onClick={guardarModal}>Guardar</Button>
                            <Button variant="secondary" loading={relanzando} disabled={!guardado} onClick={relanzar}>
                                <RotateCcw size={13} strokeWidth={2} style={{ marginRight: 6 }} />
                                Relanzar
                            </Button>
                            <InfoTooltip texto="Empieza una campaña nueva: el aviso le vuelve a aparecer a todo el mundo, incluso a quien ya lo cerró. No cambia nada más de la configuración." />
                        </div>
                    </Card>

                    {/* ── Sidebar: resumen ── */}
                    <Card padding="md">
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>Resumen</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>Estado</span>
                            <span style={{
                                fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '2px 9px',
                                color: activo ? 'var(--color-success)' : 'var(--color-muted)',
                                background: activo ? 'var(--color-success-bg)' : 'var(--color-surface-alt)',
                            }}>
                                {activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        {estado ? (
                            <div style={{ fontSize: 12, fontWeight: 500, color: estado.color, marginBottom: 10, lineHeight: 1.5 }}>{estado.texto}</div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginBottom: 10 }}>Sin límite de fechas.</div>
                        )}
                        {/* Sin banner de Apariencia acá a propósito — son dos
                            cosas separadas y opcionales, ver comentario del
                            módulo: uno no reemplaza al otro. */}
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                            Es independiente del banner de Apariencia (más discreto, siempre visible) — podés tener los dos a la vez, uno solo, o ninguno.
                        </div>
                        {tiendaUrl && (
                            <a href={tiendaUrl} target="_blank" rel="noreferrer" style={linkVerModal}>
                                Ver en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                            </a>
                        )}
                    </Card>
                </div>
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
                    <Toast variant={toastEsError(toast) ? 'error' : 'success'} title={toast} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    )
}

// Mismo cálculo que JuegosConfig.tsx#estadoVigencia — del lado del cliente,
// sobre los valores del form.
function estadoVigencia(desde: string, hasta: string): { texto: string; color: string } | null {
    if (!desde || !hasta) return null
    const hoy = new Date().toISOString().slice(0, 10)
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    if (hoy < desde) return { texto: `Todavía no empezó, arranca el ${fmt(desde)}`, color: 'var(--color-warning)' }
    if (hoy > hasta) return { texto: `Venció el ${fmt(hasta)}`, color: 'var(--color-error)' }
    return { texto: `Vigente hasta el ${fmt(hasta)}`, color: 'var(--color-success)' }
}

// Mismo patrón que JuegosConfig.tsx#InfoTooltip.
function InfoTooltip({ texto }: { texto: string }) {
    const [abierto, setAbierto] = useState(false)
    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                onMouseEnter={() => setAbierto(true)}
                onMouseLeave={() => setAbierto(false)}
                aria-label="Qué hace el botón Relanzar"
                style={{
                    width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-alt)', color: 'var(--color-muted)', display: 'grid', placeItems: 'center',
                    cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0,
                }}
            >
                <Info size={11} strokeWidth={2.2} />
            </button>
            {abierto && (
                <div role="tooltip" style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                    width: 230, padding: '9px 11px', borderRadius: 8, background: 'var(--color-text)', color: 'var(--color-bg)',
                    fontSize: 11.5, lineHeight: 1.55, boxShadow: '0 10px 24px rgba(0,0,0,0.2)', zIndex: 20,
                }}>
                    {texto}
                    <span style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--color-text)',
                    }} />
                </div>
            )}
        </span>
    )
}

// Mismo aviso que JuegosConfig.tsx/ConfigGeneral.tsx#DirtyHint.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const volverBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0,
    fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit',
}
const linkVerModal: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
    color: 'var(--color-primary)', textDecoration: 'none',
}
const quitarVigenciaBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0,
    fontSize: 11.5, fontWeight: 500, color: 'var(--color-muted)', cursor: 'pointer', fontFamily: 'inherit',
}
