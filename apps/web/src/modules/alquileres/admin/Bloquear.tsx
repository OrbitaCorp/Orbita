// Bloquear un día (canchas y salones) o un rango de fechas (alojamiento): un
// feriado, un torneo, mantenimiento, uso propio o cuando se alquiló por otro
// lado. Desde ahí ese día (o esas noches) no se reserva. Lo que ya estaba
// reservado sigue en pie: se avisa, y se cancela desde la agenda si no se va
// a poder usar. Los abre la agenda (Reservas) y la sección Días bloqueados / Bloqueos.
import { useState } from 'react'
import { Ban } from 'lucide-react'
import { diaSemana, fechaLarga, rangoTxt, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { nochesOcupadas, salidaMaxima } from '@/lib/reservas/estadia'
import { HOY, bloqueoEn, capital, cuenta, esMensual, palabrasDe, rangosOcupados, todasLasUnidades, unidadesDe, type Bloqueo, type NegocioAlquiler, type Reserva } from '../datos'
import { CalendarioDia, CalendarioRango, type Rango } from '@/design-system/reservas/Calendario'
import { Campo, Modal, Nota, Selector } from '@/design-system/reservas/piezas'

/** Id para lo que se bloquea. Se llama solo desde handlers: Date.now no va en el render. */
const idNuevo = (prefijo: string) => `${prefijo}${Date.now().toString(36)}`

/** Un día de una cancha o de un salón (o de todos). Devuelve un bloqueo por unidad. */
export function BloquearDia({ negocio, reservas, unidadInicial, onCerrar, onBloqueos }: { negocio: NegocioAlquiler; reservas: Reserva[]; unidadInicial?: string; onCerrar: () => void; onBloqueos: (b: Bloqueo[]) => void }) {
  const palabras = palabrasDe(negocio)
  const unidades = unidadesDe(negocio)
  const varias = unidades.length > 1
  const [unidad, setUnidad] = useState(unidadInicial ?? (varias ? 'todas' : unidades[0]?.id ?? ''))
  const [dia, setDia] = useState<ISO | null>(null)
  const [mes, setMes] = useState<ISO>(HOY)
  const [motivo, setMotivo] = useState(negocio.tipo === 'cancha' ? 'Mantenimiento' : 'Cerrado')
  const ids = unidad === 'todas' ? unidades.map(u => u.id) : [unidad]
  const yaBloqueado = (f: ISO) => ids.every(id => bloqueoEn(negocio, id, f))
  const enPie = dia ? reservas.filter(r => r.estado !== 'cancelada' && r.fecha === dia && ids.includes(r.unidadId)).length : 0
  const que = unidad === 'todas' ? todasLasUnidades(palabras) : unidades.find(u => u.id === unidad)?.nombre ?? ''
  const bloquear = () => {
    if (!dia) return
    const base = idNuevo('bl')
    onBloqueos(ids.filter(id => !bloqueoEn(negocio, id, dia)).map((id, i) => ({ id: `${base}${i}`, unidadId: id, desde: dia, hasta: sumarDias(dia, 1), motivo: motivo.trim() || 'Bloqueado', origen: 'dueno' as const })))
  }
  return (
    <Modal titulo="Bloquear un día" bajada={negocio.tipo === 'cancha' ? 'Para mantenimiento, un torneo o un feriado: ese día no se puede reservar.' : 'Para un feriado o un evento propio: ese día nadie puede reservar.'} onCerrar={onCerrar}
      pie={<>
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!dia} onClick={bloquear}><Ban size={15} aria-hidden /> Bloquear</button>
      </>}>
      <div className="rv-pila">
        {varias && <Selector label="Qué se bloquea" valor={unidad} onChange={v => { setUnidad(v); setDia(null) }} opciones={[{ id: 'todas', label: capital(todasLasUnidades(palabras)) }, ...unidades.map(u => ({ id: u.id, label: u.nombre }))]} />}
        <Campo label="Motivo" value={motivo} onChange={setMotivo} />
        <CalendarioDia mes={mes} onMes={setMes} hoy={HOY} elegido={dia} onElegir={setDia} minMes={HOY}
          estadoDe={f => {
            const cerrado = f < HOY || !negocio.apertura.dias.includes(diaSemana(f))
            const ya = !cerrado && yaBloqueado(f)
            return { deshabilitado: cerrado || ya, ocupado: ya, aria: ya ? 'ya está bloqueado' : cerrado ? 'cerrado' : undefined }
          }} />
        {enPie > 0 && <Nota tono="aviso">Ese día ya hay {cuenta(enPie, 'reserva', 'reservas')}: {enPie === 1 ? 'sigue en pie. Si no se va a poder usar, cancelala' : 'siguen en pie. Si no se va a poder usar, cancelalas'} desde la agenda.</Nota>}
        <p className="rv-ayuda" style={{ margin: 0 }}>{dia ? `Se bloquea ${que} el ${fechaLarga(dia).toLowerCase()}: desde ahora no se puede reservar.` : 'Elegí el día. Los tachados ya están bloqueados.'}</p>
      </div>
    </Modal>
  )
}

/** Un rango de fechas de una propiedad (noches, o días de un alquiler por mes). */
export function BloquearFechas({ negocio, reservas, propiedadInicial, onCerrar, onBloqueo }: { negocio: NegocioAlquiler; reservas: Reserva[]; propiedadInicial?: string; onCerrar: () => void; onBloqueo: (b: Bloqueo) => void }) {
  const palabras = palabrasDe(negocio)
  const [propId, setPropId] = useState(propiedadInicial ?? negocio.propiedades[0]?.id ?? '')
  const [rango, setRango] = useState<Rango>({ entrada: null, salida: null })
  const [mes, setMes] = useState<ISO>(HOY)
  const [motivo, setMotivo] = useState('Mantenimiento')
  const ocupadas = rangosOcupados(negocio, reservas, propId)
  const tomadas = nochesOcupadas(ocupadas)
  const prop = negocio.propiedades.find(p => p.id === propId)
  return (
    <Modal titulo="Bloquear fechas" bajada="Para mantenimiento, uso propio o cuando se alquiló por otro lado." onCerrar={onCerrar}
      pie={<>
        <button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!rango.entrada || !rango.salida} onClick={() => rango.entrada && rango.salida && onBloqueo({ id: idNuevo('bl'), unidadId: propId, desde: rango.entrada, hasta: rango.salida, motivo: motivo.trim() || 'Bloqueado', origen: 'dueno' })}><Ban size={15} aria-hidden /> Bloquear</button>
      </>}>
      <div className="rv-pila">
        <Selector label={capital(palabras.unidad)} valor={propId} onChange={v => { setPropId(v); setRango({ entrada: null, salida: null }) }} opciones={negocio.propiedades.map(p => ({ id: p.id, label: `${p.nombre}${esMensual(p) ? ' · por mes' : ''}` }))} />
        <Campo label="Motivo" value={motivo} onChange={setMotivo} />
        <CalendarioRango mes={mes} onMes={setMes} hoy={HOY} rango={rango} onRango={setRango} minMes={HOY} estadoDe={f => ({ deshabilitado: f < HOY, ocupado: tomadas.has(f) })} salidaMaxima={e => salidaMaxima(e, ocupadas, prop && esMensual(prop) ? 400 : 60)} />
        {rango.entrada && rango.salida && <p className="rv-ayuda" style={{ margin: 0 }}>Se bloquea del {rangoTxt(rango.entrada, rango.salida)}.</p>}
      </div>
    </Modal>
  )
}
