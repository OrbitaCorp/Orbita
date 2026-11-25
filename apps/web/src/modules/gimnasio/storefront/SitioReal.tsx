// El sitio público de un gimnasio real: <slug>.orbita.site y su /reserva. La
// portada (HomeReal) y la reserva (ReservaReal) con los datos de la API
// pública, sin sesión, y con los links del negocio (rutas.ts).
//
// Todo se pide desde el navegador: el servidor manda la página con el estado
// de carga. El día y la hora son los de verdad (la demo usa un día fijo) y
// salen del reloj del módulo (datos/reloj.ts): en el servidor no hay hora, así
// que nada se dibuja hasta estar en el navegador.
//
// Los lugares se vuelven a pedir cuando cambian por algo que pasó acá (una
// reserva, una clase que se completó): solo la grilla, un pedido. No hay
// refresco automático: el sitio no tiene sesión y sus pedidos se cuentan por IP.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { useModoSitio } from '@/design-system/reservas/modoSitio'
import { apiDelSitio, cargarSitio, releerDias, type CargaSitio } from '../datos/origen/sitio'
import { RelojProvider, useRelojReal } from '../datos/reloj'
import HomeReal from './HomeReal'
import ReservaReal from './ReservaReal'
import { CSS_SITIO } from './Sitio'
import { SitioProvider, rutaDelNegocio } from './rutas'

interface P {
  slug: string
  pagina: 'inicio' | 'reserva'
}

export default function SitioReal({ slug, pagina }: P) {
  const router = useRouter()
  // null en el servidor y en el primer pintado: recién en el navegador hay día y hora.
  const foto = useRelojReal()
  const hoy = foto?.reloj.hoy ?? null
  const api = useMemo(() => apiDelSitio(slug), [slug])
  const [carga, setCarga] = useState<CargaSitio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  // Todo de nuevo al entrar, al reintentar y cuando cambia el día (la grilla arranca en hoy).
  useEffect(() => {
    if (!hoy) return
    let vigente = true
    cargarSitio(api, slug, hoy).then(
      c => { if (vigente) { setCarga(c); setError(null) } },
      e => { if (vigente) setError(e instanceof Error && e.message ? e.message : 'No pudimos cargar el sitio. Probá de nuevo en un rato.') },
    )
    return () => { vigente = false }
  }, [api, slug, hoy, vuelta])

  const reintentar = useCallback(() => { setError(null); setVuelta(v => v + 1) }, [])

  // Solo los lugares: si no se pudo, queda lo que había (el próximo pedido lo dice).
  const releer = useCallback(() => {
    if (!carga || !hoy) return
    void releerDias(api, carga, hoy).then(setCarga, () => {})
  }, [api, carga, hoy])

  const contexto = useMemo(() => ({ real: true, ruta: rutaDelNegocio(slug) }), [slug])

  if (error && !carga) {
    return (
      <Marco>
        <h1 className="rv-h1" style={{ fontSize: 24 }}>No se puede reservar en este momento</h1>
        <p className="rv-bajada" role="alert" style={{ margin: '10px auto 0' }}>{error}</p>
        <button type="button" className="rv-btn rv-btn--primario" style={{ marginTop: 18 }} onClick={reintentar}>Probar de nuevo</button>
      </Marco>
    )
  }

  if (!carga || !foto) return <Marco><p role="status" aria-live="polite" style={{ margin: 0, color: 'var(--color-muted)' }}>Cargando…</p></Marco>

  // Un negocio que todavía no cargó ninguna clase no tiene qué mostrar.
  if (carga.negocio.clases.length === 0) {
    return (
      <Marco>
        <h1 className="rv-h1" style={{ fontSize: 24 }}>{carga.negocio.nombre}</h1>
        <p className="rv-bajada" style={{ margin: '10px auto 0' }}>Todavía no hay clases publicadas para reservar. Volvé a pasar en unos días.</p>
      </Marco>
    )
  }

  return (
    <SitioProvider valor={contexto}>
      <RelojProvider reloj={foto.reloj}>
        {pagina === 'reserva'
          ? <ReservaReal carga={carga} api={api} query={router.query} ahoraMs={foto.ms} onCambio={releer} />
          : <HomeReal carga={carga} />}
      </RelojProvider>
    </SitioProvider>
  )
}

/** La página en blanco del sitio, para la carga y los avisos: mismos colores, sin datos del negocio. */
function Marco({ children }: { children: ReactNode }) {
  const oscuro = useModoSitio('gimnasio', false)
  return (
    <div className="rv gis" data-real data-oscuro={oscuro || undefined}>
      <EstiloReservas />
      <style>{CSS_SITIO}</style>
      <main className="gis-cont" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>{children}</div>
      </main>
    </div>
  )
}
