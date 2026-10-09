import { useRouter } from 'next/router'
import { Card } from '@/design-system/components/Card'
import { ContenidoInstagram, useInstagramEstado } from '../mensajes/components/InstagramConexion'

// Difusión: darle a conocer el negocio en redes. Hoy está la conexión con Instagram (la misma que
// se ve en Mensajes); publicar productos, responder comentarios y ver estadísticas se suman acá
// a medida que se construyan. Cada pantalla es una ?vista= (ver Sidebar.tsx).

type Vista = 'instagram' | 'publicaciones' | 'comentarios' | 'estadisticas'

const PROXIMAMENTE: Record<Exclude<Vista, 'instagram'>, { titulo: string; texto: string }> = {
  publicaciones: {
    titulo: 'Publicaciones',
    texto: 'Elegí un producto, mirá cómo queda la publicación y subila a tu Instagram sin salir de Órbita. Hace falta tener Instagram conectado.',
  },
  comentarios: {
    titulo: 'Comentarios',
    texto: 'Leé y respondé los comentarios de tus publicaciones desde acá, junto con tus mensajes.',
  },
  estadisticas: {
    titulo: 'Estadísticas',
    texto: 'Mirá cuánta gente vio lo que publicaste y qué publicaciones funcionan mejor.',
  },
}

function esVista(v: unknown): v is Vista {
  return v === 'instagram' || v === 'publicaciones' || v === 'comentarios' || v === 'estadisticas'
}

export default function Difusion() {
  const router = useRouter()
  const vista: Vista = esVista(router.query.vista) ? router.query.vista : 'instagram'

  return (
    <div style={{ padding: '24px 32px 64px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>Difusión</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Mostrá tus productos en redes y respondé a quienes te escriben, desde un solo lugar.
      </p>
      {vista === 'instagram' ? <TarjetaInstagram /> : <TarjetaProximamente vista={vista} />}
    </div>
  )
}

function TarjetaInstagram() {
  const { estado, visible, cargar } = useInstagramEstado()
  return (
    <Card padding="sm" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px' }}>Instagram</h2>
      {!visible ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>Instagram todavía no está disponible para tu negocio.</p>
      ) : estado === null ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>Cargando…</p>
      ) : (
        <ContenidoInstagram estado={estado} onCambio={cargar} onDesconectado={() => undefined} />
      )}
    </Card>
  )
}

function TarjetaProximamente({ vista }: { vista: Exclude<Vista, 'instagram'> }) {
  const { titulo, texto } = PROXIMAMENTE[vista]
  return (
    <Card padding="sm" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>{titulo}</h2>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>{texto}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text)', fontWeight: 500 }}>Próximamente.</p>
    </Card>
  )
}
