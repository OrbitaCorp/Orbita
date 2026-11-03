// Invitar a alguien al equipo: el mismo flujo que Tienda (Configuración →
// Equipo → "Invitar nuevo miembro"), con las piezas del kit de reservas.
// Nombre, email y rol; al enviar, la pantalla de "Invitación enviada" con la
// contraseña temporal para copiar.
//
// Lo propio de Turnos (su agenda y cómo cobra) no se pide acá: la persona entra
// con la agenda del negocio y la forma de pago típica del rubro, y desde la
// pantalla de éxito se puede seguir a "Agenda y pago" para ajustarlo.
//
// Es una demo: no se manda ningún mail y la contraseña se inventa en el navegador.
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { Campo, OpcionTarjeta } from './configuracion/ui'
import { ErrorCampo } from './piezasPanel'
import { Modal } from '@/design-system/reservas/piezas'
import { pagoTxt, resumenRol, type Pago, type Persona, type Rol } from '../datos/equipo'

const LETRAS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Contraseña temporal de la demo. Se llama solo desde el envío (nunca en render). */
function claveTemporal(): string {
  const azar = new Uint32Array(10)
  crypto.getRandomValues(azar)
  return Array.from(azar, n => LETRAS[n % LETRAS.length]).join('')
}

const CSS = `
  .tu-inv-roles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .tu-inv-roles > .tuc-opcion { padding: 12px; }
  .tu-inv-permisos { margin-top: 10px; padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--rv-r-sm); }
  .tu-inv-permisos > div { display: flex; flex-wrap: wrap; gap: 6px; }
  .tu-inv-clave { display: flex; gap: 8px; align-items: center; }
  .tu-inv-clave > code { flex: 1; min-width: 0; padding: 10px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--rv-r-sm); font-size: 14px; font-family: var(--rv-mono); color: var(--color-text); letter-spacing: 0.04em; overflow-wrap: anywhere; }
  @media (max-width: 560px) { .tu-inv-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`

export default function InvitarPersona({ rubro, roles, personas, pago, onCerrar, onInvitar, onConfigurar }: {
  rubro: RubroTurnos
  roles: Rol[]
  personas: Persona[]
  /** La forma de pago con la que entra (la típica del rubro). */
  pago: Pago
  onCerrar: () => void
  /** Suma a la persona al equipo, con invitación pendiente. */
  onInvitar: (datos: { nombre: string; email: string; rolId: string }) => void
  /** Sigue a su ficha para ajustar agenda y pago. */
  onConfigurar: () => void
}) {
  const elegibles = roles.filter(r => !r.fijo)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rolId, setRolId] = useState(elegibles.find(r => r.atiende)?.id ?? elegibles[0]?.id ?? '')
  const [err, setErr] = useState<{ nombre?: string; email?: string }>({})
  const [resultado, setResultado] = useState<{ email: string; nombre: string; clave: string } | null>(null)
  const [copiada, setCopiada] = useState(false)

  const rol = elegibles.find(r => r.id === rolId) ?? elegibles[0]
  const permisos = rol ? resumenRol(rol, rubro) : []

  const enviar = () => {
    const e: { nombre?: string; email?: string } = {}
    const mail = email.trim().toLowerCase()
    if (!nombre.trim()) e.nombre = 'Ingresá el nombre'
    if (!mail) e.email = 'Ingresá el email'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) e.email = 'Email inválido'
    else if (personas.some(p => p.email.toLowerCase() === mail)) e.email = 'Este email ya tiene acceso al panel'
    setErr(e)
    if (Object.keys(e).length || !rol) return
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    onInvitar({ nombre: limpio, email: mail, rolId: rol.id })
    setResultado({ email: mail, nombre: limpio, clave: claveTemporal() })
  }

  const copiar = async () => {
    if (!resultado) return
    try {
      await navigator.clipboard.writeText(resultado.clave)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 2000)
    } catch { /* portapapeles bloqueado: la clave queda a la vista para copiarla a mano */ }
  }

  if (resultado) {
    return (
      <Modal rotulo="Equipo" titulo="Invitación enviada" ancho={480} onCerrar={onCerrar}
        pie={<><button type="button" className="rv-btn" onClick={onConfigurar}>Agenda y pago</button><button type="button" className="rv-btn rv-btn--primario" onClick={onCerrar}>Listo</button></>}>
        <style>{CSS}</style>
        <div className="rv-nota tu-nota--ok" style={{ marginBottom: 16 }}>
          <Check size={16} aria-hidden />
          <span>Le mandamos a <b>{resultado.email}</b> un email con el acceso al panel y su contraseña temporal.</span>
        </div>
        <div className="tuc-rotulo" style={{ marginBottom: 4 }}>Contraseña temporal</div>
        <div className="tuc-ayuda" style={{ marginBottom: 8 }}>Por si el email no le llega, pasásela por otro canal.</div>
        <div className="tu-inv-clave">
          <code>{resultado.clave}</code>
          <button type="button" className="rv-btn" onClick={() => void copiar()}>{copiada ? <Check size={14} /> : <Copy size={14} />} {copiada ? 'Copiada' : 'Copiar'}</button>
        </div>
        <p className="rv-ayuda" style={{ margin: '12px 0 0' }}>
          Deberá cambiarla en su primer acceso. {resultado.nombre.split(' ')[0]} entra con la agenda del negocio y cobra así: <b style={{ color: 'var(--color-body)' }}>{pagoTxt(pago, rubro).toLowerCase()}</b>. Lo cambiás en “Agenda y pago”.
        </p>
      </Modal>
    )
  }

  return (
    <Modal rotulo="Equipo" titulo="Invitar nuevo miembro" bajada="Le llega un mail con el acceso a su panel. Después ajustás su agenda y cómo cobra." ancho={560} onCerrar={onCerrar} onEnviar={enviar}
      pie={<><button type="button" className="rv-btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="rv-btn rv-btn--primario">Enviar invitación</button></>}>
      <style>{CSS}</style>
      <Campo label="Nombre completo" value={nombre} onChange={v => { setNombre(v); setErr(e => ({ ...e, nombre: undefined })) }} placeholder="Julián Acosta" maxLength={40} />
      {err.nombre && <ErrorCampo>{err.nombre}</ErrorCampo>}
      <Campo label="Email" type="email" value={email} onChange={v => { setEmail(v); setErr(e => ({ ...e, email: undefined })) }} placeholder="julian@tunegocio.com" />
      {err.email && <ErrorCampo>{err.email}</ErrorCampo>}

      <div className="tuc-rotulo" style={{ marginBottom: 8 }}>Rol asignado</div>
      <div role="radiogroup" aria-label="Rol asignado" className="tu-inv-roles">
        {elegibles.map(r => <OpcionTarjeta key={r.id} activa={r.id === rol?.id} onClick={() => setRolId(r.id)} titulo={r.nombre} ayuda={r.descripcion} />)}
      </div>
      {permisos.length > 0 && (
        <div className="tu-inv-permisos">
          <div className="rv-rotulo" style={{ marginBottom: 8 }}>Qué puede hacer</div>
          <div>{permisos.map(p => <span key={p} className="rv-chip rv-chip--primario" style={{ height: 24, fontSize: 11.5 }}>{p}</span>)}</div>
        </div>
      )}

      <p className="rv-ayuda" style={{ margin: '16px 0 0' }}>El miembro recibe un email con el acceso y una contraseña temporal generada automáticamente, que deberá cambiar en su primer ingreso. Al enviarla, la vas a poder copiar desde acá también.</p>
    </Modal>
  )
}
