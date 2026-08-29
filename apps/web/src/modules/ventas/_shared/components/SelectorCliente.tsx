import { useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'

export interface ClienteBase {
  id: string
  nombre: string
  dni: string
  telefono: string
  email?: string
}

type Vista = 'buscar' | 'crear'

interface Props {
  isOpen: boolean
  clientes?: ClienteBase[]
  onClose: () => void
  onSeleccionar: (cliente: ClienteBase) => void
  onCrear?: (datos: Omit<ClienteBase, 'id'>) => void
}

export function SelectorCliente({ isOpen, clientes = [], onClose, onSeleccionar, onCrear }: Props) {
  const [vista, setVista] = useState<Vista>('buscar')
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '' })

  if (!isOpen) return null

  const filtrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase()
    return c.nombre.toLowerCase().includes(q) || c.dni.includes(q) || c.telefono.includes(q)
  })

  const handleCrear = () => {
    if (!form.nombre || !form.dni) return
    onCrear?.({ ...form })
    const nuevoCliente: ClienteBase = { id: `cli-${Date.now()}`, ...form }
    onSeleccionar(nuevoCliente)
    setForm({ nombre: '', dni: '', telefono: '', email: '' })
    onClose()
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Sora, Inter, sans-serif' }}>
            {vista === 'buscar' ? 'Asociar cliente' : 'Nuevo cliente'}
          </h3>
          <button className="ds-hover" onClick={onClose} style={{ background: 'none', border: 'none', borderRadius: 6, color: 'var(--color-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['buscar', 'crear'] as Vista[]).map((v) => (
            <button key={v} className="ds-hover" onClick={() => setVista(v)}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${vista === v ? 'var(--color-primary)' : 'var(--color-border)'}`, background: vista === v ? 'rgba(59,130,246,.08)' : 'transparent', color: vista === v ? 'var(--color-primary)' : 'var(--color-muted)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              {v === 'buscar' ? 'Buscar existente' : 'Crear nuevo'}
            </button>
          ))}
        </div>

        {vista === 'buscar' ? (
          <>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input className="ds-field" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, DNI o teléfono..." style={{ ...inputStyle, paddingLeft: 32 }} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtrados.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
                  {busqueda ? 'Sin resultados.' : 'Escribí para buscar un cliente.'}
                </div>
              ) : (
                filtrados.map((c) => (
                  <button key={c.id} className="ds-hover" onClick={() => { onSeleccionar(c); onClose() }}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', textAlign: 'left', fontFamily: 'inherit' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{c.nombre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>DNI {c.dni} · {c.telefono}</p>
                  </button>
                ))
              )}
            </div>
            {onCrear && (
              <button className="ds-hover" onClick={() => setVista('crear')} style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                <UserPlus size={14} /> Crear cliente nuevo
              </button>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'nombre', label: 'Nombre *', placeholder: 'Juan Pérez' },
              { key: 'dni', label: 'DNI *', placeholder: '12345678' },
              { key: 'telefono', label: 'Teléfono', placeholder: '+54 9 11 ...' },
              { key: 'email', label: 'Email', placeholder: 'opcional' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</label>
                <input className="ds-field" value={form[key as keyof typeof form]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
              </div>
            ))}
            <button className="ds-hover" onClick={handleCrear} disabled={!form.nombre || !form.dni}
              style={{ marginTop: 4, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: !form.nombre || !form.dni ? 'not-allowed' : 'pointer', opacity: !form.nombre || !form.dni ? 0.5 : 1, fontFamily: 'inherit' }}>
              Guardar y asociar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
