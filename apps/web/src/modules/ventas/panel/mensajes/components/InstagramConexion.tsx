import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { ApiError, disconnectInstagram, getInstagramConnection, startInstagramConnect, type InstagramEstado } from '@/lib/api'

// Conexión de Instagram del negocio, desde el encabezado de la bandeja.
//
// A diferencia de WhatsApp no se pega nada: el dueño toca "Conectar", inicia
// sesión con su cuenta profesional de Instagram y vuelve a Mensajes. La API
// recibe el permiso en el camino de vuelta (ver instagram.controller.ts).
//
// Conectar/desconectar es solo de propietario/admin, y en producción solo de los
// negocios habilitados: si el backend responde 403 (o 404, porque el front sale
// unos minutos antes que la API), el botón directamente no se muestra.

export function InstagramBoton() {
  const router = useRouter()
  const [estado, setEstado] = useState<InstagramEstado | null>(null)
  const [visible, setVisible] = useState(true)
  const [abierto, setAbierto] = useState(false)

  const cargar = () => getInstagramConnection().then(setEstado).catch((e) => {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setVisible(false)
  })
  useEffect(() => { cargar() }, [])

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
        {conectado ? 'Instagram conectado' : 'Conectar Instagram'}
      </button>
      {abierto && <ModalInstagram estado={estado} resultado={resultado} onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </>
  )
}

function ModalInstagram({ estado, resultado, onCerrar, onCambio }: { estado: InstagramEstado | null; resultado: string | null; onCerrar: () => void; onCambio: () => void }) {
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
      onCerrar()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo desconectar. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal isOpen onClose={onCerrar} title="Instagram" maxWidth={460}>
      {resultado === 'sin-suscripcion' && (
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.5 }}>
          Se conectó la cuenta, pero no se pudo activar el aviso de mensajes nuevos: no vas a recibir mensajes hasta que se resuelva. Probá desconectar y volver a conectar.
        </p>
      )}
      {conectado && estado.connected ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--color-text)' }}>
            Conectado a la cuenta <strong>{estado.username ? `@${estado.username}` : 'de Instagram'}</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Los mensajes directos que te lleguen por Instagram aparecen en esta bandeja, y tus respuestas salen por el mismo canal.
            Instagram solo permite responder dentro de las 24 horas del último mensaje del cliente.
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          <Button variant="danger" size="sm" loading={trabajando} onClick={desconectar}>Desconectar</Button>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Vas a iniciar sesión con tu cuenta de Instagram y dar permiso para leer y responder tus mensajes directos desde esta bandeja.
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Necesitás una cuenta <strong>profesional</strong> (de empresa o de creador). Si tu cuenta es personal, podés cambiarla desde los ajustes de Instagram sin costo.
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-error)' }}>{error}</p>}
          <Button size="sm" loading={trabajando} onClick={conectar}>Conectar con Instagram</Button>
        </div>
      )}
    </Modal>
  )
}
