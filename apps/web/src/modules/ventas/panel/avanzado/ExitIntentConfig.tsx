// src/modules/ventas/panel/avanzado/ExitIntentConfig.tsx — Configuración del
// "Aviso de salida" (paquete Avanzado).
//
// Antes esta pantalla era "Countdown y exit-intent", con dos pestañas. La
// cuenta regresiva dejó de tener formulario propio: es un interruptor adentro
// de cada descuento (Descuentos → editar → "Cuenta regresiva en la tienda",
// ver CountdownSection.tsx), porque el dueño la buscaba ahí y porque eran dos
// formularios para una sola promo. Acá queda solo el aviso, que sí es texto
// libre, como PromoModal.
//
// El preview es una maqueta aparte, no el componente real del storefront
// (ExitIntentModal.tsx): ese depende de las variables de tema de la tienda, que
// en el panel no están montadas — mismo criterio que StorePreview.tsx.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, ArrowUpRight, Info, RotateCcw, Timer, LogOut } from 'lucide-react'
import { Volver } from '../_shared/Volver'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { Toast } from '@/design-system/components/Toast'
import { SkeletonText } from '@/design-system/components/Skeleton'
import { Toggle, CfgField } from '../configuracion/components/ConfigControls'
import {
    ApiError, panelGetExitIntent, panelUpsertExitIntent, panelRelanzarExitIntent,
    type ApiExitIntentConfig,
} from '@/lib/api'
import { toastEsError } from '@/lib/utils'
import { adminPath, currentSlug, tenantUrl } from '@/lib/tenant'

type Frecuencia = 'ONCE_EVER' | 'ONCE_PER_DAY' | 'ALWAYS'

const VACIO = {
    title: '', message: '', badge: '', code: '', ctaText: '', ctaLink: '',
    frequency: 'ONCE_PER_DAY' as Frecuencia, minSeconds: 15, onMobile: true, isActive: false,
}

export default function ExitIntentConfig({ onVolver }: { onVolver: () => void }) {
    const router = useRouter()
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const [guardado, setGuardado] = useState<ApiExitIntentConfig | null>(null)
    const [titulo, setTitulo] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [badge, setBadge] = useState('')
    const [codigo, setCodigo] = useState('')
    const [ctaTexto, setCtaTexto] = useState('')
    const [ctaLink, setCtaLink] = useState('')
    const [frecuencia, setFrecuencia] = useState<Frecuencia>('ONCE_PER_DAY')
    const [segundos, setSegundos] = useState(15)
    const [celular, setCelular] = useState(true)
    const [activo, setActivo] = useState(false)
    const [original, setOriginal] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [relanzando, setRelanzando] = useState(false)

    function cargar(s: ApiExitIntentConfig | null) {
        setGuardado(s)
        const v = s
            ? {
                title: s.title, message: s.message ?? '', badge: s.badge ?? '', code: s.code ?? '',
                ctaText: s.ctaText ?? '', ctaLink: s.ctaLink ?? '', frequency: s.frequency,
                minSeconds: s.minSeconds, onMobile: s.onMobile, isActive: s.isActive,
            }
            : VACIO
        setTitulo(v.title); setMensaje(v.message); setBadge(v.badge); setCodigo(v.code)
        setCtaTexto(v.ctaText); setCtaLink(v.ctaLink); setFrecuencia(v.frequency)
        setSegundos(v.minSeconds); setCelular(v.onMobile); setActivo(v.isActive)
        setOriginal(JSON.stringify(v))
    }

    useEffect(() => {
        let cancelado = false
        panelGetExitIntent()
            .then(s => { if (!cancelado) cargar(s) })
            .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar la configuración') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(t)
    }, [toast])

    const slug = currentSlug()
    const tiendaUrl = slug ? tenantUrl(slug, '/') : null

    function irADescuentos() {
        const negocioId = slug ?? (router.query.negocioId as string) ?? 'rama-tienda'
        const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
        router.push({ pathname: adminPath(negocioId, moduloPadre, 'descuentos') })
    }

    // ── Validación y cambios sin guardar ─────────────────────────────────────
    const snapshot = { title: titulo, message: mensaje, badge, code: codigo, ctaText: ctaTexto, ctaLink, frequency: frecuencia, minSeconds: segundos, onMobile: celular, isActive: activo }
    const hayCambios = original !== '' && JSON.stringify(snapshot) !== original
    const errorLink = linkInvalido(ctaLink)
        ? 'Tiene que ser una ruta de tu tienda, empezando con "/"'
        : (ctaLink.trim() && !ctaTexto.trim() ? 'Escribí el texto del botón' : null)
    const valido = titulo.trim() !== '' && !errorLink

    async function guardar() {
        if (!valido || !hayCambios || guardando) return
        setGuardando(true)
        try {
            const r = await panelUpsertExitIntent({
                title: titulo.trim(),
                message: mensaje.trim() || undefined,
                badge: badge.trim() || undefined,
                code: codigo.trim() || undefined,
                ctaText: ctaTexto.trim() || undefined,
                ctaLink: ctaLink.trim() || undefined,
                frequency: frecuencia,
                minSeconds: segundos,
                onMobile: celular,
                isActive: activo,
            })
            cargar(r)
            setToast('Aviso de salida guardado')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    async function relanzar() {
        if (!guardado || relanzando) return
        setRelanzando(true)
        try {
            const r = await panelRelanzarExitIntent()
            setGuardado(r)
            setToast('Listo: el aviso vuelve a aparecerle a todo el mundo')
        } catch (e) {
            setToast(e instanceof ApiError ? e.message : 'No se pudo relanzar')
        } finally {
            setRelanzando(false)
        }
    }

    return (
        <div className="panel-page">
            <style>{ESTILOS}</style>
            <Volver a="Avanzado" onClick={onVolver} espacio="suelto" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)' }}>
                    <LogOut size={19} strokeWidth={1.8} color="var(--color-primary)" />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>Cuenta regresiva y aviso de salida</h1>
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 16px', maxWidth: 720 }}>
                Dos formas de apurar una decisión. El aviso de salida se configura acá; la cuenta regresiva se prende desde el descuento.
            </div>

            {/* La cuenta regresiva no tiene formulario propio: es una opción de
                cada descuento. Acá solo se dice dónde está, para que quien
                viene de la tarjeta de Avanzado no la busque en esta pantalla. */}
            <Card padding="md" style={{ marginBottom: 16 }}>
                <div className="eic-cd">
                    <div className="eic-cd-icono" aria-hidden="true">
                        <Timer size={17} strokeWidth={1.8} color="var(--color-warning)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Cuenta regresiva en la portada</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-muted)', marginTop: 3 }}>
                            Se prende adentro de cada descuento: al crearlo o editarlo, activá &ldquo;Mostrar este descuento con cuenta regresiva en la portada&rdquo;. El reloj cuenta hasta su fecha de fin y muestra sus productos con el precio rebajado.
                        </div>
                    </div>
                    <Button variant="outline" size="sm" icon={<ArrowRight size={13} strokeWidth={2.2} />} onClick={irADescuentos}>
                        Ir a Descuentos
                    </Button>
                </div>
            </Card>

            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-border)', borderRadius: 10, margin: '0 0 16px', fontSize: 13, color: 'var(--color-error)' }}>
                    {error}
                </div>
            )}

            {cargando ? (
                <Card padding="md">
                    <SkeletonText width="40%" height={14} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                    <SkeletonText width="100%" height={40} style={{ marginTop: 14 }} />
                </Card>
            ) : (
                <div className="eic-cols">
                    <Card padding="md">
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>Aviso de salida</div>
                        <CfgField label="Título" value={titulo} onChange={setTitulo} placeholder="¿Te vas sin llevarlo?" />
                        <CfgField label="Mensaje (opcional)" value={mensaje} onChange={setMensaje} area placeholder="Llevate un 10% con este código, solo por hoy." />
                        <div className="eic-2col">
                            <CfgField label="Etiqueta (opcional)" value={badge} onChange={setBadge} placeholder="ESPERÁ" />
                            <CfgField label="Código a mostrar (opcional)" value={codigo} onChange={setCodigo} placeholder="VOLVE10" />
                        </div>
                        <div className="eic-2col">
                            <CfgField label="Texto del botón (opcional)" value={ctaTexto} onChange={setCtaTexto} placeholder="Seguir comprando" />
                            <CampoLink id="eic-link" value={ctaLink} onChange={setCtaLink} error={errorLink} />
                        </div>

                        <div className="eic-aviso">
                            <Info size={14} strokeWidth={1.8} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div>Es un anuncio: el mensaje y el código son texto libre, no se validan contra nada. Si prometés un código, crealo de verdad en Descuentos.</div>
                        </div>

                        <fieldset className="eic-fieldset">
                            <legend className="eic-legend">Cada cuánto puede aparecerle a la misma persona</legend>
                            <div className="eic-opciones">
                                <OpcionRadio nombre="eic-frec" valor="ONCE_EVER" elegido={frecuencia} onElegir={v => setFrecuencia(v as Frecuencia)}
                                    titulo="Una sola vez" desc="Lo más prudente: si ya lo vio y lo cerró, no vuelve a verlo nunca." />
                                <OpcionRadio nombre="eic-frec" valor="ONCE_PER_DAY" elegido={frecuencia} onElegir={v => setFrecuencia(v as Frecuencia)}
                                    titulo="Una vez por día" desc="Vuelve a aparecer al día siguiente. Equilibrio razonable para una promo que dura varios días." />
                                <OpcionRadio nombre="eic-frec" valor="ALWAYS" elegido={frecuencia} onElegir={v => setFrecuencia(v as Frecuencia)}
                                    titulo="Siempre" desc="Cada vez que amaga con irse. Es el que más molesta: usalo solo en una promo muy corta." />
                            </div>
                        </fieldset>

                        <div style={{ marginBottom: 16 }}>
                            <label htmlFor="eic-seg" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 8, display: 'block' }}>
                                Esperar al menos <strong style={{ color: 'var(--color-text)' }}>{segundos} segundos</strong> antes de poder mostrarlo
                            </label>
                            <input
                                id="eic-seg" type="range" min={0} max={120} step={5} value={segundos}
                                onChange={e => setSegundos(Number(e.target.value))} className="eic-slider"
                            />
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 5, lineHeight: 1.5 }}>
                                Sin esta espera, a alguien que entra y lleva el mouse a la barra del navegador le salta el cartel a los dos segundos, sin haber visto nada de la tienda.
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={celular} onChange={setCelular} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Mostrarlo también en celular</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>En el celular no existe &ldquo;el mouse se fue de la pantalla&rdquo;: ahí se dispara cuando la persona hace un scroll rápido hacia arriba, de vuelta hacia la barra del navegador.</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
                            <Toggle on={activo} onChange={setActivo} />
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text)' }}>Aviso activo</div>
                                <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Con esto prendido, puede aparecer en cualquier página de tu tienda.</div>
                            </div>
                        </div>

                        <DirtyHint show={hayCambios} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Button variant="primary" loading={guardando} disabled={!valido || !hayCambios} onClick={guardar}>Guardar</Button>
                            <Button variant="secondary" loading={relanzando} disabled={!guardado} onClick={relanzar}>
                                <RotateCcw size={13} strokeWidth={2} style={{ marginRight: 6 }} />
                                Mostrar de nuevo
                            </Button>
                            <InfoTooltip texto="Empieza una campaña nueva: el aviso le vuelve a aparecer a todo el mundo, incluso a quien ya lo había cerrado. No cambia nada más de la configuración." />
                        </div>
                    </Card>

                    <div className="eic-lateral">
                        <Card padding="md">
                            <div className="eic-lateral-titulo">Así se ve</div>
                            <PreviewSalida titulo={titulo} mensaje={mensaje} badge={badge} codigo={codigo} cta={ctaTexto} />
                            <div className="eic-nota">Es una maqueta: en tu tienda toma los colores que tengas configurados en Apariencia.</div>
                            {tiendaUrl && (
                                <a href={tiendaUrl} target="_blank" rel="noreferrer" className="eic-link-tienda">
                                    Ver en tu tienda <ArrowUpRight size={13} strokeWidth={2.2} />
                                </a>
                            )}
                        </Card>
                    </div>
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

// ─── Validación espejo de la del backend ──────────────────────────────────────
// Mismo criterio que normalizarLinkDeTienda() en la API: solo rutas de la
// propia tienda. "//otro.com" empieza con "/" pero el navegador lo resuelve
// como dominio externo, así que se rechaza aparte.
function linkInvalido(link: string): boolean {
    const l = link.trim()
    if (!l) return false
    return !l.startsWith('/') || l.startsWith('//')
}

// ─── Campos ───────────────────────────────────────────────────────────────────
// Mismo aspecto que CfgField (ConfigControls.tsx), pero con un <label for>
// atado al input y con lugar para un error debajo.
function CampoLink({ id, value, onChange, error }: { id: string; value: string; onChange: (v: string) => void; error?: string | null }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-body)', marginBottom: 6, display: 'block' }}>Link del botón (opcional)</label>
            <input
                id={id} className="eic-input" placeholder="/catalogo"
                value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error}
            />
            {error
                ? <div role="alert" style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 5 }}>{error}</div>
                : <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 5 }}>Una ruta de tu tienda: /catalogo</div>}
        </div>
    )
}

function OpcionRadio({ nombre, valor, elegido, onElegir, titulo, desc }: { nombre: string; valor: string; elegido: string; onElegir: (v: string) => void; titulo: string; desc: string }) {
    const a = elegido === valor
    return (
        <label className="eic-opcion" data-elegida={a || undefined}>
            <input type="radio" name={nombre} value={valor} checked={a} onChange={() => onElegir(valor)} className="eic-radio" />
            <span>
                <span className="eic-opcion-titulo">{titulo}</span>
                <span className="eic-opcion-desc">{desc}</span>
            </span>
        </label>
    )
}

function PreviewSalida({ titulo, mensaje, badge, codigo, cta }: { titulo: string; mensaje: string; badge: string; codigo: string; cta: string }) {
    return (
        <div className="eic-preview">
            <div className="eic-modal">
                {badge.trim() && <span className="eic-modal-badge">{badge}</span>}
                <div className="eic-modal-titulo">{titulo.trim() || 'Tu título acá'}</div>
                {mensaje.trim() && <div className="eic-modal-msg">{mensaje}</div>}
                {codigo.trim() && <div className="eic-modal-codigo">{codigo}</div>}
                {cta.trim() && <div className="eic-modal-cta">{cta}</div>}
            </div>
        </div>
    )
}

// ─── Piezas menores ───────────────────────────────────────────────────────────
// Mismo aviso que PromoModalConfig.tsx/JuegosConfig.tsx#DirtyHint.
function DirtyHint({ show }: { show: boolean }) {
    if (!show) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            Tenés cambios sin guardar
        </div>
    )
}

// Mismo patrón que PromoModalConfig.tsx#InfoTooltip.
function InfoTooltip({ texto }: { texto: string }) {
    const [abierto, setAbierto] = useState(false)
    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                type="button"
                onClick={() => setAbierto(a => !a)}
                onMouseEnter={() => setAbierto(true)}
                onMouseLeave={() => setAbierto(false)}
                onBlur={() => setAbierto(false)}
                aria-label="Qué hace el botón Mostrar de nuevo"
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
                </div>
            )}
        </span>
    )
}

// Acá vive todo lo que necesita media queries, :hover o selectores de estado;
// el resto sigue inline como en el resto del panel.
const ESTILOS = `
.eic-cd { display: flex; align-items: center; gap: 12px; }
.eic-cd-icono { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-warning-bg); }

.eic-cols { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 16px; align-items: start; }
.eic-2col { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 14px; }
.eic-input { width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; color: var(--color-text); font-family: inherit; outline: none; }
.eic-input:focus-visible { border-color: var(--color-primary); }
.eic-input[aria-invalid="true"] { border-color: var(--color-error); }

.eic-fieldset { border: none; padding: 0; margin: 6px 0 18px; min-width: 0; }
.eic-legend { font-size: 13px; font-weight: 600; color: var(--color-text); padding: 0; margin-bottom: 8px; }
.eic-opciones { display: flex; flex-direction: column; gap: 8px; }
.eic-opcion { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border: 1px solid var(--color-border); border-radius: 10px; cursor: pointer; background: var(--color-bg); transition: border-color 180ms ease, background-color 180ms ease; }
.eic-opcion:hover { border-color: var(--color-primary); }
.eic-opcion[data-elegida] { border-color: var(--color-primary); background: var(--color-primary-bg); }
.eic-opcion:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.eic-radio { margin: 2px 0 0; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--color-primary); cursor: pointer; }
.eic-opcion-titulo { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
.eic-opcion-desc { display: block; font-size: 11.5px; color: var(--color-muted); line-height: 1.5; margin-top: 2px; }

.eic-slider { width: 100%; accent-color: var(--color-primary); height: 24px; cursor: pointer; }

.eic-lateral-titulo { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.eic-link-tienda { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--color-primary); text-decoration: none; }
.eic-nota { font-size: 11.5px; color: var(--color-subtle); line-height: 1.5; margin: 10px 0 12px; }
.eic-aviso { display: flex; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-border); margin-bottom: 16px; font-size: 11.5px; color: var(--color-muted); line-height: 1.5; }

/* El preview imita el fondo de la tienda, no el del panel, para que se lea
   como "esto pasa allá" y no como un componente más de esta pantalla. */
.eic-preview { background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: 10px; padding: 20px 12px; overflow: hidden; display: grid; place-items: center; }
.eic-modal { width: 100%; max-width: 250px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 14px; padding: 18px 16px; text-align: center; box-shadow: 0 12px 28px rgba(0,0,0,0.12); }
.eic-modal-badge { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 999px; background: var(--color-primary-bg); color: var(--color-primary); margin-bottom: 8px; }
.eic-modal-titulo { font-size: 15px; font-weight: 700; color: var(--color-text); line-height: 1.3; }
.eic-modal-msg { font-size: 12px; color: var(--color-muted); line-height: 1.5; margin-top: 6px; }
.eic-modal-codigo { display: inline-block; margin-top: 10px; padding: 6px 12px; border-radius: 8px; border: 1px dashed var(--color-primary); color: var(--color-primary); font-family: "Geist Mono", monospace; font-size: 12.5px; font-weight: 700; }
.eic-modal-cta { margin-top: 12px; padding: 9px 14px; border-radius: 9px; background: var(--color-primary); color: var(--color-on-primary); font-size: 12.5px; font-weight: 600; }

/* Con el preview al lado, el formulario queda en ~380px y los dos campos por
   fila salen más angostos que su propio placeholder. Primero se baja el
   preview, después se apilan los campos. */
@media (max-width: 1080px) {
  .eic-cols { grid-template-columns: minmax(0,1fr); }
  .eic-lateral { order: -1; }
}
@media (max-width: 768px) {
  .eic-2col { grid-template-columns: minmax(0,1fr); gap: 12px; }
  .eic-cd { flex-wrap: wrap; }
  .eic-cd > button { width: 100%; justify-content: center; }
  /* 16px evita el zoom automático de iOS al enfocar el campo. */
  .eic-input { font-size: 16px; }
}
`
