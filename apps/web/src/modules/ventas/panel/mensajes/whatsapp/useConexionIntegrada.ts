import { useEffect, useRef, useState } from 'react'
import { ApiError, connectWhatsappIntegrado } from '@/lib/api'
import { ErrorDeSignup, iniciarEmbeddedSignup, precargarSdk } from '@/lib/meta/embeddedSignup'

// Conectar WhatsApp con el botón de Meta (Embedded Signup): abre el flujo de Meta, y cuando el cliente termina manda
// el código y los ids a la API, que deja la cuenta conectada. Esta pieza lleva el estado de ese camino para la pantalla.

export type EstadoDeConexion = 'libre' | 'meta' | 'guardando'

interface Opciones {
  /** Solo se carga el SDK de Meta cuando la pantalla de conectar está a la vista. */
  activo: boolean
  /** Se conectó: que la pantalla vuelva a mirar el estado de la cuenta. `coexistencia`: el número sigue en la app del celular. */
  onConectado: (r: { coexistencia: boolean }) => void
}

export function useConexionIntegrada({ activo, onConectado }: Opciones) {
  const [estado, setEstado] = useState<EstadoDeConexion>('libre')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)
  const corte = useRef<AbortController | null>(null)
  // En desarrollo React monta, desmonta y vuelve a montar: por eso se vuelve a poner en true al montar.
  useEffect(() => { montado.current = true; return () => { montado.current = false; corte.current?.abort() } }, [])

  // El SDK se carga de antes: FB.login tiene que salir directo del clic, y cargarlo recién ahí lo hace bloqueable.
  useEffect(() => {
    if (!activo) return
    precargarSdk().catch((e) => { if (montado.current) setError(e instanceof ErrorDeSignup ? e.message : 'No se pudo cargar el inicio de sesión de Meta.') })
  }, [activo])

  // OJO: nada de `await` antes de `iniciarEmbeddedSignup()`: se llama en el mismo turno del clic.
  const conectar = () => {
    setError(null); setAviso(null)
    corte.current?.abort()
    const control = new AbortController()
    corte.current = control
    const flujo = iniciarEmbeddedSignup(control.signal)
    setEstado('meta')
    flujo
      .then(async (r) => {
        if (montado.current) setEstado('guardando')
        const res = await connectWhatsappIntegrado(r)
        if (!montado.current) return
        if (!res.suscripta) setAviso('Quedó conectada, pero no pudimos suscribir la app a tu cuenta de WhatsApp: no vas a recibir mensajes hasta que se resuelva. Probá desconectar y volver a conectar.')
        onConectado({ coexistencia: res.coexistencia })
      })
      .catch((e: unknown) => {
        if (!montado.current) return
        // Cancelar es una decisión de la persona, no un error: no se muestra en rojo.
        if (e instanceof ErrorDeSignup && e.cancelado) setAviso(e.message)
        else setError(e instanceof ErrorDeSignup || e instanceof ApiError ? e.message : 'No se pudo conectar. Probá de nuevo.')
      })
      .finally(() => { if (montado.current && corte.current === control) setEstado('libre') })
  }

  /** Corta la espera de la ventana de Meta (por ejemplo, si la persona la cerró con la X). */
  const cancelar = () => corte.current?.abort()

  return { estado, error, aviso, conectar, cancelar }
}
