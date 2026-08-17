import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { MapPin, Mail, Phone, User, Plus, X, ArrowRight, ChevronLeft, Lock, LogIn } from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { ProdImage } from '@/components/storefront/Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { useAuth } from '@/hooks/useAuth'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meListAddresses, meCreateAddress, ApiError, type MeAddress } from '@/lib/api'
import { saveCheckoutDraft, loadCheckoutDraft } from '@/lib/storefront/checkoutDraft'

export default function CheckoutDatos() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { items, subtotal } = useCart()
  const { user, status: authStatus } = useAuth()
  const cliente = user?.type === 'customer' ? user.customer : null

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  // Un carrito vacío no tiene checkout — mismo criterio que /carrito.
  useEffect(() => {
    if (slug && items.length === 0) router.replace(`${base}/carrito`)
  }, [slug, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const [nombre, setNombre]     = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail]       = useState('')
  const [telefono, setTelefono] = useState('')
  useEffect(() => {
    if (!cliente) return
    setNombre(prev => prev || cliente.firstName)
    setApellido(prev => prev || (cliente.lastName ?? ''))
    setEmail(prev => prev || (cliente.email ?? ''))
  }, [cliente])

  const [direcciones, setDirecciones] = useState<MeAddress[]>([])
  const [dirSel, setDirSel]           = useState<string | null>(null)
  const [showNewDir, setShowNewDir]   = useState(false)
  const [guardandoDir, setGuardandoDir] = useState(false)
  const [errorDir, setErrorDir]       = useState('')
  const [nueva, setNueva] = useState({ alias: '', street: '', floor: '', depto: '', provincia: '', city: '', zip: '' })

  // Solo tiene sentido pedir direcciones guardadas con sesión — un invitado
  // no tiene Customer al que colgarle un Address (el backend ahora rechaza
  // shippingAddressId sin login), así que ni vale la pena pegarle al
  // endpoint (antes lo hacía igual y fallaba en silencio con 401).
  useEffect(() => {
    if (!cliente) return
    meListAddresses().then(list => {
      setDirecciones(list)
      const draft = slug ? loadCheckoutDraft(slug) : null
      const preferida = list.find(d => d.id === draft?.shippingAddressId) ?? list.find(d => d.isDefault) ?? list[0]
      if (preferida) setDirSel(preferida.id)
    }).catch(() => {})
  }, [slug, cliente])

  async function agregarDireccion() {
    if (!nueva.street.trim() || !nueva.city.trim()) { setErrorDir('Completá al menos calle y ciudad'); return }
    setGuardandoDir(true)
    setErrorDir('')
    try {
      const creada = await meCreateAddress({
        alias: nueva.alias.trim() || undefined,
        street: nueva.street.trim(),
        floor: nueva.floor.trim() || undefined,
        depto: nueva.depto.trim() || undefined,
        provincia: nueva.provincia.trim() || undefined,
        city: nueva.city.trim(),
        zip: nueva.zip.trim() || undefined,
      })
      setDirecciones(prev => [...prev, creada])
      setDirSel(creada.id)
      setShowNewDir(false)
      setNueva({ alias: '', street: '', floor: '', depto: '', provincia: '', city: '', zip: '' })
    } catch (err) {
      setErrorDir(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección')
    } finally {
      setGuardandoDir(false)
    }
  }

  const [errorForm, setErrorForm] = useState('')
  function continuar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      setErrorForm('Completá nombre, apellido y email')
      return
    }
    if (slug) {
      saveCheckoutDraft(slug, {
        buyer: { name: `${nombre.trim()} ${apellido.trim()}`, email: email.trim(), phone: telefono.trim() || undefined },
        shippingAddressId: dirSel ?? undefined,
      })
    }
    router.push(`${base}/checkout/pago`)
  }

  // Mientras se resuelve la sesión — un invitado (authStatus === 'anonymous')
  // sí ve el formulario: comprar sin cuenta es un flujo válido, ver sección
  // "Entrega 2" del plan.
  if (authStatus === 'loading') {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {config?.appearance?.logoUrl
            ? <img src={config.appearance.logoUrl} alt={tienda.nombre} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
            : <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #2563EB, #3B82F6)', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
              </div>}
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-muted)' }}>
          <Lock size={14} strokeWidth={1.5} /> Pago seguro
        </div>
      </header>

      <style>{`
        @media (max-width: 768px) {
          .sf-co-wrap   { padding: 24px 16px 48px !important; }
          .sf-co-layout { grid-template-columns: 1fr !important; }
          .sf-co-aside  { position: static !important; }
          .sf-co-2col   { grid-template-columns: 1fr !important; }
          .sf-co-3col   { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .sf-co-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="sf-co-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>
        <CheckoutStepper step={1} />
        <div className="sf-co-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>

          <form style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={continuar}>

            {/* Comprar sin cuenta es válido — esto es solo una invitación, no
                un bloqueo: el invitado puede seguir de largo con el
                formulario de abajo sin tocar nada acá. */}
            {authStatus === 'anonymous' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 10,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                fontSize: 13, color: 'var(--color-body)',
              }}>
                <LogIn size={16} strokeWidth={1.5} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>Estás comprando como invitado.</span>
                <button
                  type="button"
                  onClick={() => router.push(`${base}/login?returnTo=${encodeURIComponent(`${base}/checkout/datos`)}`)}
                  style={{ color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Iniciá sesión
                </button>
              </div>
            )}

            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>¿Quién recibe el pedido?</h2>
              <div className="sf-co-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <F label="Nombre" required><I value={nombre} onChange={setNombre} placeholder="María" icon={<User size={15} strokeWidth={1.5} color="var(--color-subtle)" />} /></F>
                <F label="Apellido" required><I value={apellido} onChange={setApellido} placeholder="Fernández" /></F>
              </div>
              <div className="sf-co-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <F label="Email" required><I type="email" value={email} onChange={setEmail} placeholder="hola@mail.com" icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} /></F>
                <F label="Teléfono"><I type="tel" value={telefono} onChange={setTelefono} placeholder="+54 9 11..." icon={<Phone size={15} strokeWidth={1.5} color="var(--color-subtle)" />} /></F>
              </div>
              {errorForm && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 10 }}>{errorForm}</div>}
            </div>

            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>Dirección de entrega</h2>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
                Opcional si vas a retirar en el local — el envío se coordina por WhatsApp después de confirmar el pedido.
              </p>

              {/* Direcciones guardadas: solo tiene sentido con sesión — un
                  invitado no tiene dónde guardarlas (Address.customerId no es
                  nullable) y el backend rechaza shippingAddressId sin login,
                  así que ni se le muestra la opción de elegir/agregar una. */}
              {cliente && (
                <>
                  {direcciones.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      {direcciones.map(d => {
                        const active = dirSel === d.id
                        return (
                          <label
                            key={d.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: 16, borderRadius: 10, cursor: 'pointer',
                              background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                              border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            }}
                          >
                            <input type="radio" name="dir" checked={active} onChange={() => setDirSel(d.id)} style={{ accentColor: 'var(--color-primary)' }} />
                            <MapPin size={20} strokeWidth={1.5} color="var(--color-muted)" />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{d.alias || 'Dirección'}</span>
                                {d.isDefault && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>Predeterminada</span>}
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                                {d.street}{d.floor ? ` · ${d.floor}` : ''} · {d.city}{d.zip ? ` · CP ${d.zip}` : ''}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowNewDir(v => !v)} style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--color-primary)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {showNewDir ? <X size={14} /> : <Plus size={14} />}
                    {showNewDir ? 'Ocultar formulario' : 'Agregar nueva dirección'}
                  </button>

                  {showNewDir && (
                    <div style={{ marginTop: 14 }}>
                      <F label="Dirección" required style={{ marginBottom: 14 }}>
                        <I placeholder="Av. Corrientes 1234" value={nueva.street} onChange={v => setNueva(p => ({ ...p, street: v }))} icon={<MapPin size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
                      </F>
                      <div className="sf-co-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <F label="Piso"><I placeholder="5" value={nueva.floor} onChange={v => setNueva(p => ({ ...p, floor: v }))} /></F>
                        <F label="Departamento"><I placeholder="B" value={nueva.depto} onChange={v => setNueva(p => ({ ...p, depto: v }))} /></F>
                        <F label="Alias"><I placeholder="Casa" value={nueva.alias} onChange={v => setNueva(p => ({ ...p, alias: v }))} /></F>
                      </div>
                      <div className="sf-co-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                        <F label="Provincia"><I placeholder="CABA" value={nueva.provincia} onChange={v => setNueva(p => ({ ...p, provincia: v }))} /></F>
                        <F label="Ciudad" required><I placeholder="CABA" value={nueva.city} onChange={v => setNueva(p => ({ ...p, city: v }))} /></F>
                        <F label="CP"><I placeholder="C1043" value={nueva.zip} onChange={v => setNueva(p => ({ ...p, zip: v }))} /></F>
                      </div>
                      {errorDir && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 10 }}>{errorDir}</div>}
                      <button type="button" onClick={() => void agregarDireccion()} disabled={guardandoDir} style={{
                        marginTop: 14, height: 40, padding: '0 18px', borderRadius: 8,
                        background: 'var(--color-text)', color: 'var(--color-bg)',
                        fontSize: 13, fontWeight: 600, border: 'none', cursor: guardandoDir ? 'default' : 'pointer', opacity: guardandoDir ? 0.6 : 1,
                      }}>
                        {guardandoDir ? 'Guardando…' : 'Guardar dirección'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => router.push(`${base}/carrito`)} style={{
                fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <ChevronLeft size={14} /> Volver al carrito
              </button>
              <button type="submit" style={{
                height: 52, padding: '0 28px', borderRadius: 10,
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(59,130,246,0.30)',
              }}>
                Continuar con el pago <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          </form>

          <aside className="sf-co-aside" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, position: 'sticky', top: 76 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 14 }}>
              Resumen del pedido
            </div>
            {items.map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center' }}>
                <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={56} radius={8} style={{ width: 56, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>x{it.qty}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                  {fmt(it.precio * it.qty)}
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Subtotal</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(subtotal)}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function F({ label, required, children, style }: { label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function I({ placeholder, type = 'text', icon, value, onChange }: { placeholder?: string; type?: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', height: 44, padding: `0 14px 0 ${icon ? 40 : 14}px`,
        borderRadius: 8, border: '1px solid var(--color-border)',
        background: 'var(--color-bg)', color: 'var(--color-text)',
        fontSize: 14, outline: 'none', boxSizing: 'border-box',
      }} />
    </div>
  )
}
