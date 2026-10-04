// Servicios del negocio: nombre, duración, precio, seña y si se reserva online.
// Tarjetas en vez de tabla: un servicio es lo que el cliente elige en el sitio,
// y acá se ve igual de claro que allá (nombre, cuánto dura, cuánto sale).
//
// Crear, editar y eliminar abren el mismo modal (tocando la tarjeta o el
// lápiz). La lista vive en PanelTurnos, así un servicio nuevo aparece también
// al agendar un turno.
import { useState } from 'react'
import { Plus, Clock, Search, Globe, Coins, Pencil, Check } from 'lucide-react'
import { pesos, duracionTxt, type RubroTurnos, type Recurso } from '@/modules/turnos/datos'
import { Cabecera, Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo, Selector } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar } from './piezasPanel'
import type { ServicioPanel } from './agendaDemo'

const DURACIONES = [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240]

interface Props {
  rubro: RubroTurnos
  recursos: Recurso[]
  servicios: ServicioPanel[]
  /** `silencio`: guarda sin mostrar el aviso (la llavecita ya se ve cambiar). */
  onGuardar: (s: ServicioPanel, silencio?: boolean) => void
  onBorrar: (id: string) => void
}

export default function Servicios({ rubro, recursos, servicios, onGuardar, onBorrar }: Props) {
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<ServicioPanel | null>(null)
  const lista = servicios.filter(s => s.nombre.toLowerCase().includes(q.toLowerCase()))
  const publicados = servicios.filter(s => s.online).length
  const maxDuracion = Math.max(...servicios.map(s => s.duracion), 1)
  const cupo = rubro.modo === 'cupo'
  const titulo = cupo ? 'Actividades' : 'Servicios'
  const uno = cupo ? 'actividad' : 'servicio'

  const nuevo = (nombre = '') => setEditando({ id: '', nombre, duracion: 30, precio: 0, online: true })

  return (
    <div className="panel-page">
      <style>{`
        .tu-sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
        .tu-sv-card { cursor: pointer; transition: border-color 180ms ease, box-shadow 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease; }
        .tu-sv-card[data-online="false"] { background: var(--color-surface); }
        .tu-sv-card[data-online="false"] .tu-sv-cuerpo { opacity: 0.62; }
        .tu-sv-cuerpo { transition: opacity 200ms ease; }
        .tu-sv-icono { transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1); }
        .tu-sv-barra { transition: width 700ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (hover: hover) {
          .tu-sv-card:hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); box-shadow: var(--shadow-card-hover); transform: translateY(-3px); }
          .tu-sv-card:hover .tu-sv-icono { transform: rotate(-8deg) scale(1.08); }
        }
        /* La llavecita mide 24px de alto: el área que se toca crece sin mover nada. */
        .tu-sv-llave .tuo-switch::before { content: ''; position: absolute; inset: -10px -4px; }
        @media (max-width: 768px) { .tu-sv-editar { width: 44px !important; height: 44px !important; } }
        @media (max-width: 480px) { .tu-sv-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (prefers-reduced-motion: reduce) { .tu-sv-card, .tu-sv-card:hover, .tu-sv-icono, .tu-sv-card:hover .tu-sv-icono, .tu-sv-barra { transition: none; transform: none; } }
      `}</style>
      <Cabecera
        rotulo={`${publicados} de ${servicios.length} se reservan online`}
        titulo={titulo}
        bajada="Lo que ofrecés, cuánto dura y cuánto sale. Lo que esté prendido aparece en tu página de reservas."
        acciones={<button onClick={() => nuevo()} className="tuo-btn tuo-btn--primario"><Plus size={16} /> {cupo ? 'Nueva actividad' : 'Nuevo servicio'}</button>}
      />

      <label className="tuo-buscar tuo-entra" style={{ ['--i' as string]: 1, marginBottom: 18 }}>
        <Search size={15} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar ${titulo.toLowerCase()}`} aria-label={`Buscar ${titulo.toLowerCase()}`} />
      </label>

      {lista.length === 0 && (
        <div className="tuo-card tuo-entra" style={{ padding: '44px 20px', textAlign: 'center' }}>
          <Search size={22} color="var(--color-subtle)" />
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)', marginTop: 10 }}>{servicios.length === 0 ? `Todavía no cargaste ${cupo ? 'ninguna actividad' : 'ningún servicio'}` : `Nada coincide con “${q}”`}</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4 }}>{servicios.length === 0 ? 'Sin eso, tus clientes no tienen qué reservar.' : `Probá con otra palabra o creá ${cupo ? 'la actividad' : 'el servicio'}.`}</div>
          <button onClick={() => nuevo(q.trim())} className="tuo-btn" style={{ marginTop: 16, height: 44 }}><Plus size={16} /> {q.trim() ? `Crear “${q.trim()}”` : `Crear ${uno}`}</button>
        </div>
      )}

      <div className="tu-sv-grid">
        {lista.map((s, i) => {
          const on = s.online
          // Quiénes lo hacen sale de la posición en la lista completa: no cambia al buscar.
          const pos = servicios.indexOf(s)
          const quienes = recursos.filter((_, k) => (k + pos) % 3 !== 2)
          const sena = rubro.sena && s.precio ? Math.round(s.precio * rubro.sena / 100) : 0
          // Toda la tarjeta abre la edición; con teclado, el lápiz.
          return (
            <article key={s.id} onClick={() => setEditando(s)} className="tuo-card tuo-card--pad tu-sv-card tuo-entra" data-online={on} style={{ ['--i' as string]: Math.min(i + 2, 10), display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="tu-sv-icono" style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--color-primary)', background: 'var(--tuo-grad-suave)', border: '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)' }}><rubro.Icon size={19} strokeWidth={1.7} /></span>
                <div className="tu-sv-cuerpo" style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="tuo-h2" style={{ fontSize: 15.5 }}>{s.nombre}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-muted)', marginTop: 4 }}><Clock size={13} /> <span className="tuo-num">{duracionTxt(s.duracion)}</span></div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setEditando(s) }} aria-label={`Editar ${s.nombre}`} className="tuo-btn tuo-btn--icono tuo-btn--sm tu-sv-editar"><Pencil size={14} /></button>
              </div>

              <div className="tu-sv-cuerpo">
                <div aria-hidden style={{ height: 4, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
                  <div className="tu-sv-barra" style={{ width: `${(s.duracion / maxDuracion) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--tuo-grad)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--tuo-fh)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{pesos(s.precio)}</span>
                  {sena > 0 && <span className="tuo-chip tuo-chip--ok" style={{ height: 22, fontSize: 11.5 }}><Coins size={12} /> seña <span className="tuo-num">{pesos(sena)}</span></span>}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }} aria-label={rubro.modo === 'profesional' ? 'Lo hacen' : 'Dónde'}>
                  {quienes.map(r => <span key={r.id} className="tuo-chip" style={{ height: 24, fontSize: 11.5, fontWeight: 500 }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />{rubro.modo === 'profesional' ? r.nombre.split(' ')[0] : r.nombre}</span>)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, marginTop: 'auto', borderTop: '1px solid var(--color-border)' }}>
                <Globe size={14} color={on ? 'var(--color-primary)' : 'var(--color-subtle)'} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: on ? 'var(--color-text)' : 'var(--color-muted)' }}>{on ? 'Se reserva online' : 'Solo lo agendás vos'}</span>
                {/* La llavecita cambia solo eso: no abre la edición de la tarjeta. */}
                <span onClick={e => e.stopPropagation()} className="tu-sv-llave" style={{ display: 'inline-flex' }}>
                  <Llave on={on} onChange={v => onGuardar({ ...s, online: v }, true)} label={`Reserva online de ${s.nombre}`} />
                </span>
              </div>
            </article>
          )
        })}
      </div>

      {editando && (
        <FormServicio
          key={editando.id || 'nuevo'}
          inicial={editando}
          rubro={rubro}
          onCerrar={() => setEditando(null)}
          onGuardar={s => { onGuardar(s); setEditando(null) }}
          onBorrar={id => { onBorrar(id); setEditando(null) }}
        />
      )}
    </div>
  )
}

/** Alta y edición de un servicio. Sin `id` es uno nuevo. */
function FormServicio({ inicial, rubro, onCerrar, onGuardar, onBorrar }: {
  inicial: ServicioPanel; rubro: RubroTurnos; onCerrar: () => void; onGuardar: (s: ServicioPanel) => void; onBorrar: (id: string) => void
}) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [duracion, setDuracion] = useState(inicial.duracion)
  const [precio, setPrecio] = useState(inicial.precio ? String(inicial.precio) : '')
  const [online, setOnline] = useState(inicial.online)
  const [error, setError] = useState('')
  const esNuevo = !inicial.id
  const cupo = rubro.modo === 'cupo'
  const monto = Math.max(0, Math.round(Number(precio.replace(',', '.')) || 0))
  const sena = rubro.sena && monto ? Math.round(monto * rubro.sena / 100) : 0
  const duraciones = (DURACIONES.includes(inicial.duracion) ? DURACIONES : [...DURACIONES, inicial.duracion].sort((a, b) => a - b))
    .map(d => ({ id: d, label: duracionTxt(d) }))

  const guardar = () => {
    if (!nombre.trim()) { setError(`Ponele un nombre ${cupo ? 'a la actividad' : 'al servicio'}.`); return }
    onGuardar({ id: inicial.id || `s${Date.now()}`, nombre: nombre.trim(), duracion, precio: monto, online })
  }

  return (
    <Modal
      rotulo={cupo ? 'Actividades' : 'Servicios'}
      titulo={esNuevo ? (cupo ? 'Nueva actividad' : 'Nuevo servicio') : inicial.nombre}
      bajada={esNuevo ? 'Así lo van a ver tus clientes al reservar.' : undefined}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> {esNuevo ? 'Crear' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre" value={nombre} onChange={v => { setNombre(v); setError('') }} placeholder={cupo ? 'Ej.: Stretching' : 'Ej.: Corte y lavado'} maxLength={50} />
      {error && <ErrorCampo>{error}</ErrorCampo>}
      <Selector label="Duración" valor={duracion} onChange={setDuracion} opciones={duraciones} />
      <Campo
        label="Precio" type="number" mono prefijo="$" value={precio} onChange={setPrecio} placeholder="0"
        ayuda={sena > 0 ? `Al reservar se pide una seña del ${rubro.sena}%: ${pesos(sena)}.` : 'Dejalo en 0 si está incluido en el abono o no se cobra.'}
      />
      <div className="tu-sv-llave" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <Globe size={16} color={online ? 'var(--color-primary)' : 'var(--color-subtle)'} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{online ? 'Se reserva online' : 'Solo lo agendás vos'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2, lineHeight: 1.45 }}>{online ? 'Aparece en tu página de reservas.' : 'No se muestra en tu página de reservas.'}</div>
        </div>
        <Llave on={online} onChange={setOnline} label="Se reserva online" />
      </div>

      {!esNuevo && (
        <Borrar
          etiqueta={cupo ? 'Eliminar actividad' : 'Eliminar servicio'}
          pregunta={<>¿Eliminar <b>{inicial.nombre}</b>? Deja de ofrecerse en tu página. Los turnos que ya están agendados no se tocan.</>}
          onBorrar={() => onBorrar(inicial.id)}
        />
      )}
    </Modal>
  )
}
