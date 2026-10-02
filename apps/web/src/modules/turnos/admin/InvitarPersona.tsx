// Invitar a alguien al equipo: el mismo modal que usa Tienda (Configuración →
// Equipo → "Invitar nuevo miembro"), con sus mismas piezas (Modal y Button del
// design system; Lbl, Inp, Err y RolRadios de Tienda). Nombre, email y rol;
// al enviar, la pantalla de "Invitación enviada" con la contraseña temporal
// para copiar.
//
// Lo propio de Turnos (su agenda y cómo cobra) no se pide acá: la persona entra
// con la agenda del negocio y la forma de pago típica del rubro, y desde la
// pantalla de éxito se puede seguir a "Agenda y pago" para ajustarlo.
//
// Es una demo: no se manda ningún mail y la contraseña se inventa en el navegador.
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { Lbl, Err, Inp, RolRadios } from '@/modules/ventas/panel/configuracion/components/equipo/FormBits'
import type { Rol as RolTienda } from '@/modules/ventas/panel/configuracion/types/equipo.types'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { COLORES_EQUIPO, pagoTxt, resumenRol, type Pago, type Persona, type Rol } from './equipoDemo'

const LETRAS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Contraseña temporal de la demo. Se llama solo desde el envío (nunca en render). */
function claveTemporal(): string {
  const azar = new Uint32Array(10)
  crypto.getRandomValues(azar)
  return Array.from(azar, n => LETRAS[n % LETRAS.length]).join('')
}

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
  // RolRadios es de Tienda: recibe sus roles. De los de Turnos usa el nombre, la descripción y un color.
  const paraRadios: RolTienda[] = elegibles.map((r, i) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, color: COLORES_EQUIPO[i % COLORES_EQUIPO.length], esDefault: false, permisos: [], miembros: 0 }))

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
      <Modal isOpen onClose={onCerrar} title="Invitación enviada" maxWidth={480}
        footer={<><Button variant="ghost" onClick={onConfigurar}>Agenda y pago</Button><Button variant="primary" onClick={onCerrar}>Listo</Button></>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.10)', color: 'var(--color-success)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Check size={18} strokeWidth={2.2} />
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
            Le mandamos a <strong style={{ color: 'var(--color-text)' }}>{resultado.email}</strong> un email con el acceso al panel y su contraseña temporal.
          </div>
        </div>

        <Lbl help="Por si el email no le llega, pasásela por otro canal">Contraseña temporal</Lbl>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', letterSpacing: '0.04em' }}>
            {resultado.clave}
          </code>
          <Button variant="outline" icon={copiada ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copiar()}>
            {copiada ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          Deberá cambiarla en su primer acceso. {resultado.nombre.split(' ')[0]} entra con la agenda del negocio y cobra así: <strong style={{ color: 'var(--color-body)' }}>{pagoTxt(pago, rubro).toLowerCase()}</strong>. Lo cambiás en “Agenda y pago”.
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen onClose={onCerrar} title="Invitar nuevo miembro" maxWidth={560}
      footer={<><Button variant="ghost" onClick={onCerrar}>Cancelar</Button><Button variant="primary" onClick={enviar}>Enviar invitación</Button></>}>
      <Lbl>Nombre completo</Lbl>
      <Inp value={nombre} onChange={setNombre} placeholder="Julián Acosta" error={!!err.nombre} autoFocus />
      {err.nombre && <Err>{err.nombre}</Err>}
      <div style={{ height: 14 }} />

      <Lbl>Email</Lbl>
      <Inp value={email} onChange={setEmail} placeholder="julian@tunegocio.com" type="email" error={!!err.email} />
      {err.email && <Err>{err.email}</Err>}
      <div style={{ height: 18 }} />

      <Lbl>Rol asignado</Lbl>
      {/* RolRadios viene de Tienda con tres columnas fijas: en celular se acomodan solas para que no se aprieten. */}
      <style>{`@media (max-width: 560px) { .tu-inv-roles > div { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`}</style>
      <div className="tu-inv-roles"><RolRadios roles={paraRadios} value={rol?.id ?? ''} onChange={setRolId} /></div>
      {permisos.length > 0 && (
        <div style={{ marginTop: 10, padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-body)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Qué puede hacer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {permisos.map(p => <span key={p} style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 9999, background: 'var(--color-primary-bg)', color: 'var(--chip-primary-fg)', border: '1px solid var(--color-border)' }}>{p}</span>)}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
        El miembro recibirá un email con el acceso y una contraseña temporal generada automáticamente, que deberá cambiar en su primer ingreso. Al enviarla, la vas a poder copiar desde acá también.
      </div>
    </Modal>
  )
}
