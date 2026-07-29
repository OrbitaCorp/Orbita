import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ShoppingBag, Search, User, Menu, X, ArrowRight, ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react'
import { Thumb } from './Thumb'
import { fmt } from '@/lib/storefront/utils'
import type { TiendaConfig, ItemCarrito } from '@/lib/storefront/types'

type Props = {
  tienda:  TiendaConfig
  carrito: ItemCarrito[]
  logged?: boolean
  // Apariencia real (Órbita panel → apps/api StorefrontConfig): logo subido y
  // enlaces del header que el dueño activó/renombró. Sin ellos, se cae al
  // logo de degradé y a la navegación por defecto de siempre.
  logoUrl?: string | null
  headerLinks?: { id: string; label: string; on: boolean }[]
}

const NAV_LINKS_DEFAULT = [
  { label: 'Catálogo',     path: '/catalogo', matcher: '/catalogo' as string | null },
  { label: 'Ofertas',      path: '/catalogo', matcher: null                         },
  { label: 'Novedades',    path: '/catalogo', matcher: null                         },
  { label: 'Más vendidos', path: '/catalogo', matcher: null                         },
]

export function StorefrontHeader({ tienda, carrito, logged, logoUrl, headerLinks }: Props) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  // Todos los links reales apuntan a /catalogo (no hay rutas propias por
  // "ofertas"/"novedades" todavía) — mismo criterio que ya tenía la lista por
  // defecto, salvo "Catálogo" que sí marca activo con matcher.
  const navLinks = headerLinks
    ? headerLinks.filter(l => l.on).map(l => ({ label: l.label, path: '/catalogo', matcher: l.id === 'catalogo' ? '/catalogo' : null }))
    : NAV_LINKS_DEFAULT

  const [items, setItems] = useState(carrito)

  const cartCount    = items.reduce((s, i) => s + i.qty, 0)
  const cartSubtotal = items.reduce((s, i) => s + i.precio * i.qty, 0)

  function updateQty(idx: number, delta: number) {
    setItems(prev => {
      const newQty = prev[idx].qty + delta
      if (newQty <= 0) return prev.filter((_, i) => i !== idx)
      return prev.map((it, i) => i === idx ? { ...it, qty: newQty } : it)
    })
  }

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchVal,  setSearchVal]  = useState('')
  const [cartOpen,   setCartOpen]   = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen])

  function toggleSearch() {
    setSearchOpen(o => !o)
    if (searchOpen) setSearchVal('')
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { router.push(`${base}/catalogo`); setSearchOpen(false); setSearchVal('') }
    if (e.key === 'Escape') { setSearchOpen(false); setSearchVal('') }
  }

  const currentPath = router.asPath.replace(base, '') || '/'
  function isActive(matcher: string | null) {
    if (!matcher) return false
    return currentPath.startsWith(matcher)
  }

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <style>{`
          .sf-nav-link {
            position: relative; display: inline-flex; align-items: center; flex-shrink: 0;
            padding: 0 14px; height: 64px; text-decoration: none;
            font-size: 13.5px; font-weight: 500; color: var(--color-muted); white-space: nowrap;
            transition: color 200ms;
          }
          .sf-nav-link::after {
            content: ''; position: absolute; bottom: 0; left: 14px; right: 14px;
            height: 2px; border-radius: 2px 2px 0 0; background: var(--color-text);
            transform: scaleX(0); transform-origin: center;
            transition: transform 220ms cubic-bezier(0.4,0,0.2,1);
          }
          .sf-nav-link:hover { color: var(--color-text); }
          .sf-nav-link:hover::after { transform: scaleX(1); }
          .sf-nav-link.sf-active { color: var(--color-text); font-weight: 600; }
          .sf-nav-link.sf-active::after { transform: scaleX(1); background: var(--color-primary); }

          .sf-hdr-btn {
            width: 36px; height: 36px; border-radius: 8px;
            display: grid; place-items: center; position: relative;
            background: transparent; border: none; cursor: pointer;
            color: var(--color-muted); transition: color 150ms;
          }
          .sf-hdr-btn:hover { color: var(--color-text); }

          .sf-search-wrap { display: flex; align-items: center; gap: 4; overflow: hidden; }
          .sf-search-input {
            width: 0; max-width: 220px; height: 34px; padding: 0;
            border: none; outline: none; background: transparent;
            font-size: 13.5px; color: var(--color-text);
            transition: width 250ms cubic-bezier(0.4,0,0.2,1), padding 250ms cubic-bezier(0.4,0,0.2,1);
            white-space: nowrap; overflow: hidden;
          }
          .sf-search-input.open { width: 220px; padding: 0 10px; border-bottom: 1.5px solid var(--color-border-strong); }
          .sf-search-input::placeholder { color: var(--color-subtle); }

          .sf-nav-wrap { flex: 1; min-width: 0; overflow: hidden; }
          .sf-nav-scroll { display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; }
          .sf-nav-scroll::-webkit-scrollbar { display: none; }

          .sf-mobile-only  { display: none !important; }
          @media (max-width: 768px) {
            .sf-mobile-only  { display: grid !important; }
            .sf-desktop-only { display: none !important; }
          }

          /* Nav mobile drawer */
          .sf-drawer {
            position: fixed; inset: 0; top: 65px;
            background: var(--color-bg); z-index: 100; overflow-y: auto;
            border-top: 1px solid var(--color-border);
            animation: sfDrawerIn 200ms ease;
          }
          @keyframes sfDrawerIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .sf-drawer-link {
            display: flex; align-items: center; gap: 10px;
            padding: 15px 20px; font-size: 15px; font-weight: 500;
            color: var(--color-text); text-decoration: none;
            border-bottom: 1px solid var(--color-border); transition: background 100ms;
          }
          .sf-drawer-link:hover { background: var(--color-surface); }

          /* Cart drawer animations */
          @keyframes sfCartSlide {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
          @keyframes sfCartFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }

          /* Cart items scrollbar */
          .sf-cart-items { overflow-y: auto; }
          .sf-cart-items::-webkit-scrollbar { width: 4px; }
          .sf-cart-items::-webkit-scrollbar-track { background: transparent; }
          .sf-cart-items::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 999px; }
        `}</style>

        <div style={{ height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4 }}>

          {/* Logo */}
          <a href={base} style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0, marginRight: 6 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{tienda.nombre}</div>
              <div style={{ fontSize: 10, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', lineHeight: 1 }}>{tienda.dominio}</div>
            </div>
          </a>

          {/* Nav — desktop */}
          <div className="sf-nav-wrap sf-desktop-only">
            <div className="sf-nav-scroll">
              {navLinks.map(s => (
                <a key={s.label} href={`${base}${s.path}`} className={`sf-nav-link${isActive(s.matcher) ? ' sf-active' : ''}`}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
            <div className="sf-search-wrap">
              <input
                ref={searchRef}
                className={`sf-search-input${searchOpen ? ' open' : ''}`}
                placeholder="Buscar productos..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={handleSearchKey}
                onBlur={() => { setSearchOpen(false); setSearchVal('') }}
                aria-label="Buscar"
              />
              <button className="sf-hdr-btn" onClick={toggleSearch} aria-label={searchOpen ? 'Cerrar' : 'Buscar'}>
                {searchOpen ? <X size={18} strokeWidth={1.5} /> : <Search size={18} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Botón carrito — ahora abre el drawer */}
            <button className="sf-hdr-btn" onClick={() => setCartOpen(o => !o)} aria-label="Carrito">
              <ShoppingBag size={18} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  minWidth: 15, height: 15, padding: '0 3px',
                  background: '#2563EB', color: '#fff', borderRadius: 999,
                  fontSize: 9, fontWeight: 700, lineHeight: 1,
                  display: 'grid', placeItems: 'center',
                  fontFamily: '"Geist Mono", monospace',
                }}>
                  {cartCount}
                </span>
              )}
            </button>

            <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 8px', flexShrink: 0 }} />

            {logged ? (
              <button onClick={() => router.push(`${base}/perfil`)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 6px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #F472B6, #FB923C)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>MF</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>María</span>
              </button>
            ) : (
              <button
                onClick={() => router.push(`${base}/login`)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
              >
                <User size={14} strokeWidth={2} /> Ingresar
              </button>
            )}

            {/* Hamburger — mobile */}
            <button className="sf-hdr-btn sf-mobile-only" style={{ marginLeft: 4 }} onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav className="sf-drawer">
            {navLinks.map(s => (
              <a key={s.label} href={`${base}${s.path}`} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
                {s.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* ── Cart drawer ── */}
      {cartOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setCartOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.45)',
              animation: 'sfCartFade 220ms ease',
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(420px, 100vw)',
            background: 'var(--color-bg)',
            zIndex: 201,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
            animation: 'sfCartSlide 300ms cubic-bezier(0.32,0.72,0,1)',
          }}>

            {/* Header del drawer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px', height: 64,
              borderBottom: '1px solid var(--color-border)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShoppingBag size={18} strokeWidth={1.5} color="var(--color-text)" />
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Tu carrito</span>
                {cartCount > 0 && (
                  <span style={{
                    height: 22, padding: '0 8px', borderRadius: 999,
                    background: 'var(--color-primary)', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center',
                  }}>
                    {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                )}
              </div>
              <button onClick={() => setCartOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Ítems */}
            {items.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
                  <ShoppingCart size={32} strokeWidth={1.2} color="var(--color-muted)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Tu carrito está vacío</div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Explorá nuestro catálogo y agregá productos.</div>
                </div>
                <button
                  onClick={() => { setCartOpen(false); router.push(`${base}/catalogo`) }}
                  style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  Ver catálogo <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="sf-cart-items" style={{ flex: 1, padding: '4px 20px' }}>
                {items.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start',
                      borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <Thumb hue={it.hue} size={64} radius={8} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                        {it.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 10 }}>{it.variante}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                        {/* Stepper cantidad */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 32, overflow: 'hidden' }}>
                          <button
                            onClick={() => updateQty(i, -1)}
                            style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: it.qty === 1 ? '#EF4444' : 'var(--color-muted)', display: 'grid', placeItems: 'center', transition: 'color 150ms' }}
                          >
                            {it.qty === 1 ? <Trash2 size={12} strokeWidth={2} /> : <Minus size={12} strokeWidth={2} />}
                          </button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                            {it.qty}
                          </span>
                          <button
                            onClick={() => updateQty(i, +1)}
                            style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', transition: 'color 150ms' }}
                          >
                            <Plus size={12} strokeWidth={2} />
                          </button>
                        </div>

                        {/* Precio */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                            {fmt(it.precio * it.qty)}
                          </div>
                          {it.precioAnt && (
                            <div style={{ fontSize: 11, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>
                              {fmt(it.precioAnt * it.qty)}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer — solo si hay ítems */}
            {items.length > 0 && (
              <div style={{
                padding: '16px 20px 24px',
                borderTop: '1px solid var(--color-border)',
                flexShrink: 0,
                background: 'var(--color-bg)',
              }}>
                {/* Subtotal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Subtotal ({cartCount} {cartCount === 1 ? 'ítem' : 'ítems'})</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                    {fmt(cartSubtotal)}
                  </span>
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => { setCartOpen(false); router.push(`${base}/checkout/datos`) }}
                    style={{
                      width: '100%', height: 50, borderRadius: 10,
                      background: 'var(--color-primary)', color: '#fff',
                      fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 6px 20px rgba(37,99,235,0.28)',
                    }}
                  >
                    Ir al checkout <ArrowRight size={15} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => { setCartOpen(false); router.push(`${base}/carrito`) }}
                    style={{
                      width: '100%', height: 42, borderRadius: 10,
                      background: 'transparent', color: 'var(--color-text)',
                      fontSize: 13, fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer',
                    }}
                  >
                    Ver carrito completo
                  </button>
                </div>

                <p style={{ fontSize: 11, color: 'var(--color-subtle)', textAlign: 'center', margin: '12px 0 0' }}>
                  Envío y cupones se calculan en el checkout
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
