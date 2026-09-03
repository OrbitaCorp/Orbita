import { forwardRef, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Mail, Phone, User, IdCard, ArrowRight, ChevronLeft, Lock, LogIn } from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { useAuth } from '@/hooks/useAuth'
import { meGetProfile, meUpdateProfile, type MeProfile } from '@/lib/api'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { saveCheckoutDraft } from '@/lib/storefront/checkoutDraft'

export default function CheckoutDatos() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { items, subtotal, descuentoTicket } = useCart()
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
  const [dni, setDni]           = useState('')
  useEffect(() => {
    if (!cliente) return
    setNombre(prev => prev || cliente.firstName)
    setApellido(prev => prev || (cliente.lastName ?? ''))
    setEmail(prev => prev || (cliente.email ?? ''))
  }, [cliente])

  // Teléfono y DNI no viven en el AuthUser liviano de arriba (solo nombre/
  // apellido/email/avatar) — se traen del perfil completo (/me) para no
  // obligar a retipearlos si el cliente ya los tiene cargados (de su perfil
  // o de una compra anterior). Si el perfil no los tiene, quedan vacíos y se
  // piden acá como a un invitado.
  // Se guarda el snapshot en un ref (no en un estado propio: nada en la UI
  // depende de esto) para poder comparar en continuar() qué cambió de
  // verdad y mandar solo eso de vuelta al perfil — ver esa función.
  const perfilRef = useRef<MeProfile | null>(null)
  useEffect(() => {
    if (!cliente) return
    let cancelado = false
    meGetProfile().then(p => {
      if (cancelado) return
      perfilRef.current = p
      setTelefono(prev => prev || (p.phone ?? ''))
      setDni(prev => prev || (p.dni ?? ''))
    }).catch(() => { /* sin perfil disponible: se sigue pidiendo a mano */ })
    return () => { cancelado = true }
  }, [cliente])

  // Validación por campo — cada input muestra su propio error (en vez de un
  // mensaje genérico al pie) y se limpia apenas el usuario lo corrige, para
  // que quede claro cuál falta sin tener que releer el formulario entero.
  // Teléfono obligatorio: el checkout coordina el envío por WhatsApp, sin
  // teléfono no hay forma de contactar al comprador para eso.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  type CampoError = 'nombre' | 'apellido' | 'email' | 'telefono' | 'dni'
  const [errores, setErrores] = useState<Partial<Record<CampoError, string>>>({})
  const nombreRef = useRef<HTMLInputElement>(null)
  const apellidoRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const telefonoRef = useRef<HTMLInputElement>(null)
  const dniRef = useRef<HTMLInputElement>(null)

  function campoOnChange(setter: (v: string) => void, campo: CampoError) {
    return (v: string) => {
      setter(v)
      setErrores(prev => (prev[campo] ? { ...prev, [campo]: undefined } : prev))
    }
  }

  function validar(): Partial<Record<CampoError, string>> {
    const next: Partial<Record<CampoError, string>> = {}
    if (!nombre.trim()) next.nombre = 'Ingresá tu nombre'
    if (!apellido.trim()) next.apellido = 'Ingresá tu apellido'
    if (!email.trim()) next.email = 'Ingresá tu email'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Ese email no es válido'
    if (!telefono.trim()) next.telefono = 'Ingresá tu WhatsApp'
    if (!dni.trim()) next.dni = 'Ingresá tu DNI'
    return next
  }

  // Manda al perfil (/me) solo los campos que de verdad cambiaron respecto
  // al snapshot cargado (perfilRef) — nunca el formulario entero. Dos
  // motivos: 1) mandar `email` sin que haya cambiado igual dispara
  // `emailVerified: false` en el backend (revalida el mail), no hay que
  // pisarlo si el cliente no lo tocó; 2) no tiene sentido escribir en la
  // base algo que no cambió. Sin perfil cargado (perfilRef.current null —
  // /me falló o todavía no respondió) no se manda nada: mejor no sincronizar
  // que sincronizar a ciegas sin saber qué había antes.
  function sincronizarPerfil() {
    if (!cliente) return
    const previo = perfilRef.current
    if (!previo) return
    const cambios: Partial<Pick<MeProfile, 'firstName' | 'lastName' | 'email' | 'phone' | 'dni'>> = {}
    if (nombre.trim() && nombre.trim() !== previo.firstName) cambios.firstName = nombre.trim()
    if (apellido.trim() !== (previo.lastName ?? '')) cambios.lastName = apellido.trim()
    if (email.trim() && email.trim() !== (previo.email ?? '')) cambios.email = email.trim()
    if (telefono.trim() !== (previo.phone ?? '')) cambios.phone = telefono.trim()
    if (dni.trim() !== (previo.dni ?? '')) cambios.dni = dni.trim()
    if (Object.keys(cambios).length === 0) return
    // Best-effort: si falla (ej. email ya usado por otra cuenta de este
    // negocio) no hay que trabar el checkout por esto — el pedido igual
    // lleva los datos tipeados acá, solo no quedan guardados para la
    // próxima. Ver CheckoutInput.buyer / OnlineOrderDetails.buyerDni.
    meUpdateProfile(cambios).catch(() => { /* no bloquea el checkout */ })
  }

  function continuar(e: React.FormEvent) {
    e.preventDefault()
    const next = validar()
    setErrores(next)
    if (next.nombre) { nombreRef.current?.focus(); return }
    if (next.apellido) { apellidoRef.current?.focus(); return }
    if (next.email) { emailRef.current?.focus(); return }
    if (next.telefono) { telefonoRef.current?.focus(); return }
    if (next.dni) { dniRef.current?.focus(); return }
    if (slug) {
      saveCheckoutDraft(slug, {
        buyer: { name: `${nombre.trim()} ${apellido.trim()}`, email: email.trim(), phone: telefono.trim(), dni: dni.trim() },
      })
    }
    sincronizarPerfil()
    router.push(`${base}/checkout/pago`)
  }

  // Mientras se resuelve la sesión — un invitado (authStatus === 'anonymous')
  // sí ve el formulario: comprar sin cuenta es un flujo válido, ver sección
  // "Entrega 2" del plan.
  if (authStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 32px', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {config?.appearance?.logoUrl
              ? <img src={config.appearance.logoUrl} alt={tienda.nombre} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
              : <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }} />}
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</span>
          </div>
        </header>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }} aria-hidden="true">
          <CheckoutStepper step={1} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                <SkeletonText width={160} height={16} style={{ marginBottom: 16, borderRadius: 5 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Skeleton height={40} radius={8} delay={40} />
                  <Skeleton height={40} radius={8} delay={60} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Skeleton height={40} radius={8} delay={80} />
                  <Skeleton height={40} radius={8} delay={100} />
                </div>
              </div>
              <Skeleton width={130} height={40} radius={8} delay={140} style={{ alignSelf: 'flex-end' }} />
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SkeletonText width={130} height={13} />
              {[1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Skeleton width={48} height={48} radius={8} delay={i * 60} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonText width="70%" height={11} delay={i * 60 + 20} />
                    <SkeletonText width="40%" height={10} delay={i * 60 + 40} />
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              <SkeletonText width="60%" height={16} delay={180} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a className="ds-hover" href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }}>
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
          .sf-co-layout { grid-template-columns: minmax(0,1fr) !important; }
          .sf-co-aside  { position: static !important; }
          .sf-co-2col   { grid-template-columns: minmax(0,1fr) !important; }
          .sf-co-3col   { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 400px) {
          .sf-co-3col { grid-template-columns: minmax(0,1fr) !important; }
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
                  className="ds-link"
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
                <F label="Nombre" required error={errores.nombre}>
                  <I ref={nombreRef} value={nombre} onChange={campoOnChange(setNombre, 'nombre')} placeholder="María" icon={<User size={15} strokeWidth={1.5} color="var(--color-subtle)" />} error={!!errores.nombre} />
                </F>
                <F label="Apellido" required error={errores.apellido}>
                  <I ref={apellidoRef} value={apellido} onChange={campoOnChange(setApellido, 'apellido')} placeholder="Fernández" error={!!errores.apellido} />
                </F>
              </div>
              <div className="sf-co-3col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 0.9fr', gap: 14 }}>
                <F label="Email" required error={errores.email}>
                  <I ref={emailRef} type="email" value={email} onChange={campoOnChange(setEmail, 'email')} placeholder="hola@mail.com" icon={<Mail size={15} strokeWidth={1.5} color="var(--color-subtle)" />} error={!!errores.email} />
                </F>
                <F label="Teléfono (WhatsApp)" required error={errores.telefono}>
                  <I ref={telefonoRef} type="tel" value={telefono} onChange={campoOnChange(setTelefono, 'telefono')} placeholder="+54 9 11..." icon={<Phone size={15} strokeWidth={1.5} color="var(--color-subtle)" />} error={!!errores.telefono} />
                </F>
                <F label="DNI" required error={errores.dni}>
                  <I ref={dniRef} value={dni} onChange={campoOnChange(setDni, 'dni')} placeholder="30123456" icon={<IdCard size={15} strokeWidth={1.5} color="var(--color-subtle)" />} error={!!errores.dni} />
                </F>
              </div>
            </div>
            {/* La dirección de entrega (envío a domicilio vs. retiro en
                local) se eligió mover al paso 2 (Pago) — ahí tiene más
                sentido: primero se sabe SI hace falta dirección, recién
                después se pide. Ver CheckoutPago.tsx. */}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="ds-link" type="button" onClick={() => router.push(`${base}/carrito`)} style={{
                fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <ChevronLeft size={14} /> Volver al carrito
              </button>
              <button className="ds-hover" type="submit" style={{
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
            {/* precioAnt (oferta automática del producto) tachado + % real, y
                el cupón del pedido con la tasa entre paréntesis — antes acá
                no se veía NINGUNO de los dos, ni siquiera el monto final del
                cupón: esta pantalla (paso 1, "Datos") mostraba directo el
                precio ya descontado sin indicio de por qué, y ni mencionaba
                el cupón aplicado. Mismo criterio que CheckoutPago.tsx (paso
                2, con el que este estado se comparte vía useCart()). */}
            {items.map(it => {
              const enOferta = it.precioAnt != null && it.precioAnt > it.precio
              const pct = enOferta ? Math.round((1 - it.precio / it.precioAnt!) * 100) : 0
              return (
                <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center' }}>
                  <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={56} radius={8} style={{ width: 56, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div>
                      {enOferta && (
                        <span style={{
                          flexShrink: 0, display: 'inline-flex', height: 16, padding: '0 5px', borderRadius: 999,
                          background: 'var(--color-error-bg)', color: 'var(--color-error)',
                          fontSize: 9.5, fontWeight: 700, alignItems: 'center',
                        }}>−{pct}%</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>x{it.qty}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(it.precio * it.qty)}</div>
                    {enOferta && (
                      <div style={{ fontSize: 11, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>
                        {fmt(it.precioAnt! * it.qty)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--color-body)' }}>Subtotal</span>
                <span style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(subtotal)}</span>
              </div>
              {descuentoTicket && descuentoTicket.monto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, gap: 8 }}>
                  <span style={{ color: 'var(--color-body)' }}>
                    Descuento: {descuentoTicket.nombre} ({descuentoTicket.esPorcentaje ? `${descuentoTicket.valor}%` : fmt(descuentoTicket.valor)})
                  </span>
                  <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>−{fmt(descuentoTicket.monto)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{descuentoTicket && descuentoTicket.monto > 0 ? 'Total' : 'Subtotal'}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                  {fmt(Math.max(0, subtotal - (descuentoTicket?.monto ?? 0)))}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function F({ label, required, error, children, style }: { label: string; required?: boolean; error?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--color-error)' }}>{error}</span>}
    </div>
  )
}

const I = forwardRef<HTMLInputElement, { placeholder?: string; type?: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void; error?: boolean }>(
  function I({ placeholder, type = 'text', icon, value, onChange, error }, ref) {
    return (
      <div style={{ position: 'relative' }}>
        {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
        <input ref={ref} className={error ? undefined : 'ds-field'} type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{
          width: '100%', height: 44, padding: `0 14px 0 ${icon ? 40 : 14}px`,
          borderRadius: 8, border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }} />
      </div>
    )
  }
)
