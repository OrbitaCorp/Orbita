// Comparador de fondos animados para el modo claro de los paneles de reservas
// (Turnos, Alquileres, Gimnasio). Ale pidió "algo más espectacular" que la aurora
// con velos y que el shader SoftAurora: acá están los candidatos de React Bits
// (design-system/fondos) con los colores de marca, montados en una maqueta del
// panel (barra lateral, header y tarjetas) para verlos donde van a vivir y elegir
// uno. Solo local: como las demos, da 404 en producción (sin datos ni API).
//
// Dos ubicaciones (?lugar=):
// - banda (por defecto): el fondo vive en una banda arriba del contenido, detrás del
//   encabezado de la página, que se desliza con el scroll y se desvanece hacia abajo;
//   las tarjetas flotan encima. Puede ir con mucho color porque el único texto que
//   le queda encima es el del encabezado, que en esta ubicación va en tinta oscura.
// - pantalla: el fondo cubre todo el contenido, más tenue para que se pueda leer.
// Se elige con los botones de abajo o con ?fondo=<id>. El que quedó en los paneles es "Cielo de
// noche" (design-system/fondos/HorizonteOrbita), que LayoutPanel además ajusta al encabezado.
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, type ReactNode } from 'react'
import HorizonteOrbita from '@/design-system/fondos/HorizonteOrbita'
import Iridescence from '@/design-system/fondos/Iridescence'
import LightRays from '@/design-system/fondos/LightRays'
import LiquidChrome from '@/design-system/fondos/LiquidChrome'
import Particles from '@/design-system/fondos/Particles'
import Prism from '@/design-system/fondos/Prism'
import Silk from '@/design-system/fondos/Silk'
import SoftAurora from '@/design-system/fondos/SoftAurora'
import Threads from '@/design-system/fondos/Threads'

// Solo en localhost, igual que las demos de los módulos: en producción no existe.
export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

const AZUL = '#3B82F6'
const VIOLETA = '#8B5CF6'
const CIAN = '#22D3EE'

interface Opcion { id: string; nombre: string; nota: string; fondo: ReactNode }

const OPCIONES: Opcion[] = [
  { id: 'horizonte-noche', nombre: 'Cielo de noche', nota: 'El cielo de la landing (oscuro, con estrellas y anillos) solo arriba del horizonte; el contenido sobre el planeta claro.',
    fondo: <HorizonteOrbita oscuro /> },
  { id: 'horizonte', nombre: 'Horizonte de Órbita', nota: 'La que quedó en los paneles: la escena de la landing en claro, cielo celeste con estrellas, anillos y la línea de luz del planeta.',
    fondo: <HorizonteOrbita /> },
  { id: 'horizonte-oscuro', nombre: 'Horizonte oscuro', nota: 'La escena de la landing tal cual, con el planeta negro, solo en la banda de arriba.',
    fondo: <HorizonteOrbita oscuro planetaOscuro /> },
  { id: 'iridescence', nombre: 'Iridiscente', nota: 'Superficie líquida tornasolada en azul y violeta; se revuelve con el cursor.',
    fondo: <Iridescence color={[0.62, 0.74, 1]} speed={0.55} amplitude={0.14} brightness={1.25} saturation={0.95} contrast={0.9} sheen={0.45} opacity={0.95} mouseReact clickSwirl={false} resolution={0.6} /> },
  { id: 'silk', nombre: 'Seda', nota: 'Pliegues de satén azul con brillos blancos que giran hacia el cursor.',
    fondo: <Silk lightMode color="#9DBDF7" sheenColor="#FFFFFF" speed={3.5} scale={1.15} noiseIntensity={0.8} rotation={0.35} sheen={0.7} depth={0.35} glow={0.5} wave={1.1} mouseInteraction interactionStrength={0.8} clickRipple={false} dpr={1} /> },
  { id: 'light-rays', nombre: 'Rayos de luz', nota: 'Luz volumétrica que baja desde arriba, con halo y bruma; sigue al cursor.',
    fondo: <LightRays lightMode raysOrigin="top-center" raysColor={AZUL} raysSpeed={0.9} lightSpread={1.1} rayLength={2.2} rayDensity={1.2} glow={1} haze={0.45} intensity={1.15} followMouse mouseInfluence={0.15} clickPulse={false} cursorShadow={false} /> },
  { id: 'liquid-chrome', nombre: 'Cromo líquido', nota: 'Metal líquido celeste que ondula; ondas al mover el cursor.',
    fondo: <LiquidChrome lightMode color="#BBD3FB" speed={0.18} amplitude={0.28} exposure={1.1} roughness={0.35} interactive maxDevicePixelRatio={1} /> },
  { id: 'threads', nombre: 'Hilos', nota: 'Hilos azules y violetas que fluyen y se abren alrededor del cursor.',
    fondo: <Threads color={AZUL} accentColor={VIOLETA} amplitude={1.5} distance={0.45} enableMouseInteraction lineCount={80} thickness={0.7} brightness={1.2} angle={18} opacity={0.9} /> },
  { id: 'prism', nombre: 'Prisma', nota: 'Un prisma de luz espectral que gira arriba y responde al cursor.',
    fondo: <Prism lightMode colors={[AZUL, VIOLETA, CIAN]} height={3.2} baseWidth={5.2} animationType="rotate" glow={1} scale={3.2} saturation={1.3} timeScale={0.4} interactive resolution={0.6} /> },
  { id: 'soft-aurora', nombre: 'Aurora suave', nota: 'La de antes, más intensa: tinta azul y violeta que fluye.',
    fondo: <SoftAurora lightMode color1={AZUL} color2={VIOLETA} speed={0.4} scale={1.3} brightness={1.2} opacity={0.9} bandHeight={0.7} bandSpread={1.1} tilt={0.18} spectrum={0.4} mouseInfluence={0.2} clickPulse={false} /> },
  { id: 'particles', nombre: 'Partículas', nota: 'Constelación de partículas de marca que se unen con líneas.',
    fondo: <Particles particleColors={[AZUL, VIOLETA, CIAN]} particleCount={260} particleSpread={9} particleBaseSize={140} alphaParticles glow={0.8} twinkle={0.5} connections connectionDistance={130} hoverEffect="repel" drift="up" driftSpeed={0.5} /> },
]

const CSS = `
  .fd { position: fixed; inset: 0; display: flex; background: var(--color-surface); color: var(--color-body); font-family: inherit; }
  .fd-lateral { width: 240px; flex-shrink: 0; background: var(--color-bg); border-right: 1px solid var(--color-border); padding: 16px; display: flex; flex-direction: column; gap: 6px; position: relative; z-index: 1; }
  .fd-logo { display: flex; align-items: center; gap: 10px; padding: 4px 4px 14px; font-weight: 700; color: var(--color-text); }
  .fd-logo i { width: 28px; height: 28px; border-radius: 50%; background: var(--color-primary); display: block; }
  .fd-grupo { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); padding: 12px 10px 4px; }
  .fd-item { height: 36px; padding: 0 10px; border-radius: 8px; display: flex; align-items: center; font-size: 14px; font-weight: 500; color: var(--color-body); }
  .fd-item[data-activo='true'] { background: var(--color-primary-bg); color: var(--chip-primary-fg); font-weight: 600; }
  .fd-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; z-index: 1; }
  .fd-header { height: 64px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--color-bg); border-bottom: 1px solid var(--color-border); font-size: 14px; color: var(--color-muted); position: relative; z-index: 2; }
  .fd-header b { color: var(--color-text); font-weight: 600; }
  .fd-main { flex: 1; min-width: 0; position: relative; overflow: auto; }
  .fd-fondo { position: absolute; left: 0; right: 0; top: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .fd-fondo > * { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; }
  .fd-fondo--vivo { pointer-events: auto; }
  .fd[data-lugar='banda'] .fd-fondo { height: 460px; -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 48%, transparent 100%); mask-image: linear-gradient(to bottom, #000 0, #000 48%, transparent 100%); }
  .fd[data-lugar='pantalla'] .fd-fondo { position: fixed; left: 240px; top: 64px; right: 0; bottom: 0; opacity: 0.55; }
  .fd-pagina { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 24px 32px 160px; pointer-events: none; }
  .fd-rotulo { font-family: var(--rv-mono, ui-monospace, monospace); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); }
  .fd-h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); margin: 6px 0 6px; }
  .fd-bajada { font-size: 14px; color: var(--color-muted); margin: 0 0 20px; }
  /* En la banda, el encabezado va en tinta oscura: el gris apagado no llega a AA sobre color. */
  .fd[data-lugar='banda'] .fd-rotulo, .fd[data-lugar='banda'] .fd-bajada { color: var(--color-text); }
  .fd[data-oscuro='true'] .fd-rotulo, .fd[data-oscuro='true'] .fd-bajada, .fd[data-oscuro='true'] .fd-h1 { color: #F1F5F9; }
  .fd[data-lugar='banda'] .fd-rotulo { font-weight: 600; }
  .fd-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
  .fd-card { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; }
  .fd-kpi small { display: block; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); }
  .fd-kpi b { display: block; font-family: var(--rv-mono, ui-monospace, monospace); font-size: 30px; font-weight: 700; color: var(--color-text); margin: 8px 0 4px; }
  .fd-kpi span { font-size: 12.5px; color: var(--color-muted); }
  .fd-fila { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 1px solid var(--color-border); font-size: 14px; }
  .fd-fila:first-child { border-top: none; }
  .fd-fila b { font-weight: 600; color: var(--color-text); }
  .fd-fila i { font-style: normal; font-family: var(--rv-mono, ui-monospace, monospace); color: var(--color-muted); font-size: 13px; }
  .fd-h2 { font-size: 15px; font-weight: 600; color: var(--color-text); margin: 26px 0 10px; }
  .fd-barra { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 50; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 8px; width: max-content; max-width: calc(100vw - 32px); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 14px; box-shadow: 0 12px 40px rgba(2,6,23,0.18); }
  .fd-btn { min-height: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-body); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  .fd-btn[aria-pressed='true'] { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--chip-primary-fg); }
  .fd-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .fd-sep { width: 1px; align-self: stretch; background: var(--color-border); margin: 0 4px; }
  .fd-nota { width: 100%; text-align: center; font-size: 12.5px; color: var(--color-muted); padding: 2px 6px 0; }
  @media (max-width: 768px) {
    .fd-lateral { display: none; }
    .fd-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fd-pagina { padding: 20px 16px 220px; }
    .fd[data-lugar='banda'] .fd-fondo { height: 380px; }
    .fd[data-lugar='pantalla'] .fd-fondo { left: 0; }
    .fd-btn { min-height: 44px; }
  }
`

export default function FondosDemo() {
  const router = useRouter()
  const id = typeof router.query.fondo === 'string' ? router.query.fondo : OPCIONES[0].id
  const lugar = router.query.lugar === 'pantalla' ? 'pantalla' : 'banda'
  const vivo = router.query.cursor === '1'
  const opcion = OPCIONES.find(o => o.id === id) ?? OPCIONES[0]

  // Siempre en claro: el oscuro ya tiene su cielo de estrellas y no se compara acá.
  useEffect(() => {
    const tenia = document.documentElement.classList.contains('dark')
    document.documentElement.classList.remove('dark')
    return () => { if (tenia) document.documentElement.classList.add('dark') }
  }, [])

  const elegir = (cambios: Record<string, string | undefined>) => {
    const q: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...router.query, ...cambios })) if (typeof v === 'string' && v) q[k] = v
    void router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true })
  }

  return (
    <>
      <Head><title>Fondos para el panel (local)</title><meta name="robots" content="noindex" /></Head>
      <style>{CSS}</style>
      <div className="fd rv" data-lugar={lugar} data-oscuro={opcion.id === 'horizonte-oscuro' || opcion.id === 'horizonte-noche'}>
        <aside className="fd-lateral" aria-hidden>
          <div className="fd-logo"><i /> Orbita</div>
          <div className="fd-grupo">Hoy</div>
          <div className="fd-item" data-activo="true">Clases</div>
          <div className="fd-item">Alumnos</div>
          <div className="fd-item">Ingresos</div>
          <div className="fd-grupo">Negocio</div>
          <div className="fd-item">Equipo</div>
          <div className="fd-item">Actividades y salas</div>
          <div className="fd-item">Planes y precios</div>
          <div className="fd-grupo">Reservas</div>
          <div className="fd-item">Reglas de reserva</div>
          <div className="fd-item">Días sin clases</div>
          <div className="fd-item">Recordatorios y mensajes</div>
          <div className="fd-item">Pagos</div>
        </aside>
        <div className="fd-cuerpo">
          <header className="fd-header"><b>Gimnasio</b> › Clases <span style={{ marginLeft: 'auto' }}>Comparador de fondos · {opcion.nombre}</span></header>
          <main className="fd-main">
            <div key={opcion.id} className={`fd-fondo${vivo ? ' fd-fondo--vivo' : ''}`} aria-hidden>{opcion.fondo}</div>
            <div className="fd-pagina">
              <div className="fd-rotulo">Hoy · sábado 14 de noviembre</div>
              <h1 className="fd-h1">Clases</h1>
              <p className="fd-bajada">3 clases · 26 de 30 lugares tomados · 2 en lista de espera: si alguien cancela, pasa solo.</p>
              <div className="fd-kpis">
                {[['Clases hoy', '3', '26 de 30 lugares'], ['Alumnos activos', '48', '▲ 4 este mes'], ['Ingresos del mes', '$2.106.000', '▲ 11,3% vs. octubre'], ['Lista de espera', '2', 'Gymnastics 10:00']].map(([t, v, n]) => (
                  <div key={t} className="fd-card fd-kpi"><small>{t}</small><b>{v}</b><span>{n}</span></div>
                ))}
              </div>
              <div className="fd-card">
                {[['08:30', 'Halterofilia', 'Nico · Box', '2 lugares libres'], ['10:00', 'Gymnastics', 'Seba · Box', 'Completa · lista de espera'], ['17:00', 'WOD', 'Caro · Box', '2 lugares libres']].map(([h, c, q, e]) => (
                  <div key={h} className="fd-fila"><span><i>{h}</i> &nbsp; <b>{c}</b> · {q}</span><i>{e}</i></div>
                ))}
              </div>
              <h2 className="fd-h2">Mañana</h2>
              <div className="fd-card">
                {[['07:00', 'Funcional', 'Caro · Box', '6 lugares libres'], ['18:00', 'WOD', 'Nico · Box', '1 lugar libre'], ['19:30', 'Movilidad', 'Seba · Sala 2', '4 lugares libres']].map(([h, c, q, e]) => (
                  <div key={h} className="fd-fila"><span><i>{h}</i> &nbsp; <b>{c}</b> · {q}</span><i>{e}</i></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="fd-barra" role="toolbar" aria-label="Elegir fondo">
        {OPCIONES.map(o => <button key={o.id} type="button" className="fd-btn" aria-pressed={o.id === opcion.id} onClick={() => elegir({ fondo: o.id })}>{o.nombre}</button>)}
        <span className="fd-sep" aria-hidden />
        <button type="button" className="fd-btn" aria-pressed={lugar === 'banda'} onClick={() => elegir({ lugar: undefined })}>En banda</button>
        <button type="button" className="fd-btn" aria-pressed={lugar === 'pantalla'} onClick={() => elegir({ lugar: 'pantalla' })}>Toda la pantalla</button>
        <button type="button" className="fd-btn" aria-pressed={vivo} onClick={() => elegir({ cursor: vivo ? undefined : '1' })}>Reacciona al cursor</button>
        <div className="fd-nota">{opcion.nota}</div>
      </div>
    </>
  )
}
