// Día y hora. Una tira horizontal con las próximas tres semanas (cada día dice
// cuánto lugar le queda, con puntitos Y con texto) y, abajo, los horarios del
// día en los turnos en que atiende el negocio: la mañana y la tarde, cada una
// con su rango, y el corte del mediodía marcado entre las dos. Los ocupados se
// ven, tachados y sin poder tocarse: muestran que la agenda es real y por qué
// falta un horario.
import { useRef } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Moon, Sun, Sunset, Zap } from 'lucide-react'
import { duracionTxt, horaTxt } from '@/modules/turnos/datos'
import { corteDe, type Semana } from '@/modules/turnos/horario'
import { teclasRadio } from './acciones'
import { esHoy, fechaLarga, fechaRelativa, gruposDel, mesCorto, mismaFecha, nombreDiaCorto, primerLibre, proximosDias, tramosDeFecha, type Fecha, type GrupoHoras } from './calendario'

interface Props {
  /** La semana en la que se puede reservar: la del negocio o, si ya se eligió con quién, la de esa persona. */
  horarios: Semana
  duracion: number
  fecha: Fecha
  hora: number | null
  onFecha: (f: Fecha) => void
  onHora: (f: Fecha, m: number) => void
}

const ICONO: Record<GrupoHoras['nombre'], typeof Sun> = { Mañana: Sun, Tarde: Sunset, Noche: Moon }

export function PasoFecha({ horarios, duracion, fecha, hora, onFecha, onHora }: Props) {
  const tira = useRef<HTMLDivElement>(null)
  const dias = proximosDias(horarios, duracion)
  const tope = Math.max(...dias.map(d => d.libres), 1)
  const dia = dias.find(d => mismaFecha(d.f, fecha)) ?? dias[0]
  const masProximo = dia.grilla.find(g => g.libre)?.m
  const rapido = primerLibre(horarios, duracion)
  // Los turnos de atención del día elegido que tienen horarios para mostrar, y el corte entre ellos.
  const grupos = gruposDel(horarios, fecha).map(g => ({ ...g, lista: dia.grilla.filter(x => x.m >= g.desde && x.m < g.hasta) })).filter(g => g.lista.length > 0)
  const corte = corteDe(tramosDeFecha(horarios, fecha))
  const yaElegido = !!rapido && hora === rapido.m && mismaFecha(rapido.f, fecha)
  const correr = (lado: 1 | -1) => tira.current?.scrollBy({ left: lado * 336, behavior: 'smooth' })

  return (
    <>
      {/* No se desmonta al usarlo (cambia el texto): si desapareciera, todo lo de abajo saltaría */}
      {rapido && (
        <button type="button" className="tur-rapido" disabled={yaElegido} onClick={() => onHora(rapido.f, rapido.m)}>
          {yaElegido ? <Check size={18} aria-hidden style={{ flexShrink: 0 }} /> : <Zap size={18} aria-hidden style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{yaElegido ? 'Tenés el primer horario libre:' : '¿Lo antes posible?'}</b> {yaElegido ? '' : 'El primer horario libre es '}{fechaRelativa(rapido.f)} a las <span className="tur-num" style={{ fontWeight: 600 }}>{horaTxt(rapido.m)}</span>
          </span>
          {!yaElegido && <ArrowRight size={18} className="tur-flecha" aria-hidden style={{ flexShrink: 0 }} />}
        </button>
      )}

      <div className="tur-tira-marco">
        <button type="button" className="tur-redondo tur-tira-flecha" onClick={() => correr(-1)} aria-label="Ver días anteriores"><ChevronLeft size={18} aria-hidden /></button>
        <div ref={tira} className="tur-tira" role="radiogroup" aria-label="Día del turno" onKeyDown={teclasRadio}>
          {dias.map((d, i) => {
            const sel = mismaFecha(d.f, fecha)
            const sinLugar = d.libres === 0
            const puntos = Math.max(1, Math.ceil((d.libres / tope) * 4))
            const texto = d.cerrado ? 'Cerrado' : sinLugar ? 'Completo' : `${d.libres} libre${d.libres === 1 ? '' : 's'}`
            return (
              <button key={`${d.f.mes}-${d.f.dia}`} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} disabled={sinLugar}
                className="tur-dia" onClick={() => onFecha(d.f)}
                aria-label={`${fechaLarga(d.f)}${esHoy(d.f) ? ', hoy' : ''}: ${d.cerrado ? 'cerrado' : sinLugar ? 'sin horarios libres' : `${d.libres} horarios libres`}`}>
                {(i === 0 || d.f.dia === 1) && <span className="tur-dia-mes">{mesCorto(d.f)}</span>}
                <span className="tur-dia-sem">{esHoy(d.f) ? 'Hoy' : nombreDiaCorto(d.f)}</span>
                <span className="tur-dia-num">{d.f.dia}</span>
                <span className="tur-dia-puntos" aria-hidden>
                  {[0, 1, 2, 3].map(k => <i key={k} data-on={!sinLugar && k < puntos} />)}
                </span>
                <span className="tur-dia-txt">{texto}</span>
              </button>
            )
          })}
        </div>
        <button type="button" className="tur-redondo tur-tira-flecha" onClick={() => correr(1)} aria-label="Ver días siguientes"><ChevronRight size={18} aria-hidden /></button>
      </div>

      {/* key: al cambiar de día los horarios vuelven a entrar, y se nota que cambió la lista */}
      <div key={`${fecha.mes}-${fecha.dia}`} className="tur-entra" role="radiogroup" aria-label={`Horarios del ${fechaLarga(fecha).toLowerCase()}`} onKeyDown={teclasRadio}>
        <h2 className="tur-h" style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>
          {fechaLarga(fecha)}{esHoy(fecha) ? ' · hoy' : ''}
        </h2>
        {grupos.length === 0 && (
          <p className="tur-sin-horas">{dia.cerrado ? 'Ese día no se atiende. Elegí otro.' : esHoy(fecha) ? 'Por hoy ya no quedan horarios para este servicio. Elegí otro día.' : 'Ese día no quedan horarios para este servicio. Elegí otro.'}</p>
        )}
        {grupos.map((fr, k) => {
          const Icono = ICONO[fr.nombre]
          const libres = fr.lista.filter(g => g.libre).length
          return (
            <div key={fr.desde} className="tur-franja" role="group" aria-label={fr.rango ? `${fr.nombre}, de ${fr.rango}` : fr.nombre}>
              {/* El corte del mediodía, entre la mañana y la tarde: explica por qué no hay horarios en el medio. */}
              {k > 0 && corte && fr.rango && fr.desde >= corte[1] && grupos[k - 1].hasta <= corte[0] && (
                <div className="tur-corte"><span>Cerrado de <span className="tur-num">{horaTxt(corte[0])}</span> a <span className="tur-num">{horaTxt(corte[1])}</span></span></div>
              )}
              <div className="tur-franja-tit"><Icono size={16} aria-hidden /> {fr.nombre} <span>{fr.rango ? <>· <span className="tur-num">{fr.rango}</span> </> : ''}· {libres ? `${libres} libre${libres === 1 ? '' : 's'}` : 'sin lugar'}</span></div>
              <div className="tur-horas">
                {fr.lista.map(g => {
                  const sel = hora === g.m
                  const primero = g.libre && g.m === masProximo
                  return (
                    <button key={g.m} type="button" role="radio" aria-checked={sel} disabled={!g.libre} className="tur-hora"
                      tabIndex={sel || (hora === null && primero) ? 0 : -1} onClick={() => onHora(fecha, g.m)}
                      aria-label={`${horaTxt(g.m)}${!g.libre ? ', ocupado' : primero ? ', el más próximo' : ''}`}>
                      {primero && !sel && <span className="tur-hora-marca" aria-hidden>Más próximo</span>}
                      {horaTxt(g.m)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Siempre ocupa su lugar: elegir un horario no empuja nada hacia abajo */}
      <div className="tur-rango" aria-live="polite">
        <Clock size={17} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text)' }} />
        {hora === null
          ? <span>Elegí un horario y te decimos a qué hora terminás.</span>
          : <span key={hora} className="tur-llega">De <b className="tur-num" style={{ color: 'var(--color-text)' }}>{horaTxt(hora)}</b> a <b className="tur-num" style={{ color: 'var(--color-text)' }}>{horaTxt(hora + duracion)}</b> · {duracionTxt(duracion)}</span>}
      </div>
    </>
  )
}
