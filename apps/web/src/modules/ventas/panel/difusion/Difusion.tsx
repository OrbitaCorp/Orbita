import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { InstagramModal } from '../mensajes/components/InstagramModal'
import { useInstagramEstado } from '../mensajes/components/InstagramConexion'

// Difusión: darle a conocer el negocio en redes. Hoy está la conexión con Instagram (la misma que
// se ve en Mensajes); publicar productos, responder comentarios y ver estadísticas se suman acá
// a medida que se construyan. Cada pantalla es una ?vista= (ver Sidebar.tsx).

type Vista = 'instagram' | 'publicaciones' | 'comentarios' | 'estadisticas'
type VistaFutura = Exclude<Vista, 'instagram'>

const FUTURAS: Record<VistaFutura, { titulo: string; texto: string }> = {
  publicaciones: {
    titulo: 'Publicaciones',
    texto: 'Elegí un producto, mirá cómo queda la publicación y subila a tu Instagram sin salir de Órbita.',
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
    <div style={{ padding: '24px 32px 64px', maxWidth: 960 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 6px' }}>Difusión</h1>
      <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        Mostrá tus productos en redes y respondé a quienes te escriben, desde un solo lugar.
      </p>
      {vista === 'instagram' ? <TableroInstagram /> : <TarjetaFutura vista={vista} />}
    </div>
  )
}

function TableroInstagram() {
  const { estado, visible, cargar } = useInstagramEstado()
  const [abierto, setAbierto] = useState(false)
  const [yaSeOfrecio, setYaSeOfrecio] = useState(false)

  // La primera vez que se entra sin cuenta conectada, el modal se abre solo: es lo único que hay
  // para hacer acá. Si se cierra, no vuelve a abrirse hasta que se toque el botón.
  useEffect(() => {
    if (estado && !estado.connected && !yaSeOfrecio) {
      setAbierto(true)
      setYaSeOfrecio(true)
    }
  }, [estado, yaSeOfrecio])

  if (!visible) {
    return (
      <Card padding="sm" style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>Instagram todavía no está disponible para tu negocio.</p>
      </Card>
    )
  }

  const conectado = estado?.connected === true
  const pendiente = estado?.habilitado === false && estado.solicitud !== null
  const resumen = estado === null
    ? 'Cargando…'
    : conectado && estado.connected
      ? (estado.username ? `Conectado a @${estado.username}` : 'Conectado')
      : pendiente && estado.habilitado === false && estado.solicitud
        ? `Pendiente de confirmación · @${estado.solicitud.username}`
        : 'Sin conectar'

  return (
    <>
      <Card padding="sm" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* El punto verde es el dato: solo aparece si está conectado. */}
            <span
              aria-hidden
              style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: conectado ? 'var(--color-success)' : 'var(--color-border)' }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Instagram</p>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-muted)' }}>{resumen}</p>
            </div>
          </div>
          <Button size="sm" variant={conectado ? 'secondary' : 'primary'} disabled={estado === null} onClick={() => setAbierto(true)}>
            {conectado ? 'Administrar' : pendiente ? 'Ver estado' : 'Conectar'}
          </Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 14 }}>
        {(Object.keys(FUTURAS) as VistaFutura[]).map((v) => (
          <Card key={v} padding="sm" style={{ padding: 20 }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{FUTURAS[v].titulo}</p>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>{FUTURAS[v].texto}</p>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: 'var(--color-muted)' }}>Próximamente</p>
          </Card>
        ))}
      </div>

      {abierto && <InstagramModal estado={estado} onCerrar={() => setAbierto(false)} onCambio={cargar} />}
    </>
  )
}

function TarjetaFutura({ vista }: { vista: VistaFutura }) {
  const { titulo, texto } = FUTURAS[vista]
  return (
    <Card padding="sm" style={{ padding: 20, maxWidth: 560 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>{titulo}</h2>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>{texto} Hace falta tener Instagram conectado.</p>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: 'var(--color-muted)' }}>Próximamente</p>
    </Card>
  )
}
