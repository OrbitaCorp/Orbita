import { useState, Fragment, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode, Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/router'
import {
  Check, ChevronLeft, ChevronRight,
  Banknote, Landmark, QrCode, CreditCard,
  User, Users, UsersRound, Building2,
  Camera, Info, MapPin, Globe, LocateFixed,
  ShoppingCart, Eye, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { Skeleton } from '@/design-system/components/Skeleton'
import { OrbiPanel } from '@/components/orbi/OrbiPanel'
import { OrbiNudge } from '@/components/orbi/OrbiNudge'
import { OrbiIcon } from '@/components/orbi/OrbiIcon'
import { useOrbiStore } from '@/components/orbi/useOrbiStore'
import { useOrbiKeyboardShortcut } from '@/components/orbi/useOrbiKeyboardShortcut'
import { useOrbiContext } from '@/components/orbi/useOrbiContext'
import { setWizardContext } from '@/components/orbi/useOrbiContext'
import { useOrbiSafeArea } from '@/components/orbi/useOrbiSafeArea'
import { useInactivityDetector } from '@/components/orbi/useInactivityDetector'
import { MapPicker } from '@/components/MapPicker'
import { checkSubdomain, checkEmail } from '@/lib/api'
import { useOnboardingStore } from './useOnboardingStore'
import { LegalModal } from './LegalModal'
import type { LegalKey } from '@/modules/landing/components/ui/LegalModal'

// ─── Public types ─────────────────────────────────────────────────────────────

export type PrimerPasoProps = {
  seleccion: string[]
  toggle: (k: string) => void
}

export type SetupUnificadoProps = {
  /** Label del primer paso en la barra de progreso, ej: "Tipo de tienda" */
  primerPasoLabel: string
  /** Componente que renderiza el primer paso (el que varía por rubro) */
  PrimerPaso: React.FC<PrimerPasoProps>
  /**
   * Lógica custom de toggle para el primer paso.
   * Por defecto: simple add/remove.
   * Tienda necesita lógica especial para "de todo un poco".
   */
  toggleFn?: (prev: string[], key: string) => string[]
  /** Si true, agrega el paso "Tu equipo" al final (usado por turnos) */
  conEquipo?: boolean
  /** Si true, agrega en "Tu negocio" la elección ecommerce/vidriera digital (exclusivo de tienda) */
  conModoVenta?: boolean
  /** Ruta de redirección al finalizar */
  successPath: string
  /** Opciones del primer paso (subrubros/servicios) para contexto de Orbi */
  firstStepOptions?: { key: string; label: string; description?: string }[]
}

// ─── Internal types ───────────────────────────────────────────────────────────

type ModoVenta = 'ecommerce' | 'vidriera' | ''

type Negocio = {
  nombre:     string
  descripcion:string
  telefono:   string
  direccion:  string
  logo:       string
  latLng:     [number, number]
  subdominio: string
  tipoLocal:  ('fisico' | 'online')[]
  modoVenta:  ModoVenta
}

const BA: [number, number] = [-34.6037, -58.3816]

const METODOS: { key: string; Icon: LucideIcon; label: string; desc: string }[] = [
  { key: 'efectivo',      Icon: Banknote,   label: 'Efectivo',         desc: 'Pagos en mano al momento de la entrega o turno' },
  { key: 'transferencia', Icon: Landmark,   label: 'Transferencia',    desc: 'CBU/CVU o alias de cuenta bancaria'             },
  { key: 'mercadopago',   Icon: QrCode,     label: 'MercadoPago / QR', desc: 'Código QR o link de pago'                      },
  { key: 'tarjeta',       Icon: CreditCard, label: 'Tarjeta',          desc: 'Débito y crédito con o sin cuotas'             },
]

const TAMANOS: { key: string; Icon: LucideIcon; label: string; desc: string }[] = [
  { key: 'solo',   Icon: User,       label: 'Solo/a yo',       desc: 'Trabajo de forma independiente'       },
  { key: 'mini',   Icon: Users,      label: '2 a 3 personas',  desc: 'Pequeño equipo de profesionales'      },
  { key: 'medio',  Icon: UsersRound, label: '4 a 10 personas', desc: 'Equipo con varios boxes o cabinas'    },
  { key: 'grande', Icon: Building2,  label: 'Más de 10',       desc: 'Salón o clínica de gran escala'       },
]

type EstadoSub = 'idle' | 'checking' | 'disponible' | 'ocupado'

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function OrbitaLogo({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 30 30" fill="none" style={{ width: size, height: size, flexShrink: 0 }}>
      <circle cx="15" cy="15" r="13" stroke="#2563eb" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round"/>
      <circle cx="25.5" cy="7.5" r="4" fill="#93c5fd"/>
      <circle cx="15" cy="15" r="4.5" fill="#1e3a8a"/>
    </svg>
  )
}

const inputBase: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 150ms',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', suggested }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; suggested?: boolean
}) {
  return (
    <>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="ds-field"
        style={suggested ? { ...inputBase, borderColor: '#3B82F6', background: 'rgba(59,130,246,0.10)' } : inputBase}
      />
      {suggested && <SugeridoPorOrbiTag />}
    </>
  )
}

function Textarea({ value, onChange, placeholder, suggested }: { value: string; onChange: (v: string) => void; placeholder?: string; suggested?: boolean }) {
  return (
    <>
      <textarea
        value={value} placeholder={placeholder} rows={3}
        onChange={e => onChange(e.target.value)}
        className="ds-field"
        style={suggested ? { ...inputBase, resize: 'vertical', borderColor: '#3B82F6', background: 'rgba(59,130,246,0.10)' } : { ...inputBase, resize: 'vertical' }}
      />
      {suggested && <SugeridoPorOrbiTag />}
    </>
  )
}

function SugeridoPorOrbiTag() {
  return (
    <div style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, marginTop: 5 }}>
      ✦ Sugerido por Orbi — editá si querés
    </div>
  )
}

function SelectCard({ sel, Icon, label, desc, onClick }: {
  sel: boolean; Icon: LucideIcon; label: string; desc: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', textAlign: 'left', padding: '20px 18px 18px', borderRadius: 14,
        border:     `2px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: sel ? 'rgba(59,130,246,0.05)' : 'var(--color-bg)',
        cursor: 'pointer', transition: 'all 150ms ease',
        boxShadow: sel ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
      }}
      onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--color-primary)' }}
      onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--color-border)'  }}
    >
      {sel && (
        <div style={{ position: 'absolute', top: 12, right: 12, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={10} color="white" strokeWidth={3} />
        </div>
      )}
      <div style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 12, background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} strokeWidth={1.75} color={sel ? 'var(--color-primary)' : '#3B82F6'} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.45 }}>{desc}</div>
    </button>
  )
}

// ─── Shared steps ─────────────────────────────────────────────────────────────

// `estadoSub` vive en el padre porque la barra de navegación necesita saber si
// el subdominio está libre para habilitar "Continuar".
function StepNegocio({ negocio, setNegocio, conModoVenta, estadoSub, setEstadoSub, sugeridosPorOrbi, onManualEdit }: {
  negocio: Negocio; setNegocio: Dispatch<SetStateAction<Negocio>>; conModoVenta?: boolean
  estadoSub: EstadoSub; setEstadoSub: Dispatch<SetStateAction<EstadoSub>>
  // Campos que Orbi completó por última vez (fillWizardField) — se muestran con
  // borde violeta hasta que el usuario los edita a mano (ver onManualEdit).
  sugeridosPorOrbi: Set<string>; onManualEdit: (campo: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const sub = negocio.subdominio.trim()
    if (!sub) { setEstadoSub('idle'); return }
    setEstadoSub('checking')
    const t = setTimeout(() => {
      checkSubdomain(sub)
        .then(r => setEstadoSub(r.available ? 'disponible' : 'ocupado'))
        .catch(() => setEstadoSub('idle'))
    }, 700)
    return () => clearTimeout(t)
  }, [negocio.subdominio, setEstadoSub])

  const set = (k: 'nombre' | 'descripcion' | 'telefono') => (v: string) => {
    setNegocio(prev => ({ ...prev, [k]: v }))
    onManualEdit(k)
  }

  const setModoVenta = (v: ModoVenta) => setNegocio(prev => ({ ...prev, modoVenta: v }))

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setNegocio(prev => ({ ...prev, logo: reader.result as string }))
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          Contanos sobre tu negocio
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Esta información aparecerá en tu perfil y en los turnos.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: 100, height: 100, borderRadius: '50%',
            border: '2px dashed var(--color-border)', background: 'var(--color-surface)',
            cursor: 'pointer', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 5, transition: 'border-color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'  }}
        >
          {negocio.logo
            ? <img src={negocio.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <>
                <Camera size={22} color="var(--color-muted)" strokeWidth={1.5} />
                <span style={{ fontSize: 10, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.35 }}>
                  Agregar LOGO<br />(opcional)
                </span>
              </>
          }
        </button>
      </div>

      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--color-body)', marginBottom: 20,
      }}>
        <Info size={15} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          El <strong>teléfono</strong> es tu medio de contacto público —
          tus clientes lo van a usar para comunicarse con vos por WhatsApp.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Nombre del negocio" required>
          <Input value={negocio.nombre} onChange={set('nombre')} placeholder="Ej: Mi Negocio" suggested={sugeridosPorOrbi.has('nombre')} />
        </Field>
        <Field label="Descripción">
          <Textarea value={negocio.descripcion} onChange={set('descripcion')} placeholder="Breve descripción de tu negocio..." suggested={sugeridosPorOrbi.has('descripcion')} />
        </Field>
        <Field label="Teléfono" required>
          <Input type="tel" value={negocio.telefono} onChange={set('telefono')} placeholder="+54 11 1234-5678" />
        </Field>
        <Field label="Subdominio de tu negocio">
          {/* ds-field solo en reposo: cuando el chequeo pinta el borde
              (disponible/ocupado/verificando) no hay que pisarlo al hover */}
          <div className={estadoSub === 'idle' ? 'ds-field' : undefined} style={{
            display: 'flex', alignItems: 'center',
            border: `1.5px solid ${
              sugeridosPorOrbi.has('subdominio') ? '#3B82F6' :
              estadoSub === 'disponible' ? 'var(--color-success)' :
              estadoSub === 'ocupado'    ? 'var(--color-error)'   :
              estadoSub === 'checking'   ? 'var(--color-primary)' :
              'var(--color-border)'
            }`,
            borderRadius: 10, background: sugeridosPorOrbi.has('subdominio') ? 'rgba(59,130,246,0.10)' : 'var(--color-surface)', overflow: 'hidden', transition: 'border-color 200ms',
          }}>
            <input
              value={negocio.subdominio}
              onChange={e => {
                setNegocio(prev => ({ ...prev, subdominio: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                onManualEdit('subdominio')
              }}
              placeholder="mi-negocio"
              style={{ ...inputBase, border: 'none', background: 'transparent', borderRadius: 0, flex: 1, outline: 'none' }}
            />
            <span style={{ paddingRight: 14, flexShrink: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
              .orbita.site
            </span>
            {estadoSub === 'checking'   && <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginRight: 12, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 600ms linear infinite' }} />}
            {estadoSub === 'disponible' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', marginRight: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>✓ Disponible</span>}
            {estadoSub === 'ocupado'    && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error)',   marginRight: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>✗ No disponible</span>}
          </div>
          {sugeridosPorOrbi.has('subdominio') && <SugeridoPorOrbiTag />}
          <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '5px 0 0' }}>
            Una vez activo tu espacio, podés conectar un dominio propio como <strong>tunegocio.com.ar</strong>.
          </p>
        </Field>
      </div>

      {conModoVenta && (
        <div style={{ marginTop: 24 }}>
          <Field label="¿Cómo vas a vender?" required>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', margin: '-2px 0 12px' }}>
              Definí cómo van a operar tus clientes con vos. Podés cambiarlo más adelante.
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectCard
              sel={negocio.modoVenta === 'ecommerce'} Icon={ShoppingCart}
              label="Tienda online"
              desc="Catálogo con carrito, checkout y cobro online completo"
              onClick={() => setModoVenta('ecommerce')}
            />
            <SelectCard
              sel={negocio.modoVenta === 'vidriera'} Icon={Eye}
              label="Vidriera digital"
              desc="Solo mostrás tu catálogo. Los clientes te consultan por WhatsApp"
              onClick={() => setModoVenta('vidriera')}
            />
          </div>

          {negocio.modoVenta === 'vidriera' && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14,
              background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 12, padding: '14px 16px', animation: 'fadeSlideDown 220ms ease',
            }}>
              <AlertTriangle size={16} color="#D97706" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                  Con vidriera digital no vas a tener disponible:
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.7 }}>
                  Checkout ni carrito de compra · Módulo de clientes y pedidos · Cupones · Mensajes · Opiniones de compradores
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.6, marginTop: 8 }}>
                  Vas a poder seguir creando productos y aplicando descuentos. Cada producto va a tener un botón para que el cliente te consulte directo por WhatsApp.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StepUbicacion({ negocio, setNegocio }: { negocio: Negocio; setNegocio: Dispatch<SetStateAction<Negocio>> }) {
  const [buscando,    setBuscando]    = useState(false)
  const [locating,    setLocating]    = useState(false)
  const [buscarInput, setBuscarInput] = useState(negocio.direccion)

  const tipoLocal = negocio.tipoLocal
  const toggleTipo = (v: 'fisico' | 'online') => setNegocio(prev => ({
    ...prev,
    tipoLocal: prev.tipoLocal.includes(v) ? prev.tipoLocal.filter(t => t !== v) : [...prev.tipoLocal, v],
  }))

  async function geocodificar() {
    const q = buscarInput.trim()
    if (!q) return
    setBuscando(true)
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ar&limit=1`)
      const data = await res.json()
      const hit  = data[0]
      if (hit) {
        setNegocio(prev => ({ ...prev, latLng: [+hit.lat, +hit.lon], direccion: hit.display_name }))
        setBuscarInput(hit.display_name)
      }
    } finally { setBuscando(false) }
  }

  function usarUbicacion() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latLng: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setNegocio(prev => ({ ...prev, latLng }))
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
          .then(r => r.json())
          .then(d => { if (d.display_name) { setNegocio(prev => ({ ...prev, direccion: d.display_name })); setBuscarInput(d.display_name) } })
          .catch(() => {})
          .finally(() => setLocating(false))
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function handleDragEnd(latLng: [number, number]) {
    setNegocio(prev => ({ ...prev, latLng }))
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng[0]}&lon=${latLng[1]}`)
      .then(r => r.json())
      .then(d => { if (d.display_name) { setNegocio(prev => ({ ...prev, direccion: d.display_name })); setBuscarInput(d.display_name) } })
      .catch(() => {})
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          ¿Dónde operás?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Contanos cómo operás — podés elegir una opción o ambas.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        <SelectCard
          sel={tipoLocal.includes('fisico')} Icon={MapPin}
          label="Local físico"
          desc="Tengo un local, showroom, consultorio o espacio propio"
          onClick={() => toggleTipo('fisico')}
        />
        <SelectCard
          sel={tipoLocal.includes('online')} Icon={Globe}
          label="Online / A domicilio"
          desc="Vendo o atiendo de forma remota o en el domicilio del cliente"
          onClick={() => toggleTipo('online')}
        />
      </div>

      {tipoLocal.includes('fisico') && (
        <div style={{ animation: 'fadeSlideDown 220ms ease', marginBottom: tipoLocal.includes('online') ? 20 : 0 }}>
          <Field label="Dirección de tu negocio" required>
            <div style={{
              border: '1.5px solid var(--color-border)', borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>

              {/* Barra de búsqueda */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', padding: '4px 4px 4px 12px', gap: 8 }}>
                <MapPin size={15} strokeWidth={2} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                <input
                  value={buscarInput}
                  onChange={e => setBuscarInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); geocodificar() } }}
                  placeholder="Buscá tu dirección..."
                  style={{ ...inputBase, border: 'none', borderRadius: 0, flex: 1, outline: 'none', background: 'transparent', padding: '8px 0', fontSize: 13 }}
                />
                <button
                  onClick={geocodificar} disabled={buscando}
                  className="ds-hover"
                  style={{
                    flexShrink: 0, height: 36, padding: '0 18px', borderRadius: 10,
                    background: buscando ? 'var(--color-surface-alt)' : 'var(--color-primary)',
                    color: buscando ? 'var(--color-muted)' : 'white',
                    border: 'none',
                    fontWeight: 600, fontSize: 13, transition: 'all 150ms',
                  }}
                >
                  {buscando ? '…' : 'Buscar'}
                </button>
              </div>

              {/* Botón de geolocalización */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '8px 12px' }}>
                <button
                  onClick={usarUbicacion} disabled={locating}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 20,
                    border: `1.5px solid ${locating ? 'var(--color-border)' : 'rgba(59,130,246,0.3)'}`,
                    background: locating ? 'transparent' : 'rgba(59,130,246,0.05)',
                    color: locating ? 'var(--color-muted)' : 'var(--color-primary)',
                    fontSize: 12, fontWeight: 600, cursor: locating ? 'default' : 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { if (!locating) { e.currentTarget.style.background = 'rgba(59,130,246,0.10)'; e.currentTarget.style.borderColor = 'var(--color-primary)' } }}
                  onMouseLeave={e => { if (!locating) { e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)' } }}
                >
                  {locating
                    ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--color-muted)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 600ms linear infinite', flexShrink: 0 }} />
                    : <LocateFixed size={13} strokeWidth={2.2} />
                  }
                  {locating ? 'Obteniendo tu ubicación…' : 'Usar mi ubicación actual'}
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-subtle)' }}>
                  o arrastrá el marcador
                </span>
              </div>

              {/* Mapa */}
              <MapPicker center={negocio.latLng} onDragEnd={handleDragEnd} />
            </div>
          </Field>
        </div>
      )}

      {tipoLocal.includes('online') && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 12, padding: '14px 16px', animation: 'fadeSlideDown 220ms ease',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={18} strokeWidth={2.5} color="var(--color-success)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
              {tipoLocal.includes('fisico')
                ? 'Perfecto, también atendés de forma remota'
                : 'Perfecto, tu negocio opera sin dirección fija'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              {tipoLocal.includes('fisico')
                ? 'Vas a poder configurar zonas de envío o atención a domicilio desde tu panel.'
                : 'Podés agregar una dirección física después desde tu panel si en algún momento abrís un local.'}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StepPagos({ pagos, setPagos, transferAlias, setTransferAlias }: {
  pagos: string[]; setPagos: Dispatch<SetStateAction<string[]>>
  transferAlias: string; setTransferAlias: (v: string) => void
}) {
  function toggle(key: string) {
    setPagos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          ¿Cómo aceptás pagos?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Podés seleccionar todos los que usás. Se puede cambiar después.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {METODOS.map(m => (
          <SelectCard key={m.key} sel={pagos.includes(m.key)} Icon={m.Icon} label={m.label} desc={m.desc} onClick={() => toggle(m.key)} />
        ))}
      </div>

      {pagos.includes('transferencia') && (
        <div style={{ marginTop: 20, animation: 'fadeSlideDown 220ms ease' }}>
          <Field label="Alias o CBU para transferencias" required>
            <Input value={transferAlias} onChange={setTransferAlias} placeholder="mi.negocio.mp" />
          </Field>
          <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: '5px 0 0' }}>
            Se lo vamos a mostrar a tus clientes cuando elijan pagar por transferencia.
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StepEquipo({ tamano, setTamano }: { tamano: string; setTamano: (k: string) => void }) {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          ¿Cómo es tu equipo?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          No es obligatorio — podés configurarlo después desde tu panel.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {TAMANOS.map(t => (
          <SelectCard key={t.key} sel={tamano === t.key} Icon={t.Icon} label={t.label} desc={t.desc} onClick={() => setTamano(t.key)} />
        ))}
      </div>
    </div>
  )
}

export type Cuenta = { ownerName: string; email: string; password: string; terms: boolean }

// Último paso del wizard: recién acá se pide crear la cuenta — todo lo
// completado antes (rubro, negocio, ubicación, pagos, equipo) se guarda de
// una vez cuando se envía este paso (ver PENDIENTES.md).
function StepCuenta({ cuenta, setCuenta }: { cuenta: Cuenta; setCuenta: Dispatch<SetStateAction<Cuenta>> }) {
  const [showPw, setShowPw] = useState(false)
  const [legalAbierto, setLegalAbierto] = useState<LegalKey | null>(null)
  const [estadoEmail, setEstadoEmail] = useState<EstadoSub>('idle')
  const set = (k: 'ownerName' | 'email') => (v: string) => setCuenta(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const email = cuenta.email.trim()
    if (!/\S+@\S+\.\S+/.test(email)) { setEstadoEmail('idle'); return }
    setEstadoEmail('checking')
    const t = setTimeout(() => {
      checkEmail(email)
        .then(r => setEstadoEmail(r.available ? 'disponible' : 'ocupado'))
        .catch(() => setEstadoEmail('idle'))
    }, 700)
    return () => clearTimeout(t)
  }, [cuenta.email])

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>
          Creá tu cuenta para guardar todo
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
          Ya configuraste tu negocio — con esto lo activamos y podés entrar a tu panel.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Tu nombre completo" required>
          <Input value={cuenta.ownerName} onChange={set('ownerName')} placeholder="Juan García" />
        </Field>
        <Field label="Email" required>
          {/* Igual que el subdominio: el borde de estado (disponible/ocupado)
              manda sobre el hover estándar */}
          <div className={estadoEmail === 'idle' ? 'ds-field' : undefined} style={{
            display: 'flex', alignItems: 'center',
            border: `1.5px solid ${
              estadoEmail === 'disponible' ? 'var(--color-success)' :
              estadoEmail === 'ocupado'    ? 'var(--color-error)'   :
              estadoEmail === 'checking'   ? 'var(--color-primary)' :
              'var(--color-border)'
            }`,
            borderRadius: 10, background: 'var(--color-surface)', overflow: 'hidden', transition: 'border-color 200ms',
          }}>
            <input
              type="email" value={cuenta.email} onChange={e => set('email')(e.target.value)} placeholder="tu@email.com"
              style={{ ...inputBase, border: 'none', background: 'transparent', borderRadius: 0, flex: 1, outline: 'none' }}
            />
            {estadoEmail === 'checking'   && <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginRight: 12, border: '2px solid var(--color-primary)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 600ms linear infinite' }} />}
            {estadoEmail === 'disponible' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', marginRight: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>✓ Disponible</span>}
            {estadoEmail === 'ocupado'    && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error)',   marginRight: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>✗ Ya tiene cuenta</span>}
          </div>
          {/* Solo avisa formato inválido si ya escribió algo — un campo vacío
              recién llegado no necesita un error debajo, alcanza con el
              asterisco. El caso "ya tiene cuenta" ya lo cubre el indicador de
              arriba. */}
          {cuenta.email.trim().length > 0 && !/\S+@\S+\.\S+/.test(cuenta.email) && (
            <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>Ingresá un email válido</p>
          )}
        </Field>
        <Field label="Contraseña" required>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={cuenta.password}
              onChange={e => setCuenta(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
              style={{ ...inputBase, paddingRight: 40 }}
            />
            <button
              type="button" onClick={() => setShowPw(p => !p)}
              className="ds-hover"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
            >
              <Eye size={15} strokeWidth={1.5} />
            </button>
          </div>
          {/* Mismo criterio: recién avisa una vez que empezó a escribir, para
              no mostrar el error en un campo todavía vacío. */}
          {cuenta.password.length > 0 && cuenta.password.length < 8 && (
            <p style={{ fontSize: 11.5, color: 'var(--color-error)', margin: '5px 0 0' }}>
              Necesita al menos 8 caracteres ({cuenta.password.length}/8)
            </p>
          )}
        </Field>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--color-body)', cursor: 'pointer' }}>
          <input
            type="checkbox" checked={cuenta.terms}
            onChange={e => setCuenta(prev => ({ ...prev, terms: e.target.checked }))}
            style={{ accentColor: 'var(--color-primary)', marginTop: 2 }}
          />
          <span>
            Acepto los{' '}
            <button
              type="button" onClick={e => { e.preventDefault(); setLegalAbierto('terminos') }}
              className="ds-link"
              style={{ color: 'var(--color-primary)', fontWeight: 500, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Términos y condiciones
            </button>
            {' '}y la{' '}
            <button
              type="button" onClick={e => { e.preventDefault(); setLegalAbierto('privacidad') }}
              className="ds-link"
              style={{ color: 'var(--color-primary)', fontWeight: 500, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              política de privacidad
            </button>
          </span>
        </label>
      </div>

      <LegalModal contentKey={legalAbierto} onClose={() => setLegalAbierto(null)} />
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonTitle({ w1, w2 }: { w1: number | string; w2: number | string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <Skeleton width={w1} height={28} radius={6} style={{ display: 'block', margin: '0 auto 8px' }} />
      <Skeleton width={w2} height={14} radius={4} style={{ display: 'block', margin: '0 auto'    }} />
    </div>
  )
}

function SkeletonField({ labelWidth, inputHeight = 42 }: { labelWidth: number; inputHeight?: number }) {
  return (
    <div>
      <Skeleton width={labelWidth} height={13} radius={4}  style={{ display: 'block', marginBottom: 6 }} />
      <Skeleton width="100%"       height={inputHeight} radius={10} style={{ display: 'block' }} />
    </div>
  )
}

function SkeletonNegocio() {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <SkeletonTitle w1={240} w2={300} />
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <Skeleton width={100} height={100} radius={50} style={{ display: 'block' }} />
      </div>
      <Skeleton width="100%" height={50} radius={10} style={{ display: 'block', marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonField labelWidth={140} />
        <SkeletonField labelWidth={90} inputHeight={80} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SkeletonField labelWidth={110} />
          <SkeletonField labelWidth={75}  />
        </div>
        <SkeletonField labelWidth={160} />
      </div>
    </div>
  )
}

function SkeletonUbicacion() {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <SkeletonTitle w1={220} w2={340} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        <Skeleton width="100%" height={120} radius={14} style={{ display: 'block' }} />
        <Skeleton width="100%" height={120} radius={14} style={{ display: 'block' }} />
      </div>
      <SkeletonField labelWidth={180} />
      <Skeleton width="100%" height={288} radius={12} style={{ display: 'block', marginTop: 12 }} />
    </div>
  )
}

function SkeletonCuenta() {
  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <SkeletonTitle w1={260} w2={320} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonField labelWidth={140} />
        <SkeletonField labelWidth={50} />
        <SkeletonField labelWidth={100} />
      </div>
    </div>
  )
}

function SkeletonGrid({ cols = 2, rows = 2, tall = false }: { cols?: number; rows?: number; tall?: boolean }) {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <SkeletonTitle w1={220} w2={320} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} style={{ padding: '20px 18px 18px', borderRadius: 14, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <Skeleton width={38} height={38} radius={10} style={{ display: 'block', marginBottom: tall ? 12 : 9 }} />
            <Skeleton width="55%" height={14} radius={4}  style={{ display: 'block', marginBottom: 4 }} />
            <Skeleton width="85%" height={11} radius={4}  style={{ display: 'block' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const defaultToggle = (prev: string[], key: string) =>
  prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]

export function SetupUnificado({
  primerPasoLabel,
  PrimerPaso,
  toggleFn = defaultToggle,
  conEquipo = false,
  conModoVenta = false,
  successPath,
  firstStepOptions,
}: SetupUnificadoProps) {
  const router = useRouter()
  const wizard      = useOnboardingStore(s => s.wizard)
  const setWizard   = useOnboardingStore(s => s.setWizard)

  const PASOS_INTERNOS = [
    primerPasoLabel,
    'Tu negocio',
    'Ubicación',
    'Métodos de pago',
    ...(conEquipo ? ['Tu equipo'] : []),
    'Tu cuenta',
  ]
  const lastPaso = PASOS_INTERNOS.length - 1
  const pasoEquipo = conEquipo ? lastPaso - 1 : -1

  // Solo para la barra de progreso: agrega el pago como último ítem visible
  // desde el arranque del wizard, para que el total de pasos mostrado sea el
  // real (wizard + pago) y no solo el tramo de "Configuración" — evita la
  // sensación de "se agregan pasos" que daba la barra global de 3 pasos que
  // reemplaza esta (Rubro/Configuración/Listo, sacada — ver PENDIENTES.md).
  // `lastPaso`/`pasoEquipo` de arriba NO usan este array — siguen atados a
  // PASOS_INTERNOS, que es el que controla la navegación real del wizard.
  const PASOS_MOSTRADOS = [...PASOS_INTERNOS, 'Pago']

  const [paso,         setPaso]        = useState(0)
  const [cargandoPaso, setCargandoPaso] = useState(true)
  const [seleccion,    setSeleccion]   = useState<string[]>([])
  const [negocio,      setNegocio]     = useState<Negocio>({
    nombre: '', descripcion: '', telefono: '',
    direccion: '', logo: '', latLng: BA, subdominio: '', tipoLocal: [], modoVenta: '',
  })
  const [pagos,       setPagos]       = useState<string[]>([])
  const [transferAlias, setTransferAlias] = useState('')
  const [tamano,      setTamano]      = useState('')
  const [cuenta,      setCuenta]      = useState<Cuenta>({ ownerName: '', email: '', password: '', terms: true })
  const [estadoSub,   setEstadoSub]   = useState<EstadoSub>('idle')
  const toggleOrbi = useOrbiStore(s => s.toggle)
  useOrbiKeyboardShortcut()
  const orbiContext = useOrbiContext()
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  useOrbiSafeArea(headerRef, footerRef, [paso])

  // Campos que Orbi completó vía la tool fillWizardField — mientras estén acá
  // el campo se ve con borde violeta (ver StepNegocio/SugeridoPorOrbiTag).
  // Editar el campo a mano lo saca del set (onManualEdit, pasado a StepNegocio).
  const [sugeridosPorOrbi, setSugeridosPorOrbi] = useState<Set<string>>(new Set())
  const orbiMessages = useOrbiStore(s => s.messages)
  const accionesAplicadas = useRef(new Set<string>())
  useEffect(() => {
    for (const msg of orbiMessages) {
      for (const accion of msg.actions ?? []) {
        if (accion.status !== 'complete' || accion.tool !== 'fillWizardField') continue
        if (accionesAplicadas.current.has(accion.id)) continue
        accionesAplicadas.current.add(accion.id)
        const field = accion.data?.field as string | undefined
        const value = accion.data?.value as string | undefined
        if (!field || value === undefined) continue
        setNegocio(prev => (field in prev ? { ...prev, [field]: value } : prev))
        setSugeridosPorOrbi(prev => new Set(prev).add(field))
      }
    }
  }, [orbiMessages])

  const onManualEdit = (campo: string) => {
    setSugeridosPorOrbi(prev => {
      if (!prev.has(campo)) return prev
      const next = new Set(prev)
      next.delete(campo)
      return next
    })
  }

  // Si no eligieron rubro todavía (entraron directo a esta URL), volver al
  // selector. Si no, rehidrata el wizard con lo que ya se cargó antes —
  // el estado vive en localStorage (useOnboardingStore) porque todavía no
  // existe cuenta ni negocio real en la base (eso pasa recién en "Tu cuenta").
  useEffect(() => {
    if (!wizard.rubro) { router.push('/onboarding/rubro'); return }
    setSeleccion(wizard.subrubros)
    setNegocio({
      nombre: wizard.nombre, descripcion: wizard.descripcion, telefono: wizard.telefono,
      direccion: wizard.direccion, logo: wizard.logoDataUrl, latLng: wizard.latLng, subdominio: wizard.subdominio,
      tipoLocal: [
        ...(wizard.operatesPhysical ? ['fisico' as const] : []),
        ...(wizard.operatesOnline ? ['online' as const] : []),
      ],
      modoVenta: wizard.modoVenta,
    })
    setPagos(wizard.pagos)
    setTransferAlias(wizard.transferAlias)
    setTamano(wizard.teamSize)
    // La contraseña no se persiste (ver useOnboardingStore.ts) — si el
    // usuario recarga la página en este paso, la tiene que volver a escribir.
    setCuenta({ ownerName: wizard.ownerName, email: wizard.ownerEmail, password: '', terms: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setCargandoPaso(false), 450)
    return () => clearTimeout(t)
  }, [paso])

  const STEP_NAMES = ['subrubros', 'tu-negocio', 'ubicacion', 'pagos', ...(conEquipo ? ['equipo'] : []), 'cuenta']

  const stepOptions: Record<string, { key: string; label: string; description?: string }[] | undefined> = {
    subrubros: firstStepOptions,
    'tu-negocio': conModoVenta ? [
      { key: 'ecommerce', label: 'Tienda online', description: 'Carrito, checkout y pagos online' },
      { key: 'vidriera', label: 'Vidriera digital', description: 'Catálogo sin carrito ni checkout' },
    ] : undefined,
    ubicacion: [
      { key: 'fisico', label: 'Local físico', description: 'Tengo un local o punto de venta' },
      { key: 'online', label: 'Online / A domicilio', description: 'Opero sin dirección fija' },
    ],
    pagos: METODOS.map(m => ({ key: m.key, label: m.label, description: m.desc })),
    equipo: TAMANOS.map(t => ({ key: t.key, label: t.label, description: t.desc })),
  }

  useEffect(() => {
    const stepName = STEP_NAMES[paso]
    setWizardContext({
      step: paso,
      stepName,
      rubro: wizard.rubro,
      availableOptions: stepOptions[stepName],
    })
  }, [paso, wizard.rubro, firstStepOptions])

  useEffect(() => {
    const handler = (e: Event) => {
      const { key } = (e as CustomEvent).detail
      const stepName = STEP_NAMES[paso]
      if (stepName === 'subrubros') {
        setSeleccion(prev => prev.includes(key) ? prev : toggleFn(prev, key))
      } else if (stepName === 'ubicacion') {
        setNegocio(prev => {
          const arr = prev.tipoLocal as ('fisico' | 'online')[]
          if (arr.includes(key as 'fisico' | 'online')) return prev
          return { ...prev, tipoLocal: [...arr, key as 'fisico' | 'online'] }
        })
      } else if (stepName === 'pagos') {
        setPagos(prev => prev.includes(key) ? prev : [...prev, key])
      } else if (stepName === 'equipo') {
        setTamano(key)
      } else if (stepName === 'tu-negocio' && (key === 'ecommerce' || key === 'vidriera')) {
        setNegocio(prev => ({ ...prev, modoVenta: key }))
      }
    }
    window.addEventListener('orbi:select-option', handler)
    return () => window.removeEventListener('orbi:select-option', handler)
  }, [paso, toggleFn])

  const { idleField, dismissField } = useInactivityDetector(
    paso === 1 ? { nombre: negocio.nombre, descripcion: negocio.descripcion, subdominio: negocio.subdominio } : {},
  )

  function toggle(key: string) {
    setSeleccion(prev => toggleFn(prev, key))
  }

  // Devuelve el motivo por el que NO se puede avanzar, o null si está todo ok.
  // Se muestra al lado del botón para que el usuario sepa qué le falta en vez
  // de encontrarse un "Continuar" gris sin explicación.
  const motivoBloqueo: string | null = (() => {
    if (paso === 0) {
      return seleccion.length > 0 ? null : 'Elegí al menos una opción'
    }
    if (paso === 1) {
      if (!negocio.nombre.trim())   return 'Completá el nombre de tu negocio'
      if (!negocio.telefono.trim()) return 'Completá tu teléfono'
      if (negocio.subdominio.trim() && estadoSub === 'ocupado')  return 'Ese subdominio ya está ocupado'
      if (negocio.subdominio.trim() && estadoSub === 'checking') return 'Verificando el subdominio…'
      if (conModoVenta && !negocio.modoVenta) return 'Elegí cómo vas a vender'
      return null
    }
    if (paso === 2) {
      if (negocio.tipoLocal.length === 0) return 'Elegí al menos una forma de operar'
      if (negocio.tipoLocal.includes('fisico') && !negocio.direccion.trim()) return 'Indicá la dirección de tu local'
      return null
    }
    if (paso === 3) {
      if (pagos.length === 0) return 'Elegí al menos un método de pago'
      if (pagos.includes('transferencia') && !transferAlias.trim()) return 'Ingresá tu alias o CBU'
      return null
    }
    if (paso === lastPaso) {
      if (!cuenta.ownerName.trim())            return 'Completá tu nombre'
      if (!/\S+@\S+\.\S+/.test(cuenta.email))  return 'Ingresá un email válido'
      if (cuenta.password.length < 8)          return 'La contraseña necesita 8 caracteres'
      if (!cuenta.terms)                       return 'Aceptá los términos para continuar'
      return null
    }
    return null
  })()

  const puedeAvanzar = motivoBloqueo === null

  function avanzar() {
    if (paso === 0) setWizard({ subrubros: seleccion })
    else if (paso === 1) setWizard({
      nombre: negocio.nombre, descripcion: negocio.descripcion,
      telefono: negocio.telefono, subdominio: negocio.subdominio, modoVenta: negocio.modoVenta,
      logoDataUrl: negocio.logo,
    })
    else if (paso === 2) setWizard({
      direccion: negocio.direccion, latLng: negocio.latLng,
      operatesPhysical: negocio.tipoLocal.includes('fisico'), operatesOnline: negocio.tipoLocal.includes('online'),
    })
    else if (paso === 3) setWizard({ pagos, transferAlias })
    else if (paso === pasoEquipo) setWizard({ teamSize: tamano })

    if (paso < lastPaso) { setCargandoPaso(true); setPaso(p => p + 1); return }

    // Último paso del wizard: NO se crea la cuenta acá. Solo se guardan las
    // credenciales en el store (la contraseña queda solo en memoria, no en
    // localStorage) y se pasa a la pantalla de pago — la cuenta y el negocio
    // recién se crean si el pago se aprueba, ver plan.tsx.
    setWizard({ ownerName: cuenta.ownerName, ownerEmail: cuenta.email, ownerPassword: cuenta.password })
    router.push(successPath)
  }

  function retroceder() {
    if (paso > 0) { setCargandoPaso(true); setPaso(p => p - 1) }
    else router.push('/onboarding/rubro')
  }

  function renderSkeleton() {
    if (paso === 0) return <SkeletonGrid cols={2} rows={3} />
    if (paso === 1) return <SkeletonNegocio   />
    if (paso === 2) return <SkeletonUbicacion />
    if (paso === lastPaso) return <SkeletonCuenta />
    return                  <SkeletonGrid cols={2} rows={2} />
  }

  function renderStep() {
    if (paso === 0) return <PrimerPaso seleccion={seleccion} toggle={toggle} />
    if (paso === 1) return <StepNegocio  negocio={negocio}  setNegocio={setNegocio} conModoVenta={conModoVenta} estadoSub={estadoSub} setEstadoSub={setEstadoSub} sugeridosPorOrbi={sugeridosPorOrbi} onManualEdit={onManualEdit} />
    if (paso === 2) return <StepUbicacion negocio={negocio} setNegocio={setNegocio} />
    if (paso === 3) return <StepPagos    pagos={pagos}      setPagos={setPagos}     transferAlias={transferAlias} setTransferAlias={setTransferAlias} />
    if (paso === pasoEquipo) return <StepEquipo tamano={tamano} setTamano={setTamano} />
    if (paso === lastPaso) return <StepCuenta cuenta={cuenta} setCuenta={setCuenta} />
    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* ── Header global ── */}
      <div ref={headerRef} style={{
        position: 'sticky', top: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', height: 56, padding: '0 28px',
        background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
      }}>
        <a href="/" className="ds-hover" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderRadius: 8 }}>
          <OrbitaLogo size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Órbita</span>
        </a>

        <a href="/login" className="ds-hover ob-login-link" style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap', borderRadius: 6 }}>
          ¿Ya tenés cuenta?{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Iniciá sesión</span>
        </a>
      </div>

      {/* ── Inner step progress — única barra de progreso del wizard, incluye
           "Pago" desde el principio para que el total mostrado sea el real. */}
      <div className="ob-inner-progress" style={{
        borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)',
        padding: '0 28px', overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 480 }}>
          {PASOS_MOSTRADOS.map((label, i) => {
            const done    = i < paso
            const current = i === paso
            const isLast  = i === PASOS_MOSTRADOS.length - 1
            return (
              <Fragment key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 0', flexShrink: 0, opacity: (done || current) ? 1 : 0.45 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: done ? '#10B981' : current ? '#2563EB' : 'var(--color-surface-alt)',
                    color:      (done || current) ? 'white' : 'var(--color-subtle)',
                    boxShadow:  current ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
                    transition: 'all 300ms',
                  }}>
                    {done ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: current ? 600 : 500, whiteSpace: 'nowrap',
                    color: current ? 'var(--color-text)' : done ? '#10B981' : 'var(--color-muted)',
                    transition: 'color 300ms',
                  }}>
                    {label}
                  </span>
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: 1, margin: '0 10px', background: done ? '#10B981' : 'var(--color-border)', transition: 'background 300ms', minWidth: 20 }} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* Mobile compact step indicator (shown only below 640px) */}
      <div className="ob-mobile-step" style={{
        display: 'none', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)', padding: '10px 16px',
        alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: '#2563EB', color: 'white', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {paso + 1}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {PASOS_MOSTRADOS[paso]}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          · {paso + 1} de {PASOS_MOSTRADOS.length}
        </span>
      </div>

      {/* ── Step content ── */}
      <div className="ob-step-content" style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 160px' }}>
        {cargandoPaso ? renderSkeleton() : renderStep()}
      </div>

      {/* ── Orbi ── */}
      <OrbiPanel />

      {idleField && !useOrbiStore.getState().isOpen && (
        <OrbiNudge
          field={idleField}
          context={orbiContext}
          onDismiss={() => dismissField(idleField)}
        />
      )}

      {/* FAB trigger for wizard */}
      <button
        onClick={toggleOrbi}
        title="Orbi AI"
        style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 170,
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          border: 'none', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          transition: 'transform 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <OrbiIcon size={22} color="white" />
      </button>

      {/* ── Navigation bar ── */}
      <div ref={footerRef} className="ob-nav-bar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '14px 32px', background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.07)', zIndex: 1000,
      }}>
        <button
          onClick={retroceder}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)';  e.currentTarget.style.color = 'var(--color-body)'    }}
        >
          <ChevronLeft size={15} strokeWidth={2.5} />
          {paso === 0 ? 'Volver al rubro' : 'Anterior'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {motivoBloqueo && (
            <span style={{ fontSize: 12.5, color: 'var(--color-muted)', textAlign: 'right' }}>
              {motivoBloqueo}
            </span>
          )}
          <button
            onClick={avanzar}
            disabled={!puedeAvanzar}
            className="ds-hover"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px', borderRadius: 10, border: 'none',
              background:  puedeAvanzar ? '#2563EB' : 'var(--color-surface-alt)',
              color:       puedeAvanzar ? 'white'   : 'var(--color-subtle)',
              fontSize: 14, fontWeight: 700,
              boxShadow: puedeAvanzar ? '0 4px 16px rgba(37,99,235,0.35)' : 'none',
              transition: 'all 150ms',
            }}
          >
            {paso === lastPaso ? 'Ir al pago' : 'Continuar'}
            {paso < lastPaso
              ? <ChevronRight size={16} strokeWidth={2.5} />
              : <Check        size={16} strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
