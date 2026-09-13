// Cuenta + carrito + buscador REALES, pintados con el tema de una plantilla.
//
// Es el relleno de los huecos que deja el navbar de cada plantilla (ver
// `AccionesTienda` y `renderBuscador` en panel/avanzado/plantillas). La
// maqueta decide DÓNDE va cada pieza y con qué tema; esto decide QUÉ hace.
// Así el navbar que ve el cliente es exactamente el mismo JSX que el de la
// vitrina del panel —idéntico por construcción— pero con sesión, contador
// vivo y drawer de verdad.
//
// La forma replica pieza por pieza la de `AccionesTienda` (pastilla
// "Ingresar" con ícono, bolsa con globo de cantidad, y en celular los dos
// íconos sueltos): si cambia una, hay que cambiar la otra, o la tienda deja
// de verse como su vitrina.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { User, ShoppingBag, Search, X, Package, MapPin, LogOut, Store } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/lib/storefront/CartContext'
import { CartDrawer } from './CartDrawer'
import type { Tema } from '@/modules/ventas/panel/avanzado/plantillas/tipos'

function inicialesDe(firstName?: string, lastName?: string | null): string {
  const a = (firstName ?? '').trim()[0] ?? ''
  const b = (lastName ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase() || 'U'
}

export function AccionesPlantilla({ t, movil, esVidriera = false }: { t: Tema; movil?: boolean; esVidriera?: boolean }) {
  const router = useRouter()
  const { slug } = router.query as { slug?: string }
  const base = `/tienda/${slug}`
  const { status, user, logout } = useAuth()
  const cliente = user?.type === 'customer' ? user.customer : null
  const { cartCount } = useCart()

  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const redondeo = t.radio === 0 ? 4 : 999

  const globo = cartCount > 0 ? (
    <span style={{
      position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, padding: '0 4px',
      background: t.primary, color: t.onPrimary, borderRadius: 999, fontSize: 10, fontWeight: 800,
      display: 'grid', placeItems: 'center', lineHeight: 1,
    }}>{cartCount}</span>
  ) : null

  // Vidriera digital (SHOWCASE): sin carrito ni cuenta — mismo criterio que
  // StorefrontHeader, no ofrecer un botón que no lleva a ningún lado.
  const bolsa = esVidriera ? null : (
    <button
      onClick={() => setCartOpen(true)}
      aria-label="Carrito"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: t.text }}
    >
      <ShoppingBag size={movil ? 18 : 17} strokeWidth={movil ? 1.6 : 1.7} />
      {globo}
    </button>
  )

  const menuCuenta = cliente && menuOpen ? (
    <span style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 200, zIndex: 60,
      background: t.surf, border: `1px solid ${t.border}`, borderRadius: t.radio === 0 ? 0 : 10,
      boxShadow: t.sombra, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: t.fb, textAlign: 'left',
    }}>
      {([
        ['Mi perfil', User, `${base}/perfil`],
        ['Mis pedidos', Package, `${base}/perfil?tab=pedidos`],
        ['Mis direcciones', MapPin, `${base}/perfil?tab=direcciones`],
      ] as [string, typeof User, string][]).map(([label, Icon, href]) => (
        <button
          key={label}
          onClick={() => { setMenuOpen(false); router.push(href) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.text, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
        >
          <Icon size={15} strokeWidth={1.5} color={t.muted} /> {label}
        </button>
      ))}
      <button
        onClick={async () => { setMenuOpen(false); await logout(); router.push(`${base}/`) }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', fontSize: 13, color: '#DC2626', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <LogOut size={15} strokeWidth={1.5} /> Cerrar sesión
      </button>
    </span>
  ) : null

  if (movil) {
    return (
      <>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 15, color: t.text }}>
          {!esVidriera && (
            <button
              onClick={() => router.push(cliente ? `${base}/perfil` : `${base}/login`)}
              aria-label={cliente ? 'Mi cuenta' : 'Ingresar'}
              style={{ display: 'inline-flex', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: t.text }}
            >
              {cliente && cliente.avatarUrl
                ? <img src={cliente.avatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                : <User size={18} strokeWidth={1.6} />}
            </button>
          )}
          {bolsa}
        </span>
        {!esVidriera && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 15, fontSize: 12.5, color: t.muted, fontFamily: t.fb, whiteSpace: 'nowrap' }}>
        {!esVidriera && (
          status === 'loading' ? (
            <span style={{ width: 86, height: 30, borderRadius: redondeo, background: t.soft }} />
          ) : cliente ? (
            <span ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: t.fb }}
              >
                <span style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: t.primary, color: t.onPrimary, fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {cliente.avatarUrl
                    ? <img src={cliente.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : inicialesDe(cliente.firstName, cliente.lastName)}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{cliente.firstName}</span>
              </button>
              {menuCuenta}
            </span>
          ) : (
            <button
              onClick={() => router.push(`${base}/login`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, color: t.text, fontWeight: 600,
                border: `1px solid ${t.border}`, borderRadius: redondeo, padding: '6px 13px',
                background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontFamily: t.fb,
              }}
            >
              <User size={13} strokeWidth={2} /> Ingresar
            </button>
          )
        )}
        {bolsa}
      </span>
      {!esVidriera && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
    </>
  )
}

// El buscador real, con la forma de la caja decorativa que cada plantilla ya
// dibuja. `placeholder` lo pasa la plantilla para no perder su voz ("¿Qué
// estás buscando?", "Buscar producto o código", "buscar…").
export function BuscadorPlantilla({ t, placeholder = 'Buscar productos…', ancho }: { t: Tema; placeholder?: string; ancho?: number }) {
  const router = useRouter()
  const { slug } = router.query as { slug?: string }
  const [valor, setValor] = useState('')

  function buscar() {
    const q = valor.trim()
    router.push(q ? `/tienda/${slug}/catalogo?search=${encodeURIComponent(q)}` : `/tienda/${slug}/catalogo`)
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      border: `1px solid ${t.border}`, borderRadius: t.radio === 0 ? 6 : 999,
      padding: '8px 14px', background: t.soft, maxWidth: ancho ?? 230, width: '100%',
    }}>
      <input
        value={valor}
        onChange={e => setValor(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') buscar() }}
        placeholder={placeholder}
        aria-label="Buscar"
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 12.5, color: t.text, fontFamily: t.fb,
        }}
      />
      <button onClick={buscar} aria-label="Buscar" style={{ display: 'inline-flex', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: t.muted }}>
        {valor ? <X size={14} strokeWidth={2} onClick={() => setValor('')} /> : <Search size={14} strokeWidth={2} />}
      </button>
    </span>
  )
}

// Atajo al panel para el dueño que navega su propia tienda logueado como
// cliente — mismo criterio que StorefrontHeader (las dos sesiones conviven
// en cookies separadas, ver bff.ts).
export function AtajoPanel({ t }: { t: Tema }) {
  const [tienePanel, setTienePanel] = useState(false)
  useEffect(() => {
    fetch('/api/auth/has-session?channel=panel')
      .then(r => r.json())
      .then((d: { exists?: boolean }) => setTienePanel(!!d.exists))
      .catch(() => {})
  }, [])
  if (!tienePanel) return null
  return (
    <button
      onClick={() => { window.location.href = '/panel' }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: t.primary, fontWeight: 600, fontFamily: t.fb }}
    >
      <Store size={13} strokeWidth={1.8} /> Panel
    </button>
  )
}
