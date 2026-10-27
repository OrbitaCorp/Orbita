// Servicios del negocio: nombre, duración, precio, seña y si se reserva online.
// Una tabla, como el catálogo de Tienda (en celular, una tarjeta por servicio),
// con buscador y un filtro por estado que dice cuántos están publicados.
//
// Crear es lo primero que se ve (el botón del encabezado y el del estado vacío).
// Cada servicio se edita, se pausa o se elimina: pausar lo saca del sitio y de
// "Nuevo turno" sin borrarlo (los turnos ya dados no se tocan) y se reanuda
// cuando se quiera; eliminar lo borra de verdad, con confirmación. La lista
// vive en PanelTurnos, así un servicio nuevo aparece también al agendar.
import { useId, useState } from 'react'
import { Plus, Globe, Pencil, Check, Pause, Play } from 'lucide-react'
import { Encabezado, Vacio } from '@/design-system/reservas/piezas'
import { pesos, duracionTxt, type RubroTurnos } from '@/modules/turnos/datos'
import { Campo, Selector, Segmentado } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar, Buscador, Llave } from './piezasPanel'
import { sinAcentos, type ServicioPanel } from '../datos/agenda'

const DURACIONES = [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240]
type Filtro = 'todos' | 'publicados' | 'pausados'

const CSS = `
  .tu-sv-filtros { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .tu-sv-filtros > .tu-buscar { flex: 1 1 240px; }
  .tu-sv-nombre { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .tu-sv-ico { width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; color: var(--color-primary); background: var(--color-primary-bg); }
  .tu-sv-nombre > div { min-width: 0; }
  .tu-sv-nombre b { display: block; font-size: 14px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tu-sv-nombre small { display: block; margin-top: 2px; font-size: 12.5px; color: var(--color-muted); }
  .rv-tabla tr[data-pausado='true'] .tu-sv-ico { color: var(--color-muted); background: var(--color-surface-alt); }
  .rv-tabla tr[data-pausado='true'] td { color: var(--color-muted); }
  .tu-sv-acciones { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  .tu-sv-estado { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--rv-r-sm); border: 1px solid var(--color-border); background: var(--color-surface); margin-bottom: 12px; }
  .tu-sv-estado > svg { flex-shrink: 0; }
  .tu-sv-estado > div { flex: 1; min-width: 0; }
  .tu-sv-estado b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tu-sv-estado small { display: block; font-size: 12.5px; color: var(--color-muted); margin-top: 2px; line-height: 1.45; }
  @media (max-width: 768px) {
    .tu-sv-filtros > .rv-seg { width: 100%; display: flex; }
    .tu-sv-filtros > .rv-seg > button { flex: 1; }
    .tu-sv-acciones { width: 100%; }
    .tu-sv-acciones > .rv-btn { flex: 1; }
  }
`

interface Props {
  rubro: RubroTurnos
  servicios: ServicioPanel[]
  /** `silencio`: guarda sin mostrar el aviso (la llave ya se ve cambiar). */
  onGuardar: (s: ServicioPanel, silencio?: boolean) => void
  onBorrar: (id: string) => void
  /** Pausar (true) saca el servicio del sitio y de Nuevo turno; reanudar (false) lo devuelve. */
  onPausar: (id: string, pausado: boolean) => void
}

export default function Servicios({ rubro, servicios, onGuardar, onBorrar, onPausar }: Props) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editando, setEditando] = useState<ServicioPanel | null>(null)
  const texto = sinAcentos(q.trim())
  const publicados = servicios.filter(s => s.estado === 'activo')
  const pausados = servicios.filter(s => s.estado === 'pausado')
  const lista = servicios
    .filter(s => filtro === 'todos' || (filtro === 'publicados' ? s.estado === 'activo' : s.estado === 'pausado'))
    .filter(s => !texto || sinAcentos(s.nombre).includes(texto))
  const conSena = rubro.sena > 0
  const nuevo = (nombre = '') => setEditando({ id: '', nombre, duracion: 30, precio: 0, online: true, estado: 'activo' })

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado
        rotulo={`${publicados.length} publicado${publicados.length === 1 ? '' : 's'}${pausados.length ? ` · ${pausados.length} pausado${pausados.length === 1 ? '' : 's'}` : ''}`}
        titulo="Servicios"
        bajada="Lo que ofrecés, cuánto dura y cuánto sale. Lo publicado aparece en tu página de reservas; lo pausado queda guardado hasta que lo reanudes."
        acciones={<button type="button" onClick={() => nuevo()} className="rv-btn rv-btn--primario"><Plus size={16} /> Nuevo servicio</button>}
      />

      <div className="tu-sv-filtros">
        <Buscador value={q} onChange={setQ} placeholder="Buscar servicios" />
        <Segmentado label="Mostrar" valor={filtro} onChange={setFiltro} opciones={[
          { id: 'todos', label: `Todos (${servicios.length})` }, { id: 'publicados', label: `Publicados (${publicados.length})` }, { id: 'pausados', label: `Pausados (${pausados.length})` },
        ]} />
      </div>

      {lista.length === 0 ? (
        <Vacio
          titulo={servicios.length === 0 ? 'Todavía no cargaste ningún servicio' : texto ? `Nada coincide con “${q.trim()}”` : filtro === 'pausados' ? 'No hay servicios pausados' : 'No hay servicios publicados'}
          texto={servicios.length === 0 ? 'Sin eso, tus clientes no tienen qué reservar. Empezá por el que más vendés.' : texto ? 'Probá con otra palabra o creá el servicio.' : filtro === 'pausados' ? 'Pausar un servicio lo saca de tu página sin borrarlo: lo hacés desde su fila.' : 'Reanudá alguno de los pausados o creá uno nuevo.'}
          accion={<button type="button" onClick={() => nuevo(texto ? q.trim() : '')} className="rv-btn rv-btn--primario"><Plus size={16} /> {texto ? `Crear “${q.trim()}”` : 'Nuevo servicio'}</button>}
        />
      ) : (
        <div className="rv-card" style={{ overflow: 'hidden', padding: '0 14px' }}>
          <table className="rv-tabla">
            <thead>
              <tr>
                <th scope="col">Servicio</th>
                <th scope="col">Duración</th>
                <th scope="col">Precio</th>
                {conSena && <th scope="col">Seña {rubro.sena}%</th>}
                <th scope="col">Reserva online</th>
                <th scope="col"><span className="rv-sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(s => {
                const pausado = s.estado === 'pausado'
                const sena = conSena && s.precio ? Math.round(s.precio * rubro.sena / 100) : 0
                return (
                  <tr key={s.id} data-pausado={pausado}>
                    <td>
                      <div className="tu-sv-nombre">
                        <span className="tu-sv-ico" aria-hidden><rubro.Icon size={16} strokeWidth={1.7} /></span>
                        <div>
                          <b>{s.nombre}</b>
                          <small>{pausado ? 'Pausado: no se ofrece' : s.online ? 'Publicado' : 'Publicado · solo lo agendás vos'}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Duración"><span className="rv-num">{duracionTxt(s.duracion)}</span></td>
                    <td data-label="Precio"><span className="rv-num">{pesos(s.precio)}</span></td>
                    {conSena && <td data-label={`Seña ${rubro.sena}%`}><span className="rv-num">{sena ? pesos(sena) : '—'}</span></td>}
                    <td data-label="Reserva online">
                      {/* Pausado no se reserva de ninguna forma: la llave queda apagada y trabada. */}
                      <Llave on={s.online && !pausado} disabled={pausado} onChange={v => onGuardar({ ...s, online: v }, true)} label={`Reserva online de ${s.nombre}`} />
                    </td>
                    <td>
                      <div className="tu-sv-acciones">
                        <button type="button" className="rv-btn rv-btn--sm" onClick={() => onPausar(s.id, !pausado)} aria-label={`${pausado ? 'Reanudar' : 'Pausar'} ${s.nombre}`}>{pausado ? <><Play size={14} /> Reanudar</> : <><Pause size={14} /> Pausar</>}</button>
                        <button type="button" className="rv-btn rv-btn--sm" onClick={() => setEditando(s)} aria-label={`Editar ${s.nombre}`}><Pencil size={14} /> Editar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormServicio
          key={editando.id || 'nuevo'}
          inicial={editando}
          rubro={rubro}
          onCerrar={() => setEditando(null)}
          onGuardar={s => { onGuardar(s); setEditando(null) }}
          onPausar={pausado => { onPausar(editando.id, pausado); setEditando(null) }}
          onBorrar={id => { onBorrar(id); setEditando(null) }}
        />
      )}
    </div>
  )
}

/** Alta y edición de un servicio. Sin `id` es uno nuevo. */
function FormServicio({ inicial, rubro, onCerrar, onGuardar, onPausar, onBorrar }: {
  inicial: ServicioPanel; rubro: RubroTurnos; onCerrar: () => void; onGuardar: (s: ServicioPanel) => void; onPausar: (pausado: boolean) => void; onBorrar: (id: string) => void
}) {
  const [nombre, setNombre] = useState(inicial.nombre)
  const [duracion, setDuracion] = useState(inicial.duracion)
  const [precio, setPrecio] = useState(inicial.precio ? String(inicial.precio) : '')
  const [online, setOnline] = useState(inicial.online)
  const [error, setError] = useState('')
  const idOnline = useId()
  const esNuevo = !inicial.id
  const pausado = inicial.estado === 'pausado'
  const monto = Math.max(0, Math.round(Number(precio.replace(',', '.')) || 0))
  const sena = rubro.sena && monto ? Math.round(monto * rubro.sena / 100) : 0
  const duraciones = (DURACIONES.includes(inicial.duracion) ? DURACIONES : [...DURACIONES, inicial.duracion].sort((a, b) => a - b))
    .map(d => ({ id: d, label: duracionTxt(d) }))

  const guardar = () => {
    if (!nombre.trim()) { setError('Ponele un nombre al servicio.'); return }
    onGuardar({ id: inicial.id || `s${Date.now()}`, nombre: nombre.trim(), duracion, precio: monto, online, estado: inicial.estado })
  }

  return (
    <Modal
      rotulo="Servicios"
      titulo={esNuevo ? 'Nuevo servicio' : inicial.nombre}
      bajada={esNuevo ? 'Así lo van a ver tus clientes al reservar.' : undefined}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="rv-btn">Cancelar</button>
        <button type="submit" className="rv-btn rv-btn--primario"><Check size={16} /> {esNuevo ? 'Crear servicio' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre" value={nombre} onChange={v => { setNombre(v); setError('') }} placeholder="Ej.: Corte y lavado" maxLength={50} />
      {error && <ErrorCampo>{error}</ErrorCampo>}
      <Selector label="Duración" valor={duracion} onChange={setDuracion} opciones={duraciones} />
      <Campo
        label="Precio" type="number" mono prefijo="$" value={precio} onChange={setPrecio} placeholder="0"
        ayuda={sena > 0 ? `Al reservar se pide una seña del ${rubro.sena}%: ${pesos(sena)}.` : 'Dejalo en 0 si está incluido en el abono o no se cobra.'}
      />
      <div className="tu-sv-estado">
        <Globe size={16} aria-hidden color={online ? 'var(--color-primary)' : 'var(--color-subtle)'} />
        <div>
          <b id={idOnline}>{online ? 'Se reserva online' : 'Solo lo agendás vos'}</b>
          <small>{online ? 'Aparece en tu página de reservas.' : 'No se muestra en tu página de reservas.'}</small>
        </div>
        <button type="button" role="switch" aria-checked={online} aria-labelledby={idOnline} className="rv-switch" onClick={() => setOnline(!online)} />
      </div>

      {!esNuevo && (
        <div className="tu-sv-estado">
          {pausado ? <Pause size={16} aria-hidden color="var(--chip-warning-fg)" /> : <Play size={16} aria-hidden color="var(--color-success)" />}
          <div>
            <b>{pausado ? 'Pausado' : 'Publicado'}</b>
            <small>{pausado ? 'No se ofrece en tu sitio ni al dar un turno. Los turnos ya dados no se tocan.' : 'Pausarlo lo saca de tu sitio y de Nuevo turno sin borrarlo: lo reanudás cuando quieras.'}</small>
          </div>
          <button type="button" className="rv-btn rv-btn--sm" onClick={() => onPausar(!pausado)}>{pausado ? 'Reanudar' : 'Pausar'}</button>
        </div>
      )}

      {!esNuevo && (
        <Borrar
          etiqueta="Eliminar servicio"
          pregunta={<>¿Eliminar <b>{inicial.nombre}</b>? Deja de ofrecerse y no se puede recuperar. Los turnos que ya están agendados no se tocan.</>}
          onBorrar={() => onBorrar(inicial.id)}
        />
      )}
    </Modal>
  )
}
