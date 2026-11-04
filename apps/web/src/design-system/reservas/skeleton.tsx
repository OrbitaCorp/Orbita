// Siluetas de carga de los paneles de reservas (Turnos, Alquileres, Gimnasio):
// lo que se ve en el lugar de una sección mientras llegan sus datos. Mismo
// criterio que las de Tienda (design-system/components/Skeleton.tsx): la misma
// clase `.skel` de globals.css (barrido de luz, modo oscuro y corte por
// prefers-reduced-motion resueltos ahí) y la FORMA de lo que está por llegar,
// no un rectángulo gris: la fila de indicadores, la grilla de la agenda, el
// calendario con su lista al lado, la tabla, las tarjetas de configuración.
// Así, cuando entra el contenido, nada salta de lugar.
//
// Ocho formas alcanzan para todas las secciones de los tres paneles; cada
// panel dice cuál va en cada sección (FORMAS en su Panel.tsx). Pintan con las
// clases rv- del kit (rv-pagina, rv-kpis, rv-card, rv-lista…): el ancho, los
// bordes y el aire son los mismos que los de la pantalla real, en claro, en
// oscuro y en celular.
//
// Las demos no tienen backend: useCargaSimulada finge la espera de la API en
// la primera carga del panel (una sola vez, ~700 ms, lo que tarda Cloud Run en
// responder); cambiar de sección es instantáneo, como va a serlo con los datos
// ya en memoria. Con ?cargando=1 la silueta se queda fija, para revisarla.
import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { Skeleton, SkeletonChip, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'

export type FormaSkeleton = 'tablero' | 'agenda' | 'calendario' | 'lista' | 'tabla' | 'tarjetas' | 'tarjetas-icono' | 'formulario'

/** Cuánto dura la espera fingida de las demos. */
export const ESPERA_DEMO_MS = 700

/**
 * true mientras "carga" el panel de una demo: los primeros `ms` después de
 * montarlo, o siempre si la URL trae ?cargando=1. El día que haya backend, el
 * panel pasa el estado real de su carga y este hook se va.
 */
export function useCargaSimulada(ms = ESPERA_DEMO_MS): boolean {
  const router = useRouter()
  const fija = router.query.cargando === '1'
  const [esperando, setEsperando] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setEsperando(false), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return fija || esperando
}

const CSS = `
  /* En claro, lo que no está adentro de una tarjeta blanca cae sobre el cielo del panel (celeste muy claro):
     la base de la silueta va un punto más oscura y el barrido en blanco, para que se vea. En oscuro, lo de siempre. */
  html:not(.dark) .rvp-main [data-skeleton] .skel { --skel-base: color-mix(in srgb, var(--color-border-strong) 60%, var(--color-border)); --skel-glow: var(--color-bg); }
  .rvsk-cab { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
  .rvsk-acciones { display: flex; gap: 8px; }
  .rvsk-kpi { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
  .rvsk-kpi > div:first-child { display: flex; justify-content: space-between; align-items: flex-start; }
  .rvsk-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .rvsk-barras { display: flex; align-items: flex-end; gap: 6px; height: 160px; padding-top: 22px; }
  .rvsk-barras > span { flex: 1 1 0; min-width: 0; width: auto !important; max-width: 24px; margin: 0 auto; border-radius: 4px 4px 0 0; }
  .rvsk-fila { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
  .rvsk-fila + .rvsk-fila { border-top: 1px solid var(--color-border); }
  .rvsk-fila > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
  /* La tira de días no desborda en celular: lo que no entra queda recortado, como en la real (que scrollea). */
  .rvsk-tira { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; max-width: 100%; overflow: hidden; }
  .rvsk-tira > span { flex: 0 0 auto; }
  .rvsk-agenda { display: grid; grid-template-columns: 56px repeat(var(--n, 4), minmax(0, 1fr)); gap: 1px; border: 1px solid var(--color-border); border-radius: var(--rv-r); overflow: hidden; background: var(--color-bg); }
  .rvsk-agenda > div { min-height: 48px; padding: 6px 8px; border-top: 1px solid var(--color-border); border-left: 1px solid var(--color-border); display: flex; align-items: center; }
  .rvsk-agenda > div:nth-child(-n + 5) { border-top: none; background: var(--color-surface); min-height: 40px; }
  .rvsk-agenda > div:nth-child(5n + 1) { border-left: none; }
  .rvsk-agenda-lista { display: none; flex-direction: column; gap: 14px; }
  .rvsk-dos { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 20px; align-items: start; }
  .rvsk-mes { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .rvsk-mes > span { height: 40px; width: auto !important; border-radius: 8px; }
  .rvsk-tarjetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .rvsk-tarjeta { overflow: hidden; }
  .rvsk-tarjeta > div { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 9px; }
  .rvsk-campos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .rvsk-campo { display: flex; flex-direction: column; gap: 7px; }
  .rvsk-tabla { padding: 0 16px; }
  .rvsk-tabla > div { display: grid; grid-template-columns: 2fr 1.2fr 1fr 1fr 0.9fr 72px; gap: 10px; align-items: center; padding: 12px 0; border-top: 1px solid var(--color-border); }
  .rvsk-tabla > div:first-child { border-top: none; padding: 10px 0; }
  .rvsk-tabla > div > span { margin: 0; }
  @media (max-width: 900px) { .rvsk-dos { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 768px) {
    .rvsk-agenda { display: none; }
    .rvsk-agenda-lista { display: flex; }
    .rvsk-tabla > div { grid-template-columns: minmax(0, 1fr) 72px; }
    .rvsk-tabla > div > span:nth-child(n + 3) { display: none; }
  }
  @media (max-width: 640px) { .rvsk-grid2, .rvsk-campos { grid-template-columns: minmax(0, 1fr); } }
`

// ─── Piezas ──────────────────────────────────────────────────────────────────

/** Rótulo, título, bajada y, si hay, uno o dos botones a la derecha: la forma de Encabezado. */
function Cabecera({ acciones = 0, bajada = true }: { acciones?: number; bajada?: boolean }) {
  return (
    <div className="rv-cab rvsk-cab" style={{ flexDirection: 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, flex: 1 }}>
        <SkeletonText width={120} height={10} />
        <SkeletonText width={200} height={26} delay={40} style={{ borderRadius: 6 }} />
        {bajada && <SkeletonText width="min(100%, 380px)" height={12} delay={80} />}
      </div>
      {acciones > 0 && (
        <div className="rvsk-acciones">
          {Array.from({ length: acciones }).map((_, i) => <Skeleton key={i} width={i === acciones - 1 ? 136 : 112} height={40} radius={8} delay={60 + i * 40} />)}
        </div>
      )}
    </div>
  )
}

/** La fila de indicadores del kit (Kpi): rótulo, el chip del ícono, el valor y la nota. */
function Kpis({ n = 4 }: { n?: number }) {
  return (
    <div className={`rv-kpis${n === 3 ? ' rv-kpis--3' : ''}`} style={{ marginBottom: 14 }}>
      {Array.from({ length: n }).map((_, i) => {
        const d = i * 80
        return (
          <div key={i} className="rv-card rvsk-kpi">
            <div><SkeletonText width={86} height={10} delay={d} /><Skeleton width={32} height={32} radius={8} delay={d + 30} /></div>
            <SkeletonText width="58%" height={28} delay={d + 60} style={{ borderRadius: 6 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><SkeletonChip width={58} delay={d + 90} /><SkeletonText width="40%" height={10} delay={d + 110} /></div>
          </div>
        )
      })}
    </div>
  )
}

/** Un gráfico de barras del kit mientras carga: columnas de distinta altura, con su rótulo abajo. */
function Barras({ alturas = [46, 70, 38, 82, 58, 64, 30, 76], delay = 0 }: { alturas?: number[]; delay?: number }) {
  return (
    <div className="rvsk-barras" aria-hidden>
      {alturas.map((h, i) => <Skeleton key={i} height={`${h}%`} radius={4} delay={delay + i * 50} />)}
    </div>
  )
}

/** Filas de una lista del kit (rv-item): sigla, dos renglones y un chip a la derecha. */
function Filas({ n = 6, delay = 0, sigla = true }: { n?: number; delay?: number; sigla?: boolean }) {
  const anchos = ['52%', '38%', '64%', '44%', '58%', '40%', '60%', '48%']
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const d = delay + i * 70
        return (
          <div key={i} className="rvsk-fila">
            {sigla && <SkeletonCircle size={36} delay={d} />}
            <div><SkeletonText width={anchos[i % anchos.length]} height={13} delay={d + 20} /><SkeletonText width="30%" height={10} delay={d + 50} /></div>
            <SkeletonChip width={78} delay={d + 80} />
          </div>
        )
      })}
    </>
  )
}

function Seccion({ titulo = 150, lineas = 2, campos = 0, delay = 0, children }: { titulo?: number; lineas?: number; campos?: number; delay?: number; children?: React.ReactNode }) {
  return (
    <section className="rv-card rv-card--pad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <SkeletonText width={titulo} height={16} delay={delay} style={{ borderRadius: 5 }} />
        {lineas > 1 && <SkeletonText width="min(100%, 420px)" height={11} delay={delay + 30} />}
      </div>
      {campos > 0 && (
        <div className="rvsk-campos">
          {Array.from({ length: campos }).map((_, i) => (
            <div key={i} className="rvsk-campo"><SkeletonText width={90 + (i % 3) * 24} height={11} delay={delay + 60 + i * 40} /><Skeleton height={42} radius={8} delay={delay + 80 + i * 40} /></div>
          ))}
        </div>
      )}
      {children}
    </section>
  )
}

// ─── Las formas ──────────────────────────────────────────────────────────────

/** Resumen, Ingresos, Ganancias: indicadores, dos gráficos y una lista. */
function Tablero() {
  return (
    <div className="rv-pagina">
      <Cabecera acciones={1} />
      <Kpis />
      <div className="rvsk-grid2" style={{ marginBottom: 14 }}>
        <Seccion titulo={120} delay={100}><Barras delay={140} /></Seccion>
        <Seccion titulo={140} delay={160}><Barras alturas={[62, 44, 78, 36, 70, 52]} delay={200} /></Seccion>
      </div>
      <div className="rvsk-grid2">
        <Seccion titulo={110} delay={240}><div className="rv-lista"><Filas n={4} delay={280} /></div></Seccion>
        <Seccion titulo={130} delay={300}><div className="rv-lista"><Filas n={4} delay={340} sigla={false} /></div></Seccion>
      </div>
    </div>
  )
}

/** La agenda de un día: la tira de días y la grilla de columnas por hora; en celular, una tarjeta por columna. */
function Agenda({ columnas = 4, horas = 7 }: { columnas?: number; horas?: number }) {
  return (
    <div className="rv-pagina">
      <Cabecera acciones={2} />
      <div className="rvsk-tira">
        <Skeleton width={34} height={34} radius={8} />
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} width={64} height={56} radius={10} delay={i * 40} />)}
        <Skeleton width={34} height={34} radius={8} delay={300} />
      </div>
      <div className="rvsk-agenda" style={{ ['--n' as string]: columnas } as CSSProperties} aria-hidden>
        <div />
        {Array.from({ length: columnas }).map((_, c) => <div key={`c${c}`}><SkeletonText width="70%" height={12} delay={c * 50} /></div>)}
        {Array.from({ length: horas }).map((_, h) => (
          <div key={`h${h}`} style={{ display: 'contents' }}>
            <div><SkeletonText width={36} height={10} delay={h * 40} /></div>
            {Array.from({ length: columnas }).map((_, c) => (
              <div key={`${h}-${c}`}>{(h + c) % 3 === 0 && <Skeleton height={34} radius={6} delay={h * 40 + c * 60} style={{ width: '100%' }} />}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="rvsk-agenda-lista" aria-hidden>
        {Array.from({ length: Math.min(columnas, 3) }).map((_, i) => (
          <section key={i} className="rv-card" style={{ padding: '4px 14px' }}>
            <div className="rvsk-fila" style={{ padding: '10px 0' }}><div><SkeletonText width="40%" height={13} delay={i * 90} /></div><SkeletonText width={80} height={10} delay={i * 90 + 30} /></div>
            <Filas n={2} delay={i * 90 + 60} sigla={false} />
          </section>
        ))}
      </div>
    </div>
  )
}

/** El mes a la izquierda y lo del día (o las próximas) a la derecha: Calendario del salón, Ocupación, Clases. */
function Calendario() {
  return (
    <div className="rv-pagina">
      <Cabecera acciones={2} />
      <div className="rvsk-dos">
        <div className="rv-card rv-card--pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Skeleton width={34} height={34} radius={8} /><SkeletonText width={130} height={14} delay={30} /><Skeleton width={34} height={34} radius={8} delay={60} />
          </div>
          <div className="rvsk-mes" aria-hidden>
            {Array.from({ length: 7 }).map((_, i) => <SkeletonText key={`d${i}`} width="60%" height={9} delay={i * 20} style={{ height: 9, margin: '6px auto 8px' }} />)}
            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} delay={100 + i * 12} style={{ opacity: (i * 7) % 5 === 0 ? 1 : 0.55 }} />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><SkeletonText width={160} height={16} delay={80} style={{ borderRadius: 5 }} /><SkeletonText width={100} height={11} delay={110} /></div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rv-card rv-card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <SkeletonText width={130} height={10} delay={140 + i * 90} />
              <SkeletonText width="55%" height={16} delay={170 + i * 90} style={{ borderRadius: 5 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><SkeletonText width="48%" height={11} delay={200 + i * 90} /><SkeletonChip width={84} delay={230 + i * 90} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Clientes, Alumnos, Equipo: tres indicadores, el buscador y la tabla. */
function Lista() {
  return (
    <div className="rv-pagina">
      <Cabecera acciones={1} />
      <Kpis n={3} />
      <Skeleton width="min(100%, 380px)" height={42} radius={8} delay={200} style={{ marginBottom: 16 }} />
      <Tabla soloFilas />
    </div>
  )
}

/** Una tabla del kit (rv-tabla): cabecera y filas con sus columnas; en celular queda la primera columna y la acción. */
function Tabla({ soloFilas = false, filas = 7 }: { soloFilas?: boolean; filas?: number }) {
  const anchos = ['62%', '48%', '70%', '54%', '66%', '44%', '58%']
  const cuerpo = (
    <div className="rv-card rvsk-tabla">
      <div>{[70, 60, 52, 56, 64, 40].map((w, i) => <SkeletonText key={i} width={w} height={9} delay={i * 20} style={{ marginLeft: i === 5 ? 'auto' : 0 }} />)}</div>
      {Array.from({ length: filas }).map((_, i) => {
        const d = 80 + i * 70
        return (
          <div key={i}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><SkeletonCircle size={32} delay={d} /><SkeletonText width={anchos[i % anchos.length]} height={12} delay={d + 20} /></span>
            <SkeletonText width="60%" height={11} delay={d + 40} />
            <SkeletonText width="50%" height={11} delay={d + 60} />
            <SkeletonChip width={72} delay={d + 80} />
            <SkeletonText width="55%" height={11} delay={d + 100} />
            <Skeleton width={64} height={34} radius={8} delay={d + 120} style={{ marginLeft: 'auto' }} />
          </div>
        )
      })}
    </div>
  )
  if (soloFilas) return cuerpo
  return (
    <div className="rv-pagina">
      <Cabecera acciones={1} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Skeleton width="min(100%, 320px)" height={42} radius={8} />
        {[88, 96, 84].map((w, i) => <SkeletonChip key={i} width={w} delay={60 + i * 40} style={{ height: 32 }} />)}
      </div>
      {cuerpo}
    </div>
  )
}

/** Tarjetas con foto (propiedades, salones) o con una sigla o un ícono (equipo, espacios, el hub de Avanzado). */
function Tarjetas({ n = 6, conFoto = true }: { n?: number; conFoto?: boolean }) {
  return (
    <div className="rv-pagina">
      <Cabecera acciones={1} />
      <div className="rvsk-tarjetas">
        {Array.from({ length: n }).map((_, i) => {
          const d = i * 90
          return (
            <div key={i} className="rv-card rvsk-tarjeta">
              {conFoto ? <Skeleton height="auto" radius={0} delay={d} style={{ aspectRatio: '16 / 10', display: 'block' }} /> : null}
              <div>
                {!conFoto && <Skeleton width={36} height={36} radius={10} delay={d} />}
                <SkeletonText width="62%" height={15} delay={d + 40} style={{ borderRadius: 5 }} />
                <SkeletonText width="44%" height={11} delay={d + 70} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}><SkeletonText width={72} height={14} delay={d + 100} /><SkeletonChip width={64} delay={d + 130} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Una pantalla de configuración (880 px): dos o tres tarjetas con su título y sus campos. */
function Formulario() {
  return (
    <div className="rv-pagina rv-pagina--form">
      <Cabecera />
      <div className="rv-pila">
        <Seccion titulo={170} campos={2} delay={100} />
        <Seccion titulo={130} campos={3} delay={260} />
        <Seccion titulo={150} lineas={1} delay={420}><div className="rv-lista"><Filas n={3} delay={460} sigla={false} /></div></Seccion>
      </div>
    </div>
  )
}

const FORMAS: Record<FormaSkeleton, () => React.ReactNode> = {
  tablero: () => <Tablero />, agenda: () => <Agenda />, calendario: () => <Calendario />, lista: () => <Lista />,
  tabla: () => <Tabla />, tarjetas: () => <Tarjetas />, 'tarjetas-icono': () => <Tarjetas conFoto={false} />, formulario: () => <Formulario />,
}

/**
 * La silueta de una sección del panel mientras carga. `forma` es la de la
 * pantalla que viene después, para que al entrar el contenido nada se mueva.
 * Se anuncia como "Cargando" al lector de pantalla y las piezas quedan fuera
 * del árbol de accesibilidad (son decoración).
 */
export function SkeletonVista({ forma, nombre }: { forma: FormaSkeleton; nombre?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" data-skeleton={forma}>
      <style>{CSS}</style>
      <span className="rv-sr">Cargando{nombre ? ` ${nombre}` : ''}…</span>
      <div aria-hidden="true">{FORMAS[forma]()}</div>
    </div>
  )
}
