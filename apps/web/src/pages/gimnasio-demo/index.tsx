// DEMO INTERNA — índice del módulo Gimnasio (localhost; en producción da 404).
// Los ocho rubros de clases con cupo, que comparten el mismo motor, y las
// pantallas de la demo. Cada link lleva ?rubro= para que el resto lo conserve.
import type { CSSProperties } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { ArrowRight, CalendarCheck, LayoutDashboard, Rocket, Store, Users } from 'lucide-react'
import { BarraDemo, useRubroDemo } from '@/modules/gimnasio/demo/BarraDemo'
import { RUBROS_GYM, negocioDe } from '@/modules/gimnasio/datos'
import { EstiloReservas } from '@/design-system/reservas/estilo'

// Solo en localhost, igual que /turnos-demo y /alquileres-demo: en producción no existe.
export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

const PANTALLAS = [
  { href: '/gimnasio-demo/onboarding', label: 'Alta', Icon: Rocket, texto: 'El alta única de Órbita con Gimnasio elegido: rubro, actividades con su cupo y planes con precio.' },
  { href: '/gimnasio-demo/panel', label: 'Panel', Icon: LayoutDashboard, texto: 'Clases del día con check-in y lista de espera, grilla semanal, socios con vencimientos, ingresos y configuración.' },
  { href: '/gimnasio-demo/negocio', label: 'Sitio', Icon: Store, texto: 'Lo que ven los socios: las clases de hoy, la semana, los planes con precio y dónde queda.' },
  { href: '/gimnasio-demo/reserva', label: 'Reservar clase', Icon: CalendarCheck, texto: 'Reserva de lugar sin registrarse: con plan, pack, clase suelta o la de prueba gratis (una vez por persona).' },
  { href: '/gimnasio-demo/mis-clases', label: 'Mis clases', Icon: Users, texto: 'El plan del socio, sus próximas clases con check-in y cancelación, y su asistencia.' },
]

export default function GimnasioDemo() {
  const [rubro] = useRubroDemo()
  return (
    <>
      <Head><title>Gimnasio · Vista previa local</title></Head>
      <EstiloReservas />
      <BarraDemo />
      <main className="rv" style={{ minHeight: 'calc(100vh - 40px)', background: 'var(--color-surface)' }}>
        <div className="rv-pagina" style={{ maxWidth: 1040 }}>
          <span className="rv-rotulo">Gimnasio · Vista previa local</span>
          <h1 className="rv-h1" style={{ fontSize: 32, marginTop: 8 }}>Clases con cupo, un solo módulo</h1>
          <p className="rv-bajada" style={{ fontSize: 15 }}>Gimnasio, crossfit, funcional, yoga, danza, artes marciales, natación y talleres comparten el mismo motor: grilla semanal con cupo, profe y sala, lista de espera que avanza sola, planes, socios y check-in. Todo es visual y con datos de ejemplo: no llama a la API ni guarda nada fuera de este navegador.</p>

          <h2 className="rv-h2" style={{ marginTop: 28, marginBottom: 12 }}>Rubros</h2>
          <div className="rv-grid rv-grid--4">
            {RUBROS_GYM.map((r, i) => {
              const n = negocioDe(r)
              return (
                <div key={r.key} className="rv-card rv-entra" style={{ ['--i' as string]: i, overflow: 'hidden', display: 'flex', flexDirection: 'column' } as CSSProperties}>
                  <img src={n.fotoPortada} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', background: 'var(--color-surface-alt)' }} />
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span className="rv-rotulo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><r.Icon size={13} aria-hidden /> {r.label}</span>
                    <h3 className="rv-h2" style={{ marginTop: 4 }}>{n.nombre}</h3>
                    <p className="rv-bajada" style={{ fontSize: 13.5, flex: 1 }}>{r.descripcion}. {n.clases.length} clases por semana.</p>
                    {/* Los tres en una fila (con el padding de siempre, Reservar caía solo a la segunda). */}
                    <div className="rv-fila" style={{ marginTop: 14, gap: 6, flexWrap: 'nowrap' }}>
                      <Link href={{ pathname: '/gimnasio-demo/panel', query: { rubro: r.key } }} className="rv-btn rv-btn--primario rv-btn--sm" style={{ flex: 1, padding: '0 8px' }} aria-label={`Panel de ${n.nombre}`}>Panel</Link>
                      <Link href={{ pathname: '/gimnasio-demo/negocio', query: { rubro: r.key } }} className="rv-btn rv-btn--sm" style={{ flex: 1, padding: '0 8px' }} aria-label={`Sitio de ${n.nombre}`}>Sitio</Link>
                      <Link href={{ pathname: '/gimnasio-demo/reserva', query: { rubro: r.key } }} className="rv-btn rv-btn--sm" style={{ flex: 1, padding: '0 8px' }} aria-label={`Reservar una clase en ${n.nombre}`}>Reservar</Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <h2 className="rv-h2" style={{ marginTop: 36, marginBottom: 4 }}>Pantallas</h2>
          <p className="rv-bajada" style={{ marginTop: 0, marginBottom: 12 }}>Con el rubro elegido arriba a la derecha: {rubro.label}.</p>
          <div className="rv-grid rv-grid--3">
            {PANTALLAS.map(p => (
              <Link key={p.href} href={{ pathname: p.href, query: { rubro: rubro.key } }} className="rv-card rv-card--pad rv-card--accion" style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}>
                <span className="rv-fila" style={{ gap: 10 }}><span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}><p.Icon size={17} aria-hidden /></span><span className="rv-h3">{p.label}</span></span>
                <span style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>{p.texto}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Abrir <ArrowRight size={14} aria-hidden /></span>
              </Link>
            ))}
          </div>

          <h2 className="rv-h2" style={{ marginTop: 36, marginBottom: 8 }}>Qué es real y qué es simulado</h2>
          {/* list-style explícito: el preflight de Tailwind se lo saca a todas las listas y sin viñetas parecía un párrafo con sangría. */}
          <ul className="rv-bajada" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.7, listStyle: 'disc' }}>
            <li>El calendario .ics de las clases se genera de verdad en el navegador (Configuración › Calendarios, y cada reserva en Mis clases).</li>
            <li>La importación de un calendario externo por URL es simulada: no se descarga nada y lo dice en pantalla («Demo: sincronización simulada»).</li>
            <li>Los cobros (planes, packs, clases sueltas) se registran a mano: no se cobra nada.</li>
          </ul>
        </div>
      </main>
    </>
  )
}
