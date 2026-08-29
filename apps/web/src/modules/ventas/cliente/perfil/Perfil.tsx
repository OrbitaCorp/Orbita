import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Package, MapPin, User, Lock, LogOut,
  ChevronRight, Eye, EyeOff, ShieldCheck, MessageCircle,
  CheckCircle2, Store, Gift,
} from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { MensajesCliente } from './components/MensajesCliente'
import { DireccionesTab } from './components/DireccionesTab'
import { DateInput } from '../../_shared/components'
import { fmt } from '@/lib/storefront/utils'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import {
  meGetProfile, meUpdateProfile, meChangePassword, meUploadAvatar,
  meListOrders, meListSessions, meRevokeSession, meRevokeAllSessions,
  type MeProfile, type MeOrderRow, type MeSession,
} from '@/lib/api'
import { SkeletonText, SkeletonChip } from '@/design-system/components/Skeleton'

type Tab = 'pedidos' | 'mensajes' | 'direcciones' | 'datos' | 'seguridad'

const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'pedidos',     Icon: Package,       label: 'Mis pedidos'      },
  { id: 'mensajes',    Icon: MessageCircle, label: 'Mensajes'         },
  { id: 'direcciones', Icon: MapPin,        label: 'Mis direcciones'  },
  { id: 'datos',       Icon: User,          label: 'Datos personales' },
  { id: 'seguridad',   Icon: Lock,          label: 'Seguridad'        },
]

const TAB_IDS: Tab[] = TABS.map(t => t.id)

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

// Mismo layout de la fila real (grid 1fr/auto/auto: número+estado / fecha,
// total a la derecha), para que el "parpadeo" al terminar de cargar sea de
// contenido y no de forma.
function PedidoRowSkeleton({ filas = 4 }: { filas?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: filas }).map((_, i) => {
        const d = i * 90
        return (
          <div
            key={i}
            style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              alignItems: 'center', gap: 16,
              padding: '18px 24px',
              borderBottom: i < filas - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <SkeletonText width={64} height={14} delay={d} />
                <SkeletonChip width={80} delay={d + 30} />
              </div>
              <SkeletonText width={150} height={11} delay={d + 60} />
            </div>
            <SkeletonText width={66} height={15} delay={d + 90} />
            <div style={{ width: 16 }} />
          </div>
        )
      })}
    </div>
  )
}

export default function Perfil() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { user, logout, updateAvatar } = useAuth()

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }
  // Vidriera digital: no hay mensajería en el storefront (backend la
  // bloquea, ver FullModeOnly en conversations.controller.ts) — se saca la
  // pestaña entera en vez de dejarla y que tire error al abrirla.
  const esVidriera = config?.business?.mode === 'SHOWCASE'
  const tabsVisibles = esVidriera ? TABS.filter(t => t.id !== 'mensajes') : TABS

  // La pestaña inicial puede venir del query (?tab=), para el deep-link del menú
  // de cuenta del header. `pedidos` es el default seguro mientras el query se
  // hidrata (router.query llega vacío en el primer render de Next).
  const tabQuery = router.query.tab
  const tabInicial: Tab = typeof tabQuery === 'string' && (TAB_IDS as string[]).includes(tabQuery) ? (tabQuery as Tab) : 'pedidos'
  const [tab, setTab] = useState<Tab>(tabInicial)
  useEffect(() => {
    if (typeof tabQuery === 'string' && (TAB_IDS as string[]).includes(tabQuery)) setTab(tabQuery as Tab)
  }, [tabQuery])
  // Si un deep-link viejo (?tab=mensajes, ej. un link guardado de antes de
  // pasar a vidriera) cae acá, no hay nada que mostrar — vuelve a Pedidos.
  useEffect(() => {
    if (esVidriera && tab === 'mensajes') setTab('pedidos')
  }, [esVidriera, tab])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  // ── Datos reales ──────────────────────────────────────────────────────────
  const [perfil, setPerfil] = useState<MeProfile | null>(null)
  const [pedidos, setPedidos] = useState<MeOrderRow[]>([])
  const [pedidosCargando, setPedidosCargando] = useState(true)
  // Paginado del lado del cliente: meListOrders() ya trae el historial
  // completo de una (no hay demasiados pedidos por cliente como para
  // justificar paginado real del backend, a diferencia de las listas del
  // panel) — acá solo se corta la vista.
  const PEDIDOS_POR_PAGINA = 5
  const [paginaPedidos, setPaginaPedidos] = useState(1)
  const [resumen, setResumen] = useState<{ cantidadPedidos: number; totalGastado: number }>({ cantidadPedidos: 0, totalGastado: 0 })
  const desdePedido = pedidos.length === 0 ? 0 : (paginaPedidos - 1) * PEDIDOS_POR_PAGINA + 1
  const hastaPedido = Math.min(paginaPedidos * PEDIDOS_POR_PAGINA, pedidos.length)
  const pedidosPagina = pedidos.slice((paginaPedidos - 1) * PEDIDOS_POR_PAGINA, paginaPedidos * PEDIDOS_POR_PAGINA)
  const [sesiones, setSesiones] = useState<MeSession[]>([])

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
    meListOrders().then((r) => { setPedidos(r.data); setResumen(r.resumen) }).catch(() => {}).finally(() => setPedidosCargando(false))
  }, [])

  useEffect(() => { if (tab === 'seguridad') recargarSesiones() }, [tab, recargarSesiones])

  // Un dueño puede navegar su propia tienda logueado como cliente (sesión de
  // panel y de customer conviven en cookies separadas, ver bff.ts) — si
  // detectamos una sesión de panel viva en este navegador, mostramos el
  // atajo "Panel de administrador". Chequeo de sola-presencia (no rota nada,
  // no valida contra el backend): un cliente real, sin esa cookie, nunca ve
  // el ítem.
  const [tienePanel, setTienePanel] = useState(false)
  useEffect(() => {
    fetch('/api/auth/has-session?channel=panel')
      .then(r => r.json())
      .then((d: { exists?: boolean }) => setTienePanel(!!d.exists))
      .catch(() => {})
  }, [])

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
      updateAvatar(avatarUrl) // refleja la foto nueva en el header de inmediato, sin recargar
    } catch (err) {
      setErrorDatos(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.')
    }
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
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

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
            {tabsVisibles.map((t, i) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  className="ds-hover"
                  onClick={() => setTab(t.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 16px', fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-primary)' : 'var(--color-body)',
                    background: active ? 'var(--color-primary-bg)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    borderRight: 'none', borderBottom: 'none',
                    textAlign: 'left', transition: 'all 150ms',
                  }}
                >
                  <t.Icon size={15} strokeWidth={1.5} />
                  {t.label}
                </button>
              )
            })}
            {tienePanel && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <button
                  className="ds-hover"
                  onClick={() => { window.location.href = '/panel' }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 16px', fontSize: 13, fontWeight: 500,
                    color: 'var(--color-primary)', background: 'transparent',
                    border: 'none', borderLeft: '3px solid transparent',
                    textAlign: 'left',
                  }}
                >
                  <Store size={15} strokeWidth={1.5} />
                  Panel de administrador
                </button>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                className="ds-hover"
                onClick={handleCerrarSesion}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px', fontSize: 13, fontWeight: 500,
                  color: 'var(--color-error)', background: 'transparent',
                  border: 'none', borderLeft: '3px solid transparent',
                  textAlign: 'left',
                }}
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
                  {pedidosCargando
                    ? <SkeletonText width={130} height={12} delay={0} style={{ marginTop: 6 }} />
                    : <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>{resumen.cantidadPedidos} pedido{resumen.cantidadPedidos === 1 ? '' : 's'} en tu historial</div>}
                </div>
                {pedidosCargando && <PedidoRowSkeleton />}
                {!pedidosCargando && pedidos.length === 0 && (
                  <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>
                    Todavía no tenés pedidos.
                  </div>
                )}
                {!pedidosCargando && pedidosPagina.map((p, i) => {
                  const est = ESTADO_PEDIDO[p.status] ?? { label: p.status, tipo: 'neutral' as const }
                  const st = ESTADO_STYLE[est.tipo]
                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`${base}/pedido/${p.id}`)}
                      className="ds-hover sf-prf-pedido-row"
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto',
                        alignItems: 'center', gap: 16,
                        padding: '18px 24px',
                        borderBottom: i < pedidosPagina.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
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
                        {/* Sin esto, un pedido con devolución ya aprobada se
                            veía exactamente igual que cualquier otro en la
                            lista — había que entrar al detalle para
                            enterarse de que tenía saldo a favor generado. */}
                        {p.devolucionAprobada && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 9px', borderRadius: 999, background: '#DCFCE7', fontSize: 11, fontWeight: 700, color: '#16A34A' }}>
                            <Gift size={11} strokeWidth={2} />
                            Devolución aprobada{p.notaCreditoMonto > 0 ? ` · ${fmt(p.notaCreditoMonto)} a favor` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>
                        {fmt(p.total)}
                      </div>
                      <ChevronRight className="sf-prf-pedido-chev" size={16} color="var(--color-subtle)" />
                    </div>
                  )
                })}
                {!pedidosCargando && pedidos.length > PEDIDOS_POR_PAGINA && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                      Mostrando <strong style={{ color: 'var(--color-text)' }}>{desdePedido}–{hastaPedido}</strong> de <strong style={{ color: 'var(--color-text)' }}>{pedidos.length}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setPaginaPedidos(n => Math.max(1, n - 1))}
                        disabled={paginaPedidos <= 1}
                        style={{
                          height: 34, padding: '0 14px', borderRadius: 8,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                          color: paginaPedidos <= 1 ? 'var(--color-subtle)' : 'var(--color-text)',
                          fontSize: 12.5, fontWeight: 600, cursor: paginaPedidos <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ‹ Anterior
                      </button>
                      <button
                        onClick={() => setPaginaPedidos(n => n + 1)}
                        disabled={hastaPedido >= pedidos.length}
                        style={{
                          height: 34, padding: '0 14px', borderRadius: 8,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                          color: hastaPedido >= pedidos.length ? 'var(--color-subtle)' : 'var(--color-text)',
                          fontSize: 12.5, fontWeight: 600, cursor: hastaPedido >= pedidos.length ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Siguiente ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ MENSAJES ══ */}
            {!esVidriera && tab === 'mensajes' && <MensajesCliente />}

            {/* ══ DIRECCIONES ══ */}
            {tab === 'direcciones' && <DireccionesTab />}

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
                    <label className="ds-hover" style={{ height: 34, padding: '0 14px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                      Cambiar imagen
                      <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <FI label="Nombre">
                    <input className="ds-field" value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
                  </FI>
                  <FI label="Apellido">
                    <input className="ds-field" value={apellido} onChange={e => setApellido(e.target.value)} style={inputStyle} />
                  </FI>
                </div>
                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <FI label="Email">
                    <input className="ds-field" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                  </FI>
                  <FI label="Teléfono">
                    <input className="ds-field" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} style={inputStyle} />
                  </FI>
                </div>
                <div className="sf-prf-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <FI label="Fecha de nacimiento">
                    <DateInput className="ds-field" value={fechaNac} onChange={setFechaNac} style={inputStyle} />
                  </FI>
                  <FI label="DNI / CUIL (opcional)">
                    <input className="ds-field" value={dni} onChange={e => setDni(e.target.value)} placeholder="20-12345678-3" style={inputStyle} />
                  </FI>
                </div>

                {errorDatos && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)', marginBottom: 16 }}>{errorDatos}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="submit" className="ds-hover" disabled={guardandoDatos} style={{ height: 42, padding: '0 22px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: guardandoDatos ? 'default' : 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.25)', opacity: guardandoDatos ? 0.7 : 1 }}>
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
                        <input className="ds-field" type={showPass ? 'text' : 'password'} value={passActual} onChange={e => setPassActual(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, paddingRight: 40 }} />
                        <button type="button" className="ds-hover" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-subtle)', display: 'grid', placeItems: 'center' }}>
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </FI>
                    <FI label="Nueva contraseña">
                      <input className="ds-field" type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    </FI>
                    <FI label="Confirmar nueva contraseña">
                      <input className="ds-field" type="password" value={passConfirmar} onChange={e => setPassConfirmar(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    </FI>
                  </div>
                  {passMsg && (
                    <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: passMsg.tipo === 'ok' ? '#16A34A' : 'var(--color-error)' }}>{passMsg.texto}</div>
                  )}
                  <button type="submit" className="ds-hover" disabled={cambiandoPass} style={{ marginTop: 20, height: 42, padding: '0 22px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: cambiandoPass ? 'default' : 'pointer', opacity: cambiandoPass ? 0.7 : 1 }}>
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
                        <button className="ds-hover" onClick={() => handleRevocarSesion(s.id)} style={{ height: 30, padding: '0 12px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-error)', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          Cerrar
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="ds-hover"
                    onClick={handleCerrarTodas}
                    style={{ marginTop: 16, height: 38, padding: '0 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <LogOut size={14} strokeWidth={1.5} /> Cerrar sesión en todos los dispositivos
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
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
