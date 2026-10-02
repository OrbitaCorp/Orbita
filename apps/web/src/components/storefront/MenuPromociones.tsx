// Pestaña flotante de la tienda con los juegos con premio y el anuncio del
// negocio (paquete Avanzado): deja volver a jugar o volver a ver el anuncio
// después de haber cerrado el modal, que se abre una sola vez por navegador
// (ver Inicio.tsx). Aparece solo si hay algo para ofrecer y no mientras un modal
// está abierto. Con una sola opción, un toque la abre directo; con varias, abre
// una lista. La demo (modules/demo/MenuDemoTienda.tsx) usa este mismo componente
// con sus anuncios de muestra.
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Gift, X } from 'lucide-react'
import type { ActiveGame, ActivePromoModal } from '@/lib/storefront/api'
import { TEMAS } from '@/modules/ventas/cliente/juegos/JuegoInline'

interface Props {
    juegos: ActiveGame[]
    anuncios: ActivePromoModal[]
    onJugar: (juego: ActiveGame) => void
    onAnuncio: (anuncio: ActivePromoModal) => void
    /** Texto vertical de la pestaña. Si falta, sale de lo que haya para ofrecer. */
    etiqueta?: string
    titulo?: string
    subtitulo?: string
    /** Encabezado de la lista de anuncios (la tienda real los llama "promos"). */
    seccionAnuncios?: string
}

export function MenuPromociones({ juegos, anuncios, onJugar, onAnuncio, etiqueta, titulo = 'Para vos', subtitulo = 'Jugá por un descuento o volvé a ver las promos de la tienda.', seccionAnuncios = 'Promos' }: Props) {
    const [abierto, setAbierto] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const total = juegos.length + anuncios.length

    useEffect(() => {
        if (!abierto) return
        const alTocarAfuera = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false)
        }
        const conEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
        document.addEventListener('mousedown', alTocarAfuera)
        document.addEventListener('keydown', conEscape)
        return () => {
            document.removeEventListener('mousedown', alTocarAfuera)
            document.removeEventListener('keydown', conEscape)
        }
    }, [abierto])

    // Se fue lo último que había para ofrecer (jugó y perdió, se venció el
    // anuncio): que no quede el panel abierto sin nada adentro.
    useEffect(() => { if (total === 0) setAbierto(false) }, [total])

    if (total === 0) return null

    // Una sola cosa para ofrecer: no hace falta una lista de un elemento.
    const alTocarPestana = () => {
        if (total > 1) return setAbierto(a => !a)
        if (juegos.length === 1) return onJugar(juegos[0])
        onAnuncio(anuncios[0])
    }
    const texto = etiqueta ?? (juegos.length > 0 && anuncios.length > 0 ? 'Juegos y promos' : juegos.length > 0 ? 'Jugá y ganá' : 'Promo')

    return (
        <div ref={panelRef} className="sf-menu-promo">
            <style>{CSS}</style>
            <button
                type="button"
                className="sf-menu-promo-tab"
                onClick={alTocarPestana}
                aria-expanded={total > 1 ? abierto : undefined}
                aria-controls={total > 1 ? 'sf-menu-promo-panel' : undefined}
                aria-haspopup={total > 1 ? 'dialog' : undefined}
            >
                <Gift size={15} strokeWidth={2} />
                <span>{texto}</span>
            </button>

            {total > 1 && (
                <div id="sf-menu-promo-panel" className={`sf-menu-promo-panel${abierto ? ' abierto' : ''}`} role="dialog" aria-label={titulo} aria-hidden={!abierto}>
                    <div className="sf-menu-promo-cab">
                        <div>
                            <div className="sf-menu-promo-titulo">{titulo}</div>
                            <div className="sf-menu-promo-sub">{subtitulo}</div>
                        </div>
                        <button type="button" className="sf-menu-promo-x" onClick={() => setAbierto(false)} aria-label="Cerrar" tabIndex={abierto ? 0 : -1}>
                            <X size={15} />
                        </button>
                    </div>

                    {juegos.length > 0 && (
                        <>
                            <div className="sf-menu-promo-seccion">Juegos con premio</div>
                            {juegos.map(j => {
                                const tema = TEMAS[j.type] ?? TEMAS.HOOP
                                return (
                                    <button
                                        key={j.type}
                                        type="button"
                                        className="sf-menu-promo-item"
                                        tabIndex={abierto ? 0 : -1}
                                        onClick={() => { setAbierto(false); onJugar(j) }}
                                    >
                                        <span className="sf-menu-promo-ico"><tema.Icon size={16} strokeWidth={1.8} /></span>
                                        <span className="sf-menu-promo-txt">
                                            <span className="sf-menu-promo-nombre">{j.name || tema.titulo}</span>
                                            <span className="sf-menu-promo-det">Hasta {j.maxPercent} % off · {j.maxAttempts} tiros</span>
                                        </span>
                                        <ChevronRight size={15} className="sf-menu-promo-flecha" />
                                    </button>
                                )
                            })}
                        </>
                    )}

                    {anuncios.length > 0 && (
                        <>
                            <div className="sf-menu-promo-seccion">{seccionAnuncios}</div>
                            {anuncios.map(a => (
                                <button
                                    key={a.title}
                                    type="button"
                                    className="sf-menu-promo-item"
                                    tabIndex={abierto ? 0 : -1}
                                    onClick={() => { setAbierto(false); onAnuncio(a) }}
                                >
                                    <span className="sf-menu-promo-txt">
                                        <span className="sf-menu-promo-nombre">{a.title}</span>
                                        {(a.code || a.badge) && <span className="sf-menu-promo-det">{a.code ? `Con código ${a.code}` : a.badge}</span>}
                                    </span>
                                    <ChevronRight size={15} className="sf-menu-promo-flecha" />
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

// Debajo del modal de juegos (z-index 1000) y por encima del contenido. La
// pestaña va pegada al borde izquierdo: el WhatsApp flotante ocupa el derecho.
const CSS = `
.sf-menu-promo-tab{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:900;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 9px;border:none;border-radius:0 10px 10px 0;background:var(--color-primary);color:var(--color-on-primary,#fff);font-size:12.5px;font-weight:600;line-height:1;font-family:inherit;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);transition:padding .2s ease}
.sf-menu-promo-tab span{writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.01em}
.sf-menu-promo-tab:hover{padding-left:13px}
/* Entra con un retraso: al cargar el home el modal se abre en el mismo instante y la
   pestaña no tiene que llegar a verse un cuadro debajo de él. */
.sf-menu-promo-tab{animation:sf-menu-promo-entra .4s ease .9s both}
@keyframes sf-menu-promo-entra{from{opacity:0;transform:translate(-100%,-50%)}to{opacity:1;transform:translateY(-50%)}}
.sf-menu-promo-tab:focus-visible{outline:2px solid var(--color-text);outline-offset:2px}
.sf-menu-promo-panel{position:fixed;left:12px;top:50%;z-index:901;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 140px);overflow-y:auto;padding:16px 12px 12px;border-radius:14px;background:var(--color-bg);border:1px solid var(--color-border);box-shadow:0 24px 64px rgba(0,0,0,.22);transform:translate(calc(-100% - 24px),-50%);visibility:hidden;transition:transform .25s ease,visibility 0s linear .25s}
.sf-menu-promo-panel.abierto{transform:translate(0,-50%);visibility:visible;transition:transform .25s ease,visibility 0s}
.sf-menu-promo-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:0 4px 6px}
.sf-menu-promo-titulo{font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--color-text)}
.sf-menu-promo-sub{font-size:12px;line-height:1.45;color:var(--color-muted);margin-top:3px}
.sf-menu-promo-x{width:28px;height:28px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;border:1px solid var(--color-border);background:transparent;color:var(--color-muted);cursor:pointer}
.sf-menu-promo-seccion{font-size:12px;font-weight:600;color:var(--color-muted);padding:14px 4px 6px}
.sf-menu-promo-item{display:flex;align-items:center;gap:11px;width:100%;min-height:48px;padding:8px 8px;border:none;border-radius:10px;background:transparent;color:var(--color-text);font-family:inherit;text-align:left;cursor:pointer;transition:background .15s ease}
.sf-menu-promo-item:hover,.sf-menu-promo-item:focus-visible{background:var(--color-surface-alt, var(--color-surface))}
.sf-menu-promo-item:focus-visible{outline:2px solid var(--color-primary);outline-offset:-2px}
.sf-menu-promo-ico{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;border:1px solid var(--color-border);color:var(--color-text)}
.sf-menu-promo-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.sf-menu-promo-nombre{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-menu-promo-det{font-size:12px;color:var(--color-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-menu-promo-flecha{flex-shrink:0;color:var(--color-muted)}
@media (prefers-reduced-motion: reduce){.sf-menu-promo-panel,.sf-menu-promo-panel.abierto,.sf-menu-promo-tab{transition:none;animation:none}}
`
