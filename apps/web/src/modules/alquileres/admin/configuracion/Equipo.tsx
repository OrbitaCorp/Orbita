// Equipo: quiénes entran al panel y con qué rol (dueño, encargado, recepción).
// Se suma y se quita gente al instante; en la demo no se manda ninguna
// invitación.
import { useState } from 'react'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { Campo, Chip, EtiquetaDemo, Modal, Seccion, Selector, Sigla } from '@/design-system/reservas/piezas'
import { ROLES, TIPOS, rolDe, type Persona, type RolEquipo } from '../../datos'
import { PaginaForm, idNuevo, type Form } from './comun'

type Opcion = 'encargado' | 'encargada' | 'recepcion'
const OPCIONES: { id: Opcion; label: string; rol: RolEquipo; genero?: 'f' }[] = [
  { id: 'encargado', label: 'Encargado', rol: 'encargado' },
  { id: 'encargada', label: 'Encargada', rol: 'encargado', genero: 'f' },
  { id: 'recepcion', label: 'Recepción', rol: 'recepcion' },
]

export default function Equipo({ negocio, onGuardar }: Form) {
  const [abrir, setAbrir] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [opcion, setOpcion] = useState<Opcion>('encargado')
  const [error, setError] = useState('')
  const cerrar = () => { setAbrir(false); setNombre(''); setTelefono(''); setEmail(''); setOpcion('encargado'); setError('') }
  const sumar = () => {
    if (nombre.trim().length < 3) { setError('Escribí el nombre y el apellido.'); return }
    const o = OPCIONES.find(x => x.id === opcion) ?? OPCIONES[0]
    const p: Persona = { id: idNuevo('e'), nombre: nombre.trim(), rol: o.rol, genero: o.genero, telefono: telefono.trim(), email: email.trim() || undefined }
    onGuardar({ equipo: [...negocio.equipo, p] }, `${p.nombre} ya está en el equipo`, 'Demo: no se mandó ninguna invitación.')
    cerrar()
  }
  const quitar = (p: Persona) => onGuardar({ equipo: negocio.equipo.filter(x => x.id !== p.id) }, `${p.nombre} ya no entra al panel`)
  return (
    <PaginaForm rotulo={TIPOS[negocio.tipo].label} titulo="Equipo" bajada="Quiénes entran al panel y qué puede hacer cada uno." acciones={<button type="button" className="rv-btn rv-btn--primario" onClick={() => setAbrir(true)}><UserPlus size={15} aria-hidden /> Sumar a alguien</button>}>
      <div className="rv-pila">
        <Seccion titulo="Personas" bajada={`${negocio.equipo.length} en el equipo.`} acciones={<EtiquetaDemo>Demo: no se mandó ninguna invitación</EtiquetaDemo>}>
          <div className="rv-lista">
            {negocio.equipo.map((p, i) => (
              <div key={p.id} className="alc-persona">
                <Sigla nombre={p.nombre} />
                <span className="rv-item-cuerpo">
                  <span className="rv-item-titulo">{p.nombre} <Chip tono={p.rol === 'dueno' ? 'primario' : 'gris'}>{rolDe(p)}</Chip>{i === 0 && <Chip tono="borde">Sos vos</Chip>}</span>
                  <span className="rv-item-sub">{[p.telefono, p.email].filter(Boolean).join(' · ') || 'Sin contacto cargado'}</span>
                </span>
                {p.rol !== 'dueno' && <button type="button" className="rv-btn rv-btn--sm" onClick={() => quitar(p)}><Trash2 size={15} aria-hidden /> Quitar</button>}
              </div>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="Roles" bajada="Cada persona entra con su cuenta y ve solo lo que su rol le permite.">
          <div className="rv-lista">
            {(Object.keys(ROLES) as RolEquipo[]).map(r => (
              <div key={r} className="rv-item" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 110, flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{ROLES[r].label[0]}</span>
                <span className="rv-item-cuerpo" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{ROLES[r].puede}</span>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
      {abrir && (
        <Modal titulo="Sumar a alguien" bajada="Entra con su propia cuenta y ve lo que su rol le permite." onCerrar={cerrar}
          pie={<>
            <button type="button" className="rv-btn" onClick={cerrar}>Cancelar</button>
            <button type="button" className="rv-btn rv-btn--primario" onClick={sumar}><Plus size={15} aria-hidden /> Sumar</button>
          </>}>
          <div className="rv-pila">
            <Campo label="Nombre y apellido" value={nombre} onChange={setNombre} autoComplete="off" />
            <Selector label="Rol" valor={opcion} onChange={setOpcion} opciones={OPCIONES.map(o => ({ id: o.id, label: o.label }))} ayuda={ROLES[OPCIONES.find(o => o.id === opcion)?.rol ?? 'encargado'].puede} />
            <div className="rv-dos">
              <Campo label="Celular" value={telefono} onChange={setTelefono} inputMode="tel" />
              <Campo label="Email (opcional)" value={email} onChange={setEmail} inputMode="email" />
            </div>
            {error && <p className="rv-error" role="alert" style={{ margin: 0 }}>{error}</p>}
          </div>
        </Modal>
      )}
    </PaginaForm>
  )
}
