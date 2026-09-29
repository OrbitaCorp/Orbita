// Menú flotante de la tienda demo (solo en el home de demo.orbita.site): deja
// abrir a mano cada juego con premio y cada anuncio, como los vería alguien
// que entra a la tienda por primera vez. En la demo no se abren solos al
// entrar (ver Inicio.tsx): el que recorre la demo decide qué probar.
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Gift, X } from 'lucide-react'
import type { ActiveGame, ActivePromoModal } from '@/lib/storefront/api'
import { TEMAS } from '@/modules/ventas/cliente/juegos/JuegoInline'

// Anuncios de muestra. La tienda real tiene UN modal de anuncio a la vez (el
// primero de esta lista es el que está cargado en el panel de la demo); acá
// se ofrecen varios para mostrar los usos típicos. Los códigos y promos que
// nombran existen de verdad en la demo (apps/api/prisma/demo/).
export const ANUNCIOS_DEMO: ActivePromoModal[] = [
    {
        title: '2x1 en accesorios para el celu',
        badge: '2x1',
        message: 'Llevá dos fundas, cargadores o soportes para auto y pagá uno. El descuento se aplica solo en el carrito.',
        code: null,
        ctaText: 'Ver accesorios',
        ctaLink: '/catalogo?cat=celulares-y-accesorios',
        campaignVersion: 1,
    },
    {
        title: '15 % off en compras grandes',
        badge: '15 % OFF',
        message: 'En compras desde $150.000, usá este código en el checkout.',
        code: 'NEBULA15',
        ctaText: 'Empezar a comprar',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
    {
        title: '3x2 en iluminación',
        badge: '3x2',
        message: 'Lámparas, tiras LED y enchufes inteligentes: llevá tres y pagá dos.',
        code: null,
        ctaText: 'Ver hogar inteligente',
        ctaLink: '/catalogo?cat=hogar-inteligente',
        campaignVersion: 1,
    },
    {
        title: 'Envío gratis a todo el país',
        badge: 'Envío gratis',
        message: 'En compras desde $250.000 el envío corre por nuestra cuenta, con Correo Argentino, Andreani u OCA.',
        code: null,
        ctaText: 'Ver catálogo',
        ctaLink: '/catalogo',
        campaignVersion: 1,
    },
]

interface Props {
    juegos: ActiveGame[]
    onJugar: (juego: ActiveGame) => void
    onAnuncio: (anuncio: ActivePromoModal) => void
}

export function MenuDemoTienda({ juegos, onJugar, onAnuncio }: Props) {
    const [abierto, setAbierto] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)

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

    return (
        <div ref={panelRef} className="sf-menu-demo">
            <style>{CSS}</style>
            <button
                type="button"
                className="sf-menu-demo-tab"
                onClick={() => setAbierto(a => !a)}
                aria-expanded={abierto}
                aria-controls="sf-menu-demo-panel"
            >
                <Gift size={15} strokeWidth={2} />
                <span>Juegos y anuncios</span>
            </button>

            <div id="sf-menu-demo-panel" className={`sf-menu-demo-panel${abierto ? ' abierto' : ''}`} role="dialog" aria-label="Juegos y anuncios de la demo" aria-hidden={!abierto}>
                <div className="sf-menu-demo-cab">
                    <div>
                        <div className="sf-menu-demo-titulo">Probalos como cliente</div>
                        <div className="sf-menu-demo-sub">Se abren como los vería alguien que entra a la tienda por primera vez.</div>
                    </div>
                    <button type="button" className="sf-menu-demo-x" onClick={() => setAbierto(false)} aria-label="Cerrar" tabIndex={abierto ? 0 : -1}>
                        <X size={15} />
                    </button>
                </div>

                {juegos.length > 0 && (
                    <>
                        <div className="sf-menu-demo-seccion">Juegos con premio</div>
                        {juegos.map(j => {
                            const tema = TEMAS[j.type] ?? TEMAS.HOOP
                            return (
                                <button
                                    key={j.type}
                                    type="button"
                                    className="sf-menu-demo-item"
                                    tabIndex={abierto ? 0 : -1}
                                    onClick={() => { setAbierto(false); onJugar(j) }}
                                >
                                    <span className="sf-menu-demo-ico"><tema.Icon size={16} strokeWidth={1.8} /></span>
                                    <span className="sf-menu-demo-txt">
                                        <span className="sf-menu-demo-nombre">{j.name || tema.titulo}</span>
                                        <span className="sf-menu-demo-det">Hasta {j.maxPercent} % off · {j.maxAttempts} tiros</span>
                                    </span>
                                    <ChevronRight size={15} className="sf-menu-demo-flecha" />
                                </button>
                            )
                        })}
                    </>
                )}

                <div className="sf-menu-demo-seccion">Anuncios</div>
                {ANUNCIOS_DEMO.map(a => (
                    <button
                        key={a.title}
                        type="button"
                        className="sf-menu-demo-item"
                        tabIndex={abierto ? 0 : -1}
                        onClick={() => { setAbierto(false); onAnuncio(a) }}
                    >
                        <span className="sf-menu-demo-txt">
                            <span className="sf-menu-demo-nombre">{a.title}</span>
                            <span className="sf-menu-demo-det">{a.code ? `Con código ${a.code}` : a.badge}</span>
                        </span>
                        <ChevronRight size={15} className="sf-menu-demo-flecha" />
                    </button>
                ))}
            </div>
        </div>
    )
}

// Debajo del modal de juegos (z-index 1000) y por encima del contenido. La
// pestaña va pegada al borde izquierdo: el WhatsApp flotante ocupa el derecho.
const CSS = `
.sf-menu-demo-tab{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:900;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 9px;border:none;border-radius:0 10px 10px 0;background:var(--color-primary);color:#fff;font-size:12.5px;font-weight:600;line-height:1;font-family:inherit;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);transition:padding .2s ease}
.sf-menu-demo-tab span{writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.01em}
.sf-menu-demo-tab:hover{padding-left:13px}
.sf-menu-demo-tab:focus-visible{outline:2px solid var(--color-text);outline-offset:2px}
.sf-menu-demo-panel{position:fixed;left:12px;top:50%;z-index:901;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 140px);overflow-y:auto;padding:16px 12px 12px;border-radius:14px;background:var(--color-bg);border:1px solid var(--color-border);box-shadow:0 24px 64px rgba(0,0,0,.22);transform:translate(calc(-100% - 24px),-50%);visibility:hidden;transition:transform .25s ease,visibility 0s linear .25s}
.sf-menu-demo-panel.abierto{transform:translate(0,-50%);visibility:visible;transition:transform .25s ease,visibility 0s}
.sf-menu-demo-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:0 4px 6px}
.sf-menu-demo-titulo{font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--color-text)}
.sf-menu-demo-sub{font-size:12px;line-height:1.45;color:var(--color-muted);margin-top:3px}
.sf-menu-demo-x{width:28px;height:28px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;border:1px solid var(--color-border);background:transparent;color:var(--color-muted);cursor:pointer}
.sf-menu-demo-seccion{font-size:12px;font-weight:600;color:var(--color-muted);padding:14px 4px 6px}
.sf-menu-demo-item{display:flex;align-items:center;gap:11px;width:100%;min-height:48px;padding:8px 8px;border:none;border-radius:10px;background:transparent;color:var(--color-text);font-family:inherit;text-align:left;cursor:pointer;transition:background .15s ease}
.sf-menu-demo-item:hover,.sf-menu-demo-item:focus-visible{background:var(--color-surface-alt, var(--color-surface))}
.sf-menu-demo-item:focus-visible{outline:2px solid var(--color-primary);outline-offset:-2px}
.sf-menu-demo-ico{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:8px;border:1px solid var(--color-border);color:var(--color-text)}
.sf-menu-demo-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.sf-menu-demo-nombre{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-menu-demo-det{font-size:12px;color:var(--color-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sf-menu-demo-flecha{flex-shrink:0;color:var(--color-muted)}
@media (prefers-reduced-motion: reduce){.sf-menu-demo-panel,.sf-menu-demo-panel.abierto,.sf-menu-demo-tab{transition:none}}
`
