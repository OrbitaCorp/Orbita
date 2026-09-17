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
// Si el dueño clickea un link adentro del preview, navega de verdad: esa
// página pierde el `?preview=1` y muestra lo guardado. Es correcto — sigue
// siendo su tienda real, solo sin el borrador encima.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ROOT_DOMAIN, currentSlug } from '@/lib/tenant'
import { MSG_BORRADOR, MSG_LISTA, PREVIEW_QUERY } from '@/lib/storefront/previewBridge'
import { apToUpdateDto } from '../../mock/apariencia.mapper'
import type { Apariencia } from '../../mock/apariencia.mock'

const DESIGN_W = 1280
// Suficiente para que tipear un título se sienta en vivo sin mandar un
// postMessage por tecla (los slides pueden llevar URLs largas adentro).
const DEBOUNCE_MS = 120

interface StorePreviewProps { ap: Apariencia; full?: boolean; subdomain?: string }

export function StorePreview({ ap, full, subdomain }: StorePreviewProps) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [scale, setScale] = useState(0.5)
    const [wrapH, setWrapH] = useState(900)

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
            setScale(wrap.clientWidth / DESIGN_W)
            setWrapH(wrap.clientHeight)
        }
        medir()
        const ro = new ResizeObserver(medir)
        if (wrapRef.current) ro.observe(wrapRef.current)
        window.addEventListener('resize', medir)
        return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
    }, [])

    // Exactamente lo que se mandaría al guardar: así el preview no puede
    // divergir de lo que va a quedar en la tienda.
    const borrador = useMemo(() => apToUpdateDto(ap), [ap])
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
            <div style={{ height: 36, flexShrink: 0, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
                <div style={{ height: 22, padding: '0 14px', borderRadius: 999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', maxWidth: 280, overflow: 'hidden' }}>
                    {ap.favicon
                        ? <img src={ap.favicon} alt="" style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />
                        : <span aria-hidden style={{ fontSize: 11 }}>🔒</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subdomain ? `${subdomain}.${ROOT_DOMAIN}` : (ap.nombreTienda || 'tu-tienda')}
                    </span>
                </div>
            </div>

            <div ref={wrapRef} style={{ flex: 1, overflow: 'hidden', background: 'var(--color-bg)' }}>
                {src ? (
                    <iframe
                        ref={iframeRef}
                        src={src}
                        title="Vista previa de tu tienda"
                        style={{
                            width: DESIGN_W, height: wrapH / (scale || 1), border: 'none', display: 'block',
                            transformOrigin: 'top left', transform: `scale(${scale})`, background: 'var(--color-bg)',
                        }}
                    />
                ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                        Cargando tu tienda…
                    </div>
                )}
            </div>
        </div>
    )
}
