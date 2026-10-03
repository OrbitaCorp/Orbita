// "Nuevo turno": para quién, qué, con quién y cuándo, en un modal.
//
// El cliente se busca escribiendo: el nombre (sin que importen los acentos) o un
// pedazo del teléfono. Si no está, la misma lista ofrece agregarlo y el alta se
// hace ahí mismo, sin salir del turno: queda en la lista de clientes al agendar.
//
// El día se elige en una tira (los días que esa agenda no atiende van apagados)
// y los horarios que se ofrecen son los que de verdad están libres para esa
// persona o espacio, donde entra la duración del servicio, separados por la
// mañana y la tarde. En la demo el turno queda en memoria.
import { useRef, useState, type KeyboardEvent } from 'react'
import { CalendarPlus, CalendarX, Search, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/design-system/components/Avatar'
import { duracionTxt, horaTxt, pesos, type Cliente, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
import type { Tramo } from '@/modules/turnos/horario'
import { Campo, Dos, Selector } from './configuracion/ui'
import { Modal, ErrorCampo, DatoFila, TiraDias, HorasLibres } from './piezasPanel'
import { sinAcentos, useCalendarioDemo, tieneTelefono, type NuevoTurnoPre, type ServicioPanel, type TurnoAgenda } from './agendaDemo'
import { clientesTxt, taparTelefono } from './equipoDemo'

const DIAS_A_LA_VISTA = 14
const MAX_RESULTADOS = 6

interface Props {
  rubro: RubroTurnos
  pre: NuevoTurnoPre
  clientes: Cliente[]
  /** Las agendas en las que quien mira puede dar turnos. */
  recursos: Recurso[]
  servicios: ServicioPanel[]
  turnosDelDia: (dia: number) => TurnoAgenda[]
  /** En qué tramos atiende una agenda un día (contado desde hoy). [] = ese día no atiende. */
  jornada: (recursoId: string, dia: number) => Tramo[]
  /** Quien mira puede ver los teléfonos. */
  verContacto: boolean
  onCerrar: () => void
  onCrear: (turno: Omit<TurnoAgenda, 'id'>, clienteNuevo?: { nombre: string; telefono: string }) => void
}

const CSS = `
  .tu-nt-combo { position: relative; margin-bottom: 16px; }
  .tu-nt-lista { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 5; max-height: 300px; overflow-y: auto; overscroll-behavior: contain; padding: 6px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); box-shadow: 0 18px 44px rgba(3,6,14,0.22), 0 2px 8px rgba(3,6,14,0.1); animation: tuNtLista 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes tuNtLista { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
  .tu-nt-op { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 50px; padding: 6px 10px; border: none; border-radius: 9px; background: transparent; text-align: left; font-family: inherit; color: inherit; cursor: pointer; transition: background 140ms ease; }
  .tu-nt-op[aria-selected='true'] { background: var(--color-primary-bg); }
  .tu-nt-op-ico { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; color: var(--color-primary); background: var(--tuo-grad-suave); border: 1px dashed color-mix(in srgb, var(--color-primary) 45%, transparent); }
  .tu-nt-vacio { padding: 14px 10px 10px; font-size: 13px; color: var(--color-muted); }
  .tu-nt-elegido { display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 12px; margin-bottom: 16px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--color-primary) 34%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg)); }
  .tu-nt-nuevo { padding: 14px 14px 0; margin-bottom: 16px; border-radius: 12px; border: 1px dashed color-mix(in srgb, var(--color-primary) 50%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 4%, var(--color-bg)); animation: tuoEntra 320ms var(--tuo-ease, ease) both; }
  .tu-nt-quien { display: flex; flex-wrap: wrap; gap: 6px; }
  .tu-nt-quien > button > i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  @media (max-width: 640px) { .tu-nt-op { min-height: 56px; } }
  @media (prefers-reduced-motion: reduce) { .tu-nt-lista, .tu-nt-nuevo { animation: none; } .tu-nt-op { transition: none; } }
`

export default function NuevoTurno({ rubro, pre, clientes, recursos, servicios, turnosDelDia, jornada, verContacto, onCerrar, onCrear }: Props) {
  const { fechaLarga, libresPorTramo } = useCalendarioDemo()
  const [clienteId, setClienteId] = useState<string | null>(pre.clienteId ?? null)
  const [q, setQ] = useState('')
  const [lista, setLista] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [nuevo, setNuevo] = useState<{ nombre: string; telefono: string } | null>(null)
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? '')
  const [recursoElegido, setRecursoElegido] = useState(pre.recursoId ?? recursos[0]?.id ?? '')
  const [diaElegido, setDiaElegido] = useState(Math.max(0, pre.dia ?? 0))
  const [hora, setHora] = useState<number | null>(pre.inicio ?? null)
  const [nota, setNota] = useState('')
  // Los errores del cliente van debajo de sus campos; el del horario, al final.
  const [error, setError] = useState<{ en: 'cliente' | 'turno'; texto: string } | null>(null)
  const buscador = useRef<HTMLInputElement>(null)
  const limpiar = () => setError(null)

  const plural = clientesTxt(rubro)
  const etiquetaRecurso = rubro.modo === 'profesional' ? `Con qué ${rubro.profesional.toLowerCase()}` : rubro.modo === 'cancha' ? 'En qué cancha' : 'Dónde'
  // Si la agenda elegida ya no está entre las que se pueden usar, la primera.
  const recursoId = recursos.some(r => r.id === recursoElegido) ? recursoElegido : recursos[0]?.id ?? ''
  const recurso = recursos.find(r => r.id === recursoId)
  const servicio = servicios.find(s => s.id === servicioId)
  const cliente = clienteId ? clientes.find(c => c.id === clienteId) ?? null : null

  // El día: el elegido si esa agenda atiende; si no, el primero que sí (mira tres semanas).
  const atiende = (d: number) => jornada(recursoId, d).length > 0
  const dia = atiende(diaElegido) ? diaElegido : Array.from({ length: 21 }, (_, i) => diaElegido + i).find(atiende) ?? diaElegido
  const dias = Array.from({ length: Math.max(DIAS_A_LA_VISTA, dia + 1) }, (_, d) => ({ dia: d, cerrado: !atiende(d) }))
  const grupos = servicio ? libresPorTramo(turnosDelDia(dia), jornada(recursoId, dia), recursoId, servicio.duracion, dia) : []
  // Si el horario elegido dejó de estar libre (cambió el día, el servicio o la agenda), hay que elegir de nuevo.
  const inicio = hora !== null && grupos.some(g => g.libres.includes(hora)) ? hora : null
  const sena = servicio && rubro.sena ? Math.round(servicio.precio * rubro.sena / 100) : 0

  // ── Buscador de clientes ──
  const texto = sinAcentos(q.trim())
  const digitos = q.replace(/\D/g, '')
  const soloNumeros = digitos.length > 0 && q.replace(/[\d\s()+-]/g, '') === ''
  const coinciden = clientes
    .filter(c => !texto || sinAcentos(c.nombre).includes(texto) || (digitos.length >= 3 && c.telefono.replace(/\D/g, '').includes(digitos)))
    .slice(0, MAX_RESULTADOS)
  const yaEsta = clientes.some(c => sinAcentos(c.nombre) === texto)
  const ofreceNuevo = q.trim().length >= 2 && !yaEsta
  const opciones = coinciden.length + (ofreceNuevo ? 1 : 0)
  const marcado = Math.min(cursor, Math.max(0, opciones - 1))

  const elegir = (c: Cliente) => { setClienteId(c.id); setNuevo(null); setQ(''); setLista(false); setCursor(0); limpiar() }
  const agregar = () => {
    setNuevo(soloNumeros ? { nombre: '', telefono: q.trim() } : { nombre: q.trim().replace(/\s+/g, ' '), telefono: '' })
    setClienteId(null); setQ(''); setLista(false); setCursor(0); limpiar()
  }
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!lista) setLista(true); else setCursor(Math.min(marcado + 1, Math.max(0, opciones - 1))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(Math.max(marcado - 1, 0)) }
    else if (e.key === 'Enter') {
      // Enter en el buscador elige de la lista: no agenda el turno.
      e.preventDefault()
      if (!lista) { setLista(true); return }
      if (marcado < coinciden.length) elegir(coinciden[marcado])
      else if (ofreceNuevo) agregar()
    }
    else if (e.key === 'Escape' && lista) { e.preventDefault(); setLista(false) }
  }

  const crear = () => {
    if (!servicio) return
    let clienteNuevo: { nombre: string; telefono: string } | undefined
    if (nuevo) {
      const nombre = nuevo.nombre.trim().replace(/\s+/g, ' ')
      if (!nombre) { setError({ en: 'cliente', texto: 'Escribí el nombre para agendarlo.' }); return }
      const repetido = clientes.find(c => sinAcentos(c.nombre) === sinAcentos(nombre))
      if (repetido) { setError({ en: 'cliente', texto: `${repetido.nombre} ya está en tu lista: buscalo por su nombre.` }); return }
      if (nuevo.telefono.trim() && !tieneTelefono(nuevo.telefono)) { setError({ en: 'cliente', texto: 'Revisá el teléfono: tiene que tener al menos 8 números.' }); return }
      clienteNuevo = { nombre, telefono: nuevo.telefono.trim() }
    } else if (!cliente) {
      setError({ en: 'cliente', texto: `Elegí para quién es el turno: escribí su nombre para buscarlo.` })
      buscador.current?.focus()
      return
    }
    if (inicio === null) { setError({ en: 'turno', texto: 'Elegí un horario.' }); return }
    onCrear(
      { recursoId, clienteId: cliente?.id ?? '', servicio: servicio.nombre, inicio, duracion: servicio.duracion, precio: servicio.precio, estado: 'confirmado', senaPagada: false, nota: nota.trim() || undefined, dia },
      clienteNuevo,
    )
  }

  if (servicios.length === 0 || recursos.length === 0) {
    return (
      <Modal rotulo="Agenda" titulo="Nuevo turno" onCerrar={onCerrar} pie={<button type="button" onClick={onCerrar} className="tuo-btn tuo-btn--primario">Entendido</button>}>
        <div style={{ textAlign: 'center', padding: '28px 8px' }}>
          <CalendarX size={24} color="var(--color-subtle)" />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 10 }}>Todavía no se puede agendar</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>{servicios.length === 0 ? 'Para dar un turno hace falta al menos un servicio cargado. Sumalo desde “Tu negocio”.' : 'No hay ninguna agenda en la que puedas dar turnos.'}</div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      ancho={560}
      rotulo="Agenda"
      titulo="Nuevo turno"
      bajada="Escribí el nombre para buscar a quién le das el turno. Si viene por primera vez, lo agregás ahí mismo."
      foco={buscador}
      onCerrar={onCerrar}
      onEnviar={crear}
      pie={<>
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><CalendarPlus size={16} /> Agendar turno</button>
      </>}
    >
      <style>{CSS}</style>

      {/* ── Para quién ── */}
      {cliente ? (
        <>
          <div className="tuc-rotulo" style={{ marginBottom: 8 }}>{rubro.cliente}</div>
          <div className="tu-nt-elegido">
            <Avatar name={cliente.nombre} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.nombre}</div>
              <div className="tuo-num" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{verContacto ? cliente.telefono : taparTelefono(cliente.telefono)} · {cliente.visitas} visita{cliente.visitas === 1 ? '' : 's'}</div>
            </div>
            <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => { setClienteId(null); setLista(true) }}><X size={14} /> Cambiar</button>
          </div>
        </>
      ) : nuevo ? (
        <div className="tu-nt-nuevo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="tuo-chip tuo-chip--primario"><UserPlus size={13} /> {rubro.cliente} que viene por primera vez</span>
            <button type="button" className="tuc-link" style={{ marginLeft: 'auto' }} onClick={() => { setNuevo(null); setLista(true); limpiar() }}><Search size={13} aria-hidden /> Buscar en mi lista</button>
          </div>
          <Dos>
            <Campo label="Nombre y apellido" value={nuevo.nombre} onChange={v => { setNuevo({ ...nuevo, nombre: v.slice(0, 60) }); limpiar() }} placeholder="Ej.: Paula Herrera" style={{ marginBottom: 10 }} />
            <Campo label="Teléfono" value={nuevo.telefono} onChange={v => { setNuevo({ ...nuevo, telefono: v }); limpiar() }} placeholder="11 5555-0000" type="tel" mono style={{ marginBottom: 10 }} />
          </Dos>
          <p className="tuc-ayuda" style={{ margin: '0 0 14px' }}>El teléfono es opcional: ahí le llegan la confirmación y el recordatorio. Queda en tu lista al agendar.</p>
          {error?.en === 'cliente' && <ErrorCampo>{error.texto}</ErrorCampo>}
        </div>
      ) : (
        <>
          <label htmlFor="tu-nt-cliente" className="tuc-rotulo" style={{ marginBottom: 8 }}>{rubro.cliente}</label>
          <div className="tu-nt-combo" data-esc={lista ? 'propio' : undefined} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setLista(false) }}>
            <div className="tuc-field tuc-field--fila">
              <span className="tuc-field-adorno"><Search size={15} aria-hidden /></span>
              <input
                id="tu-nt-cliente" ref={buscador} autoFocus value={q} autoComplete="off" placeholder="Escribí el nombre o el teléfono"
                role="combobox" aria-expanded={lista} aria-controls="tu-nt-lista" aria-autocomplete="list" aria-activedescendant={lista && opciones > 0 ? `tu-nt-op-${marcado}` : undefined}
                onChange={e => { setQ(e.target.value); setCursor(0); setLista(true); limpiar() }} onFocus={() => setLista(true)} onClick={() => setLista(true)} onKeyDown={tecla}
              />
            </div>
            {lista && (
              <div id="tu-nt-lista" role="listbox" aria-label={`Tus ${plural}`} className="tu-nt-lista">
                {!texto && coinciden.length > 0 && <div className="tuo-rotulo" style={{ padding: '6px 10px 4px', fontSize: 9.5 }}>Tus {plural}</div>}
                {coinciden.map((c, i) => (
                  // tabIndex -1 y mousedown sin foco: el foco se queda en el campo y las flechas mueven la selección.
                  <button key={c.id} type="button" id={`tu-nt-op-${i}`} role="option" aria-selected={i === marcado} tabIndex={-1} className="tu-nt-op"
                    onMouseDown={e => e.preventDefault()} onMouseEnter={() => setCursor(i)} onClick={() => elegir(c)}>
                    <Avatar name={c.nombre} size={34} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</span>
                      <span className="tuo-num" style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)' }}>{verContacto ? c.telefono : taparTelefono(c.telefono)}</span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>{c.visitas} visita{c.visitas === 1 ? '' : 's'}</span>
                  </button>
                ))}
                {coinciden.length === 0 && <div className="tu-nt-vacio">{ofreceNuevo ? `Nadie coincide con “${q.trim()}”.` : `Escribí al menos dos letras para buscar o agregar.`}</div>}
                {ofreceNuevo && (
                  <button type="button" id={`tu-nt-op-${coinciden.length}`} role="option" aria-selected={marcado === coinciden.length} tabIndex={-1} className="tu-nt-op"
                    onMouseDown={e => e.preventDefault()} onMouseEnter={() => setCursor(coinciden.length)} onClick={agregar}>
                    <span className="tu-nt-op-ico" aria-hidden><UserPlus size={15} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Agregar a “{q.trim()}”</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)' }}>Viene por primera vez: se suma a tus {plural} sin salir de acá</span>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
          {error?.en === 'cliente' && <ErrorCampo>{error.texto}</ErrorCampo>}
        </>
      )}

      {/* ── Qué y con quién ── */}
      <Selector
        label={rubro.modo === 'cupo' ? 'Actividad' : 'Servicio'}
        valor={servicioId}
        onChange={v => { setServicioId(v); limpiar() }}
        opciones={servicios.map(s => ({ id: s.id, label: `${s.nombre} · ${duracionTxt(s.duracion)}${s.precio ? ` · ${pesos(s.precio)}` : ''}` }))}
      />
      {recursos.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div className="tuc-rotulo" style={{ marginBottom: 8 }}>{etiquetaRecurso}</div>
          <div className="tu-nt-quien" role="group" aria-label={etiquetaRecurso}>
            {recursos.map(r => (
              <button key={r.id} type="button" className="tuc-pastilla" aria-pressed={r.id === recursoId} onClick={() => { setRecursoElegido(r.id); limpiar() }}>
                <i aria-hidden style={{ background: r.color }} />{r.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Cuándo ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Día</div>
        <TiraDias dias={dias} valor={dia} onElegir={d => { setDiaElegido(d); limpiar() }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '6px 0 12px' }}>
          <span className="tuc-rotulo">Horario</span>
          <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{fechaLarga(dia)}</span>
        </div>
        <HorasLibres grupos={grupos} valor={inicio} onElegir={m => { setHora(m); limpiar() }}
          vacio={<>No quedan horarios libres ese día para {recurso?.nombre ?? 'esa agenda'}. Probá con otro día{recursos.length > 1 ? ' o con otra agenda' : ''}.</>} />
      </div>
      {error?.en === 'turno' && <div style={{ marginTop: 16 }}><ErrorCampo>{error.texto}</ErrorCampo></div>}

      <Campo label="Nota" ayuda="Opcional. Solo la ve tu equipo." value={nota} onChange={setNota} area maxLength={140} placeholder="Ej.: viene con su hijo" />

      {servicio && inicio !== null && (
        <div className="tuo-card" style={{ padding: '6px 14px', boxShadow: 'none', background: 'var(--color-surface)' }}>
          <DatoFila label="Cuándo">{fechaLarga(dia)} · <span className="tuo-num">{horaTxt(inicio)} – {horaTxt(inicio + servicio.duracion)}</span></DatoFila>
          {recurso && <DatoFila label={rubro.modo === 'profesional' ? rubro.profesional : 'Dónde'}>{recurso.nombre}</DatoFila>}
          <DatoFila label="Precio"><span className="tuo-num">{pesos(servicio.precio)}</span></DatoFila>
          {sena > 0 && <DatoFila label={`Seña ${rubro.sena}%`}><span className="tuo-num">{pesos(sena)}</span> · pendiente</DatoFila>}
        </div>
      )}
    </Modal>
  )
}
