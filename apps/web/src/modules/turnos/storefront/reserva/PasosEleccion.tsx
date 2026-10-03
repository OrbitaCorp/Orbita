// Los pasos donde se elige UNA cosa entre varias: servicio, con quién (o dónde)
// y, en los rubros con cupo, la clase. Los tres son radiogroups: Tab entra al
// grupo, las flechas se mueven y eligen, y el elegido se reconoce por el borde,
// el check de la esquina y la elevación (no solo por el color).
import { useState } from 'react'
import { Clock, Shuffle, Star, Users } from 'lucide-react'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { pesos, duracionTxt, horaTxt, semanaDeRecurso, type RubroTurnos, type Recurso, type ClaseCupo } from '@/modules/turnos/datos'
import { diasTxt, tramosDe, tramosFrase } from '@/modules/turnos/horario'
import { RETRATOS, type TemaNegocio } from '../tema'
import { teclasRadio } from './acciones'
import { fechaLarga, mesCorto, nombreDiaCorto, useCalendarioReserva, type CalendarioReserva, type Fecha } from './calendario'
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

const cuandoCorto = (esHoy: CalendarioReserva['esHoy'], f: Fecha, m: number) => `${esHoy(f) ? 'Hoy' : `${nombreDiaCorto(f)} ${f.dia}`} ${horaTxt(m)}`

export function PasoRecurso({ rubro, t, recursos, duracion, elegido, onElegir }: {
  rubro: RubroTurnos; t: TemaNegocio; recursos: Recurso[]; duracion: number; elegido: string | null; onElegir: (id: string) => void
}) {
  const { esHoy, proximosDias } = useCalendarioReserva()
  const persona = rubro.modo === 'profesional'
  // "Cualquiera" solo tiene sentido cuando al cliente le puede dar lo mismo: una cancha de
  // fútbol 5 y una de pádel no son intercambiables.
  const conCualquiera = rubro.modo !== 'cancha'
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
      {conCualquiera && (
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
                <span className="tur-vivo" aria-hidden /> Próximo horario: <span className="tur-num">{cuandoCorto(esHoy, primero.f, primero.m)}</span>
              </span>
            )}
          </span>
        </button>
      )}
      <div className="tur-recursos">
        {recursos.map((r, i) => {
          const sel = elegido === r.id
          const px = proximo(r, i)
          const atiende = persona ? cuandoAtiende(r) : ''
          return (
            <button key={r.id} type="button" role="radio" aria-checked={sel} tabIndex={sel || (!conCualquiera && elegido === null && i === 0) ? 0 : -1}
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
                    <span className="tur-vivo" aria-hidden /> Libre <span className="tur-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{cuandoCorto(esHoy, px.f, px.m)}</span>
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

// ─── Clase con cupo ───────────────────────────────────────────────────────────

// Los días con clases (lunes a sábado), empezando por hoy y siguiendo con los que vienen.
const diasClaseDesde = (hoy: number) => [0, 1, 2, 3, 4, 5].sort((a, b) => (a - hoy + 7) % 7 - (b - hoy + 7) % 7)

export function PasoClase({ clases, elegida, onElegir }: { clases: ClaseCupo[]; elegida: ClaseCupo | null; onElegir: (c: ClaseCupo) => void }) {
  const { ahora, clasePasada, esHoy, fechaDeClase } = useCalendarioReserva()
  const DIAS_CLASE = diasClaseDesde(ahora.diaSemana)
  const [dia, setDia] = useState(elegida?.dia ?? DIAS_CLASE[0])
  const lista = clases.filter(c => c.dia === dia).sort((a, b) => a.inicio - b.inicio)
  const primeraLibre = lista.find(c => !clasePasada(c))

  return (
    <>
      <div className="tur-tira" role="radiogroup" aria-label="Día de la clase" onKeyDown={teclasRadio} style={{ marginBottom: 12 }}>
        {DIAS_CLASE.map(d => {
          const f = fechaDeClase(d)
          const sel = d === dia
          const cuantas = clases.filter(c => c.dia === d && !clasePasada(c)).length
          return (
            <button key={d} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} className="tur-dia" onClick={() => setDia(d)}
              aria-label={`${fechaLarga(f)}${esHoy(f) ? ', hoy' : ''}, ${cuantas} clase${cuantas === 1 ? '' : 's'}`}>
              {(d === DIAS_CLASE[0] || f.dia === 1) && <span className="tur-dia-mes">{mesCorto(f)}</span>}
              <span className="tur-dia-sem">{esHoy(f) ? 'Hoy' : nombreDiaCorto(f)}</span>
              <span className="tur-dia-num">{f.dia}</span>
              <span className="tur-dia-txt" style={{ marginTop: 8 }}>{cuantas} clase{cuantas === 1 ? '' : 's'}</span>
            </button>
          )
        })}
      </div>

      <div key={dia} className="tur-clases" role="radiogroup" aria-label={`Clases del ${fechaLarga(fechaDeClase(dia)).toLowerCase()}`} onKeyDown={teclasRadio}>
        {lista.map((c, i) => {
          const sel = elegida?.id === c.id
          const pasada = clasePasada(c)
          const libres = c.cupo - c.anotados
          const llena = libres <= 0
          const pocos = !llena && libres <= 3
          const tono = llena ? 'var(--tur-error)' : pocos ? 'var(--tur-aviso)' : 'var(--color-primary)'
          const estado = pasada ? 'Ya empezó' : llena ? 'Completa' : libres === 1 ? 'Último lugar' : `${libres} lugares`
          return (
            <button key={c.id} type="button" role="radio" aria-checked={sel} disabled={pasada}
              tabIndex={sel || (!elegida || elegida.dia !== dia ? c.id === primeraLibre?.id : false) ? 0 : -1}
              className="tur-op tur-clase tur-entra" style={escalon(i)} onClick={() => onElegir(c)}>
              <Tilde />
              <span className="tur-num tur-clase-hora">{horaTxt(c.inicio)}</span>
              <span className="tur-clase-info" style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>{c.nombre}</span>
                <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', fontSize: 13.5, color: 'var(--color-muted)', marginTop: 4 }}>
                  <Users size={13} aria-hidden /> {c.profe} · {c.sala} · {duracionTxt(c.duracion)}
                </span>
              </span>
              <span className="tur-clase-cupo">
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: pasada ? 'var(--color-muted)' : 'var(--color-text)', whiteSpace: 'nowrap' }}>{estado}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{pasada ? 'Hoy' : llena ? 'Hay lista de espera' : `de ${c.cupo}`}</span>
                </span>
                <Anillo valor={c.anotados / c.cupo} size={50} grosor={5} color={pasada ? 'var(--color-muted)' : tono} label={`${c.anotados} de ${c.cupo} lugares ocupados`}>
                  {c.anotados}/{c.cupo}
                </Anillo>
              </span>
            </button>
          )
        })}
        {lista.length === 0 && (
          <p style={{ padding: '28px 20px', textAlign: 'center', borderRadius: 'var(--tur-r)', border: '1.5px dashed var(--color-border)', color: 'var(--color-muted)', margin: 0 }}>Ese día no hay clases. Probá con otro.</p>
        )}
      </div>
    </>
  )
}
