// Link público de una plantilla de Home — /plantillas/[id], ej. /plantillas/vidriera.
//
// Por qué existe: la galería completa (PlantillasConfig.tsx) vive DENTRO del
// panel, atrás de login — no hay forma de mandarle a alguien de afuera "mirá
// cómo queda esta plantilla" sin darle acceso a la cuenta. Esta página es
// pública (sin auth, ver pages/index.tsx — tampoco la tiene) y dibuja el
// MISMO `Home()` que usan el panel y las tiendas reales: es la maqueta con
// datos de muestra, no una tienda de verdad (para eso ya existe
// negocio.orbita.site, ver Inicio.tsx).
//
// Ruta dinámica (no solo /plantillas/vidriera hardcodeado) a propósito: las
// otras 19 quedan con link propio gratis, sin escribir una página por cada
// una — mismo criterio de "una plantilla nueva no debería pedir tocar más
// archivos de los necesarios" que el resto de este refactor.
//
// `getServerSideProps` no es opcional acá — mismo bug que documenta
// lib/storefront/forceSSR.ts: una página dinámica que Next.js optimiza como
// estática (el default sin getStaticProps/getServerSideProps) deja
// `router.query`/`router.isReady` sin resolver nunca del lado del cliente en
// este entorno, y la página queda esperando para siempre. Con SSR, el id ya
// viene resuelto en las props desde el primer render — no hace falta ni
// tocar el router.

import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react'
import { PLANTILLAS } from '@/modules/ventas/panel/avanzado/plantillas/datos'
import { Home } from '@/modules/ventas/panel/avanzado/plantillas/homes'
import { CSS, cargarFuentes } from '@/modules/ventas/panel/avanzado/plantillas/piezas'

type Props = { id: string }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = typeof ctx.params?.id === 'string' ? ctx.params.id : ''
  return { props: { id } }
}

export default function PlantillaPublica({ id }: Props) {
  const [movil, setMovil] = useState(false)
  const plantilla = PLANTILLAS.find(x => x.id === id && !x.oculta)

  useEffect(() => {
    if (plantilla) cargarFuentes()
  }, [plantilla])

  if (!plantilla) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No encontramos esa plantilla</p>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Revisá el link — puede que esté escrito distinto o ya no esté disponible.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{plantilla.nombre} — Plantillas de Home | Órbita</title>
        <meta name="robots" content="noindex" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Barra fija con volver + toggle de dispositivo — angosta y discreta
          para no competir con la plantilla en sí, que es lo que se comparte. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: '#111827', color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
        <a href="https://orbita.site" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff', textDecoration: 'none', opacity: 0.85 }}>
          <ArrowLeft size={14} strokeWidth={2} /> Órbita
        </a>
        <span style={{ fontWeight: 600 }}>{plantilla.nombre}</span>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setMovil(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: !movil ? '#fff' : 'transparent', color: !movil ? '#111827' : '#fff' }}
          >
            <Monitor size={13} strokeWidth={2} /> Computadora
          </button>
          <button
            onClick={() => setMovil(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: movil ? '#fff' : 'transparent', color: movil ? '#111827' : '#fff' }}
          >
            <Smartphone size={13} strokeWidth={2} /> Celular
          </button>
        </div>
      </div>

      {movil ? (
        <div style={{ maxWidth: 430, margin: '0 auto' }}>
          <Home key={`${plantilla.id}-m`} p={plantilla} movil />
        </div>
      ) : (
        <Home key={plantilla.id} p={plantilla} movil={false} />
      )}
    </>
  )
}
