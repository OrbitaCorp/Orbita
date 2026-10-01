// El equipo del negocio: quién trabaja, con qué rol entra al panel, cuándo
// atiende y cómo cobra. Dos pestañas: las personas y los roles con sus permisos.
//
// Los roles salen del rubro (una barbería trae Barbero y Aprendiz; un
// consultorio, Secretaría y Administración) y se pueden ajustar o crear nuevos.
// En los rubros donde cada turno es con una persona, quien tiene un rol que
// atiende tiene su propia columna en la agenda: sus días y su horario se editan
// acá mismo. "Ver su panel" muestra el panel tal como lo ve esa persona.
//
// Sumar y editar abren un modal; todo vive en PanelTurnos, así quien se suma
// acá aparece en la agenda, al dar un turno y en Ganancias.
import { useState } from 'react'
import { Check, Eye, Mail, MapPin, Pencil, Plus, UserPlus, Wallet } from 'lucide-react'
import { type Recurso, type RubroTurnos, type Turno } from '@/modules/turnos/datos'
import type { Semana, Tramo } from '@/modules/turnos/horario'
import { Anillo } from '@/modules/turnos/_shared/orbita/OrbitaDia'
import { Cabecera, Sigla } from '@/modules/turnos/_shared/orbita/piezas'
import { Campo, Dos, Selector } from './configuracion/ui'
import { Modal, ErrorCampo, Borrar, CamposAgenda, agendaDeForm, agendaFormDe, errorAgenda } from './piezasPanel'
import { ResumenAgenda, ocupacionDe } from './Espacios'
import RolesPermisos from './Roles'
import { CamposPago } from './PagoPersona'
import { CADA_TXT, COLORES_EQUIPO, pagoInicialDe, pagoTxt, type Persona, type Rol, type VerComo } from './equipoDemo'

export const CSS_EQUIPO = `
  .tu-per-pie { display: flex; gap: 8px; margin-top: auto; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .tu-per-pie > .tuo-btn { flex: 1; }
  .tu-per-nota { font-size: 13px; line-height: 1.5; color: var(--color-muted); margin: 0 0 12px; }
  .tu-per-tabs { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  @media (max-width: 768px) {
    .tu-per-pie > .tuo-btn { height: 44px; }
    .tu-per-tabs .tuo-seg { display: flex; width: 100%; }
    .tu-per-tabs .tuo-seg > button { flex: 1; height: 44px; }
  }
`

type Agenda = { atiende: number[]; horario: string; dias: string }

interface Props {
  rubro: RubroTurnos
  semana: Semana
  personas: Persona[]
  roles: Rol[]
  recursos: Recurso[]
  /** Los turnos de hoy. */
  turnos: Turno[]
  /** En qué tramos atiende cada agenda hoy. */
  jornada: (recursoId: string) => Tramo[]
  /** De la primera apertura al último cierre del negocio hoy. */
  rango: Tramo
  /** `agenda` son los días y el horario de quien atiende (rubros por profesional); null = no tiene agenda propia. */
  onGuardar: (p: Persona, agenda: Agenda | null) => void
  onBorrar: (id: string) => void
  onGuardarRol: (r: Rol) => void
  onBorrarRol: (id: string) => void
  onVerComo: (c: VerComo) => void
}

export default function Equipo({ rubro, semana, personas, roles, recursos, turnos, jornada, rango, onGuardar, onBorrar, onGuardarRol, onBorrarRol, onVerComo }: Props) {
  const [tab, setTab] = useState<'personas' | 'roles'>('personas')
  const [editando, setEditando] = useState<Persona | null>(null)
  const porPersona = rubro.modo === 'profesional'
  const rolDe = (id: string) => roles.find(r => r.id === id)
  const nueva = () => setEditando({
    id: '', nombre: '', email: '', telefono: '', pago: pagoInicialDe(rubro),
    rolId: roles.find(r => r.atiende && !r.fijo)?.id ?? roles.find(r => !r.fijo)?.id ?? '',
    color: COLORES_EQUIPO.find(c => !personas.some(p => p.color === c)) ?? COLORES_EQUIPO[personas.length % COLORES_EQUIPO.length],
  })

  return (
    <div className="panel-page">
      <Cabecera
        rotulo={`${personas.length} ${personas.length === 1 ? 'persona' : 'personas'} · ${roles.length} roles`}
        titulo="Equipo"
        bajada="Quién trabaja en el negocio, con qué rol entra al panel y cómo cobra. Cada uno ve solo lo que su rol le permite."
        acciones={<button type="button" onClick={nueva} className="tuo-btn tuo-btn--primario"><UserPlus size={16} /> Sumar persona</button>}
      />

      <div className="tu-per-tabs tuo-entra" style={{ ['--i' as string]: 1 }}>
        <div className="tuo-seg" role="group" aria-label="Qué ver del equipo">
          <button type="button" aria-pressed={tab === 'personas'} onClick={() => setTab('personas')}>Personas</button>
          <button type="button" aria-pressed={tab === 'roles'} onClick={() => setTab('roles')}>Roles y permisos</button>
        </div>
      </div>

      {tab === 'roles' ? (
        <RolesPermisos rubro={rubro} roles={roles} personas={personas} onGuardar={onGuardarRol} onBorrar={onBorrarRol} onVerComo={onVerComo} />
      ) : (
        <div className="tu-eq-grid">
          {personas.map((p, idx) => {
            const rol = rolDe(p.rolId)
            const rec = p.recursoId ? recursos.find(r => r.id === p.recursoId) : undefined
            const tramos = rec ? jornada(rec.id) : []
            const pct = rec ? ocupacionDe(rec.id, turnos, tramos) : 0
            return (
              <article key={p.id} className="tuo-card tuo-card--pad tu-eq-card tuo-entra" style={{ ['--c' as string]: p.color, ['--i' as string]: idx + 2, display: 'flex', flexDirection: 'column' }}>
                <span aria-hidden className="tu-eq-filo" style={{ background: `linear-gradient(90deg, ${p.color}, color-mix(in srgb, ${p.color} 20%, transparent))` }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <Sigla nombre={p.nombre} color={p.color} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--tuo-fh)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                      <span className={`tuo-chip${rol?.fijo ? ' tuo-chip--primario' : ''}`} style={{ height: 22, fontSize: 11.5 }}>{rol?.nombre ?? 'Sin rol'}</span>
                      {p.pendiente && <span className="tuo-chip tuo-chip--aviso" style={{ height: 22, fontSize: 11.5 }}>Invitación pendiente</span>}
                    </div>
                  </div>
                  {porPersona && rec && <Anillo valor={pct} color={p.color} size={46} grosor={4.5} label={`Ocupación de hoy: ${Math.round(pct * 100)}%`} />}
                </div>

                {porPersona && rec
                  ? <ResumenAgenda recurso={rec} semana={semana} turnos={turnos} tramos={tramos} rango={rango} verbo="atiende" />
                  : <p className="tu-per-nota">{rol?.descripcion}</p>}

                <div className="tu-eq-datos" style={{ marginTop: porPersona && rec ? 7 : 0, marginBottom: 16 }}>
                  {!porPersona && rec && <span><MapPin size={14} /> Atiende en {rec.nombre}</span>}
                  {p.email && <span><Mail size={14} /> <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span></span>}
                  <span><Wallet size={14} /> {pagoTxt(p.pago, rubro)}{p.pago ? ` · ${CADA_TXT[p.pago.cada]}` : ''}</span>
                </div>

                <div className="tu-per-pie">
                  {!rol?.fijo && <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => onVerComo({ rolId: p.rolId, personaId: p.id })} aria-label={`Ver el panel como ${p.nombre}`}><Eye size={14} /> Ver su panel</button>}
                  <button type="button" className="tuo-btn tuo-btn--sm" onClick={() => setEditando(p)} aria-label={`Editar a ${p.nombre}`}><Pencil size={14} /> Editar</button>
                </div>
              </article>
            )
          })}

          <button type="button" onClick={nueva} className="tu-eq-nuevo tuo-entra" style={{ ['--i' as string]: personas.length + 2 }}>
            <Plus size={22} strokeWidth={1.6} />
            Sumar persona
          </button>
        </div>
      )}

      {editando && (
        <FormPersona
          key={editando.id || 'nueva'}
          inicial={editando}
          rubro={rubro}
          semana={semana}
          roles={roles}
          recursos={recursos}
          personas={personas}
          turnosHoy={turnos.filter(t => t.recursoId === editando.recursoId && t.estado !== 'cancelado').length}
          onCerrar={() => setEditando(null)}
          onGuardar={(p, agenda) => { onGuardar(p, agenda); setEditando(null) }}
          onBorrar={id => { onBorrar(id); setEditando(null) }}
        />
      )}
    </div>
  )
}

/** Alta y edición de una persona: sus datos, el rol, cuándo atiende y cómo cobra. Sin `id` es alguien nuevo. */
function FormPersona({ inicial, rubro, semana, roles, recursos, personas, turnosHoy, onCerrar, onGuardar, onBorrar }: {
  inicial: Persona; rubro: RubroTurnos; semana: Semana; roles: Rol[]; recursos: Recurso[]; personas: Persona[]; turnosHoy: number
  onCerrar: () => void; onGuardar: (p: Persona, agenda: Agenda | null) => void; onBorrar: (id: string) => void
}) {
  const esNueva = !inicial.id
  const porPersona = rubro.modo === 'profesional'
  const suRecurso = inicial.recursoId ? recursos.find(r => r.id === inicial.recursoId) ?? null : null
  const [nombre, setNombre] = useState(inicial.nombre)
  const [email, setEmail] = useState(inicial.email)
  const [telefono, setTelefono] = useState(inicial.telefono)
  const [rolId, setRolId] = useState(inicial.rolId)
  const [agenda, setAgenda] = useState(() => agendaFormDe(porPersona ? suRecurso : null, semana))
  const [cabina, setCabina] = useState(porPersona ? '' : inicial.recursoId ?? '')
  const [pago, setPago] = useState(inicial.pago ?? pagoInicialDe(rubro))
  const [error, setError] = useState<{ en: 'datos' | 'agenda'; texto: string } | null>(null)

  const rol = roles.find(r => r.id === rolId)
  const esDueno = !!roles.find(r => r.id === inicial.rolId)?.fijo
  const atiende = !!rol?.atiende
  // Sin nadie que atienda no hay agenda: el último no puede dejar de atender ni irse.
  const esLaUnicaAgenda = porPersona && !!suRecurso && recursos.length <= 1
  const pila = nombre.trim().split(' ')[0]

  const guardar = () => {
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (!limpio) { setError({ en: 'datos', texto: 'Escribí el nombre y el apellido.' }); return }
    const mail = email.trim().toLowerCase()
    if (mail && !/.+@.+\..+/.test(mail)) { setError({ en: 'datos', texto: 'Revisá el mail: le falta algo.' }); return }
    if (mail && personas.some(p => p.id !== inicial.id && p.email === mail)) { setError({ en: 'datos', texto: 'Ese mail ya es de otra persona del equipo.' }); return }
    if (porPersona && atiende) {
      const mal = errorAgenda(agenda)
      if (mal) { setError({ en: 'agenda', texto: mal }); return }
    }
    if (esLaUnicaAgenda && !atiende) { setError({ en: 'agenda', texto: 'Es la única persona que atiende: con ese rol la agenda quedaría vacía.' }); return }
    const persona: Persona = {
      id: inicial.id || `p${Date.now()}`, nombre: limpio, email: mail, telefono: telefono.trim(), rolId, color: inicial.color,
      pago: esDueno ? null : pago,
      ...(porPersona ? (inicial.recursoId ? { recursoId: inicial.recursoId } : {}) : atiende && cabina ? { recursoId: cabina } : {}),
      ...(esNueva && mail ? { pendiente: true } : inicial.pendiente ? { pendiente: true } : {}),
    }
    onGuardar(persona, porPersona && atiende ? agendaDeForm(agenda) : null)
  }

  return (
    <Modal
      ancho={600}
      rotulo="Equipo"
      titulo={esNueva ? 'Sumar al equipo' : inicial.nombre}
      bajada={esNueva ? 'Elegí su rol: de eso depende qué ve cuando entra al panel.' : undefined}
      icono={esNueva ? undefined : <Sigla nombre={inicial.nombre} color={inicial.color} size={44} />}
      onCerrar={onCerrar}
      onEnviar={guardar}
      pie={<>
        <button type="button" onClick={onCerrar} className="tuo-btn">Cancelar</button>
        <button type="submit" className="tuo-btn tuo-btn--primario"><Check size={16} /> {esNueva ? 'Sumar al equipo' : 'Guardar cambios'}</button>
      </>}
    >
      <Campo label="Nombre y apellido" value={nombre} onChange={v => { setNombre(v); setError(null) }} placeholder="Ej.: Julián Acosta" maxLength={40} />
      <Dos>
        <Campo label="Mail" ayuda={esNueva ? 'Ahí le llega la invitación para entrar a su panel.' : undefined} type="email" value={email} onChange={v => { setEmail(v); setError(null) }} placeholder="nombre@mail.com" />
        <Campo label="Teléfono" ayuda={esNueva ? 'Opcional.' : undefined} type="tel" mono value={telefono} onChange={setTelefono} placeholder="11 5555-0000" />
      </Dos>
      {error?.en === 'datos' && <ErrorCampo>{error.texto}</ErrorCampo>}

      {esDueno ? (
        <div className="tu-nota tu-nota--info">
          <Check size={15} />
          <span><b>{rol?.nombre}.</b> Ve y puede todo: su rol no se cambia.</span>
        </div>
      ) : (
        <Selector label="Rol" ayuda={rol?.descripcion} valor={rolId} onChange={v => { setRolId(v); setError(null) }} opciones={roles.filter(r => !r.fijo).map(r => ({ id: r.id, label: r.nombre }))} />
      )}

      {atiende && porPersona && (
        <div className="tu-seccion">
          <span className="tuo-rotulo">Su agenda</span>
          <CamposAgenda id="tu-persona" valor={agenda} onChange={a => { setAgenda(a); setError(null) }} semana={semana} />
        </div>
      )}
      {atiende && rubro.modo === 'recurso' && (
        <Selector label="Dónde atiende" ayuda="Lo que factura esa agenda cuenta para su comisión." valor={cabina} onChange={setCabina}
          opciones={[...recursos.map(r => ({ id: r.id, label: r.nombre })), { id: '', label: 'Sin un espacio fijo' }]} />
      )}
      {atiende && rubro.modo === 'cupo' && (
        <div className="tu-nota tu-nota--info"><Check size={15} /><span>Las clases que da {pila || 'esta persona'} se arman en <b>Clases</b>: ahí se elige quién da cada una.</span></div>
      )}
      {error?.en === 'agenda' && <ErrorCampo>{error.texto}</ErrorCampo>}

      {!esDueno && (
        <div className="tu-seccion">
          <span className="tuo-rotulo">Cómo cobra</span>
          <CamposPago pago={pago} onChange={setPago} rubro={rubro} nombre={nombre} />
        </div>
      )}

      {!esNueva && !esDueno && (
        <div style={{ marginTop: 16 }}>
          {esLaUnicaAgenda ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>No se puede sacar del equipo: es la única persona que atiende turnos.</p>
          ) : (
            <Borrar
              etiqueta="Sacar del equipo"
              pregunta={<>¿Sacar a <b>{inicial.nombre}</b> del equipo? Deja de poder entrar al panel. {porPersona && suRecurso ? (turnosHoy > 0 ? `Sus ${turnosHoy} turno${turnosHoy === 1 ? '' : 's'} de hoy dejan de verse: reprogramalos antes.` : 'No tiene turnos para hoy.') : ''}</>}
              onBorrar={() => onBorrar(inicial.id)}
            />
          )}
        </div>
      )}
    </Modal>
  )
}
