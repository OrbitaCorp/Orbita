import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { ApiError, disconnectInstagram, getInstagramConnection, requestInstagramAccess, startInstagramConnect, type InstagramEstado } from '@/lib/api'

// Conexión de Instagram del negocio, desde el encabezado de la bandeja.
//
// A diferencia de WhatsApp no se pega nada: el dueño toca "Conectar", inicia
// sesión con su cuenta profesional de Instagram y vuelve a Mensajes. La API
// recibe el permiso en el camino de vuelta (ver instagram.controller.ts).
//
// Conectar/desconectar es solo de propietario/admin. Mientras la app de Meta no
// tenga acceso avanzado, solo conectan las cuentas que el equipo sumó como
// evaluadoras: un negocio sin acceso ve el pedido de acceso anticipado (deja su
// @usuario), y cuando el equipo lo habilita pasa a ver "Conectar". Si el backend
// responde 403 o 404 (el front sale unos minutos antes que la API), el botón
// directamente no se muestra.

// Cómo aceptar la invitación de evaluador en Instagram. Sale cuando Meta apruebe el
// acceso avanzado (App Review): ahí ya no hace falta y se borra de este archivo.
const PASOS_EVALUADOR = 'En Instagram, andá a Configuración → Apps y sitios web → Invitaciones de evaluador y aceptá la de Órbita.'

export function InstagramBoton() {
  const router = useRouter()
  const { estado, visible, cargar } = useInstagramEstado()
  const [abierto, setAbierto] = useState(false)

  // Al volver del login, la API manda ?ig=conectado | sin-suscripcion: se abre el
  // modal con el resultado y se limpia la dirección para no repetirlo al recargar.
  const resultado = typeof router.query.ig === 'string' ? router.query.ig : null
  useEffect(() => {
    if (!resultado) return
    setAbierto(true)
    cargar()
    const { ig: _ig, ...resto } = router.query
    router.replace({ pathname: router.pathname, query: resto }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado])

  if (!visible) return null
  const conectado = estado?.connected === true
  const pedidoPendiente = estado?.habilitado === false && estado.solicitud !== null

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
        {conectado ? 'Instagram conectado' : pedidoPendiente ? 'Instagram: acceso pendiente' : 'Conectar Instagram'}
      </button>
      {abierto && <ModalInstagram estado={estado} resultado={resultado} onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </>
  )
}

function ModalInstagram({ estado, resultado, onCerrar, onCambio }: { estado: InstagramEstado | null; resultado: string | null; onCerrar: () => void; onCambio: () => void }) {
  return (
    <Modal isOpen onClose={onCerrar} title="Instagram" maxWidth={460}>
      <ContenidoInstagram estado={estado} resultado={resultado} onCambio={onCambio} onDesconectado={onCerrar} />
    </Modal>
  )
}

// Estado de la conexión para las pantallas que la muestran (la bandeja y Difusión). Si el backend
// responde 403 o 404 (el front sale unos minutos antes que la API), `visible` pasa a false.
export function useInstagramEstado() {
  const [estado, setEstado] = useState<InstagramEstado | null>(null)
  const [visible, setVisible] = useState(true)
  const cargar = () => getInstagramConnection().then(setEstado).catch((e) => {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setVisible(false)
  })
  useEffect(() => { cargar() }, [])
  return { estado, visible, cargar }
}

// Lo que se hace con Instagram según el estado: pedir acceso, conectar o desconectar. Va dentro de
// un modal (bandeja) o de una tarjeta (Difusión).
export function ContenidoInstagram({ estado, resultado = null, onCambio, onDesconectado }: { estado: InstagramEstado | null; resultado?: string | null; onCambio: () => void; onDesconectado?: () => void }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conectado = estado?.connected === true

  const conectar = async () => {
    setTrabajando(true); setError(null)
    try {
      const { url } = await startInstagramConnect()
      window.location.href = url
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar la conexión. Probá de nuevo.')
      setTrabajando(false)
    }
  }

  const desconectar = async () => {
    setTrabajando(true); setError(null)
    try {
      await disconnectInstagram()
      onCambio()
      onDesconectado?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo desconectar. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <>
      {resultado === 'sin-suscripcion' && (
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.5 }}>
          Se conectó la cuenta, pero no se pudo activar el aviso de mensajes nuevos: no vas a recibir mensajes hasta que se resuelva. Probá desconectar y volver a conectar.
        </p>
      )}
      {estado?.habilitado === false ? (
        <PedirAcceso solicitud={estado.solicitud} onEnviado={onCambio} />
      ) : conectado && estado.connected ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--color-text)' }}>
            Conectado a la cuenta <strong>{estado.username ? `@${estado.username}` : 'de Instagram'}</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Los mensajes directos que te lleguen por Instagram aparecen en la bandeja de Mensajes, y tus respuestas salen por el mismo canal.
            Instagram solo permite responder dentro de las 24 horas del último mensaje del cliente.
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          <Button variant="danger" size="sm" loading={trabajando} onClick={desconectar}>Desconectar</Button>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Vas a iniciar sesión con tu cuenta de Instagram y dar permiso para leer y responder tus mensajes directos desde la bandeja de Mensajes.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Necesitás una cuenta <strong>profesional</strong> (de empresa o de creador). Si tu cuenta es personal, podés cambiarla desde los ajustes de Instagram sin costo.
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Si es la primera vez: {PASOS_EVALUADOR}
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          <Button size="sm" loading={trabajando} onClick={conectar}>Conectar con Instagram</Button>
        </div>
      )}
    </>
  )
}

// Negocio sin acceso todavía: deja su @usuario (o corrige el que dejó) y espera a que el
// equipo lo sume como evaluador. Cuando lo habiliten, el estado cambia y aparece "Conectar".
function PedirAcceso({ solicitud, onEnviado }: { solicitud: { username: string } | null; onEnviado: () => void }) {
  const [editando, setEditando] = useState(solicitud === null)
  const [usuario, setUsuario] = useState(solicitud?.username ?? '')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    setTrabajando(true); setError(null)
    try {
      await requestInstagramAccess(usuario)
      onEnviado()
      setEditando(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar el pedido. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  if (!editando && solicitud) {
    return (
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--color-text)' }}>
          Pedido enviado con la cuenta <strong>@{solicitud.username}</strong>.
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Vamos a sumar tu cuenta como evaluadora de la app. Cuando esté lista, acá vas a ver el botón para conectar. Antes de eso, {PASOS_EVALUADOR.charAt(0).toLowerCase() + PASOS_EVALUADOR.slice(1)}
        </p>
        <button
          type="button"
          className="ds-hover"
          onClick={() => setEditando(true)}
          style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12.5, color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cambiar usuario
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Instagram está en acceso anticipado. Dejanos el usuario de la cuenta que vas a conectar y la sumamos como evaluadora de la app de Órbita.
        Tiene que ser una cuenta <strong>profesional</strong> (de empresa o de creador).
      </p>
      <label style={{ display: 'block', margin: '0 0 12px' }}>
        <span style={{ display: 'block', margin: '0 0 4px', fontSize: 12, color: 'var(--color-muted)' }}>Usuario de Instagram</span>
        <input
          className="ds-field"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="@tu_tienda"
          maxLength={60}
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px',
            border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface-alt)',
            fontSize: 13, color: 'var(--color-text)', fontFamily: 'inherit', outline: 'none',
          }}
        />
      </label>
      {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
      <Button size="sm" loading={trabajando} disabled={!usuario.trim()} onClick={enviar}>Pedir acceso</Button>
    </div>
  )
}
