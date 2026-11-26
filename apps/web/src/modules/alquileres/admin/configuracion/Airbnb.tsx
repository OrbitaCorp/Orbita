// Airbnb, en el panel de un negocio real de alojamiento: el calendario de cada
// propiedad sincronizado en las dos direcciones, con el .ics de cada aviso.
//
// - De Órbita a Airbnb: la dirección del calendario de la propiedad, para
//   pegar en Airbnb. Trae solo noches ocupadas, sin datos de nadie.
// - De Airbnb a Órbita: el enlace del aviso. El servidor lo baja cada 30
//   minutos y bloquea esas noches; acá se ve cuándo fue la última vez, si
//   falló y por qué, y se puede pedir que lo baje ahora.
//
// Lo que no se esconde: entre una sincronización y la otra pueden entrar dos
// reservas para las mismas noches. Si pasa, se avisa acá y arriba del
// calendario, con el código de la reserva.
//
// La demo sigue con su pantalla simulada (Calendarios.tsx). Canchas y salones
// todavía no conectan calendarios.
import { useState } from 'react'
import { AlertTriangle, Check, Copy, Link2, RefreshCw, Unplug } from 'lucide-react'
import { diasEntre, rangoTxt } from '@/lib/reservas/fechas'
import { urlDelCalendario } from '@/lib/reservasApi/cliente'
import { Campo, Nota, Seccion } from '@/design-system/reservas/piezas'
import { TIPOS, cuenta, palabrasDe, type CalendarioExterno, type NegocioAlquiler } from '../../datos'
import { hace } from '../../datos/textos'
import { PaginaForm } from './comun'
import { BotonConfirmar } from '../piezas'

/** Tope de calendarios por propiedad (el mismo que aplica el servidor). */
const MAXIMO = 3

interface P {
  negocio: NegocioAlquiler
  /** Las tres devuelven si quedó hecho: la pantalla espera para decir qué está pasando y para no perder lo escrito. */
  onConectar: (c: CalendarioExterno) => Promise<boolean>
  onDesconectar: (id: string) => Promise<boolean>
  onSincronizar: (id: string) => Promise<boolean>
  onVerReserva: (id: string) => void
}

const CSS = `
  .ala-url { display: flex; gap: 8px; align-items: stretch; }
  .ala-url input { flex: 1; min-width: 0; font-family: var(--rv-mono); font-size: 13px; }
  .ala-pasos { margin: 12px 0 0; padding-left: 22px; list-style: decimal; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--color-body); }
  .ala-cal { padding: 12px 0; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 8px; }
  .ala-cal:first-child { border-top: none; padding-top: 0; }
  .ala-cal-cab { display: flex; align-items: flex-start; gap: 10px; }
  .ala-cal-cab > svg { margin-top: 3px; color: var(--color-muted); flex-shrink: 0; }
  .ala-cal-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ala-cal-txt b { font-size: 14.5px; color: var(--color-text); overflow-wrap: anywhere; }
  .ala-cal-txt span { font-size: 13px; color: var(--color-muted); overflow-wrap: anywhere; }
  .ala-cal-acc { display: flex; gap: 8px; flex-wrap: wrap; padding-left: 26px; }
  .ala-gira { animation: ala-gira 900ms linear infinite; }
  @keyframes ala-gira { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .ala-gira { animation: none; } }
  .ala-conflicto { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 6px 0; }
  @media (max-width: 480px) { .ala-url { flex-direction: column; } .ala-cal-acc { padding-left: 0; } .ala-cal-acc .rv-btn { flex: 1 1 100%; } }
`

export default function Airbnb({ negocio, onConectar, onDesconectar, onSincronizar, onVerReserva }: P) {
  const palabras = palabrasDe(negocio)
  const propiedades = negocio.propiedades
  const [propiedadId, setPropiedadId] = useState(propiedades[0]?.id ?? '')
  const [url, setUrl] = useState('')
  const [copiado, setCopiado] = useState(false)
  // Qué se está haciendo ahora ("conectar", o el id del calendario que se baja o se desconecta): mientras
  // tanto el botón lo dice y no se puede pedir dos veces lo mismo.
  const [ocupado, setOcupado] = useState<string | null>(null)
  const mientras = async (que: string, accion: () => Promise<boolean>) => {
    setOcupado(que)
    try { return await accion() } finally { setOcupado(null) }
  }
  // El "ahora" de esta pantalla, tomado al abrirla: alcanza para decir "hace 12 min" sin volver a dibujar cada segundo.
  const [ahora] = useState(() => Date.now())
  const propiedad = propiedades.find(p => p.id === propiedadId)
  const suyos = negocio.calendariosExternos.filter(c => c.unidadId === propiedadId)
  const conflictos = negocio.calendariosExternos.flatMap(c => (c.conflictos ?? []).map(x => ({ ...x, propiedad: propiedades.find(p => p.id === c.unidadId)?.nombre ?? '' })))
  const exportar = propiedad ? urlDelCalendario(negocio.slug, propiedad.id) : ''

  const copiar = () => {
    void navigator.clipboard?.writeText(exportar).then(() => { setCopiado(true); window.setTimeout(() => setCopiado(false), 2000) }, () => undefined)
  }
  const conectar = async () => {
    if (!propiedad || !url.trim() || ocupado) return
    const pegado = url.trim()
    // El campo se vacía recién cuando quedó conectado: si la API rechaza el enlace, sigue ahí para corregirlo.
    if (await mientras('conectar', () => onConectar({ id: '', unidadId: propiedad.id, nombre: 'Airbnb', url: pegado, ultimaSync: '' }))) setUrl(actual => (actual.trim() === pegado ? '' : actual))
  }
  // Las noches que bloquea un calendario: las cuenta el servidor (el panel carga solo medio año para adelante).
  const nochesDe = (c: CalendarioExterno) => c.noches ?? negocio.bloqueos.filter(b => b.origen === 'ical' && b.calendarioId === c.id).reduce((s, b) => s + Math.max(1, diasEntre(b.desde, b.hasta)), 0)

  if (propiedades.length === 0) {
    return (
      <PaginaForm rotulo={TIPOS.estadia.label} titulo="Airbnb" bajada="Sincronizá el calendario de cada propiedad con su aviso de Airbnb.">
        <Nota tono="info"><span>Primero cargá una {palabras.unidad} en Propiedades: el calendario se conecta por propiedad.</span></Nota>
      </PaginaForm>
    )
  }

  return (
    <PaginaForm rotulo={TIPOS.estadia.label} titulo="Airbnb" bajada="Que lo que te reservan en Airbnb se bloquee acá, y lo que te reservan acá se bloquee en Airbnb. Se conecta una vez por propiedad, con el calendario de su aviso.">
      <style>{CSS}</style>
      <div className="rv-pila">
        {conflictos.length > 0 && (
          <Nota tono="aviso">
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} aria-hidden /> Airbnb tiene reservadas noches que también tenés acá</b>
              {conflictos.map(x => (
                <span key={x.reservaId} className="ala-conflicto">
                  <span>{x.propiedad} · {rangoTxt(x.entrada, x.salida)} · código <span className="rv-num">{x.codigo}</span></span>
                  <button type="button" className="rv-btn rv-btn--sm" onClick={() => onVerReserva(x.reservaId)}>Ver la reserva</button>
                </span>
              ))}
              <span className="rv-ayuda" style={{ display: 'block', marginTop: 4 }}>Entraron las dos antes de que se sincronizara. Decidí con cuál te quedás y avisale a la otra persona: acá no se cancela nada solo.</span>
            </span>
          </Nota>
        )}

        {propiedades.length > 1 && (
          <div className="rv-seg" role="group" aria-label="Propiedad" style={{ maxWidth: '100%', overflowX: 'auto' }}>
            {propiedades.map(p => <button key={p.id} type="button" aria-pressed={p.id === propiedadId} onClick={() => { setPropiedadId(p.id); setUrl(''); setCopiado(false) }}>{p.nombre}</button>)}
          </div>
        )}

        <Seccion titulo="De Órbita a Airbnb" bajada={`Para que Airbnb bloquee las noches que ${propiedad?.nombre ?? 'esta propiedad'} tiene tomadas acá. Solo viajan las fechas: ni nombres ni montos.`}>
          <div className="ala-url">
            <input className="rv-input" readOnly value={exportar} aria-label={`Enlace del calendario de ${propiedad?.nombre ?? 'la propiedad'}`} onFocus={e => e.currentTarget.select()} />
            <button type="button" className="rv-btn rv-btn--primario" onClick={copiar}>{copiado ? <><Check size={15} aria-hidden /> Copiado</> : <><Copy size={15} aria-hidden /> Copiar enlace</>}</button>
          </div>
          <span className="rv-sr" role="status">{copiado ? 'Enlace copiado.' : ''}</span>
          <ol className="ala-pasos">
            <li>En Airbnb, abrí el aviso y andá a <b>Calendario → Disponibilidad → Conectar calendarios</b>.</li>
            <li>Elegí <b>Importar calendario</b>, pegá este enlace y ponele un nombre (por ejemplo, “Órbita”).</li>
            <li>Listo. Airbnb lo vuelve a leer solo cada pocas horas.</li>
          </ol>
        </Seccion>

        <Seccion titulo="De Airbnb a Órbita" bajada={`Para que acá se bloqueen las noches que ${propiedad?.nombre ?? 'esta propiedad'} tiene reservadas en Airbnb.`}>
          {suyos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {suyos.map(c => {
                const noches = nochesDe(c)
                return (
                  <div key={c.id} className="ala-cal">
                    <div className="ala-cal-cab">
                      <Link2 size={16} aria-hidden />
                      <span className="ala-cal-txt">
                        <b>{c.nombre}</b>
                        {c.error
                          ? <span className="rv-error" role="alert" style={{ margin: 0 }}>No se pudo bajar ({hace(c.ultimaSyncEn, ahora)}): {c.error} Lo que ya estaba bloqueado sigue bloqueado.</span>
                          : <span>Sincronizado {hace(c.ultimaSyncEn, ahora)} · {noches > 0 ? `${cuenta(noches, 'noche bloqueada', 'noches bloqueadas')}` : 'sin noches tomadas en Airbnb'}</span>}
                      </span>
                    </div>
                    <div className="ala-cal-acc">
                      <button type="button" className="rv-btn rv-btn--sm" disabled={ocupado !== null} aria-busy={ocupado === c.id} onClick={() => void mientras(c.id, () => onSincronizar(c.id))}>
                        <RefreshCw size={14} aria-hidden className={ocupado === c.id ? 'ala-gira' : undefined} /> {ocupado === c.id ? 'Sincronizando…' : 'Sincronizar ahora'}
                      </button>
                      {ocupado === `quitar:${c.id}`
                        ? <button type="button" className="rv-btn rv-btn--sm" disabled aria-busy><Unplug size={14} aria-hidden /> Desconectando…</button>
                        : <BotonConfirmar pregunta={noches > 0 ? `¿Desconectar? Se ${noches === 1 ? 'libera 1 noche' : `liberan ${noches} noches`} que venían de Airbnb.` : '¿Desconectar este calendario?'} si="Sí, desconectar" onConfirmar={() => { if (!ocupado) void mientras(`quitar:${c.id}`, () => onDesconectar(c.id)) }}><Unplug size={14} aria-hidden /> Desconectar</BotonConfirmar>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {suyos.length < MAXIMO ? (
            <form className="rv-pila" onSubmit={e => { e.preventDefault(); void conectar() }}>
              <Campo label="Enlace del calendario de Airbnb" value={url} onChange={setUrl} placeholder="https://www.airbnb.com.ar/calendar/ical/…ics" inputMode="text" autoComplete="off"
                ayuda="En Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar calendario. Copiá el enlace que termina en .ics." />
              <button type="submit" className="rv-btn rv-btn--primario" style={{ alignSelf: 'flex-start' }} disabled={!url.trim() || ocupado !== null} aria-busy={ocupado === 'conectar'}><Link2 size={15} aria-hidden /> {ocupado === 'conectar' ? 'Conectando…' : 'Conectar'}</button>
            </form>
          ) : <p className="rv-ayuda" style={{ margin: 0 }}>Hasta {MAXIMO} calendarios por propiedad. Desconectá uno para sumar otro.</p>}
        </Seccion>

        <Nota tono="info">
          <span>Órbita baja el calendario de Airbnb <b>cada 30 minutos</b>, y Airbnb lee el de Órbita cada pocas horas. En ese rato pueden entrar dos reservas para las mismas noches: si pasa, te avisamos acá y arriba del calendario.</span>
        </Nota>
      </div>
    </PaginaForm>
  )
}
