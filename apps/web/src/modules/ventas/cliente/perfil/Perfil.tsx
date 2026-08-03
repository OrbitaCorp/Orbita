import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Package, MapPin, User, Lock, LogOut,
  ChevronRight, Plus, Pencil, Trash2, CheckCircle2,
  Eye, EyeOff, ShieldCheck, MessageCircle,
} from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { MensajesCliente } from './components/MensajesCliente'
import { TIENDA, CARRITO_INICIAL } from '@/lib/storefront/mock'
import { fmt } from '@/lib/storefront/utils'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import {
  meGetProfile, meUpdateProfile, meChangePassword, meUploadAvatar,
  meListAddresses, meCreateAddress, meUpdateAddress, meDeleteAddress,
  meListOrders, meListSessions, meRevokeSession, meRevokeAllSessions,
  type MeProfile, type MeAddress, type MeAddressInput, type MeOrderRow, type MeSession,
} from '@/lib/api'

type Tab = 'pedidos' | 'mensajes' | 'direcciones' | 'datos' | 'seguridad'

const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'pedidos',     Icon: Package,       label: 'Mis pedidos'      },
  { id: 'mensajes',    Icon: MessageCircle, label: 'Mensajes'         },
  { id: 'direcciones', Icon: MapPin,        label: 'Mis direcciones'  },
  { id: 'datos',       Icon: User,          label: 'Datos personales' },
  { id: 'seguridad',   Icon: Lock,          label: 'Seguridad'        },
]

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  success: { bg: '#DCFCE7', color: '#16A34A' },
  warning: { bg: '#FEF9C3', color: '#CA8A04' },
  error:   { bg: '#FEE2E2', color: '#DC2626' },
  neutral: { bg: 'var(--color-surface)', color: 'var(--color-muted)' },
}

// El backend devuelve el estado crudo (enum OrderStatus); acá lo traducimos a la
// etiqueta en español + el bucket de color, como el resto de las pantallas.
const ESTADO_PEDIDO: Record<string, { label: string; tipo: keyof typeof ESTADO_STYLE }> = {
  PENDING:   { label: 'Pendiente',      tipo: 'warning' },
  CONFIRMED: { label: 'Confirmado',     tipo: 'neutral' },
  PREPARING: { label: 'En preparación', tipo: 'warning' },
  SHIPPED:   { label: 'Enviado',        tipo: 'neutral' },
  DELIVERED: { label: 'Entregado',      tipo: 'success' },
  COMPLETED: { label: 'Completado',     tipo: 'success' },
  CANCELLED: { label: 'Cancelado',      tipo: 'error'   },
}

function iniciales(firstName?: string, lastName?: string | null): string {
  const a = (firstName ?? '').trim()[0] ?? ''
  const b = (lastName ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase() || 'U'
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DIR_VACIA: MeAddressInput = { alias: '', street: '', floor: '', depto: '', entreCalles: '', provincia: '', city: '', zip: '', isDefault: false }

export default function Perfil() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { user, logout } = useAuth()

  const [tab, setTab] = useState<Tab>('pedidos')
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  // ── Datos reales ──────────────────────────────────────────────────────────
  const [perfil, setPerfil] = useState<MeProfile | null>(null)
  const [pedidos, setPedidos] = useState<MeOrderRow[]>([])
  const [resumen, setResumen] = useState<{ cantidadPedidos: number; totalGastado: number }>({ cantidadPedidos: 0, totalGastado: 0 })
  const [direcciones, setDirecciones] = useState<MeAddress[]>([])
  const [sesiones, setSesiones] = useState<MeSession[]>([])

  const recargarDirecciones = useCallback(() => { meListAddresses().then(setDirecciones).catch(() => {}) }, [])
  const recargarSesiones = useCallback(() => { meListSessions().then(setSesiones).catch(() => {}) }, [])

  useEffect(() => {
    meGetProfile().then((p) => {
      setPerfil(p)
      setNombre(p.firstName ?? '')
      setApellido(p.lastName ?? '')
      setEmail(p.email ?? '')
      setTelefono(p.phone ?? '')
      setDni(p.dni ?? '')
      setFechaNac(p.birthDate ? p.birthDate.slice(0, 10) : '')
    }).catch(() => {})
    meListOrders().then((r) => { setPedidos(r.data); setResumen(r.resumen) }).catch(() => {})
    recargarDirecciones()
  }, [recargarDirecciones])

  useEffect(() => { if (tab === 'seguridad') recargarSesiones() }, [tab, recargarSesiones])

  // ── Datos personales ──────────────────────────────────────────────────────
  const [nombre, setNombre]     = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail]       = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni]           = useState('')
  const [fechaNac, setFechaNac] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [errorDatos, setErrorDatos] = useState('')
  const [guardandoDatos, setGuardandoDatos] = useState(false)

  async function handleGuardarDatos(e: React.FormEvent) {
    e.preventDefault()
    setErrorDatos('')
    setGuardandoDatos(true)
    try {
      const p = await meUpdateProfile({
        firstName: nombre, lastName: apellido || null, email: email || null,
        phone: telefono || null, dni: dni || null, birthDate: fechaNac || null,
      })
      setPerfil(p)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (err) {
      setErrorDatos(err instanceof ApiError ? err.message : 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { avatarUrl } = await meUploadAvatar(file)
      setPerfil((prev) => (prev ? { ...prev, avatarUrl } : prev))
    } catch (err) {
      setErrorDatos(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.')
    }
  }

  // ── Direcciones ───────────────────────────────────────────────────────────
  const [dirForm, setDirForm] = useState<MeAddressInput>(DIR_VACIA)
  const [editId, setEditId] = useState<string | null>(null)
  const [showDirForm, setShowDirForm] = useState(false)
  const [guardadoDir, setGuardadoDir] = useState(false)
  const [errorDir, setErrorDir] = useState('')

  function abrirNuevaDir() { setDirForm(DIR_VACIA); setEditId(null); setErrorDir(''); setShowDirForm(true) }
  function abrirEditarDir(d: MeAddress) {
    setDirForm({
      alias: d.alias ?? '', street: d.street, floor: d.floor ?? '', depto: d.depto ?? '',
      entreCalles: d.entreCalles ?? '', provincia: d.provincia ?? '', city: d.city, zip: d.zip ?? '', isDefault: d.isDefault,
    })
    setEditId(d.id); setErrorDir(''); setShowDirForm(true)
  }
  const setDF = (k: keyof MeAddressInput) => (v: string | boolean) => setDirForm((f) => ({ ...f, [k]: v }))

  async function handleGuardarDir(e: React.FormEvent) {
    e.preventDefault()
    setErrorDir('')
    if (!dirForm.street.trim() || !dirForm.city.trim()) { setErrorDir('La calle y la ciudad son obligatorias.'); return }
    try {
      // El backend solo acepta strings no vacíos; los vacíos se mandan como undefined.
      const input: MeAddressInput = {
        alias: dirForm.alias || undefined, street: dirForm.street, floor: dirForm.floor || undefined,
        depto: dirForm.depto || undefined, entreCalles: dirForm.entreCalles || undefined,
        provincia: dirForm.provincia || undefined, city: dirForm.city, zip: dirForm.zip || undefined,
        isDefault: dirForm.isDefault,
      }
      if (editId) await meUpdateAddress(editId, input)
      else await meCreateAddress(input)
      setShowDirForm(false)
      recargarDirecciones()
      setGuardadoDir(true)
      setTimeout(() => setGuardadoDir(false), 2500)
    } catch (err) {
      setErrorDir(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección.')
    }
  }

  async function handleBorrarDir(id: string) {
    try { await meDeleteAddress(id); recargarDirecciones() } catch { /* noop */ }
  }

  // ── Seguridad: contraseña + sesiones ──────────────────────────────────────
  const [showPass, setShowPass] = useState(false)
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirmar, setPassConfirmar] = useState('')
  const [passMsg, setPassMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cambiandoPass, setCambiandoPass] = useState(false)

  async function handleCambiarPass(e: React.FormEvent) {
    e.preventDefault()
    setPassMsg(null)
    if (passNueva.length < 8) { setPassMsg({ tipo: 'error', texto: 'La nueva contraseña debe tener al menos 8 caracteres.' }); return }
    if (passNueva !== passConfirmar) { setPassMsg({ tipo: 'error', texto: 'Las contraseñas nuevas no coinciden.' }); return }
    setCambiandoPass(true)
    try {
      await meChangePassword({ currentPassword: passActual, newPassword: passNueva })
      setPassActual(''); setPassNueva(''); setPassConfirmar('')
      setPassMsg({ tipo: 'ok', texto: 'Contraseña actualizada.' })
    } catch (err) {
      setPassMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.' })
    } finally {
      setCambiandoPass(false)
    }
  }

  async function handleCerrarSesion() {
    await logout()
    router.push(`${base}/login`)
  }

  async function handleRevocarSesion(id: string) {
    try { await meRevokeSession(id); recargarSesiones() } catch { /* noop */ }
  }

  async function handleCerrarTodas() {
    // Cierra todas las sesiones (incluida esta, porque el token de refresh vive
    // en una cookie httpOnly que el frontend no puede reenviar como "actual") y
    // te manda al login. Ver PENDIENTES.md.
    try { await meRevokeAllSessions() } catch { /* noop */ }
    await handleCerrarSesion()
  }

  const nombreCompleto = `${nombre}${apellido ? ` ${apellido}` : ''}`.trim() || (user?.type === 'customer' ? user.customer.firstName : '')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-prf-wrap        { padding: 20px 16px 48px !important; }
          .sf-prf-hero        { padding: 20px !important; flex-direction: column !important; gap: 16px !important; }
          .sf-prf-hero-stats  { width: 100% !important; justify-content: flex-start !important; gap: 32px !important; }
          .sf-prf-layout      { grid-template-columns: 1fr !important; }
          .sf-prf-sidebar     { position: static !important; display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; gap: 0 !important; overflow: hidden !important; }
          .sf-prf-sidebar button { border-top: none !important; border-right: 1px solid var(--color-border) !important; flex: 1 1 auto !important; padding: 10px 8px !important; font-size: 12px !important; }
          .sf-prf-sidebar button:last-child { border-right: none !important; }
          .sf-prf-2col        { grid-template-columns: 1fr !important; }
          .sf-prf-3col        { grid-template-columns: 1fr !important; }
          .sf-prf-pedido-row  { grid-template-columns: 1fr auto !important; }
          .sf-prf-pedido-chev { display: none !important; }
        }
      `}</style>
      <StorefrontHeader tienda={TIENDA} carrito={CARRITO_INICIAL} logged />

      <div className="sf-prf-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>

        {/* ── Hero del perfil ── */}
        <div className="sf-prf-hero" style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 60%, #3B82F6 100%)',
          borderRadius: 16, padding: '32px 36px', marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'linear-gradient(135deg, #F472B6, #FB923C)',
            color: '#fff', fontSize: 24, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
          }}>
            {perfil?.avatarUrl
              ? <img src={perfil.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : iniciales(nombre, apellido)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              {nombreCompleto}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{email}</div>
          </div>
          <div className="sf-prf-hero-stats" style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'Pedidos',       value: resumen.cantidadPedidos },
              { label: 'Total gastado', value: fmt(resumen.totalGastado) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: '"Geist Mono", monospace' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Layout sidebar + contenido ── */}
        <div className="sf-prf-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start' }}>

          {/* Sidebar nav */}
          <div className="sf-prf-sidebar" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 80 }}>
            {TABS.map((t, i) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 16px', fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-primary)' : 'var(--color-body)',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    borderRight: 'none', borderBottom: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
                  }}
                >
                  <t.Icon size={15} strokeWidth={1.5} />
                  {t.label}
                </button>
              )
            })}
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={handleCerrarSesion}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px', fontSize: 13, fontWeight: 500,
                  color: 'var(--color-error)', background: 'transparent',
                  border: 'none', borderLeft: '3px solid transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={15} strokeWidth={1.5} />
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div style={{ minHeight: 600 }}>

            {/* ══ PEDIDOS ══ */}
            {tab === 'pedidos' && (
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Mis pedidos</div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>{resumen.cantidadPedidos} pedido{resumen.cantidadPedidos === 1 ? '' : 's'} en tu historial</div>
                </div>
                {pedidos.length === 0 && (
                  <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                    Todavía no tenés pedidos.
                  </div>
                )}
                {pedidos.map((p, i) => {
                  const est = ESTADO_PEDIDO[p.status] ?? { label: p.status, tipo: 'neutral' as const }
                  const st = ESTADO_STYLE[est.tipo]
                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`${base}/pedido/${p.id}`)}
                      className="sf-prf-pedido-row"
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto',
                        alignItems: 'center', gap: 16,
                        padding: '18px 24px', cursor: 'pointer',
                        borderBottom: i < pedidos.length - 1 ? '1px solid var(--color-border)' : 'none',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{p.orderNumber}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: st.bg, color: st.color }}>
                            {est.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          {fechaCorta(p.createdAt)} · {p.itemCount} producto{p.itemCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>
                        {fmt(p.total)}
                      </div>
                      <ChevronRight className="sf-prf-pedido-chev" size={16} color="var(--color-subtle)" />
                    </div>
                  )
                })}
              </div>
            )}

            {/* ══ MENSAJES ══ */}
            {tab === 'mensajes' && <MensajesCliente />}

            {/* ══ DIRECCIONES ══ */}
            {tab === 'direcciones' && (
              <div>
                {guardadoDir && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
                    <CheckCircle2 size={15} /> Dirección guardada correctamente
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  {direcciones.length === 0 && !showDirForm && (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
                      Todavía no cargaste ninguna dirección.
                    </div>
                  )}
                  {direcciones.map(d => (
                    <div
                      key={d.id}
                      style={{
                        background: 'var(--color-bg)', border: `2px solid ${d.isDefault ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 12, padding: '16px 20px',
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: d.isDefault ? 'var(--color-primary-bg)' : 'var(--color-surface)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <MapPin size={16} strokeWidth={1.5} color={d.isDefault ? 'var(--color-primary)' : 'var(--color-muted)'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{d.alias || 'Dirección'}</span>
                          {d.isDefault && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
                          {d.street}{d.floor ? ` · Piso ${d.floor}` : ''}{d.depto ? ` · Depto ${d.depto}` : ''}<br />
                          {d.city}{d.provincia ? `, ${d.provincia}` : ''}{d.zip ? ` · CP ${d.zip}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => abrirEditarDir(d)} style={{ height: 32, padding: '0 12px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Pencil size={12} strokeWidth={1.5} /> Editar
                        </button>
                        <button onClick={() => handleBorrarDir(d.id)} aria-label="Eliminar dirección" style={{ height: 32, width: 32, borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-error)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {!showDirForm ? (
                  <button
                    onClick={abrirNuevaDir}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 10, background: 'var(--color-bg)', border: '1px dashed var(--color-border)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 150ms' }}
                  >
                    <Plus size={15} strokeWidth={2} /> Agregar nueva dirección
                  </button>
                ) : (
                  <form onSubmit={handleGuardarDir} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>{editId ? 'Editar dirección' : 'Nueva dirección'}</div>
                    {errorDir && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)', marginBottom: 14 }}>{errorDir}</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <FI label="Alias (ej: Casa, Trabajo)"><input value={dirForm.alias} onChange={e => setDF('alias')(e.target.value)} placeholder="Mi casa" style={inputStyle} /></FI>
                      <FI label="Calle y número"><input value={dirForm.street} onChange={e => setDF('street')(e.target.value)} placeholder="Av. Corrientes 1234" style={inputStyle} /></FI>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                        <FI label="Piso"><input value={dirForm.floor} onChange={e => setDF('floor')(e.target.value)} placeholder="3" style={inputStyle} /></FI>
                        <FI label="Depto"><input value={dirForm.depto} onChange={e => setDF('depto')(e.target.value)} placeholder="A" style={inputStyle} /></FI>
                        <FI label="Entre calles"><input value={dirForm.entreCalles} onChange={e => setDF('entreCalles')(e.target.value)} placeholder="Opcional" style={inputStyle} /></FI>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                        <FI label="Ciudad"><input value={dirForm.city} onChange={e => setDF('city')(e.target.value)} placeholder="CABA" style={inputStyle} /></FI>
                        <FI label="Provincia"><input value={dirForm.provincia} onChange={e => setDF('provincia')(e.target.value)} placeholder="Buenos Aires" style={inputStyle} /></FI>
                        <FI label="CP"><input value={dirForm.zip} onChange={e => setDF('zip')(e.target.value)} placeholder="C1043" style={inputStyle} /></FI>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!dirForm.isDefault} onChange={e => setDF('isDefault')(e.target.checked)} />
                        Usar como dirección predeterminada
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                      <button type="submit" style={{ height: 40, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Guardar dirección</button>
                      <button type="button" onClick={() => setShowDirForm(false)} style={{ height: 40, padding: '0 16px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, border: '1px solid var(--color-border)', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ══ DATOS PERSONALES ══ */}
            {tab === 'datos' && (
              <form onSubmit={handleGuardarDatos} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 28 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Datos personales</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>Tu información de contacto y cuenta.</div>

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #F472B6, #FB923C)', color: '#fff', fontSize: 22, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {perfil?.avatarUrl
                      ? <img src={perfil.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : iniciales(nombre, apellido)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Foto de perfil</div>
                    <label style={{ height: 34, padding: '0 14px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                      Cambiar imagen
                      <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <FI label="Nombre">
                    <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
                  </FI>
                  <FI label="Apellido">
                    <input value={apellido} onChange={e => setApellido(e.target.value)} style={inputStyle} />
                  </FI>
                </div>
                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <FI label="Email">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                  </FI>
                  <FI label="Teléfono">
                    <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} style={inputStyle} />
                  </FI>
                </div>
                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <FI label="Fecha de nacimiento">
                    <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} style={inputStyle} />
                  </FI>
                  <FI label="DNI / CUIL (opcional)">
                    <input value={dni} onChange={e => setDni(e.target.value)} placeholder="20-12345678-3" style={inputStyle} />
                  </FI>
                </div>

                {errorDatos && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)', marginBottom: 16 }}>{errorDatos}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="submit" disabled={guardandoDatos} style={{ height: 42, padding: '0 22px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: guardandoDatos ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.25)', opacity: guardandoDatos ? 0.7 : 1 }}>
                    {guardandoDatos ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  {guardado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                      <CheckCircle2 size={15} /> Guardado correctamente
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* ══ SEGURIDAD ══ */}
            {tab === 'seguridad' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Cambiar contraseña */}
                <form onSubmit={handleCambiarPass} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>Cambiar contraseña</div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>Usá una contraseña segura de al menos 8 caracteres.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <FI label="Contraseña actual">
                      <div style={{ position: 'relative' }}>
                        <input type={showPass ? 'text' : 'password'} value={passActual} onChange={e => setPassActual(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: 40 }} />
                        <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)', display: 'grid', placeItems: 'center' }}>
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </FI>
                    <FI label="Nueva contraseña">
                      <input type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    </FI>
                    <FI label="Confirmar nueva contraseña">
                      <input type="password" value={passConfirmar} onChange={e => setPassConfirmar(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    </FI>
                  </div>
                  {passMsg && (
                    <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: passMsg.tipo === 'ok' ? '#16A34A' : 'var(--color-error)' }}>{passMsg.texto}</div>
                  )}
                  <button type="submit" disabled={cambiandoPass} style={{ marginTop: 20, height: 42, padding: '0 22px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: cambiandoPass ? 'default' : 'pointer', opacity: cambiandoPass ? 0.7 : 1 }}>
                    {cambiandoPass ? 'Actualizando…' : 'Actualizar contraseña'}
                  </button>
                </form>

                {/* Sesiones activas */}
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <ShieldCheck size={18} strokeWidth={1.5} color="var(--color-success)" />
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Sesiones activas</div>
                  </div>
                  {sesiones.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '4px 0' }}>No hay sesiones activas para mostrar.</div>
                  )}
                  {sesiones.map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                            {s.deviceInfo?.userAgent ?? 'Dispositivo desconocido'}
                          </span>
                          {s.isCurrent && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>Esta sesión</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                          {s.deviceInfo?.ip ? `IP ${s.deviceInfo.ip} · ` : ''}Inició {fechaCorta(s.createdAt)}
                        </div>
                      </div>
                      {!s.isCurrent && (
                        <button onClick={() => handleRevocarSesion(s.id)} style={{ height: 30, padding: '0 12px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-error)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                          Cerrar
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleCerrarTodas}
                    style={{ marginTop: 16, height: 38, padding: '0 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <LogOut size={14} strokeWidth={1.5} /> Cerrar sesión en todos los dispositivos
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <StorefrontFooter tienda={TIENDA} slug={slug} />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

function FI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  )
}
