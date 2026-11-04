// DEMO INTERNA — índice del módulo Alquileres (localhost; en producción da 404).
// Tres negocios de ejemplo, uno por modo, y las pantallas de cada uno.
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { ArrowRight, LayoutDashboard, Store, CalendarCheck, Rocket, Users } from 'lucide-react'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { NEGOCIOS_DEMO, TIPOS, TIPOS_ORDEN } from '@/modules/alquileres/datos'
import { EstiloReservas } from '@/design-system/reservas/estilo'

// Solo en localhost, igual que /turnos-demo: en producción no existe.
export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

const PANTALLAS = [
  { href: '/alquileres-demo/onboarding', label: 'Alta', Icon: Rocket, texto: 'El alta única de Órbita con Alquileres elegido: qué alquilás, lo que alquilás, tu negocio y tu página.' },
  { href: '/alquileres-demo/panel', label: 'Panel', Icon: LayoutDashboard, texto: 'Agenda, qué hay libre, clientes (eventos en los salones, huéspedes o inquilinos en el alojamiento), ingresos y configuración.' },
  { href: '/alquileres-demo/negocio', label: 'Sitio', Icon: Store, texto: 'Lo que ven los clientes: portada, unidades, paquetes o propiedades.' },
  { href: '/alquileres-demo/reserva', label: 'Reserva', Icon: CalendarCheck, texto: 'El flujo completo, sin registrarse, con seña simulada.' },
  { href: '/alquileres-demo/mis-reservas', label: 'Mis reservas', Icon: Users, texto: 'Lo que reservó el cliente, con cancelación dentro del plazo.' },
]

export default function AlquileresDemo() {
  return (
    <>
      <Head><title>Alquileres · Vista previa local</title></Head>
      <EstiloReservas />
      <BarraDemo />
      <main className="rv" style={{ minHeight: 'calc(100vh - 40px)', background: 'var(--color-surface)' }}>
        <div className="rv-pagina" style={{ maxWidth: 1040 }}>
          <span className="rv-rotulo">Alquileres · Vista previa local</span>
          <h1 className="rv-h1" style={{ fontSize: 32, marginTop: 8 }}>Tres formas de alquilar, un solo módulo</h1>
          <p className="rv-bajada" style={{ fontSize: 15 }}>Por hora, por bloque (uno o varios salones) o por período, por noche o por mes. Todo es visual y con datos de ejemplo: no llama a la API ni guarda nada fuera de este navegador. Elegí un negocio y recorré sus pantallas.</p>
          <div className="rv-grid rv-grid--3" style={{ marginTop: 24 }}>
            {TIPOS_ORDEN.map((t, i) => {
              const n = NEGOCIOS_DEMO[t]
              const info = TIPOS[t]
              return (
                <div key={t} className="rv-card rv-entra" style={{ ['--i' as string]: i, overflow: 'hidden' } as React.CSSProperties}>
                  <img src={n.fotoPortada} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }} />
                  <div style={{ padding: 16 }}>
                    <span className="rv-rotulo">{info.label}</span>
                    <h2 className="rv-h2" style={{ marginTop: 4 }}>{n.nombre}</h2>
                    <p className="rv-bajada" style={{ fontSize: 13.5 }}>{info.descripcion}</p>
                    <div className="rv-fila" style={{ marginTop: 14 }}>
                      <Link href={{ pathname: '/alquileres-demo/panel', query: { tipo: t } }} className="rv-btn rv-btn--primario rv-btn--sm">Panel</Link>
                      <Link href={{ pathname: '/alquileres-demo/negocio', query: { tipo: t } }} className="rv-btn rv-btn--sm">Sitio</Link>
                      <Link href={{ pathname: '/alquileres-demo/reserva', query: { tipo: t } }} className="rv-btn rv-btn--sm">Reservar</Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <h2 className="rv-h2" style={{ marginTop: 36, marginBottom: 12 }}>Pantallas</h2>
          <div className="rv-grid rv-grid--3">
            {PANTALLAS.map(p => (
              <Link key={p.href} href={{ pathname: p.href, query: { tipo: 'cancha' } }} className="rv-card rv-card--pad rv-card--accion" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
                <span className="rv-fila" style={{ gap: 10 }}><span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}><p.Icon size={17} aria-hidden /></span><span className="rv-h3">{p.label}</span></span>
                <span style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>{p.texto}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Abrir <ArrowRight size={14} aria-hidden /></span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
