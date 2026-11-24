// El sitio público de un negocio real de Alquileres: <slug>.orbita.site, su
// /reserva y /mi-reserva/<token>. Son las mismas pantallas de la demo (Home,
// Reserva) con los datos de la API pública de reservas en vez de los de
// ejemplo, y con los links del negocio (rutas.ts).
//
// Todo se pide desde el navegador y sin sesión: el servidor manda la página
// con el estado de carga. El día es el de verdad (la demo usa uno fijo): se
// fija una sola vez, en el navegador, antes de dibujar nada.
//
// Por ahora, solo alojamiento por noche. Lo que el sitio no sabe de las
// reservas ajenas lo reemplazan las noches ocupadas que da la API.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { claveDeIntento } from '@/lib/reservasApi/cliente'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { HOY, ahoraEnArgentina, usarHoyReal } from '../datos'
import { cargarSitio, reservarEnSitio, type CargaSitio } from '../datos/origen/sitio'
import type { PedidoSitio } from '../datos/origen/escribir'
import Home from './Home'
import MiReserva from './MiReserva'
import Reserva from './Reserva'
import { CSS_SITIO } from './Sitio'
import { SitioProvider, guardarMiReserva, rutaDelNegocio, rutaMiReserva, ultimaReserva } from './rutas'

interface P {
  slug: string
  pagina: 'inicio' | 'reserva' | 'mi-reserva'
  /** Solo en mi-reserva: el token del enlace personal. */
  token?: string
}

export default function SitioReal({ slug, pagina, token }: P) {
  // El día real, una sola vez y solo en el navegador (en el servidor HOY lo comparten todos los pedidos).
  const [enNavegador] = useState(() => {
    if (typeof window === 'undefined') return false
    usarHoyReal(...ahoraEnArgentina())
    return true
  })
  const [carga, setCarga] = useState<CargaSitio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)
  // La última reserva hecha desde este navegador, para ofrecer "Mi reserva" en el menú.
  const [miToken, setMiToken] = useState<string | null>(() => (typeof window === 'undefined' ? null : ultimaReserva(slug)))

  useEffect(() => {
    if (!enNavegador) return
    let vigente = true
    cargarSitio(slug, HOY).then(
      c => { if (vigente) { setCarga(c); setError(null) } },
      e => { if (vigente) setError(e instanceof Error && e.message ? e.message : 'No pudimos cargar el sitio. Probá de nuevo en un rato.') },
    )
    return () => { vigente = false }
  }, [slug, vuelta, enNavegador])

  const recargar = useCallback(() => { setError(null); setVuelta(v => v + 1) }, [])

  // La clave del intento: la misma mientras se pida lo mismo, así un doble toque o un
  // reintento después de un corte no duplican la reserva (el servidor devuelve la que ya hizo).
  const intento = useRef<{ firma: string; clave: string } | null>(null)

  const enviar = useCallback(async (p: Omit<PedidoSitio, 'clave'>) => {
    const firma = `${p.propiedadId}|${p.entrada}|${p.salida}`
    if (intento.current?.firma !== firma) intento.current = { firma, clave: claveDeIntento() }
    const res = await reservarEnSitio(slug, { ...p, clave: intento.current.clave })
    // Hecha: el próximo pedido de esas mismas fechas (después de cancelar, por ejemplo) es otro intento.
    if (res.ok) intento.current = null
    if (res.ok) { guardarMiReserva(slug, res.hecha.token); setMiToken(res.hecha.token) }
    // Quedó tomada o se la llevó otro: en los dos casos el calendario cambió.
    if (res.ok || res.ocupado) setVuelta(v => v + 1)
    return res
  }, [slug])

  const contexto = {
    real: true,
    ruta: rutaDelNegocio(slug),
    miReserva: miToken ? rutaMiReserva(slug, miToken) : null,
    ultimoDia: carga?.ultimoDia ?? null,
    confirmaElNegocio: carga?.confirmaElNegocio ?? false,
  }

  // "Mi reserva" se abre aunque el sitio no cargue (reservas en pausa): solo espera a saber si cargó o no.
  if (pagina === 'mi-reserva' && token && (carga || error)) {
    return <SitioProvider valor={contexto}><MiReserva slug={slug} token={token} negocio={carga?.negocio ?? null} /></SitioProvider>
  }

  if (error && !carga) {
    return (
      <Marco>
        <h1 className="rv-h1" style={{ fontSize: 24 }}>No se puede reservar en este momento</h1>
        <p className="rv-bajada" role="alert" style={{ margin: '10px auto 0' }}>{error}</p>
        <button type="button" className="rv-btn rv-btn--primario" style={{ marginTop: 18 }} onClick={recargar}>Probar de nuevo</button>
      </Marco>
    )
  }

  if (!carga) return <Marco><p role="status" aria-live="polite" style={{ margin: 0, color: 'var(--color-muted)' }}>Cargando…</p></Marco>

  // Canchas y salones todavía no reservan en el sitio real; y un alojamiento sin propiedades no tiene qué mostrar.
  if (carga.tipo !== 'estadia' || carga.negocio.propiedades.length === 0) {
    return (
      <Marco>
        <h1 className="rv-h1" style={{ fontSize: 24 }}>{carga.negocio.nombre}</h1>
        <p className="rv-bajada" style={{ margin: '10px auto 0' }}>Todavía no hay nada publicado para reservar. Volvé a pasar en unos días.</p>
      </Marco>
    )
  }

  return (
    <SitioProvider valor={contexto}>
      {pagina === 'reserva'
        ? <Reserva negocio={carga.negocio} reservas={[]} enviar={enviar} />
        : <Home negocio={carga.negocio} reservas={[]} />}
    </SitioProvider>
  )
}

/** La página en blanco del sitio, para la carga y los avisos: mismos colores, sin datos del negocio. */
function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="rv als" data-tipo="estadia" data-real>
      <EstiloReservas />
      <style>{CSS_SITIO}</style>
      <main className="als-cont" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>{children}</div>
      </main>
    </div>
  )
}
