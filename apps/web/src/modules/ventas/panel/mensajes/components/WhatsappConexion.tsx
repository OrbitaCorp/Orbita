import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { ApiError, connectWhatsapp, disconnectWhatsapp, getWhatsappConnection, type WhatsappEstado } from '@/lib/api'

// Conexión de WhatsApp Business del negocio, desde el encabezado de la bandeja.
//
// Por ahora es MANUAL: se pegan los datos de la app de Meta (WhatsApp → API
// Setup). El botón "Conectar con Facebook" (Embedded Signup) va a reemplazar
// este formulario cuando Órbita tenga la verificación de Tech Provider.
//
// Conectar/desconectar es solo de propietario/admin, y en producción solo de los
// negocios habilitados: si el backend responde 403 al consultar el estado, el
// botón directamente no se muestra.

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px',
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: 'var(--color-surface-alt)', fontSize: 13, color: 'var(--color-text)',
  fontFamily: 'inherit', outline: 'none',
}

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>{label}</span>
      {children}
      {ayuda && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.4 }}>{ayuda}</span>}
    </label>
  )
}

export function WhatsappBoton() {
  const [estado, setEstado] = useState<WhatsappEstado | null>(null)
  const [visible, setVisible] = useState(true)
  const [abierto, setAbierto] = useState(false)

  // 403: el negocio no está habilitado. 404: la API todavía no tiene el endpoint
  // (el front sale unos minutos antes que la API). En ambos casos no se muestra.
  const cargar = () => getWhatsappConnection().then(setEstado).catch((e) => {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setVisible(false)
  })
  useEffect(() => { cargar() }, [])

  if (!visible) return null
  const conectado = estado?.connected === true

  return (
    <>
      <button
        type="button"
        className="ds-hover"
        onClick={() => setAbierto(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 8px',
          border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer',
          fontSize: 11.5, fontWeight: 500, color: 'var(--color-muted)', fontFamily: 'inherit',
        }}
      >
        {/* El punto verde es el dato: solo aparece si está conectado. */}
        {conectado && <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />}
        {conectado ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
      </button>
      {abierto && <ModalConexion estado={estado} onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </>
  )
}

function ModalConexion({ estado, onCerrar, onCambio }: { estado: WhatsappEstado | null; onCerrar: () => void; onCambio: () => void }) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const conectado = estado?.connected === true

  const conectar = async () => {
    setTrabajando(true); setError(null); setAviso(null)
    try {
      const r = await connectWhatsapp({ phoneNumberId, wabaId, accessToken })
      if (!r.suscripta) setAviso('Se guardó la conexión, pero no se pudo suscribir la app a tu cuenta de WhatsApp: no vas a recibir mensajes hasta que se resuelva.')
      setAccessToken('')
      onCambio()
      if (r.suscripta) onCerrar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo conectar. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  const desconectar = async () => {
    setTrabajando(true); setError(null)
    try {
      await disconnectWhatsapp()
      onCambio()
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo desconectar. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal isOpen onClose={onCerrar} title="WhatsApp" maxWidth={460}>
      {conectado && estado.connected ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--color-text)' }}>
            Conectado al número <strong>{estado.displayPhone ?? estado.phoneNumberId}</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Los mensajes que te lleguen por WhatsApp aparecen en esta bandeja, y tus respuestas salen por el mismo canal.
            WhatsApp solo permite responder dentro de las 24 horas del último mensaje del cliente.
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          <Button variant="danger" size="sm" loading={trabajando} onClick={desconectar}>Desconectar</Button>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Pegá los datos de tu app de Meta (WhatsApp → API Setup). Los mensajes de tus clientes van a llegar a esta bandeja.
          </p>
          <Campo label="ID del número de teléfono">
            <input style={inputStyle} inputMode="numeric" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </Campo>
          <Campo label="ID de la cuenta de WhatsApp Business">
            <input style={inputStyle} inputMode="numeric" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </Campo>
          <Campo label="Token de acceso" ayuda="Se guarda cifrado y no se vuelve a mostrar.">
            <input style={inputStyle} type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          </Campo>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          {aviso && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.5 }}>{aviso}</p>}
          <Button size="sm" loading={trabajando} disabled={!phoneNumberId || !wabaId || !accessToken} onClick={conectar}>Conectar</Button>
        </div>
      )}
    </Modal>
  )
}
