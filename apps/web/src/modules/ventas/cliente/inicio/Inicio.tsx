// src/modules/ventas/cliente/inicio/Inicio.tsx — Vista 01 (v3 editorial)

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { ProductCard } from '@/components/storefront/ProductCard'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import { openWpp } from '@/lib/storefront/utils'
import {
    getStorefrontConfig, getStorefrontProducts, getStorefrontCategories,
    toTiendaConfig, toCategoria, toProducto,
    type StorefrontConfigResponse, type StorefrontCategoryItem, type StorefrontHeroSlide, type StorefrontStatsItem,
} from '@/lib/storefront/api'
import { renderHeroBgPattern } from '@/components/storefront/heroPatterns'
import { Skeleton, SkeletonText, SkeletonProductGrid } from '@/design-system/components/Skeleton'

// Fallback si el negocio nunca guardó su propia barra de stats (Apariencia →
// statsBar) — mismos valores decorativos que antes eran 100% hardcodeados.
const STATS_DEFAULT: StorefrontStatsItem[] = [
    { id: 'st1', value: '+1.200',  label: 'ventas realizadas' },
    { id: 'st2', value: '48 hs',   label: 'envío al país' },
    { id: 'st3', value: '30 días', label: 'cambios gratis' },
    { id: 'st4', value: '3 cuotas', label: 'sin interés' },
]

type CatVisual = { id: string; slug: string; nombre: string; count: number; hue: number; emoji: string }

const EMOJI_DEFAULT = '🛍️'

export default function Inicio() {
    const router = useRouter()
    const { slug } = router.query as { slug: string }
    const base = `/tienda/${slug}`
    const go = (path: string) => router.push(`${base}${path}`)

    const [cargando, setCargando] = useState(true)
    const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
    const [categorias, setCategorias] = useState<StorefrontCategoryItem[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [destacados, setDestacados] = useState<Producto[]>([])

    useEffect(() => {
        if (!slug) return
        let cancelado = false
        Promise.all([
            getStorefrontConfig(slug),
            getStorefrontCategories(slug),
            getStorefrontProducts(slug, { limit: 16 }),
            getStorefrontProducts(slug, { featured: true, limit: 8 }),
        ]).then(([cfg, cats, general, feat]) => {
            if (cancelado) return
            setConfig(cfg)
            setCategorias(cats)
            const badges = { showNew: cfg.appearance?.showNewBadge, showOffer: cfg.appearance?.showOfferBadge, showLowStock: cfg.appearance?.showLowStock }
            setProductos(general.data.map(p => toProducto(p, badges)))
            setDestacados(feat.data.map(p => toProducto(p, badges)))
        }).catch(() => { /* tienda no encontrada / backend caído: se muestra vacía, no rompe la página */ })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [slug])

    const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }
    const heroSlides = config?.appearance?.heroSlides ?? []
    const stats = config?.appearance?.statsBar && config.appearance.statsBar.length > 0 ? config.appearance.statsBar : STATS_DEFAULT
    const catsVisual: CatVisual[] = categorias.map(c => ({ ...toCategoria(c), slug: c.slug, emoji: EMOJI_DEFAULT }))

    // Mismo criterio de "estantes" que tenía el mock (slices de una misma
    // lista) pero ahora sobre productos reales, ya ordenados por más nuevo
    // primero (así "nuevos ingresos" es directamente la primera tanda).
    const nuevosIngresos = productos.slice(0, 4)
    const masVendidos     = productos.slice(4, 8)
    const lanzamientos    = productos.slice(8, 12)
    const masParaVos      = productos.slice(12, 16)

    if (cargando) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
                <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 64px' }} aria-hidden="true">
                    <Skeleton width="100%" height={360} radius={16} />
                    <div style={{ display: 'flex', gap: 10, margin: '28px 0 40px', overflow: 'hidden' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} width={96} height={96} radius={14} delay={i * 40} style={{ flexShrink: 0 }} />)}
                    </div>
                    {[1, 2].map(estante => (
                        <div key={estante} style={{ marginBottom: 40 }}>
                            <SkeletonText width={180} height={20} delay={estante * 60} style={{ marginBottom: 20, borderRadius: 6 }} />
                            <SkeletonProductGrid cantidad={4} columns="repeat(4, 1fr)" cardHeight={200} />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // OJO con volver a poner `overflowX: 'hidden'` acá: el header de
    // StorefrontHeader.tsx es `position: sticky` — un ancestro con
    // overflow-x fijado (sin overflow-y) hace que el navegador compute
    // overflow-y como `auto` (regla de CSS Overflow: si un eje no es
    // `visible` y el otro sí, el `visible` pasa a `auto`), convirtiendo este
    // div en su propio contenedor de scroll y rompiendo el sticky del
    // header — es justo lo que pasaba: en TODAS las demás páginas del
    // storefront (Catálogo, Producto, Carrito...) el header queda fijo al
    // hacer scroll, en la Home no, porque era la única con este overflowX.
    // Cada elemento que de verdad necesita recortar su propio contenido
    // (el marquee de categorías, el banner de WhatsApp, los slides del hero)
    // ya tiene su propio `overflow: hidden` local más abajo — no hacía
    // falta este de más a nivel página.
    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
            <style>{`
                @keyframes sfFadeIn   { from { opacity:0; transform:translateY(8px)  } to { opacity:1; transform:translateY(0) } }
                @keyframes sfDotPulse { 0%,100%{ opacity:1; transform:scale(1)  } 50%{ opacity:.4; transform:scale(.7) } }
                @keyframes sfFloat    { 0%,100%{ transform:translateY(0)   } 33%{ transform:translateY(-7px)  } 66%{ transform:translateY(-3px) } }
                @keyframes sfBadge    { 0%,100%{ transform:translateY(0)   } 50%{ transform:translateY(-8px) } }
                @keyframes sfMarquee  { from { transform:translateX(0) } to { transform:translateX(-50%) } }
                .sf-cat-scroll::-webkit-scrollbar { display:none }
                .sf-marquee-track { display:flex; gap:8px; width:max-content; animation:sfMarquee 28s linear infinite; }
                .sf-marquee-track:hover { animation-play-state:paused; }
                .sf-marquee-wrap { overflow:hidden; mask-image:linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); -webkit-mask-image:linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%); }

                /* Contenedor base */
                .sf-w  { max-width:1280px; margin:0 auto; padding:0 32px }
                /* Grillas de productos */
                .sf-g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px }
                /* Grid hero */
                .sf-hero-grid { display:grid; grid-template-columns:1fr 400px; gap:40px; align-items:center; max-width:1280px; margin:0 auto; padding:0 48px }
                .sf-hero-inner { min-height:560px; padding-top:64px; padding-bottom:64px }
                /* Grid envíos / beneficios */
                .sf-2col { display:grid; grid-template-columns:1.1fr 1fr; gap:18px }

                /* ── Tablet (≤1024px) ── */
                @media(max-width:1024px){
                    .sf-w         { padding:0 24px }
                    .sf-g4        { grid-template-columns:repeat(2,1fr); gap:12px }
                    .sf-hero-grid { grid-template-columns:1fr; padding:0 32px }
                    .sf-hero-card { display:none }
                    .sf-2col      { grid-template-columns:1fr }
                    .sf-wpp-grid  { grid-template-columns:1fr !important; gap:24px !important; padding:32px 28px !important; }
                    .sf-wpp-chat  { display:none !important; }
                }
                /* ── Mobile (≤640px) ── */
                @media(max-width:640px){
                    .sf-w          { padding:0 16px }
                    .sf-g4         { gap:10px }
                    .sf-hero-grid  { padding:0 20px }
                    .sf-hero-inner { min-height:420px; padding-top:40px; padding-bottom:40px }
                    .sf-stats-row  { flex-wrap:wrap; gap:8px 0 }
                    .sf-stats-div  { display:none !important }
                    .sf-stats-item { padding:4px 16px !important }
                    .sf-wpp-grid   { padding:24px 20px !important; }
                }
            `}</style>

            <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
            <AnnouncementBar text={config?.appearance?.shippingText} visible={config?.appearance?.showAnnouncementBar ?? true} />

            {/* ══ HERO ══ */}
            {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} go={go} />}

            {/* ══ STATS BAR ══ */}
            {(config?.appearance?.showStatsBar ?? true) && stats.length > 0 && (
                <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
                    <div className="sf-w" style={{ display: 'flex', justifyContent: 'center' }}>
                        <div className="sf-stats-row" style={{ display: 'flex', alignItems: 'center' }}>
                            {stats.map((s, i, arr) => (
                                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <span className="sf-stats-item" style={{ padding: '0 24px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace' }}>{s.value}</span>
                                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-body)' }}>{s.label}</span>
                                    </span>
                                    {i < arr.length - 1 && <span className="sf-stats-div" style={{ width: 1, height: 14, background: 'var(--color-border)', flexShrink: 0 }} />}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ CATEGORÍAS ══ */}
            {catsVisual.length > 0 && (config?.appearance?.showCategoriesSection ?? true) && <CategoriaCarrusel cats={catsVisual} go={go} />}

            {/* ══ DESTACADOS ══ */}
            {destacados.length > 0 && (
                <section className="sf-w" style={{ paddingTop: 36, paddingBottom: 36 }}>
                    <SectionHead color="#EF4444" eyebrow="Destacados" titulo="Productos destacados" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {destacados.map(p => (
                            <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />
                        ))}
                    </div>
                </section>
            )}

            {/* ══ NUEVOS INGRESOS ══ */}
            {nuevosIngresos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#10B981" eyebrow="Nuevos ingresos" titulo="Recién llegados" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {nuevosIngresos.map(p => (
                            <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />
                        ))}
                    </div>
                </section>
            )}

            {/* ══ MÁS VENDIDOS ══ */}
            {masVendidos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#F59E0B" eyebrow="Top ventas" titulo="Más vendidos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {masVendidos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}

            {/* ══ LANZAMIENTOS ══ */}
            {lanzamientos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 36 }}>
                    <SectionHead color="#7C3AED" eyebrow="Lanzamientos" titulo="Nuevos lanzamientos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {lanzamientos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}

            {/* ══ MÁS PARA VOS ══ */}
            {masParaVos.length > 0 && (
                <section className="sf-w" style={{ paddingBottom: 44 }}>
                    <SectionHead color="var(--color-primary)" eyebrow="Recomendados" titulo="Más para vos" onVer={() => go('/catalogo')} />
                    <div className="sf-g4">
                        {masParaVos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
                    </div>
                </section>
            )}


            {/* ══ BANNER WHATSAPP ══ */}
            {config?.appearance?.showWhatsapp !== false && tienda.wpp && (
            <section className="sf-w" style={{ paddingBottom: 52 }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, background: 'linear-gradient(135deg,#064E3B 0%,#065F46 50%,#047857 100%)', boxShadow: '0 20px 60px rgba(6,78,59,0.30)' }}>

                    {/* Decoración fondo */}
                    <div style={{ position: 'absolute', top: -80, right: 260, width: 320, height: 320, borderRadius: '50%', background: 'rgba(52,211,153,0.10)', filter: 'blur(80px)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -60, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', filter: 'blur(60px)', pointerEvents: 'none' }} />

                    <div className="sf-wpp-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', alignItems: 'center', gap: 48, padding: '40px 48px' }}>

                        {/* ── Columna izquierda ── */}
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 12px', borderRadius: 999, background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.35)', marginBottom: 16 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="#34D399"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Atención por WhatsApp</span>
                            </div>
                            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 10px', maxWidth: 420 }}>
                                Respondemos en menos<br />de una hora
                            </h2>
                            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 380 }}>
                                Consultá talles, disponibilidad o coordiná un envío. Te atendemos de lunes a sábado, sin bots.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => openWpp(tienda.wpp, 'Hola! Quería hacer una consulta.')}
                                    style={{ height: 46, padding: '0 22px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(37,211,102,0.40)', transition: 'all 150ms', flexShrink: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#1DAA52'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'translateY(0)' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.528 5.845L.057 23.882l6.2-1.624A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.372l-.36-.213-3.681.965.982-3.594-.235-.369A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                                    Escribirnos ahora
                                </button>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    {([['< 1hs', 'respuesta'], ['+1.200', 'consultas']] as [string,string][]).map(([n, l]) => (
                                        <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.02em' }}>{n}</span>
                                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{l}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Chat animado ── */}
                        <div className="sf-wpp-chat"><WppChat /></div>

                    </div>
                </div>
            </section>
            )}

            <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
        </div>
    )
}

// ─── Encabezado de sección ─────────────────────────────────────────────────────

function SectionHead({ color, eyebrow, titulo, onVer }: { color: string; eyebrow: string; titulo: string; onVer: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'sfDotPulse 2s infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{eyebrow}</span>
                </div>
                <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '5px 0 0' }}>{titulo}</h2>
            </div>
            <button onClick={onVer} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todos →</button>
        </div>
    )
}

// ─── Hero carousel ─────────────────────────────────────────────────────────────
// Los slides reales (StorefrontConfig.heroSlides) solo traen {titulo,
// subtitulo, img, cta} — sin el eyebrow/producto-overlay/precio que tenía el
// mock, que no tienen dónde editarse en Apariencia. Con imagen sube esa foto
// de fondo; sin ella, un degradé estable por índice.
const HERO_GRADS = [
    'linear-gradient(120deg, #0F172A 0%, #1E3A5F 42%, #1D4ED8 100%)',
    'linear-gradient(120deg, #1E1B4B 0%, #4C1D95 45%, #7C3AED 100%)',
    'linear-gradient(120deg, #052E2B 0%, #0A6638 45%, #10B981 100%)',
]

function HeroCarousel({ slides, go }: { slides: StorefrontHeroSlide[]; go: (p: string) => void }) {
    const [idx, setIdx] = useState(0)
    const [paused, setPaused] = useState(false)
    const n = slides.length

    useEffect(() => {
        if (paused || n <= 1) return
        const id = setInterval(() => setIdx(i => (i + 1) % n), 4000)
        return () => clearInterval(id)
    }, [paused, n])

    const goSlide = (i: number) => setIdx((i + n) % n)

    // El link del CTA es texto libre cargado en Apariencia: puede ser un path
    // interno ("/catalogo/camperas") o una URL completa. Vacío = /catalogo.
    function irACta(link: string | undefined) {
        if (!link) { go('/catalogo'); return }
        if (/^https?:\/\//.test(link)) { window.location.href = link; return }
        go(link.startsWith('/') ? link : `/${link}`)
    }

    return (
        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', width: `${n * 100}%`, transform: `translateX(-${idx * (100 / n)}%)`, transition: 'transform 680ms cubic-bezier(0.4,0,0.2,1)' }}>
                {slides.map((s, i) => {
                    const centrada = s.imageStyle === 'centered'
                    function textoBloque(align: 'left' | 'center') {
                        return (
                            <div style={align === 'center' ? { textAlign: 'center' } : undefined}>
                                <h1 style={{ fontSize: 'clamp(30px, 3.6vw, 50px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#fff', whiteSpace: 'pre-line', margin: 0 }}>{s.titulo}</h1>
                                {s.subtitulo && <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.84)', lineHeight: 1.6, marginTop: 14, maxWidth: 380, ...(align === 'center' ? { marginLeft: 'auto', marginRight: 'auto' } : {}) }}>{s.subtitulo}</p>}
                                <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', ...(align === 'center' ? { justifyContent: 'center' } : {}) }}>
                                    <button onClick={() => irACta(s.ctaLink)} style={{ height: 46, padding: '0 22px', borderRadius: 10, background: '#fff', color: '#0F172A', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}>
                                        {s.cta || 'Ver catálogo'} <ArrowRight size={15} />
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    if (centrada) {
                        const posCenter = s.imagePosition === 'center'
                        if (posCenter) {
                            // Posición "Centro" real: apilado, texto arriba e
                            // imagen abajo, todo centrado en el ancho del
                            // slide — antes quedaba metido en la misma
                            // columna angosta que "Derecha" (layout de 2
                            // columnas de siempre) y se veía igual.
                            return (
                                <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                                    <div style={{ position: 'relative', overflow: 'hidden', background: s.bgColor || HERO_GRADS[i % HERO_GRADS.length] }}>
                                        {renderHeroBgPattern(s.bgPattern, { scope: s.bgPatternScope, anchor: s.imagePosition })}
                                        <div className="sf-hero-inner" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 820, margin: '0 auto', padding: '0 48px' }}>
                                            {textoBloque('center')}
                                            {s.img && <img src={s.img} alt="" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} />}
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        const imgPrimero = s.imagePosition === 'left'
                        const justify = s.imagePosition === 'left' ? 'flex-start' : 'flex-end'
                        return (
                            <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                                <div style={{ position: 'relative', overflow: 'hidden', background: s.bgColor || HERO_GRADS[i % HERO_GRADS.length] }}>
                                    {renderHeroBgPattern(s.bgPattern, { scope: s.bgPatternScope, anchor: s.imagePosition })}
                                    <div className="sf-hero-inner" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap', maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
                                        <div style={{ flex: '1 1 380px', order: imgPrimero ? 2 : 1 }}>{textoBloque('left')}</div>
                                        {s.img && (
                                            <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: justify, order: imgPrimero ? 1 : 2 }}>
                                                <img src={s.img} alt="" style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={s.id} style={{ width: `${100 / n}%`, flexShrink: 0 }}>
                            <div style={{
                                position: 'relative', overflow: 'hidden',
                                background: s.img ? `linear-gradient(rgba(15,23,42,0.55),rgba(15,23,42,0.55)), url(${s.img})` : HERO_GRADS[i % HERO_GRADS.length],
                                backgroundSize: 'cover', backgroundPosition: 'center',
                            }}>
                                {/* Textura de puntos */}
                                <div style={{ position: 'absolute', inset: 0, opacity: 0.40, backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to right, transparent, black 60%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 60%)' }} />

                                <div className="sf-hero-grid sf-hero-inner" style={{ gridTemplateColumns: '1fr' }}>
                                    {textoBloque('left')}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Flechas */}
            {n > 1 && <>
                <button onClick={() => goSlide(idx - 1)} aria-label="Anterior" style={arrowStyle('left')}><ChevronLeft size={19} /></button>
                <button onClick={() => goSlide(idx + 1)} aria-label="Siguiente" style={arrowStyle('right')}><ChevronRight size={19} /></button>

                {/* Dots */}
                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', gap: 6 }}>
                    {slides.map((_, i) => (
                        <button key={i} onClick={() => goSlide(i)} aria-label={`Slide ${i + 1}`}
                            style={{ height: 7, width: i === idx ? 22 : 7, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,0.42)', transition: 'width 280ms ease', padding: 0 }} />
                    ))}
                </div>
            </>}
        </div>
    )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
    return {
        position: 'absolute', [side]: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 3,
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', backdropFilter: 'blur(8px)',
        color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
    }
}

// ─── Carrusel de categorías (marquee automático si > 4 items) ─────────────────

const CAT_MIN_MARQUEE = 4

function CatPill({ c, go }: { c: CatVisual; go: (p: string) => void }) {
    return (
        <button
            onClick={() => go(`/catalogo/${c.slug}`)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, height: 50, padding: '0 14px 0 7px', cursor: 'pointer', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-bg)', transition: 'border-color 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
            <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 30%, oklch(0.86 0.07 ${c.hue}), oklch(0.74 0.08 ${c.hue}))`, display: 'grid', placeItems: 'center', fontSize: 16 }}>{c.emoji}</span>
            <span style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{c.nombre}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-muted)', marginTop: 1, fontFamily: '"Geist Mono", monospace' }}>{c.count} productos</span>
            </span>
        </button>
    )
}

function CategoriaCarrusel({ cats, go }: { cats: CatVisual[]; go: (p: string) => void }) {
    const isMarquee = cats.length > CAT_MIN_MARQUEE

    return (
        <div style={{ paddingTop: 24, paddingBottom: 28 }}>
            <div className="sf-w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Comprá por categoría</h2>
                <button onClick={() => go('/catalogo')} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
            </div>

            {isMarquee ? (
                /* ── Marquee automático ── */
                <div className="sf-marquee-wrap" style={{ paddingLeft: 0 }}>
                    <div className="sf-marquee-track">
                        {/* Duplicamos para el loop infinito */}
                        {[...cats, ...cats].map((c, i) => (
                            <CatPill key={`${c.id}-${i}`} c={c} go={go} />
                        ))}
                    </div>
                </div>
            ) : (
                /* ── Scroll estático si ≤ 4 ── */
                <div className="sf-w">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {cats.map(c => <CatPill key={c.id} c={c} go={go} />)}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Chat WhatsApp animado ─────────────────────────────────────────────────────

const WPP_DOUBLE_CHECK = (
    <svg width="14" height="9" viewBox="0 0 16 10" fill="none">
        <path d="M1 5L4.5 8.5L11 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5L8.5 8.5L15 2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

// phase: 0=vacío → 1=msg cliente → 2=typing tienda → 3=msg tienda → 4=msg cliente2 → reset
function WppChat() {
    const [phase, setPhase] = useState(0)

    useEffect(() => {
        const DELAYS: Record<number, number> = { 0: 500, 1: 1000, 2: 1800, 3: 1000, 4: 3000 }
        const next = phase < 4 ? phase + 1 : 0
        const t = setTimeout(() => setPhase(next), DELAYS[phase] ?? 1000)
        return () => clearTimeout(t)
    }, [phase])

    const show1   = phase >= 1
    const typing  = phase === 2
    const show2   = phase >= 3
    const show3   = phase >= 4

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <style>{`
                @keyframes wppBubble {
                    from { opacity: 0; transform: translateY(8px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes wppDot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30%           { transform: translateY(-4px); opacity: 1; }
                }
            `}</style>

            {/* Mensaje cliente */}
            {show1 && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '85%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>Hola! ¿Tienen la campera en talle M?</p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:41</span>
                </div>
            )}

            {/* Typing indicator */}
            {typing && (
                <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '10px 16px', animation: 'wppBubble 200ms ease both', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.18, 0.36].map((d, i) => (
                        <span key={i} style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: `wppDot 1s ${d}s ease-in-out infinite` }} />
                    ))}
                </div>
            )}

            {/* Respuesta tienda */}
            {show2 && (
                <div style={{ alignSelf: 'flex-end', background: '#25D366', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', maxWidth: '92%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Sí! Tenemos en M y L. Te coordinamos el envío hoy mismo 🎉</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>09:42</span>
                        {WPP_DOUBLE_CHECK}
                    </div>
                </div>
            )}

            {/* Respuesta final cliente */}
            {show3 && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px 14px 14px 3px', padding: '9px 13px', maxWidth: '70%', animation: 'wppBubble 280ms ease both' }}>
                    <p style={{ fontSize: 12.5, color: '#fff', margin: 0, lineHeight: 1.45 }}>¡Perfecto, muchas gracias! 🙌</p>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 3, display: 'block', textAlign: 'right' }}>09:43</span>
                </div>
            )}
        </div>
    )
}

