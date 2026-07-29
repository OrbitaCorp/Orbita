// Vista previa en vivo del storefront — reproducción fiel del home real (Inicio.tsx).
// Se renderiza a ancho de diseño fijo (1280px) y se escala para llenar el panel
// derecho, con scroll interno. Modo `full` = modal a pantalla completa.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Tag, Search, ShoppingBag, User } from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { fontStack, RADII, type Apariencia } from '../../mock/apariencia.mock'

const DESIGN_W = 1280

// ─── Datos de muestra (espejo del home) ─────────────────────────────────────────

type PvProd = { n: string; p: string; old: string | null; hue: number; badge: string | null; stock?: number }

const MAS_VENDIDOS: PvProd[] = [
    { n: 'Remera oversize negra',   p: '$24.900', old: null,       hue: 220, badge: null   },
    { n: 'Campera bomber beige',    p: '$89.000', old: '$110.000', hue: 35,  badge: '−19%' },
    { n: 'Jean tiro medio celeste', p: '$56.000', old: '$68.000',  hue: 200, badge: '−18%' },
    { n: 'Buzo capucha crema',      p: '$38.500', old: null,       hue: 45,  badge: null   },
]
const DESTACADOS: PvProd[] = [
    { n: 'Remera oversize negra',   p: '$24.900', old: '$32.000',  hue: 220, badge: '−22%',  stock: 4 },
    { n: 'Jogger gris melange',     p: '$34.500', old: '$45.000',  hue: 210, badge: '−23%',  stock: 2 },
    { n: 'Buzo sin capucha crema',  p: '$32.000', old: '$40.000',  hue: 45,  badge: '−20%',  stock: 7 },
    { n: 'Jean tiro medio celeste', p: '$56.000', old: '$68.000',  hue: 200, badge: '−18%',  stock: 3 },
]
const NUEVOS: PvProd[] = [
    { n: 'Campera técnica impermeable', p: '$112.000', old: null, hue: 200, badge: 'Nuevo' },
    { n: 'Remera estampada gráfica',    p: '$27.500',  old: null, hue: 280, badge: 'Nuevo' },
    { n: 'Gorra trucker bordada',       p: '$15.900',  old: null, hue: 30,  badge: 'Nuevo' },
    { n: 'Top deportivo lila',          p: '$19.500',  old: null, hue: 270, badge: 'Nuevo' },
]

const CATS = [
    { id: 'remeras',    nombre: 'Remeras',    count: 12, hue: 220, emoji: '👕' },
    { id: 'pantalones', nombre: 'Pantalones', count: 8,  hue: 140, emoji: '👖' },
    { id: 'buzos',      nombre: 'Buzos',      count: 6,  hue: 280, emoji: '🧥' },
    { id: 'camperas',   nombre: 'Camperas',   count: 5,  hue: 35,  emoji: '🧣' },
    { id: 'jeans',      nombre: 'Jeans',      count: 9,  hue: 200, emoji: '👖' },
    { id: 'calzado',    nombre: 'Calzado',    count: 14, hue: 30,  emoji: '👟' },
    { id: 'accesorios', nombre: 'Accesorios', count: 11, hue: 320, emoji: '🧢' },
    { id: 'deportivo',  nombre: 'Deportivo',  count: 7,  hue: 170, emoji: '🎽' },
]

const STATS: [string, string][] = [
    ['+1.200', 'ventas realizadas'],
    ['48 hs',  'envío al país'],
    ['30 días', 'cambios gratis'],
    ['3 cuotas', 'sin interés'],
]

function thumb(hue: number, dk: boolean) {
    const l1 = dk ? 0.34 : 0.86, l2 = dk ? 0.30 : 0.82
    return `repeating-linear-gradient(135deg, oklch(${l1} 0.06 ${hue}) 0 14px, oklch(${l2} 0.06 ${hue}) 14px 28px)`
}

function badgeColor(badge: string): { bg: string; color: string } {
    if (badge.startsWith('−') || badge.startsWith('-') || badge.includes('%')) return { bg: '#DC2626', color: '#fff' }
    if (badge.toLowerCase() === 'nuevo') return { bg: '#059669', color: '#fff' }
    return { bg: '#2563EB', color: '#fff' }
}

// ─── Componente principal ────────────────────────────────────────────────────────

interface StorePreviewProps { ap: Apariencia; full?: boolean }

export function StorePreview({ ap, full }: StorePreviewProps) {
    const { isDark } = useDarkMode()
    const dk = ap.modoColor === 'oscuro' || (ap.modoColor === 'sistema' && isDark)
    const prim = ap.colorPrimario
    const rad = RADII[ap.radioCards] ?? 12
    const ff = fontStack(ap.fuenteBody)
    const fh = fontStack(ap.fuenteHeading)

    const c = dk
        ? { bg: '#0F172A', surf: '#1E293B', border: '#334155', borderStrong: '#475569', text: '#F1F5F9', body: '#CBD5E1', muted: '#94A3B8', subtle: '#64748B' }
        : { bg: ap.colorFondo === 'custom' ? '#F8FAFC' : ap.colorFondo, surf: '#FFFFFF', border: '#E2E8F0', borderStrong: '#CBD5E1', text: '#0F172A', body: '#334155', muted: '#64748B', subtle: '#94A3B8' }

    const themeVars = {
        '--color-bg': c.bg,
        '--color-surface': c.surf,
        '--color-border': c.border,
        '--color-border-strong': c.borderStrong,
        '--color-text': c.text,
        '--color-body': c.body,
        '--color-muted': c.muted,
        '--color-subtle': c.subtle,
        '--color-primary': prim,
        '--color-primary-bg': prim + '1A',
        '--color-success': '#10B981',
    } as React.CSSProperties

    const navLinks = ap.headerLinks.filter(l => l.on).map(l => l.label)
    const gridCols = ap.layoutGrid === '4col' ? 4 : ap.layoutGrid === 'list' ? 1 : 3

    // ── Scaler: medir ancho disponible y alto del contenido ──
    const wrapRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0.5)
    const [contentH, setContentH] = useState(1600)

    useLayoutEffect(() => {
        const measure = () => {
            const wrap = wrapRef.current, content = contentRef.current
            if (!wrap || !content) return
            setScale(wrap.clientWidth / DESIGN_W)
            setContentH(content.offsetHeight)
        }
        measure()
        const ro = new ResizeObserver(measure)
        if (wrapRef.current) ro.observe(wrapRef.current)
        if (contentRef.current) ro.observe(contentRef.current)
        window.addEventListener('resize', measure)
        return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
    }, [])

    const content = (
        <div ref={contentRef} style={{ width: DESIGN_W, ...themeVars, background: c.bg, color: c.text, fontFamily: ff }}>
            <style>{`
                @keyframes pvDot    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
                @keyframes pvMarquee{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
                .pv-marquee-track{ display:flex; gap:8px; width:max-content; animation:pvMarquee 26s linear infinite }
                .pv-marquee-wrap{ overflow:hidden; mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%); -webkit-mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%) }
            `}</style>

            {/* ══ Announcement bar ══ */}
            <div style={{ height: 40, display: 'grid', placeItems: 'center', background: `linear-gradient(90deg, ${prim}, ${prim}cc, ${prim})`, color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>
                ✦&nbsp;&nbsp;{ap.textoEnvio}&nbsp;&nbsp;·&nbsp;&nbsp;Cambios en 30 días&nbsp;&nbsp;✦
            </div>

            {/* ══ Header ══ */}
            <PreviewHeader ap={ap} c={c} prim={prim} fh={fh} navLinks={navLinks} />

            {/* ══ Hero ══ */}
            <HeroCarousel ap={ap} c={c} prim={prim} fh={fh} rad={rad} dk={dk} />

            {/* ══ Stats bar ══ */}
            <div style={{ background: c.surf, borderBottom: `1px solid ${c.border}`, padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {STATS.map(([num, lbl], i, arr) => (
                        <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ padding: '0 24px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: prim, fontFamily: '"Geist Mono", monospace' }}>{num}</span>
                                <span style={{ fontSize: 12, fontWeight: 500, color: c.body }}>{lbl}</span>
                            </span>
                            {i < arr.length - 1 && <span style={{ width: 1, height: 14, background: c.border }} />}
                        </span>
                    ))}
                </div>
            </div>

            {/* ══ Categorías ══ */}
            {ap.mostrarCategorias && (
                <div style={{ paddingTop: 24, paddingBottom: 28 }}>
                    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 700, color: c.text, margin: 0, fontFamily: fh }}>Comprá por categoría</h2>
                        <span style={{ fontSize: 13, fontWeight: 500, color: prim }}>Ver todas →</span>
                    </div>
                    <div className="pv-marquee-wrap">
                        <div className="pv-marquee-track">
                            {[...CATS, ...CATS].map((cat, i) => (
                                <span key={`${cat.id}-${i}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, height: 50, padding: '0 14px 0 7px', borderRadius: 999, border: `1px solid ${c.border}`, background: c.bg }}>
                                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, oklch(0.86 0.07 ${cat.hue}), oklch(0.74 0.08 ${cat.hue}))`, display: 'grid', placeItems: 'center', fontSize: 16 }}>{cat.emoji}</span>
                                    <span style={{ textAlign: 'left' }}>
                                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: c.text, lineHeight: 1.2 }}>{cat.nombre}</span>
                                        <span style={{ display: 'block', fontSize: 11, color: c.muted, marginTop: 1, fontFamily: '"Geist Mono", monospace' }}>{cat.count} productos</span>
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Banner cupones ══ */}
            <section style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 32px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 28px', borderRadius: 16, background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)', boxShadow: '0 8px 28px rgba(109,40,217,0.22)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Tag size={20} color="#fff" strokeWidth={2} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Cupones y descuentos activos</div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>4 cupones disponibles para tu próxima compra</div>
                        </div>
                    </div>
                    <div style={{ height: 36, padding: '0 16px', borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Ver todos <ArrowRight size={13} />
                    </div>
                </div>
            </section>

            {/* ══ Secciones de productos ══ */}
            <ProductSection title="Más vendidos"   eyebrow="Top ventas"      color="#F59E0B" prods={MAS_VENDIDOS} ap={ap} c={c} prim={prim} fh={fh} rad={rad} dk={dk} cols={gridCols} />
            <ProductSection title="Productos destacados" eyebrow="Destacados" color="#EF4444" prods={DESTACADOS}   ap={ap} c={c} prim={prim} fh={fh} rad={rad} dk={dk} cols={gridCols} />
            <ProductSection title="Recién llegados" eyebrow="Nuevos ingresos" color="#10B981" prods={NUEVOS}      ap={ap} c={c} prim={prim} fh={fh} rad={rad} dk={dk} cols={gridCols} />

            {/* ══ Banner WhatsApp ══ */}
            {ap.mostrarWhatsapp && (
                <section style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 32px 52px' }}>
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: 'linear-gradient(135deg,#064E3B 0%,#065F46 50%,#047857 100%)', boxShadow: '0 20px 60px rgba(6,78,59,0.30)' }}>
                        <div style={{ position: 'absolute', top: -80, right: 260, width: 320, height: 320, borderRadius: '50%', background: 'rgba(52,211,153,0.10)', filter: 'blur(80px)' }} />
                        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 300px', alignItems: 'center', gap: 48, padding: '40px 48px' }}>
                            <div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 12px', borderRadius: 999, background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.35)', marginBottom: 16 }}>
                                    <WppIcon size={13} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Atención por WhatsApp</span>
                                </div>
                                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 10px', fontFamily: fh }}>Respondemos en menos<br />de una hora</h2>
                                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 380 }}>Consultá talles, disponibilidad o coordiná un envío. Te atendemos de lunes a sábado, sin bots.</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                                    <span style={{ height: 46, padding: '0 22px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(37,211,102,0.40)' }}>
                                        <WppIcon size={16} white /> {ap.textoWhatsapp}
                                    </span>
                                    <div style={{ display: 'flex', gap: 24 }}>
                                        {([['< 1hs', 'respuesta'], ['+1.200', 'consultas']] as [string, string][]).map(([nn, ll]) => (
                                            <div key={ll} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: '"Geist Mono", monospace' }}>{nn}</span>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{ll}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <WppChat />
                        </div>
                    </div>
                </section>
            )}

            {/* ══ Footer ══ */}
            {ap.mostrarFooter && (
                <footer style={{ borderTop: `1px solid ${c.border}`, background: c.surf, padding: '48px 32px 24px' }}>
                    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr', gap: 40, marginBottom: 32 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    {ap.logo
                                        ? <img src={ap.logo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                                        : <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, #2563EB, ${prim})`, display: 'grid', placeItems: 'center' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} /></div>}
                                    <span style={{ fontSize: 15, fontWeight: 700, color: c.text, fontFamily: fh }}>{ap.nombreTienda}</span>
                                </div>
                                <p style={{ fontSize: 13, color: c.muted, maxWidth: 220, lineHeight: 1.5, margin: 0 }}>{ap.tagline}</p>
                                <span style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 8, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
                                    <WppIcon size={16} green /> Escribinos
                                </span>
                            </div>
                            {([['Tienda', ['Inicio', 'Catálogo', 'Novedades', 'Ofertas']], ['Mi cuenta', ['Ingresar', 'Crear cuenta', 'Mis pedidos', 'Iniciar cambio']]] as [string, string[]][]).map(([titulo, links]) => (
                                <div key={titulo}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.subtle, marginBottom: 14 }}>{titulo}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {links.map(l => <span key={l} style={{ fontSize: 13, color: c.body }}>{l}</span>)}
                                    </div>
                                </div>
                            ))}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.subtle, marginBottom: 14 }}>Contacto</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: c.body }}>
                                    <span>📍 Buenos Aires, Argentina</span>
                                    <span>✉ hola@ramaindumentaria.com</span>
                                    <span>🕒 Lun–Vie 9:00–18:00</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: c.subtle }}>
                            <span style={{ fontFamily: '"Geist Mono", monospace' }}>Powered by <strong style={{ color: c.muted }}>Órbita</strong></span>
                            <span style={{ fontSize: 11, fontFamily: '"Geist Mono", monospace' }}>© 2026 {ap.nombreTienda} · Todos los derechos reservados</span>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    )

    const frameHeight = full ? '100%' : 'calc(100vh - 150px)'

    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: full ? 'none' : '0 8px 32px rgba(15,23,42,0.12)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', height: frameHeight }}>
            {/* Chrome de navegador */}
            <div style={{ height: 36, flexShrink: 0, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>{['#EF4444', '#F59E0B', '#10B981'].map(cc => <span key={cc} style={{ width: 9, height: 9, borderRadius: '50%', background: cc }} />)}</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ height: 22, padding: '0 14px', borderRadius: 999, background: 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', maxWidth: 280 }}>
                        🔒 rama.orbita.shop
                    </div>
                </div>
                <span style={{ width: 9, height: 9 }} />
            </div>

            {/* Viewport con scroll */}
            <div ref={wrapRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: c.bg }}>
                <div style={{ width: DESIGN_W * scale, height: contentH * scale, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${scale})` }}>
                        {content}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Header ──────────────────────────────────────────────────────────────────────

function PreviewHeader({ ap, c, prim, fh, navLinks }: { ap: Apariencia; c: any; prim: string; fh: string; navLinks: string[] }) {
    const isCentered = ap.layoutHeader === 'centered'
    const isMinimal = ap.layoutHeader === 'minimal'
    const isStandard = ap.layoutHeader === 'standard'

    const logo = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            {ap.logo
                ? <img src={ap.logo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, #1D4ED8, ${prim})`, display: 'grid', placeItems: 'center' }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }} /></div>}
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: fh }}>{ap.nombreTienda}</div>
                <div style={{ fontSize: 10, color: c.subtle, fontFamily: '"Geist Mono", monospace', lineHeight: 1 }}>rama.orbita.shop</div>
            </div>
        </div>
    )

    const nav = !isMinimal && navLinks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, ...(isStandard ? { justifyContent: 'center', flex: 1 } : { flex: 1, marginLeft: 6 }) }}>
            {navLinks.map((l, i) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', height: 64, padding: '0 14px', fontSize: 13.5, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? c.text : c.muted, position: 'relative', whiteSpace: 'nowrap' }}>
                    {l}
                    {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, borderRadius: '2px 2px 0 0', background: prim }} />}
                </span>
            ))}
        </div>
    )

    const actions = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
            {ap.mostrarBuscador && !isMinimal && (
                <span style={{ width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', color: c.muted }}><Search size={18} strokeWidth={1.5} /></span>
            )}
            <span style={{ width: 36, height: 36, borderRadius: 8, display: 'grid', placeItems: 'center', color: c.muted, position: 'relative' }}>
                <ShoppingBag size={18} strokeWidth={1.5} />
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15, padding: '0 3px', background: prim, color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center', fontFamily: '"Geist Mono", monospace' }}>2</span>
            </span>
            <span style={{ width: 1, height: 20, background: c.border, margin: '0 8px' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: prim, color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 600 }}>
                <User size={14} strokeWidth={2} /> Ingresar
            </span>
        </div>
    )

    if (isCentered) {
        return (
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: c.surf, borderBottom: `1px solid ${c.border}` }}>
                <div style={{ height: 64, padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                    <span />
                    {logo}
                    {actions}
                </div>
                {navLinks.length > 0 && (
                    <div style={{ borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'center', gap: 4, padding: '0 24px' }}>
                        {navLinks.map((l, i) => (
                            <span key={l} style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? c.text : c.muted, padding: '12px 14px', whiteSpace: 'nowrap' }}>{l}</span>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: c.surf, borderBottom: `1px solid ${c.border}` }}>
            <div style={{ height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4 }}>
                {logo}
                {nav}
                {actions}
            </div>
        </div>
    )
}

// ─── Hero carousel ───────────────────────────────────────────────────────────────

function HeroCarousel({ ap, c, prim, fh, rad, dk }: { ap: Apariencia; c: any; prim: string; fh: string; rad: number; dk: boolean }) {
    const slides = ap.sliders.length > 0 ? ap.sliders : [{ id: 's0', titulo: ap.tagline, subtitulo: '', img: null, cta: ap.textoCTA, ctaLink: '' }]
    const [idx, setIdx] = useState(0)
    const n = slides.length

    useEffect(() => {
        if (n <= 1) return
        const id = setInterval(() => setIdx(i => (i + 1) % n), 4200)
        return () => clearInterval(id)
    }, [n])

    const safeIdx = idx % n
    const s = slides[safeIdx]
    const heroBg = s.img
        ? `url(${s.img}) center/cover`
        : `linear-gradient(120deg, ${ap.colorSecundario} 0%, ${prim}99 48%, ${prim} 100%)`

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${c.border}`, background: heroBg }}>
            {s.img && <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} />}
            {!s.img && <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to right, transparent, black 60%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 60%)' }} />}

            <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '64px 48px', minHeight: 560, display: 'flex', alignItems: 'center' }}>
                {/* Texto */}
                <div>
                    <h1 style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#fff', whiteSpace: 'pre-line', margin: 0, fontFamily: fh }}>{s.titulo}</h1>
                    {s.subtitulo && <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.84)', lineHeight: 1.6, marginTop: 14, maxWidth: 380 }}>{s.subtitulo}</p>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                        <span style={{ height: 46, padding: '0 22px', borderRadius: Math.min(rad, 12), background: '#fff', color: '#0F172A', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}>
                            {s.cta} <ArrowRight size={15} />
                        </span>
                    </div>
                </div>
            </div>

            {/* Flechas */}
            <span style={arrowStyle('left')}><ChevronLeft size={19} /></span>
            <span style={arrowStyle('right')}><ChevronRight size={19} /></span>

            {/* Dots */}
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                {slides.map((_, i) => (
                    <span key={i} style={{ height: 7, width: i === safeIdx ? 22 : 7, borderRadius: 999, background: i === safeIdx ? '#fff' : 'rgba(255,255,255,0.42)', transition: 'width 280ms ease' }} />
                ))}
            </div>
        </div>
    )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
    return {
        position: 'absolute', [side]: 14, top: '50%', transform: 'translateY(-50%)',
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)',
        color: '#fff', display: 'grid', placeItems: 'center',
    }
}

// ─── Sección de productos ────────────────────────────────────────────────────────

function ProductSection({ title, eyebrow, color, prods, ap, c, prim, fh, rad, dk, cols }: {
    title: string; eyebrow: string; color: string; prods: PvProd[]
    ap: Apariencia; c: any; prim: string; fh: string; rad: number; dk: boolean; cols: number
}) {
    const n = Math.min(cols, 4)
    return (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pvDot 2s infinite' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{eyebrow}</span>
                    </div>
                    <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: c.text, margin: '5px 0 0', fontFamily: fh }}>{title}</h2>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: prim }}>Ver todos →</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 16 }}>
                {prods.slice(0, n).map((p, i) => (
                    <PreviewCard key={i} p={p} ap={ap} c={c} prim={prim} fh={fh} rad={rad} dk={dk} />
                ))}
            </div>
        </section>
    )
}

function PreviewCard({ p, ap, c, prim, fh, rad, dk }: { p: PvProd; ap: Apariencia; c: any; prim: string; fh: string; rad: number; dk: boolean }) {
    const showBadge = p.badge && ((p.badge.toLowerCase() === 'nuevo' && ap.mostrarBadgeNuevo) || (p.badge.includes('%') && ap.mostrarBadgeOferta))
    const bc = p.badge ? badgeColor(p.badge) : null
    return (
        <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: rad, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ height: 200, position: 'relative', background: thumb(p.hue, dk) }}>
                {showBadge && bc && (
                    <span style={{ position: 'absolute', top: 10, left: 10, height: 23, padding: '0 9px', borderRadius: 999, background: bc.bg, color: bc.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', fontFamily: p.badge!.startsWith('−') ? '"Geist Mono", monospace' : 'inherit' }}>{p.badge}</span>
                )}
                {ap.mostrarStockBajo && p.stock !== undefined && p.stock <= 5 && (
                    <span style={{ position: 'absolute', bottom: 10, left: 10, height: 22, padding: '0 8px', borderRadius: 999, background: p.stock <= 3 ? '#D97706' : '#059669', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {p.stock <= 3 ? `⚡ ${p.stock} disponibles` : '✓ En stock'}
                    </span>
                )}
                <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.90)', color: '#2563EB', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}><ArrowRight size={13} strokeWidth={2} /></span>
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, lineHeight: 1.35, marginBottom: 6, fontFamily: fh, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.n}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.text, fontFamily: '"Geist Mono", monospace' }}>{p.p}</span>
                    {p.old && <span style={{ fontSize: 12, color: c.muted, textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{p.old}</span>}
                </div>
                <span style={{ width: '100%', height: 36, borderRadius: Math.min(rad, 8), background: prim, color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>🛒 {ap.textoCTA}</span>
            </div>
        </div>
    )
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────────

function WppIcon({ size = 14, white, green }: { size?: number; white?: boolean; green?: boolean }) {
    const fill = white ? '#fff' : green ? '#10B981' : '#34D399'
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
    )
}

function WppChat() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '85%' }}>
                <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>Hola! ¿Tienen la campera en talle M?</p>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:41</span>
            </div>
            <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', maxWidth: '92%' }}>
                <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Sí! Tenemos en M y L. Te coordinamos el envío hoy mismo 🎉</p>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:42 ✓✓</span>
            </div>
            <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '70%' }}>
                <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Perfecto, muchas gracias! 🙌</p>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:43</span>
            </div>
        </div>
    )
}
