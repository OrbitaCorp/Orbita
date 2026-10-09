import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ApiError, getInstagramConnection, type InstagramEstado } from '@/lib/api'
import { InstagramModal } from './InstagramModal'

// Conexión de Instagram del negocio, desde el encabezado de la bandeja (y desde Difusión).
//
// A diferencia de WhatsApp no se pega nada: el dueño abre el modal, deja su usuario o toca
// "Conectar", inicia sesión con su cuenta profesional de Instagram y vuelve a Mensajes. La API
// recibe el permiso en el camino de vuelta (ver instagram.controller.ts). Todo el recorrido
// (pedir acceso anticipado, esperar, conectar, desconectar) vive en InstagramModal.
//
// Conectar/desconectar es solo de propietario/admin. Si el backend responde 403 o 404 (el front
// sale unos minutos antes que la API), el botón directamente no se muestra.

// Estado de la conexión para las pantallas que la muestran. `visible` pasa a false si el backend
// responde 403 o 404.
export function useInstagramEstado() {
  const [estado, setEstado] = useState<InstagramEstado | null>(null)
  const [visible, setVisible] = useState(true)
  const cargar = () => getInstagramConnection().then(setEstado).catch((e) => {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setVisible(false)
  })
  useEffect(() => { cargar() }, [])
  return { estado, visible, cargar }
}

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
      {abierto && <InstagramModal estado={estado} resultado={resultado} onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </>
  )
}
