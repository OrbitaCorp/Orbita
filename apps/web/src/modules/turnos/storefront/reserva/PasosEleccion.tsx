// Los pasos donde se elige UNA cosa entre varias: el servicio y con quién (o
// dónde). Los dos son radiogroups: Tab entra al grupo, las flechas se mueven y
// eligen, y el elegido se reconoce por el borde, el check de la esquina y la
// elevación (no solo por el color).
import { Clock, Shuffle, Star } from 'lucide-react'
import { pesos, duracionTxt, horaTxt, semanaDeRecurso, type RubroTurnos, type Recurso } from '@/modules/turnos/datos'
import { diasTxt, tramosDe, tramosFrase } from '@/modules/turnos/horario'
import { RETRATOS, type TemaNegocio } from '../tema'
import { teclasRadio } from './acciones'
import { esHoy, nombreDiaCorto, proximosDias, type Fecha } from './calendario'
import { Tilde } from './piezas'

const escalon = (i: number) => ({ ['--i' as string]: Math.min(i, 8) }) as React.CSSProperties

// ─── Servicio ─────────────────────────────────────────────────────────────────

export function PasoServicio({ rubro, t, elegido, onElegir }: { rubro: RubroTurnos; t: TemaNegocio; elegido: number | null; onElegir: (i: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Servicios" className="tur-servicios" onKeyDown={teclasRadio}>
      {rubro.servicios.map((s, i) => {
        const sel = elegido === i
        return (
          <button key={s.nombre} type="button" role="radio" aria-checked={sel} tabIndex={sel || (elegido === null && i === 0) ? 0 : -1}
            className="tur-op tur-serv tur-entra" style={escalon(i)} onClick={() => onElegir(i)}>
            <Tilde />
            <span className="tur-foto"><img src={t.galeria[i % t.galeria.length]} alt="" loading="lazy" /></span>
            <span className="tur-serv-cuerpo">
              {/* El segundo de la lista es el más pedido del negocio de ejemplo */}
              {i === 1 && <span className="tur-marca" style={{ alignSelf: 'flex-start' }}><Star size={11} fill="currentColor" aria-hidden /> Más elegido</span>}
              <span className="tur-h tur-serv-nombre">{s.nombre}</span>
              <span className="tur-serv-pie">
                <span className="tur-pill"><Clock size={13} aria-hidden /> {duracionTxt(s.duracion)}</span>
                <span className="tur-num tur-serv-precio">{s.precio ? pesos(s.precio) : 'Sin cargo'}</span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Con quién / dónde ────────────────────────────────────────────────────────

const cuandoCorto = (f: Fecha, m: number) => `${esHoy(f) ? 'Hoy' : `${nombreDiaCorto(f)} ${f.dia}`} ${horaTxt(m)}`

export function PasoRecurso({ rubro, t, recursos, duracion, elegido, onElegir }: {
  rubro: RubroTurnos; t: TemaNegocio; recursos: Recurso[]; duracion: number; elegido: string | null; onElegir: (id: string) => void
}) {
  const persona = rubro.modo === 'profesional'
  // Los próximos horarios libres de la agenda de ejemplo. Cada quien tiene los suyos: salen de los
  // días y las horas en que atiende, dentro del horario del negocio. Se reparten para que no den
  // todos el mismo.
  const libresDe = (semana: typeof t.horarios) => proximosDias(semana, duracion, 7).flatMap(d => d.grilla.filter(g => g.libre).map(g => ({ f: d.f, m: g.m })))
  const proximo = (r: Recurso, i: number) => { const l = libresDe(semanaDeRecurso(r, t.horarios)); return l[Math.min(i, l.length - 1)] }
  const primero = libresDe(t.horarios)[0]
  // Solo se aclara cuándo atiende quien no sigue el horario completo del negocio.
  const cuandoAtiende = (r: Recurso) => [r.horario ? tramosFrase(tramosDe(r.horario)) : '', r.atiende.length < t.horarios.filter(([, h]) => h).length ? diasTxt(r.atiende).toLowerCase() : ''].filter(Boolean).join(' · ')

  return (
    <div role="radiogroup" aria-label={persona ? `Elegí ${rubro.profesional.toLowerCase()}` : 'Elegí el espacio'} onKeyDown={teclasRadio}>
      {/* "Cualquiera" va primero: es la opción con más horarios, y a quien le da lo mismo le ahorra elegir. */}
      <button type="button" role="radio" aria-checked={elegido === 'cualquiera'} tabIndex={elegido === 'cualquiera' || elegido === null ? 0 : -1}
        className="tur-op tur-cualquiera tur-entra" onClick={() => onElegir('cualquiera')}>
        <Tilde />
        <span className="tur-cualquiera-caras" aria-hidden>
          {persona
            ? RETRATOS.slice(0, 3).map(f => <img key={f} src={f} alt="" />)
            : <span><Shuffle size={20} /></span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="tur-h" style={{ display: 'block', fontSize: 21, fontWeight: 700 }}>{persona ? 'Cualquiera disponible' : 'El primero libre'}</span>
          <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-muted)', marginTop: 4 }}>
            {persona ? 'Te atiende quien esté libre primero.' : 'Te asignamos el espacio que se libere primero.'} Es la opción con más horarios.
          </span>
          {primero && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--color-text)', fontWeight: 600, marginTop: 8 }}>
              <span className="tur-vivo" aria-hidden /> Próximo horario: <span className="tur-num">{cuandoCorto(primero.f, primero.m)}</span>
            </span>
          )}
        </span>
      </button>
      <div className="tur-recursos">
        {recursos.map((r, i) => {
          const sel = elegido === r.id
          const px = proximo(r, i)
          const atiende = persona ? cuandoAtiende(r) : ''
          return (
            <button key={r.id} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1}
              className="tur-op tur-rec tur-entra" style={escalon(i + 1)} onClick={() => onElegir(r.id)}>
              <Tilde />
              <span className="tur-foto" style={{ aspectRatio: persona ? '1 / 1' : '16 / 10' }}>
                <img src={persona ? RETRATOS[i % RETRATOS.length] : t.galeria[i % t.galeria.length]} alt="" loading="lazy" />
              </span>
              <span className="tur-rec-cuerpo">
                <span className="tur-h" style={{ display: 'block', fontSize: 19, fontWeight: 700 }}>{r.nombre}</span>
                <span style={{ display: 'block', fontSize: 13.5, color: 'var(--color-muted)', marginTop: 3 }}>{r.rol}{atiende ? ` · ${atiende}` : ''}</span>
                {px && (
                  <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 7px', fontSize: 13, color: 'var(--color-body)', marginTop: 10 }}>
                    <span className="tur-vivo" aria-hidden /> Libre <span className="tur-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{cuandoCorto(px.f, px.m)}</span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
