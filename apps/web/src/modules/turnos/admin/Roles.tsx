// Roles y permisos del equipo. Cada rubro trae los suyos (una barbería tiene
// Barbero y Aprendiz; un consultorio, Secretaría y Administración): el dueño los
// ajusta permiso por permiso, los vuelve a como venían o crea uno propio.
//
// De cada rol se ve qué puede hacer en frases y cuánta gente lo tiene, y con
// "Ver su panel" se entra a mirar el panel tal como lo ve alguien con ese rol.
// La misma pieza se usa en Equipo y en Configuración → Equipo y permisos.
import { useState } from 'react'
import { Check, Crown, Eye, Lock, Minus, Pencil, Plus, RotateCcw, ShieldCheck, UserCog, Users } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { Llave } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo, Selector } from './configuracion/ui'
import { Borrar, ErrorCampo, Modal } from './piezasPanel'
import { sinAcentos } from './agendaDemo'
import {
  PERMISOS_MINIMOS, normalizar, permisosDe, resumenRol, rolCambiado, rolDeFabrica, trabaDe,
  type Alcance, type Permiso, type Persona, type Rol, type VerComo,
} from './equipoDemo'

export const CSS_ROLES = `
  .tu-rol-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .tu-rol { display: flex; flex-direction: column; gap: 12px; padding: 18px; transition: border-color 180ms ease, box-shadow 240ms ease; }
  @media (hover: hover) { .tu-rol:hover { border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border)); box-shadow: var(--shadow-card-hover); } }
  .tu-rol-ico { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center; color: var(--color-primary); background: var(--tuo-grad-suave); border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent); }
  .tu-rol-desc { font-size: 13px; line-height: 1.5; color: var(--color-muted); margin: 0; }
  .tu-rol-puede { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-body); }
  .tu-rol-puede > li { display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
  .tu-rol-puede > li > svg { flex-shrink: 0; margin-top: 2px; color: var(--color-success); }
  .tu-rol-pie { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--color-border); }
  .tu-rol-nuevo { min-height: 190px; border-radius: var(--tuo-r); border: 1.5px dashed var(--color-border-strong); background: transparent; color: var(--color-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px; font-family: inherit; font-size: 13.5px; font-weight: 600; text-align: center; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, color 180ms ease; }
  .tu-rol-nuevo > small { font-size: 12.5px; font-weight: 400; line-height: 1.45; max-width: 220px; }
  @media (hover: hover) { .tu-rol-nuevo:hover { border-color: var(--color-primary); background: var(--color-primary-bg); color: var(--color-primary); } }
  .tu-rol-nuevo:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

  /* Editor: un renglón por permiso, con su alcance a la derecha. */
  .tu-rol-grupo { margin-top: 18px; }
  .tu-rol-grupo > .tuo-rotulo { display: block; margin-bottom: 4px; }
  .tu-rol-permiso { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--color-border); }
  .tu-rol-permiso > div:first-child { flex: 1; min-width: 0; }
  .tu-rol-permiso b { display: block; font-size: 13.5px; font-weight: 600; color: var(--color-text); }
  .tu-rol-permiso small { display: block; font-size: 12px; line-height: 1.45; color: var(--color-muted); margin-top: 2px; }
  .tu-rol-permiso small[data-traba] { color: var(--chip-warning-fg); }
  .tu-rol-alcance { display: inline-flex; flex-shrink: 0; padding: 3px; gap: 2px; border-radius: 11px; background: var(--color-surface-alt); border: 1px solid var(--color-border); }
  .tu-rol-alcance > button { min-height: 32px; padding: 0 11px; border-radius: 8px; border: none; background: transparent; color: var(--color-muted); font-family: inherit; font-size: 12.5px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease; }
  .tu-rol-alcance > button[aria-checked='true'] { background: var(--color-bg); color: var(--color-text); font-weight: 600; box-shadow: 0 1px 3px rgba(15,23,42,0.16), 0 0 0 1px var(--color-border); }
  .tu-rol-alcance > button[aria-checked='true'][data-alcance='todo'] { color: var(--chip-success-fg); box-shadow: 0 1px 3px rgba(15,23,42,0.16), 0 0 0 1px color-mix(in srgb, var(--color-success) 45%, var(--color-border)); }
  .tu-rol-alcance > button[aria-checked='true'][data-alcance='propio'] { color: var(--chip-primary-fg); box-shadow: 0 1px 3px rgba(15,23,42,0.16), 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
  .tu-rol-alcance > button:disabled { opacity: 0.4; cursor: not-allowed; }
  .tu-rol-alcance > button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  @media (hover: hover) { .tu-rol-alcance > button:not(:disabled):not([aria-checked='true']):hover { color: var(--color-text); } }
  .tu-rol-atiende { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-surface); }
  @media (max-width: 640px) {
    .tu-rol-grid { grid-template-columns: minmax(0, 1fr); }
    .tu-rol-permiso { flex-direction: column; align-items: stretch; gap: 10px; }
    .tu-rol-alcance { display: flex; }
    .tu-rol-alcance > button { flex: 1; min-height: 44px; padding: 0 6px; }
    .tu-rol-pie .tuo-btn { height: 44px; flex: 1; }
  }
  @media (prefers-reduced-motion: reduce) { .tu-rol, .tu-rol-nuevo, .tu-rol-alcance > button { transition: none; } }
`

interface Props {
  rubro: RubroTurnos
  roles: Rol[]
  personas: Persona[]
  onGuardar: (r: Rol) => void
  onBorrar: (id: string) => void
  /** Entrar a ver el panel como alguien con ese rol. */
  onVerComo?: (c: VerComo) => void
}

const NUEVO: Rol = { id: '', nombre: '', descripcion: '', deFabrica: false, atiende: false, permisos: PERMISOS_MINIMOS }

export default function RolesPermisos({ rubro, roles, personas, onGuardar, onBorrar, onVerComo }: Props) {
  const [editando, setEditando] = useState<Rol | null>(null)
  const conRol = (id: string) => personas.filter(p => p.rolId === id)

  return (
    <>
      <div className="tu-rol-grid">
        {roles.map((rol, i) => {
          const gente = conRol(rol.id)
          const Icono = rol.fijo ? Crown : rol.deFabrica ? ShieldCheck : UserCog
          const ajustado = rol.deFabrica && !rol.fijo && rolCambiado(rol, rubro)
          return (
            <article key={rol.id} className="tuo-card tu-rol tuo-entra" style={{ ['--i' as string]: Math.min(i, 8) }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="tu-rol-ico" aria-hidden><Icono size={18} strokeWidth={1.7} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="tuo-h2" style={{ fontSize: 15.5 }}>{rol.nombre}</h3>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {rol.fijo ? <span className="tuo-chip tuo-chip--primario" style={{ height: 22, fontSize: 11 }}><Lock size={11} /> Puede todo</span>
                      : rol.deFabrica ? <span className="tuo-chip" style={{ height: 22, fontSize: 11 }}>{ajustado ? 'Ajustado por vos' : `De ${rubro.label.toLowerCase()}`}</span>
                        : <span className="tuo-chip tuo-chip--ok" style={{ height: 22, fontSize: 11 }}>Creado por vos</span>}
                    {rol.atiende && rubro.modo !== 'cancha' && <span className="tuo-chip tuo-chip--borde" style={{ height: 22, fontSize: 11 }}>{rubro.modo === 'cupo' ? 'Da clases' : 'Atiende turnos'}</span>}
                  </div>
                </div>
              </div>
              <p className="tu-rol-desc">{rol.descripcion || 'Sin descripción.'}</p>
              <ul className="tu-rol-puede">
                {resumenRol(rol, rubro).map(t => (t.startsWith('No ')
                  ? <li key={t} style={{ color: 'var(--color-muted)' }}><Minus size={14} strokeWidth={2.4} aria-hidden style={{ color: 'var(--color-subtle)' }} />{t}</li>
                  : <li key={t}><Check size={14} strokeWidth={2.4} aria-hidden />{t}</li>))}
              </ul>
              <div className="tu-rol-pie">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-muted)', marginRight: 'auto' }}>
                  <Users size={14} aria-hidden /> {gente.length === 0 ? 'Nadie todavía' : gente.length === 1 ? gente[0].nombre.split(' ')[0] : `${gente.length} personas`}
                </span>
                {!rol.fijo && onVerComo && (
                  <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => onVerComo({ rolId: rol.id, personaId: gente[0]?.id })} aria-label={`Ver el panel como ${rol.nombre}`}><Eye size={14} /> Ver su panel</button>
                )}
                {!rol.fijo && <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => setEditando(rol)} aria-label={`Editar el rol ${rol.nombre}`}><Pencil size={14} /> Editar</button>}
              </div>
            </article>
          )
        })}

        <button type="button" className="tu-rol-nuevo tuo-entra" style={{ ['--i' as string]: Math.min(roles.length, 9) }} onClick={() => setEditando(NUEVO)}>
          <Plus size={22} strokeWidth={1.6} aria-hidden />
          Crear un rol
          <small>Para alguien que no entra en ninguno de estos: elegís vos qué ve y qué puede hacer.</small>
        </button>
      </div>

      {editando && (
        <EditorRol
          key={editando.id || 'nuevo'}
          inicial={editando}
          rubro={rubro}
          roles={roles}
          cuantos={conRol(editando.id).length}
          onCerrar={() => setEditando(null)}
          onGuardar={r => { onGuardar(r); setEditando(null) }}
          onBorrar={id => { onBorrar(id); setEditando(null) }}
        />
      )}
    </>
  )
}

/** Alta y edición de un rol: nombre, si atiende y el alcance de cada permiso. Sin `id` es uno nuevo. */
function EditorRol({ inicial, rubro, roles, cuantos, onCerrar, onGuardar, onBorrar }: {
  inicial: Rol; rubro: RubroTurnos; roles: Rol[]; cuantos: number; onCerrar: () => void; onGuardar: (r: Rol) => void; onBorrar: (id: string) => void
}) {
  const [rol, setRol] = useState(inicial)
  const [desde, setDesde] = useState('')
  const [error, setError] = useState('')
  const esNuevo = !inicial.id
  const permisos = permisosDe(rubro)
  const grupos = [...new Set(permisos.map(p => p.grupo))]
  const fabrica = rol.deFabrica ? rolDeFabrica(rol.id, rubro) : null
  const copiables = roles.filter(r => !r.fijo)

  const cambiar = (id: Permiso['id'], alcance: Alcance) => setRol(r => ({ ...r, permisos: normalizar({ ...r.permisos, [id]: alcance }) }))
  const copiarDe = (id: string) => {
    setDesde(id)
    const base = roles.find(r => r.id === id)
    setRol(r => ({ ...r, permisos: base ? base.permisos : PERMISOS_MINIMOS, atiende: base ? base.atiende : false }))
  }
  const guardar = () => {
    const nombre = rol.nombre.trim().replace(/\s+/g, ' ')
    if (!nombre) { setError('Ponele un nombre al rol.'); return }
    const repetido = roles.find(r => r.id !== rol.id && sinAcentos(r.nombre) === sinAcentos(nombre))
    if (repetido) { setError(`Ya hay un rol que se llama ${repetido.nombre}.`); return }
    onGuardar({ ...rol, id: rol.id || `rol${Date.now()}`, nombre, descripcion: rol.descripcion.trim(), permisos: normalizar(rol.permisos) })
  }

  return (
    <Modal
      ancho={680}
      rotulo="Roles y permisos"
      titulo={esNuevo ? 'Crear un rol' : inicial.nombre}
      bajada={esNuevo ? 'Quien tenga este rol entra al panel y ve solo lo que le prendas acá.' : `${cuantos === 0 ? 'Nadie tiene este rol todavía' : cuantos === 1 ? 'Lo tiene 1 persona' : `Lo tienen ${cuantos} personas`}. Los cambios valen para todos los que lo tengan.`}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        {fabrica && rolCambiado(rol, rubro) && (
          <button type="button" className="tuo-btn tuo-btn--fantasma tuo-modal-izq" onClick={() => { setRol(fabrica); setError('') }}><RotateCcw size={15} /> Volver a como venía</button>
        )}
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> {esNuevo ? 'Crear rol' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre del rol" value={rol.nombre} onChange={v => { setRol(r => ({ ...r, nombre: v })); setError('') }} placeholder="Ej.: Encargada de sucursal" maxLength={30} />
      {error && <ErrorCampo>{error}</ErrorCampo>}
      <Campo label="Para qué es" ayuda="Opcional. Te sirve para acordarte a quién dárselo." value={rol.descripcion} onChange={v => setRol(r => ({ ...r, descripcion: v }))} area maxLength={140} placeholder="Ej.: Abre el local los sábados y cierra la caja." />
      {esNuevo && copiables.length > 0 && (
        <Selector label="Empezar desde" ayuda="Copia los permisos de un rol que ya tenés; después cambiás lo que quieras." valor={desde} onChange={copiarDe}
          opciones={[{ id: '', label: 'De cero: solo ve su agenda' }, ...copiables.map(r => ({ id: r.id, label: `Igual que ${r.nombre}` }))]} />
      )}

      {rubro.modo !== 'cancha' && (
        <div className="tu-rol-atiende">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{rubro.modo === 'cupo' ? 'Da clases' : 'Atiende turnos'}</div>
            <div className="tuc-ayuda">
              {!esNuevo && cuantos > 0 ? `Para cambiarlo, primero pasá a ${cuantos === 1 ? 'la persona que lo tiene' : `las ${cuantos} personas que lo tienen`} a otro rol.`
                : rubro.modo === 'profesional' ? 'Tiene su columna en la agenda y se le pueden dar turnos.'
                  : rubro.modo === 'cupo' ? 'Aparece como profe al armar una clase.' : 'Atiende en una de las cabinas.'}
            </div>
          </div>
          <Llave on={rol.atiende} onChange={atiende => setRol(r => ({ ...r, atiende }))} label={rubro.modo === 'cupo' ? 'Da clases' : 'Atiende turnos'} disabled={!esNuevo && cuantos > 0} />
        </div>
      )}

      {grupos.map(g => (
        <section key={g} className="tu-rol-grupo" aria-label={`Permisos de ${g.toLowerCase()}`}>
          <span className="tuo-rotulo">{g}</span>
          {permisos.filter(p => p.grupo === g).map(p => {
            const valor = rol.permisos[p.id]
            const traba = trabaDe(p.id, rol.permisos, rubro)
            const opciones: { id: Alcance; label: string }[] = [{ id: 'no', label: 'No' }, ...(p.propio ? [{ id: 'propio' as const, label: p.propio }] : []), { id: 'todo', label: p.propio ? p.todo ?? 'Todo' : 'Sí' }]
            return (
              <div key={p.id} className="tu-rol-permiso">
                <div>
                  <b>{p.label}</b>
                  <small>{p.ayuda}</small>
                  {traba && <small data-traba>{traba.motivo}</small>}
                </div>
                <div role="radiogroup" aria-label={p.label} className="tu-rol-alcance">
                  {opciones.map(o => (
                    <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} data-alcance={o.id} disabled={!!traba?.alcances.includes(o.id)} onClick={() => cambiar(p.id, o.id)}>{o.label}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {!esNuevo && !inicial.deFabrica && (
        <div style={{ marginTop: 18 }}>
          {cuantos > 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>No se puede eliminar mientras alguien lo tenga: pasá a {cuantos === 1 ? 'esa persona' : `esas ${cuantos} personas`} a otro rol desde Equipo.</p>
          ) : (
            <Borrar etiqueta="Eliminar rol" pregunta={<>¿Eliminar el rol <b>{inicial.nombre}</b>? Nadie lo tiene, así que no cambia nada para tu equipo.</>} onBorrar={() => onBorrar(inicial.id)} />
          )}
        </div>
      )}
    </Modal>
  )
}
