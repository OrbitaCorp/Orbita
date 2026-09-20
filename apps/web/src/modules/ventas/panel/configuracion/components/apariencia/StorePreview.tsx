// Vista previa de Apariencia: la TIENDA REAL, en un iframe.
//
// Antes este archivo eran 900 líneas que redibujaban el home a mano
// (productos, categorías, badges y hasta un chat de WhatsApp inventados).
// Dos problemas: cada cambio del storefront había que copiarlo acá también —
// y cuando no se copiaba, el preview mentía (la propia historia del archivo
// lo muestra: "Radio de cards" que no existía en la tienda, badges "−19%"
// que ningún producto muestra, el parallax simulado con JS porque el
// transform:scale rompía el `fixed`) — y el dueño veía la marca y el
// catálogo de una tienda ficticia en vez de los suyos.
//
// Ahora se embebe la tienda de verdad (mismo origen, ver X-Frame-Options
// SAMEORIGIN en next.config.ts) a ancho de diseño 1280 y se escala para
// llenar el panel; el scroll y el parallax son los del storefront real.
// El borrador SIN GUARDAR viaja por postMessage y la tienda lo pisa sobre su
// propia config (ver lib/storefront/previewBridge.ts), así los cambios se
// siguen viendo en vivo sin apretar "Guardar cambios".
//
// Con cambios sin guardar aparece "Publicado / Con tus cambios" arriba: el
// mismo iframe recibe lo guardado en vez del borrador, así se compara el
// antes y el después sin recargar ni guardar nada. Tocar cualquier campo
// vuelve solo a "Con tus cambios" — si no, se editaría a ciegas.
//
// Si el dueño clickea un link adentro del preview, navega de verdad: esa
// página pierde el `?preview=1` y muestra lo guardado. Es correcto — sigue
// siendo su tienda real, solo sin el borrador encima.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { ROOT_DOMAIN, currentSlug } from '@/lib/tenant'
import { MSG_BORRADOR, MSG_LISTA, PREVIEW_QUERY } from '@/lib/storefront/previewBridge'
import { apToUpdateDto } from '../../mock/apariencia.mapper'
import type { Apariencia } from '../../mock/apariencia.mock'

const DESIGN_W = 1280
// Vista de celular: el iframe se dibuja a 390×844 (un teléfono común) y la
// tienda responde con SU diseño de celular, el mismo que ve un cliente —
// no es una maqueta angosta, es el storefront real a ese ancho.
const MOVIL_W = 390
const MOVIL_H = 844
// Suficiente para que tipear un título se sienta en vivo sin mandar un
// postMessage por tecla (los slides pueden llevar URLs largas adentro).
const DEBOUNCE_MS = 120

type Vista = 'cambios' | 'publicado'
type Dispositivo = 'escritorio' | 'celular'

interface StorePreviewProps {
    ap: Apariencia
    /** Lo que la tienda muestra hoy. null = no hay cambios que comparar. */
    publicado?: Apariencia | null
    full?: boolean
    subdomain?: string
}

export function StorePreview({ ap, publicado, full, subdomain }: StorePreviewProps) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [scale, setScale] = useState(0.5)
    const [wrapH, setWrapH] = useState(900)
    // Pedido de Ale (20/09): poder ver la portada como se ve en un celular
    // sin salir del panel — la mayoría de las visitas a una tienda entran
    // desde el teléfono.
    const [dispositivo, setDispositivo] = useState<Dispositivo>('escritorio')
    const esMovil = dispositivo === 'celular'

    // En un effect y no inline: el src depende del host (currentSlug lee
    // window.location) y calcularlo durante el render rompería la hidratación.
    // Con subdominio, la tienda es la raíz de ESTE host; sin subdominio (dev
    // en localhost, panel bajo /admin/...) se entra por el path.
    const [src, setSrc] = useState<string | null>(null)
    useEffect(() => {
        const slugHost = currentSlug()
        if (slugHost) { setSrc(`/?${PREVIEW_QUERY}=1`); return }
        setSrc(subdomain ? `/tienda/${subdomain}?${PREVIEW_QUERY}=1` : null)
    }, [subdomain])

    // Escalar: el iframe se dibuja a 1280 de ancho (el ancho de diseño del
    // storefront) y se reduce para entrar en la columna. El alto se estira en
    // la misma proporción, así el iframe scrollea por dentro como la tienda.
    useLayoutEffect(() => {
        const medir = () => {
            const wrap = wrapRef.current
            if (!wrap || wrap.clientWidth === 0) return
            setWrapH(wrap.clientHeight)
            // En celular el teléfono entra ENTERO (se achica por alto y por
            // ancho, lo que sea más chico), con un respiro alrededor; en
            // escritorio se sigue llenando el ancho como siempre.
            setScale(esMovil
                ? Math.min((wrap.clientWidth - 32) / MOVIL_W, (wrap.clientHeight - 32) / MOVIL_H, 1)
                : wrap.clientWidth / DESIGN_W)
        }
        medir()
        const ro = new ResizeObserver(medir)
        if (wrapRef.current) ro.observe(wrapRef.current)
        window.addEventListener('resize', medir)
        return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
    }, [esMovil])

    // Exactamente lo que se mandaría al guardar: así el preview no puede
    // divergir de lo que va a quedar en la tienda.
    const [vista, setVista] = useState<Vista>('cambios')
    useEffect(() => { setVista('cambios') }, [ap])
    const verPublicado = vista === 'publicado' && !!publicado
    const borrador = useMemo(() => apToUpdateDto(verPublicado ? publicado! : ap), [ap, publicado, verPublicado])
    const borradorRef = useRef(borrador)
    useEffect(() => { borradorRef.current = borrador }, [borrador])

    const mandarBorrador = useCallback(() => {
        iframeRef.current?.contentWindow?.postMessage(
            { type: MSG_BORRADOR, appearance: borradorRef.current },
            window.location.origin,
        )
    }, [])

    // El iframe avisa cuando ya puede escuchar (MSG_LISTA): un postMessage
    // mandado antes de eso se pierde sin error. Vale para la carga inicial y
    // para cualquier recarga posterior del iframe.
    useEffect(() => {
        const alMensaje = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            if ((e.data as { type?: string } | null)?.type === MSG_LISTA) mandarBorrador()
        }
        window.addEventListener('message', alMensaje)
        return () => window.removeEventListener('message', alMensaje)
    }, [mandarBorrador])

    useEffect(() => {
        const t = setTimeout(mandarBorrador, DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [borrador, mandarBorrador])

    const frameHeight = full ? '100%' : 'calc(100vh - 150px)'

    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: full ? 'none' : '0 8px 32px rgba(15,23,42,0.12)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', height: frameHeight }}>
            {/* Solo el favicon y el subdominio real de ESTE negocio — sin los
                puntitos de macOS ni una URL de mentira. */}
            <div style={{ height: 36, flexShrink: 0, borderBottom: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                <div style={{ justifySelf: 'start' }}>
                    <ToggleDispositivo valor={dispositivo} onChange={setDispositivo} />
                </div>
                <div style={{ height: 22, padding: '0 14px', borderRadius: 999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', maxWidth: 280, overflow: 'hidden' }}>
                    {ap.favicon
                        ? <img src={ap.favicon} alt="" style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />
                        : <span aria-hidden style={{ fontSize: 11 }}>🔒</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subdomain ? `${subdomain}.${ROOT_DOMAIN}` : (ap.nombreTienda || 'tu-tienda')}
                    </span>
                </div>
                <div style={{ justifySelf: 'end' }}>
                    {publicado && <ToggleVista vista={vista} onChange={setVista} />}
                </div>
            </div>

            <div ref={wrapRef} style={{ flex: 1, overflow: 'hidden', background: esMovil ? 'var(--color-surface-alt)' : 'var(--color-bg)', display: esMovil ? 'grid' : 'block', placeItems: 'center' }}>
                {src ? (
                    // En celular el iframe va adentro de una caja del tamaño ya
                    // escalado: sin eso, el `transform` no ocupa lugar en el
                    // layout y el teléfono no queda centrado.
                    <div style={esMovil
                        ? { width: MOVIL_W * scale, height: MOVIL_H * scale, borderRadius: 22 * scale, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 8px 28px rgba(15,23,42,0.16)', background: 'var(--color-bg)' }
                        : undefined}
                    >
                        <iframe
                            ref={iframeRef}
                            src={src}
                            title="Vista previa de tu tienda"
                            style={{
                                width: esMovil ? MOVIL_W : DESIGN_W,
                                height: esMovil ? MOVIL_H : wrapH / (scale || 1),
                                border: 'none', display: 'block',
                                transformOrigin: 'top left', transform: `scale(${scale})`, background: 'var(--color-bg)',
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                        Cargando tu tienda…
                    </div>
                )}
            </div>
        </div>
    )
}

// Escritorio / celular. Iconos solos: el aria-label dice cuál es cada uno y
// el par entra al lado de la barra de direcciones sin apretarla.
function ToggleDispositivo({ valor, onChange }: { valor: Dispositivo; onChange: (v: Dispositivo) => void }) {
    const opciones: [Dispositivo, string, typeof Monitor][] = [
        ['escritorio', 'Ver como en una computadora', Monitor],
        ['celular', 'Ver como en un celular', Smartphone],
    ]
    return (
        <div role="radiogroup" aria-label="Tamaño de pantalla de la vista previa" style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {opciones.map(([id, label, Icono]) => {
                const activa = valor === id
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        aria-label={label}
                        title={label}
                        onClick={() => onChange(id)}
                        className="ds-hover"
                        style={{
                            width: 26, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                            display: 'grid', placeItems: 'center',
                            background: activa ? 'var(--color-bg)' : 'transparent',
                            color: activa ? 'var(--color-text)' : 'var(--color-muted)',
                            boxShadow: activa ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
                            transition: 'background 150ms, color 150ms',
                        }}
                    >
                        <Icono size={14} strokeWidth={1.8} />
                    </button>
                )
            })}
        </div>
    )
}

const OPCIONES_VISTA: [Vista, string][] = [['publicado', 'Publicado'], ['cambios', 'Con tus cambios']]

function ToggleVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
    return (
        <div role="radiogroup" aria-label="Qué mostrar en la vista previa" style={{ display: 'inline-flex', padding: 2, gap: 2, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {OPCIONES_VISTA.map(([id, label]) => {
                const activa = vista === id
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        onClick={() => onChange(id)}
                        className="ds-hover"
                        style={{
                            height: 24, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: 11.5, fontWeight: activa ? 600 : 500, whiteSpace: 'nowrap',
                            background: activa ? 'var(--color-bg)' : 'transparent',
                            color: activa ? 'var(--color-text)' : 'var(--color-muted)',
                            boxShadow: activa ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
                            transition: 'background 150ms, color 150ms',
                        }}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
