// El equipo: quiénes dan las clases. Cada profe tiene su color (el punto que lo
// identifica en la grilla y en el día), las actividades que da y cuántas
// clases tiene por semana. Sumar a alguien le manda una invitación al panel
// (simulada: no se manda nada); dar de baja deja sus clases "sin profe" y
// avisa cuántas, para asignarles a otro desde la grilla semanal.
import { useState } from 'react'
import { Check, Pencil, Trash2, UserPlus } from 'lucide-react'
import { DIAS_CORTOS, hhmm } from '@/lib/reservas/fechas'
import { COLORES_EQUIPO, actividadDe, rubroPorKey, type NegocioGym, type Profe } from '../datos'
import { Campo, Chip, Encabezado, EtiquetaDemo, Modal, Sigla, Vacio } from '@/design-system/reservas/piezas'
import { Swatches, type PropsConfig } from './piezas'

const CSS = `
  .geq-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .geq-card { display: flex; flex-direction: column; gap: 12px; }
  .geq-cab { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .geq-nombre { font-size: 16px; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .geq-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .geq-datos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .geq-dato { min-width: 0; padding: 10px 12px; border-radius: 8px; background: var(--color-surface); }
  .geq-dato b { display: block; font-family: var(--rv-mono); font-size: 18px; font-weight: 600; letter-spacing: -0.02em; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .geq-dato span { display: block; font-size: 12px; color: var(--color-muted); margin-top: 2px; }
  .geq-pie { display: flex; gap: 8px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--color-border); }
  .geq-pie > .rv-btn { flex: 1; }
  /* Las actividades que da: casillas de verdad, de 44 px de alto. */
  .geq-check { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 2px; cursor: pointer; font-size: 14px; color: var(--color-text); }
  .geq-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--color-primary); flex-shrink: 0; }
  .geq-dueno { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
  .geq-dueno > p { flex: 1 1 280px; min-width: 0; margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--color-body); }
  @media (max-width: 1024px) { .geq-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .geq-grid { grid-template-columns: minmax(0, 1fr); } }
`

export default function Equipo({ negocio, onGuardar }: PropsConfig) {
  const r = rubroPorKey(negocio.rubro)
  const [editando, setEditando] = useState<Profe | 'nuevo' | null>(null)
  const [baja, setBaja] = useState<Profe | null>(null)
  const clasesDe = (id: string) => negocio.clases.filter(c => c.profeId === id)
  const profeTxt = r.profe.toLowerCase()

  const guardar = (p: Profe) => {
    const existe = negocio.profes.some(x => x.id === p.id)
    onGuardar({ profes: existe ? negocio.profes.map(x => (x.id === p.id ? p : x)) : [...negocio.profes, p] }, existe ? 'Cambios guardados' : `${p.nombre} ya está en el equipo`, !existe && p.email ? 'Demo: no se mandó ninguna invitación.' : undefined)
    setEditando(null)
  }
  const darDeBaja = (p: Profe) => {
    const suyas = clasesDe(p.id)
    onGuardar({ profes: negocio.profes.filter(x => x.id !== p.id), clases: negocio.clases.map(c => (c.profeId === p.id ? { ...c, profeId: '' } : c)) }, `${p.nombre} ya no está en el equipo`, suyas.length ? `${suyas.length} ${suyas.length === 1 ? 'clase quedó' : 'clases quedaron'} sin profe: asignales a alguien desde la grilla.` : undefined)
    setBaja(null)
  }

  return (
    <div className="rv-pagina">
      <style>{CSS}</style>
      <Encabezado rotulo={`Negocio · ${negocio.profes.length} ${negocio.profes.length === 1 ? 'persona' : 'personas'}`} titulo="Equipo" bajada={`Quiénes dan las clases. Cada ${profeTxt} tiene su color en la grilla, sus actividades y, con su invitación, entra al panel a ver sus clases y tomar asistencia.`}
        acciones={<button type="button" className="rv-btn rv-btn--primario" onClick={() => setEditando('nuevo')}><UserPlus size={16} aria-hidden /> Sumar {profeTxt}</button>} />
      {negocio.profes.length === 0 ? <Vacio titulo="Nadie en el equipo" texto="Sumá a quien da las clases para asignarle horarios en la grilla." accion={<button type="button" className="rv-btn" onClick={() => setEditando('nuevo')}><UserPlus size={15} aria-hidden /> Sumar {profeTxt}</button>} /> : (
        <div className="geq-grid">
          {negocio.profes.map((p, i) => {
            const suyas = clasesDe(p.id).sort((a, b) => a.dia - b.dia || a.inicio - b.inicio)
            const dias = [...new Set(suyas.map(c => c.dia))].sort((a, b) => a - b).map(d => DIAS_CORTOS[d])
            const primera = suyas[0]
            return (
              <article key={p.id} className="rv-card rv-card--pad geq-card rv-entra" style={{ ['--i' as string]: i } as React.CSSProperties} aria-label={p.nombre}>
                <div className="geq-cab">
                  <Sigla nombre={p.nombre} color={p.color} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="geq-nombre">{p.nombre}</div>
                    <div className="rv-ayuda">{r.profe}{p.email ? ` · ${p.email}` : ''}</div>
                  </div>
                </div>
                <div className="geq-chips">
                  {p.actividades.map(id => actividadDe(negocio, id)).filter(a => !!a).map(a => <Chip key={a.id} tono="gris">{a.nombre}</Chip>)}
                  {p.actividades.length === 0 && <Chip tono="borde">Sin actividades</Chip>}
                  {p.email && <Chip tono="aviso">Invitación pendiente</Chip>}
                </div>
                <div className="geq-datos">
                  <div className="geq-dato"><b>{suyas.length}</b><span>{suyas.length === 1 ? 'clase por semana' : 'clases por semana'}{dias.length ? ` · ${dias.join(', ')}` : ''}</span></div>
                  <div className="geq-dato"><b>{primera ? `${DIAS_CORTOS[primera.dia]} ${hhmm(primera.inicio)}` : '—'}</b><span>{primera ? `primera: ${actividadDe(negocio, primera.actividadId)?.nombre ?? 'clase'}` : 'sin clases en la grilla'}</span></div>
                </div>
                <div className="geq-pie">
                  <button type="button" className="rv-btn rv-btn--sm" onClick={() => setEditando(p)}><Pencil size={14} aria-hidden /> Editar</button>
                  <button type="button" className="rv-btn rv-btn--sm rv-btn--peligro" onClick={() => setBaja(p)}><Trash2 size={14} aria-hidden /> Dar de baja</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <div className="rv-card rv-card--pad geq-dueno">
        <Sigla nombre={negocio.dueno.nombre} color="#1D4ED8" size={40} />
        <p><b style={{ color: 'var(--color-text)' }}>{negocio.dueno.nombre}</b> · {negocio.dueno.rol}, con acceso a todo el panel. Cada {profeTxt} recibe su invitación por email y desde el celular ve solo sus clases, hace check-in y marca quién faltó.</p>
        <EtiquetaDemo>Demo: no se mandó ninguna invitación</EtiquetaDemo>
      </div>
      {editando && <EditarProfe negocio={negocio} profe={editando === 'nuevo' ? null : editando} profeTxt={profeTxt} onCerrar={() => setEditando(null)} onGuardar={guardar} />}
      {baja && (
        <Modal titulo={`Dar de baja a ${baja.nombre}`} bajada="Deja de ver el panel y de aparecer en la grilla." onCerrar={() => setBaja(null)}
          pie={<><button type="button" className="rv-btn" onClick={() => setBaja(null)}>Cancelar</button><button type="button" className="rv-btn rv-btn--primario" onClick={() => darDeBaja(baja)}><Check size={15} aria-hidden /> Dar de baja</button></>}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
            {clasesDe(baja.id).length
              ? <>Sus <b>{clasesDe(baja.id).length} clases por semana</b> quedan en la grilla <b>sin profe</b>: se ven así en el panel y en el sitio hasta que les asignes a otra persona. Las clases que ya dio quedan en el historial.</>
              : 'No tiene clases en la grilla. Las clases que ya dio quedan en el historial.'}
          </p>
        </Modal>
      )}
    </div>
  )
}

function EditarProfe({ negocio, profe, profeTxt, onCerrar, onGuardar }: { negocio: NegocioGym; profe: Profe | null; profeTxt: string; onCerrar: () => void; onGuardar: (p: Profe) => void }) {
  // El color nuevo es el primero que nadie usa (así en la grilla se distinguen); el id se da al guardar.
  const [v, setV] = useState<Omit<Profe, 'id'>>(profe ?? { nombre: '', email: '', color: COLORES_EQUIPO.find(c => !negocio.profes.some(p => p.color === c)) ?? COLORES_EQUIPO[negocio.profes.length % COLORES_EQUIPO.length], actividades: [] })
  const [error, setError] = useState('')
  const toggle = (id: string) => setV({ ...v, actividades: v.actividades.includes(id) ? v.actividades.filter(a => a !== id) : [...v.actividades, id] })
  const guardar = () => {
    if (v.nombre.trim().length < 2) { setError('Escribí su nombre.'); return }
    const email = (v.email ?? '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('Revisá el email.'); return }
    onGuardar({ id: profe?.id ?? `p${Date.now().toString(36)}`, nombre: v.nombre.trim(), color: v.color, actividades: v.actividades, email: email || undefined })
  }
  return (
    <Modal titulo={profe ? `Editar a ${profe.nombre}` : `Sumar ${profeTxt}`} bajada={profe ? 'Su color, su email y las actividades que da.' : 'Con su email le llega la invitación para entrar al panel desde el celular.'} onCerrar={onCerrar}
      pie={<><button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button><button type="button" className="rv-btn rv-btn--primario" onClick={guardar}><Check size={15} aria-hidden /> {profe ? 'Guardar' : 'Sumar e invitar'}</button></>}>
      <div className="rv-pila">
        <Campo label="Nombre" value={v.nombre} onChange={x => setV({ ...v, nombre: x })} autoComplete="off" maxLength={40} />
        <Campo label="Email (opcional)" value={v.email ?? ''} onChange={x => setV({ ...v, email: x })} inputMode="email" ayuda="Para invitarle al panel: ve sus clases y toma asistencia. Sin email, solo figura en la grilla." />
        <div className="rv-campo">
          <span>Actividades que da</span>
          <div role="group" aria-label="Actividades que da">
            {negocio.actividades.map(a => (
              <label key={a.id} className="geq-check">
                <input type="checkbox" checked={v.actividades.includes(a.id)} onChange={() => toggle(a.id)} />
                <span>{a.nombre}</span>
              </label>
            ))}
          </div>
        </div>
        <Swatches label="Color en la grilla" colores={COLORES_EQUIPO} valor={v.color} onChange={c => setV({ ...v, color: c })} />
        {error && <p className="rv-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </Modal>
  )
}
