import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ShoppingBag, Search, User, Menu, X, ArrowRight, ShoppingCart, Minus, Plus, Trash2, Package, MapPin, LogOut, Store, Sun, Moon, ImageOff } from 'lucide-react'
import { ProdImage } from './Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/lib/storefront/CartContext'
import { useStorefrontTheme } from '@/hooks/useStorefrontTheme'
import { getStorefrontProducts, type StorefrontProductItem } from '@/lib/storefront/api'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import type { TiendaConfig } from '@/lib/storefront/types'

type Props = {
  tienda:  TiendaConfig
  // Apariencia real (Órbita panel → apps/api StorefrontConfig): logo subido y
  // enlaces del header que el dueño activó/renombró. Sin ellos, se cae al
  // logo de degradé y a la navegación por defecto de siempre.
  logoUrl?: string | null
  headerLinks?: { id: string; label: string; on: boolean }[]
  // Toggle "Buscador" de Apariencia — antes no se chequeaba en ningún lado,
  // el ícono de búsqueda se veía siempre. Default true (mismo criterio que
  // el resto de los toggles de esta pantalla).
  showSearch?: boolean
  // Vidriera digital (BusinessConfig.mode = SHOWCASE): no hay carrito ni
  // checkout — se saca el ícono para no dejar un botón que abre un drawer
  // que nunca va a tener nada adentro. Default false (tienda completa).
  esVidriera?: boolean
  // Plantilla Vidriera de Home (Avanzado → Plantillas, distinto de
  // esVidriera/SHOWCASE de arriba, nombre parecido por coincidencia): logo
  // centrado + buscador a la izquierda + nav en una fila propia debajo (ver
  // HeaderCentrado en panel/avanzado/plantillas/piezas.tsx, es el mismo
  // layout con datos reales en vez de mock). Todo el resto — sesión, carrito,
  // búsqueda en vivo, drawer mobile — es EXACTAMENTE el mismo código/estado
  // de siempre, solo cambia dónde se dibuja cada bloque.
  centrado?: boolean
}

// Iniciales del cliente para el avatar del header — fallback cuando todavía
// no subió una foto (cliente.avatarUrl es null).
function inicialesDe(firstName?: string, lastName?: string | null): string {
  const a = (firstName ?? '').trim()[0] ?? ''
  const b = (lastName ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase() || 'U'
}

// A dónde lleva cada link real del header y con qué filtro — "Categorías" y
// "Novedades" se sacaron (no tenían función propia, ver apariencia.mock.ts).
// "Ofertas" y "Más vendidos" no son solo una etiqueta: navegan al catálogo
// con el filtro real correspondiente aplicado (Catalogo.tsx lee estos query
// params al montar).
const NAV_LINKS_DEFAULT = [
  { label: 'Catálogo',     path: '/catalogo',                    matcher: '/catalogo' as string | null },
  { label: 'Ofertas',      path: '/catalogo?onSale=1',           matcher: null                         },
  { label: 'Más vendidos', path: '/catalogo?sort=bestselling',   matcher: null                         },
]

// Mismo destino para cuando los links vienen de Apariencia (headerLinks del
// negocio) — ahí solo se guarda label/on, así que el path se resuelve acá
// por id, con /catalogo como fallback para ids que no matcheen ninguno de
// los conocidos (label personalizado, o dato viejo de un negocio anterior a
// esta limpieza).
const PATH_POR_ID: Record<string, string> = {
  catalogo: '/catalogo',
  ofertas: '/catalogo?onSale=1',
  masVendidos: '/catalogo?sort=bestselling',
}

// Una categoria real del negocio en el header, guardada como
// `cat:<slug>` dentro de headerLinks (ver Apariencia, tarjeta "Header").
// Va con prefijo y no con el slug pelado para no chocar nunca con los ids
// fijos de arriba: un negocio podria tener una categoria llamada "ofertas".
const PREFIJO_CATEGORIA = 'cat:'
function pathDeLink(id: string): string {
  if (id.startsWith(PREFIJO_CATEGORIA)) {
    return `/catalogo?cat=${encodeURIComponent(id.slice(PREFIJO_CATEGORIA.length))}`
  }
  return PATH_POR_ID[id] ?? '/catalogo'
}

export function StorefrontHeader({ tienda, logoUrl, headerLinks, showSearch = true, esVidriera = false, centrado = false }: Props) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  // Sesión real (el AuthProvider envuelve toda la app en _app.tsx). El menú de
  // cuenta se muestra solo para clientes de ESTA tienda.
  const { status, user, logout } = useAuth()
  const cliente = user?.type === 'customer' ? user.customer : null

  // 'categorias'/'novedades' se filtran también acá por si el negocio guardó
  // su propia lista de headerLinks antes de esta limpieza (ver
  // apariencia.mapper.ts, mismo filtro del lado del panel).
  const navLinks = headerLinks
    ? headerLinks
        .filter(l => l.on && l.id !== 'categorias' && l.id !== 'novedades')
        .map(l => ({ label: l.label, path: pathDeLink(l.id), matcher: l.id === 'catalogo' ? '/catalogo' : null }))
    : NAV_LINKS_DEFAULT

  // Carrito real (CartContext) — antes cada instancia del header tenía su
  // propia copia local del carrito (useState(carrito)), desconectada de
  // cualquier otro lugar que lo tocara. Ahora todos leen/escriben el mismo
  // estado — agregar un producto en la grilla o el detalle se refleja acá al
  // toque.
  const { items, cartCount, subtotal: cartSubtotal, actualizarQty, quitar, revalidar, descuentoTicket } = useCart()
  const hayNoDisponibles = items.some(i => i.noDisponible)

  const { isDark, toggle: toggleTema } = useStorefrontTheme()

  function updateQty(variantId: string, delta: number) {
    actualizarQty(variantId, delta)
  }

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchVal,  setSearchVal]  = useState('')
  const [cartOpen,   setCartOpen]   = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  // Resultados en vivo del buscador — antes el input solo servía para armar
  // la URL al tocar Enter, no mostraba nada mientras se escribía.
  const [buscando, setBuscando] = useState(false)
  const [resultadosBusq, setResultadosBusq] = useState<StorefrontProductItem[] | null>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  // Revalida al abrir el drawer — mismo criterio que Carrito.tsx (el
  // CartProvider ya revalida solo al hidratar, esto cubre volver a abrirlo
  // después de un rato).
  useEffect(() => {
    if (cartOpen) revalidar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartOpen])

  // Cerrar el dropdown de cuenta al clickear afuera.
  useEffect(() => {
    if (!accountOpen) return
    function onDown(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [accountOpen])

  async function handleLogout() {
    setAccountOpen(false)
    setMenuOpen(false)
    await logout()
    router.push(`${base}/`)
  }

  // Items del menú de cuenta (dropdown desktop + drawer mobile).
  const accountLinks = [
    { label: 'Mi perfil',       Icon: User,    href: `${base}/perfil` },
    { label: 'Mis pedidos',     Icon: Package, href: `${base}/perfil?tab=pedidos` },
    { label: 'Mis direcciones', Icon: MapPin,  href: `${base}/perfil?tab=direcciones` },
  ]

  // Un dueño puede navegar su propia tienda logueado como cliente (sesión de
  // panel y de customer conviven en cookies separadas, ver bff.ts) — si
  // detectamos una sesión de panel viva en este navegador, mostramos el
  // atajo "Panel de administrador" acá también (mismo criterio que Perfil.tsx).
  const [tienePanel, setTienePanel] = useState(false)
  useEffect(() => {
    fetch('/api/auth/has-session?channel=panel')
      .then(r => r.json())
      .then((d: { exists?: boolean }) => setTienePanel(!!d.exists))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen])

  // Resultados en vivo mientras se escribe — mismo patrón (debounce +
  // bandera de cancelado para no dejar que una respuesta vieja pise a una
  // más nueva) que ya usa la búsqueda global del panel (Header.tsx). Antes
  // el buscador del storefront no mostraba nada hasta tocar Enter.
  useEffect(() => {
    const q = searchVal.trim()
    if (!slug || q.length < 2) { setResultadosBusq(null); setBuscando(false); return }
    let cancelado = false
    setBuscando(true)
    const t = setTimeout(() => {
      getStorefrontProducts(slug, { search: q, limit: 5 })
        .then(r => { if (!cancelado) setResultadosBusq(r.data) })
        .catch(() => { if (!cancelado) setResultadosBusq([]) })
        .finally(() => { if (!cancelado) setBuscando(false) })
    }, 300)
    return () => { cancelado = true; clearTimeout(t) }
  }, [searchVal, slug])

  // Cerrar el desplegable de resultados al clickear afuera — antes el input
  // usaba onBlur para esto, que se dispara ANTES del click de un resultado y
  // se lo comía (el desplegable se cerraba y limpiaba antes de que el click
  // llegara a navegar a ningún lado). Mismo patrón que ya usa el dropdown de
  // cuenta de acá arriba (accountRef).
  useEffect(() => {
    if (!searchOpen) return
    function onDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchVal('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [searchOpen])

  function toggleSearch() {
    setSearchOpen(o => !o)
    if (searchOpen) setSearchVal('')
  }

  function irACatalogoBuscado() {
    const q = searchVal.trim()
    router.push(q ? `${base}/catalogo?search=${encodeURIComponent(q)}` : `${base}/catalogo`)
    setSearchOpen(false)
    setSearchVal('')
  }

  function irAProducto(id: string) {
    router.push(`${base}/producto/${id}`)
    setSearchOpen(false)
    setSearchVal('')
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    // Antes navegaba a /catalogo sin el texto buscado — el buscador no
    // filtraba nada de verdad. Catalogo.tsx lee ?search= y lo manda al
    // backend (StorefrontProductsQueryDto ya lo soporta).
    if (e.key === 'Enter') irACatalogoBuscado()
    if (e.key === 'Escape') { setSearchOpen(false); setSearchVal('') }
  }

  const currentPath = router.asPath.replace(base, '') || '/'
  function isActive(matcher: string | null) {
    if (!matcher) return false
    return currentPath.startsWith(matcher)
  }

  // Piezas reusadas entre el layout de siempre y el centrado (plantilla
  // Vidriera) — mismo estado/handlers de arriba, solo cambia DÓNDE se
  // dibuja cada una. Como `centrado` es fijo durante todo el render, cada
  // una se usa en un solo lugar (nunca las dos ramas del JSX de abajo a la
  // vez), así que no hay duplicación de comportamiento.
  const navLinksBlock = navLinks.map(s => (
    <a key={s.label} href={`${base}${s.path}`} className={`sf-nav-link${centrado ? ' sf-nlc' : ''}${isActive(s.matcher) ? ' sf-active' : ''}`}>
      {s.label}
    </a>
  ))

  const searchBlock = showSearch && (
    // Wrapper propio para el `position: relative` del dropdown — NO puede
    // ser el mismo div que .sf-search-wrap: esa clase tiene `overflow:
    // hidden` a propósito (para la animación de ancho del input) y se comía
    // el dropdown entero.
    <div ref={searchWrapRef} style={{ position: 'relative' }}>
      <div className="sf-search-wrap">
        <input
          ref={searchRef}
          className={`sf-search-input${searchOpen ? ' open' : ''}`}
          placeholder="Buscar productos..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={handleSearchKey}
          aria-label="Buscar"
        />
        <button className="sf-hdr-btn" onClick={toggleSearch} aria-label={searchOpen ? 'Cerrar' : 'Buscar'}>
          {searchOpen ? <X size={18} strokeWidth={1.5} /> : <Search size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Resultados en vivo. Ancla a la izquierda cuando el buscador está a
          la izquierda del header (centrado, plantilla Vidriera) — con
          right:0 el desplegable se abría hacia afuera de la pantalla. */}
      {searchOpen && searchVal.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', ...(centrado ? { left: 0 } : { right: 0 }), width: 320,
          borderRadius: 12, zIndex: 1000,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          boxShadow: '0 12px 32px rgba(15,23,42,0.16)', overflow: 'hidden',
        }}>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {buscando ? (
              <div aria-hidden="true" style={{ padding: '10px 4px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                    <Skeleton width={36} height={36} radius={8} delay={i * 90} />
                    <SkeletonText width={`${[70, 55, 62][i]}%`} height={11} delay={i * 90 + 30} />
                  </div>
                ))}
              </div>
            ) : resultadosBusq && resultadosBusq.length > 0 ? (
              resultadosBusq.map(p => (
                <button
                  key={p.id}
                  onClick={() => irAProducto(p.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-surface)' }}>
                      <ImageOff size={15} color="var(--color-subtle)" strokeWidth={1.5} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>{fmt(p.price)}</div>
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
                Sin resultados para &quot;{searchVal.trim()}&quot;
              </div>
            )}
          </div>
          <button
            onClick={irACatalogoBuscado}
            style={{ width: '100%', height: 40, border: 'none', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            Mostrar más resultados →
          </button>
        </div>
      )}
    </div>
  )

  const themeBlock = (
    <button className="sf-hdr-btn" onClick={toggleTema} aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
      {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    </button>
  )

  const cartBlock = !esVidriera && (
    <button className="sf-hdr-btn" onClick={() => setCartOpen(o => !o)} aria-label="Carrito">
      <ShoppingBag size={18} strokeWidth={1.5} />
      {cartCount > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          minWidth: 15, height: 15, padding: '0 3px',
          background: 'var(--color-primary)', color: '#fff', borderRadius: 999,
          fontSize: 9, fontWeight: 700, lineHeight: 1,
          display: 'grid', placeItems: 'center',
          fontFamily: '"Geist Mono", monospace',
        }}>
          {cartCount}
        </span>
      )}
    </button>
  )

  const accountBlock = (
    <div className="sf-desktop-only" style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 8px', flexShrink: 0 }} />

      {status === 'loading' ? (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface)' }} />
      ) : cliente ? (
        <div ref={accountRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAccountOpen(o => !o)}
            className="ds-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 6px', height: 36, borderRadius: 8, background: 'transparent', border: 'none' }}
          >
            <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #F472B6, #FB923C)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {cliente.avatarUrl
                ? <img src={cliente.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : inicialesDe(cliente.firstName, cliente.lastName)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{cliente.firstName}</span>
          </button>
          {accountOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 200,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 60,
            }}>
              {accountLinks.map(l => (
                <button key={l.label} onClick={() => { setAccountOpen(false); router.push(l.href) }}
                  className="ds-hover"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text)', textAlign: 'left' }}>
                  <l.Icon size={15} strokeWidth={1.5} color="var(--color-muted)" /> {l.label}
                </button>
              ))}
              {tienePanel && (
                <button onClick={() => { setAccountOpen(false); window.location.href = '/panel' }}
                  className="ds-hover"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textAlign: 'left' }}>
                  <Store size={15} strokeWidth={1.5} /> Panel de administrador
                </button>
              )}
              <button onClick={handleLogout}
                className="ds-hover"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', fontSize: 13, color: 'var(--color-error)', fontWeight: 600, textAlign: 'left' }}>
                <LogOut size={15} strokeWidth={1.5} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => router.push(`${base}/login`)}
          className="ds-hover"
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, flexShrink: 0 }}
        >
          <User size={14} strokeWidth={2} /> Ingresar
        </button>
      )}
    </div>
  )

  const hamburgerBlock = (
    <button className="sf-hdr-btn sf-mobile-only" style={{ marginLeft: centrado ? 0 : 4 }} onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
      {menuOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  )

  const logoBlock = (
    // Logo — un poco más grande que antes (32px), acompañando la cabecera
    // más alta (pedido explícito del dueño).
    <a href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0, ...(centrado ? { justifySelf: 'center' } : { marginRight: 8 }) }}>
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
      ) : (
        // Logo genérico cuando el negocio no subió uno — un stop fijo
        // (marca de Órbita) + uno dinámico (color de la tienda).
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #1D4ED8, var(--color-primary))', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
        </div>
      )}
      <div style={centrado ? { textAlign: 'center' } : undefined}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: 'var(--font-heading, inherit)' }}>{tienda.nombre}</div>
        <div style={{ fontSize: 10.5, color: 'var(--color-subtle)', fontFamily: '"Geist Mono", monospace', lineHeight: 1 }}>{tienda.dominio}</div>
      </div>
    </a>
  )

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <style>{`
          .sf-nav-link {
            position: relative; display: inline-flex; align-items: center; flex-shrink: 0;
            padding: 0 14px; height: 76px; text-decoration: none;
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

          /* Plantilla Vidriera (centrado): la fila de nav vive SOLA debajo del
             header, no adentro de la fila de 76px — el mismo link con altura
             fija de siempre quedaría gigante ahí. */
          .sf-nav-link.sf-nlc { height: auto; padding: 3px 0; }
          .sf-nav-link.sf-nlc::after { left: 0; right: 0; }

          .sf-hdr-btn {
            width: 36px; height: 36px; border-radius: 8px;
            display: grid; place-items: center; position: relative;
            background: transparent; border: none; cursor: pointer;
            /* Antes var(--color-muted) (gris fijo) — pedido explícito del
               dueño: que los íconos del header sigan el color primario que
               se configura en Apariencia, igual que ya hace el resto de la
               tienda (y el preview del panel, una vez arreglado abajo). */
            color: var(--color-primary); transition: color 150ms;
          }
          .sf-hdr-btn:hover { color: var(--color-primary-h); }

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
            /* El botón/dropdown de cuenta y el login se ocultan en mobile —
               el drawer del hamburger (más abajo) ya tiene los mismos links
               de cuenta + "Ingresar"/"Cerrar sesión". Antes se mostraban los
               DOS (avatar+nombre acá arriba, Y el link adentro del drawer),
               y como esta fila nunca se achicaba, en pantallas angostas el
               conjunto search+tema+carrito+avatar+nombre+hamburger no entraba
               y forzaba scroll horizontal de TODA la página (bug reportado:
               el header se veía cortado y había que scrollear a los costados
               para llegar al menú). */
            .sf-hdr-row { padding: 0 16px; }
            .sf-search-input.open { width: min(190px, 52vw); }
          }

          /* Nav mobile drawer */
          .sf-drawer {
            position: fixed; inset: 0; top: 77px;
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

        <div
          className="sf-hdr-row"
          style={{
            height: 76, padding: '0 24px', alignItems: 'center',
            ...(centrado
              ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12 }
              : { display: 'flex', gap: 4 }),
          }}
        >
          {centrado ? (
            <>
              {/* Columna izquierda: buscador en desktop, hamburger en mobile
                  (mutuamente excluyentes por CSS, nunca se ven los dos). */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="sf-desktop-only" style={{ display: 'block' }}>{searchBlock}</div>
                {hamburgerBlock}
              </div>

              {/* Logo centrado — la pieza que define esta plantilla. */}
              {logoBlock}

              {/* Columna derecha: tema + carrito + cuenta (desktop-only). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end', flexShrink: 0 }}>
                {themeBlock}
                {cartBlock}
                {accountBlock}
              </div>
            </>
          ) : (
            <>
              {logoBlock}

              {/* Nav — desktop */}
              <div className="sf-nav-wrap sf-desktop-only">
                <div className="sf-nav-scroll">{navLinksBlock}</div>
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
                {searchBlock}
                {themeBlock}
                {cartBlock}
                {accountBlock}
                {hamburgerBlock}
              </div>
            </>
          )}
        </div>

        {/* Fila de nav propia, centrada, debajo del header — solo plantilla
            Vidriera. Mobile no la ve (el drawer del hamburger ya tiene los
            mismos links), igual que HeaderCentrado en panel/avanzado/plantillas/piezas.tsx. */}
        {centrado && navLinks.length > 0 && (
          <div className="sf-desktop-only" style={{ display: 'flex', justifyContent: 'center', gap: 26, padding: '0 24px 14px' }}>
            {navLinksBlock}
          </div>
        )}

        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav className="sf-drawer">
            {navLinks.map(s => (
              <a key={s.label} href={`${base}${s.path}`} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
                {s.label}
              </a>
            ))}
            {status !== 'loading' && (cliente ? (
              <>
                {accountLinks.map(l => (
                  <a key={l.label} href={l.href} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
                    <l.Icon size={16} strokeWidth={1.5} /> {l.label}
                  </a>
                ))}
                {tienePanel && (
                  <a href="/panel" className="sf-drawer-link" style={{ color: 'var(--color-primary)', fontWeight: 600 }} onClick={() => setMenuOpen(false)}>
                    <Store size={16} strokeWidth={1.5} /> Panel de administrador
                  </a>
                )}
                <button onClick={handleLogout} className="sf-drawer-link" style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 600 }}>
                  <LogOut size={16} strokeWidth={1.5} /> Cerrar sesión
                </button>
              </>
            ) : (
              <a href={`${base}/login`} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
                <User size={16} strokeWidth={1.5} /> Ingresar
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
              <button onClick={() => setCartOpen(false)} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
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
                  className="ds-hover"
                  style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  Ver catálogo <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="sf-cart-items" style={{ flex: 1, padding: '4px 20px' }}>
                {items.map((it, i) => {
                  const enElTope = it.maxQty !== undefined && it.qty >= it.maxQty
                  return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start',
                      borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                      opacity: it.noDisponible ? 0.55 : 1,
                    }}
                  >
                    <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={64} radius={8} style={{ width: 64, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3, textDecoration: it.noDisponible ? 'line-through' : 'none' }}>
                        {it.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 10 }}>{it.variante}</div>

                      {it.noDisponible ? (
                        <button
                          onClick={() => quitar(it.id)}
                          className="ds-hover"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--color-error)', background: 'var(--color-error-bg)', border: 'none', padding: '5px 9px', borderRadius: 6 }}
                        >
                          <Trash2 size={11} strokeWidth={2} /> No disponible — quitar
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                          {/* Stepper cantidad */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 32, overflow: 'hidden' }}>
                            <button
                              onClick={() => updateQty(it.id, -1)}
                              className="ds-hover"
                              style={{ width: 32, height: 32, background: 'none', border: 'none', color: it.qty === 1 ? '#EF4444' : 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
                            >
                              {it.qty === 1 ? <Trash2 size={12} strokeWidth={2} /> : <Minus size={12} strokeWidth={2} />}
                            </button>
                            <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                              {it.qty}
                            </span>
                            <button
                              onClick={() => updateQty(it.id, +1)}
                              disabled={enElTope}
                              className="ds-hover"
                              style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: enElTope ? 'not-allowed' : 'pointer', color: enElTope ? 'var(--color-subtle)' : 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
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
                      )}
                    </div>
                  </div>
                  )
                })}
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
                {/* Subtotal — el precio de cada ítem ya viene descontado si
                    corresponde (RBT-613), así que un descuento POR PRODUCTO
                    ya está reflejado acá. Solo el de alcance TICKET (toda la
                    compra) necesita una línea aparte, no tiene un ítem donde
                    "esconderse". */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: descuentoTicket ? 4 : 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Subtotal ({cartCount} {cartCount === 1 ? 'ítem' : 'ítems'})</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                    {fmt(cartSubtotal)}
                  </span>
                </div>
                {/* La tasa entre paréntesis (1% / $500) — antes solo se veía
                    el monto final, sin ninguna pista de si salía de un % o
                    de un fijo (pedido explícito del dueño, mismo criterio
                    que Carrito.tsx/CheckoutPago.tsx). */}
                {descuentoTicket && descuentoTicket.monto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      Descuento: {descuentoTicket.nombre} ({descuentoTicket.esPorcentaje ? `${descuentoTicket.valor}%` : fmt(descuentoTicket.valor)})
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                      −{fmt(descuentoTicket.monto)}
                    </span>
                  </div>
                )}

                {/* CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Si hay ítems caídos, el botón lleva al carrito completo
                      (ahí se resuelve: tachados con motivo, "Quitar") en vez
                      de dejar avanzar al checkout con el carrito roto — pero
                      SIGUE siendo clickeable, no se deshabilita: un botón
                      disabled no dispara el redirect y el cliente se queda
                      sin saber qué hacer. */}
                  <button
                    onClick={() => { setCartOpen(false); router.push(hayNoDisponibles ? `${base}/carrito` : `${base}/checkout/datos`) }}
                    className="ds-hover"
                    style={{
                      width: '100%', height: 50, borderRadius: 10,
                      background: hayNoDisponibles ? 'var(--color-surface-alt)' : 'var(--color-primary)',
                      color: hayNoDisponibles ? 'var(--color-muted)' : '#fff',
                      fontSize: 14, fontWeight: 700, border: 'none', cursor: hayNoDisponibles ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: hayNoDisponibles ? 'none' : '0 6px 20px rgba(37,99,235,0.28)',
                    }}
                  >
                    {hayNoDisponibles ? 'Revisá tu carrito' : <>Ir al checkout <ArrowRight size={15} strokeWidth={2} /></>}
                  </button>
                  <button
                    onClick={() => { setCartOpen(false); router.push(`${base}/carrito`) }}
                    style={{
                      width: '100%', height: 42, borderRadius: 10,
                      background: 'transparent', color: 'var(--color-text)',
                      fontSize: 13, fontWeight: 600, border: '1px solid var(--color-border-strong)', cursor: 'pointer',
                      transition: 'border-color 150ms, color 150ms, background 150ms',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)'
                      e.currentTarget.style.color = 'var(--color-primary)'
                      e.currentTarget.style.background = 'var(--color-primary-bg)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                      e.currentTarget.style.color = 'var(--color-text)'
                      e.currentTarget.style.background = 'transparent'
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
