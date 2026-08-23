import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { ApiError, meListAddresses, meCreateAddress, meUpdateAddress, meDeleteAddress } from '@/lib/api'
import type { MeAddress, MeAddressInput } from '@/lib/api'
import { buscarDireccion, type GeorefDireccion } from '@/lib/georef'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'

const DIR_VACIA: MeAddressInput = { alias: '', street: '', floor: '', depto: '', referencia: '', provincia: '', city: '', zip: '', isDefault: false }

// Mismo layout de la tarjeta real (recuadro del ícono + alias/pill + las dos
// líneas de dirección), para que no cambie de forma al terminar de cargar.
function DireccionCardSkeleton({ tarjetas = 2 }: { tarjetas?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: tarjetas }).map((_, i) => {
        const d = i * 100
        return (
          <div key={i} style={{
            background: 'var(--color-bg)', border: '2px solid var(--color-border)',
            borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <Skeleton width={36} height={36} radius={10} delay={d} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonText width={110} height={13} delay={d + 30} style={{ marginBottom: 10 }} />
              <SkeletonText width="60%" height={12} delay={d + 60} style={{ marginBottom: 7 }} />
              <SkeletonText width="42%" height={12} delay={d + 90} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DireccionesTab() {
  const [direcciones, setDirecciones] = useState<MeAddress[]>([])
  const [cargando, setCargando] = useState(true)
  const recargar = useCallback(() => { meListAddresses().then(setDirecciones).catch(() => {}).finally(() => setCargando(false)) }, [])
  useEffect(() => { recargar() }, [recargar])

  const [dirForm, setDirForm] = useState<MeAddressInput>(DIR_VACIA)
  const [editId, setEditId] = useState<string | null>(null)
  const [showDirForm, setShowDirForm] = useState(false)
  const [guardadoDir, setGuardadoDir] = useState(false)
  const [errorDir, setErrorDir] = useState('')
  // Fix del bug de "dos ítems": mientras esto es true, el botón de submit está
  // deshabilitado — un doble click ya no dispara dos POST.
  const [guardando, setGuardando] = useState(false)

  function abrirNuevaDir() { setDirForm(DIR_VACIA); setEditId(null); setErrorDir(''); setShowDirForm(true) }
  function abrirEditarDir(d: MeAddress) {
    setDirForm({
      alias: d.alias ?? '', street: d.street, floor: d.floor ?? '', depto: d.depto ?? '',
      referencia: d.referencia ?? '', provincia: d.provincia ?? '', city: d.city, zip: d.zip ?? '', isDefault: d.isDefault,
    })
    setEditId(d.id); setErrorDir(''); setShowDirForm(true)
  }
  const setDF = (k: keyof MeAddressInput) => (v: string | boolean) => setDirForm((f) => ({ ...f, [k]: v }))

  async function handleGuardarDir(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // segunda barrera: ignora un submit mientras ya hay uno en vuelo
    setErrorDir('')
    if (!dirForm.street.trim() || !dirForm.city.trim()) { setErrorDir('La calle y la ciudad son obligatorias.'); return }
    setGuardando(true)
    try {
      const input: MeAddressInput = {
        alias: dirForm.alias || undefined, street: dirForm.street, floor: dirForm.floor || undefined,
        depto: dirForm.depto || undefined, referencia: dirForm.referencia || undefined,
        provincia: dirForm.provincia || undefined, city: dirForm.city, zip: dirForm.zip || undefined,
        isDefault: dirForm.isDefault,
      }
      if (editId) await meUpdateAddress(editId, input)
      else await meCreateAddress(input)
      setShowDirForm(false)
      recargar()
      setGuardadoDir(true)
      setTimeout(() => setGuardadoDir(false), 2500)
    } catch (err) {
      setErrorDir(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleBorrarDir(id: string) {
    try { await meDeleteAddress(id); recargar() } catch { /* noop */ }
  }

  // ── Autocompletado Georef (calle y número → provincia/ciudad) ────────────
  const [sugerencias, setSugerencias] = useState<GeorefDireccion[]>([])
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function handleStreetChange(v: string) {
    setDF('street')(v)
    setSugerencias([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    if (v.trim().length < 5) return
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setBuscandoDireccion(true)
      try {
        const resultados = await buscarDireccion(v, { signal: controller.signal })
        setSugerencias(resultados)
      } catch {
        // Georef es un asistente, no bloquea: un fallo de red simplemente no ofrece sugerencias.
      } finally {
        setBuscandoDireccion(false)
      }
    }, 500)
  }

  function elegirSugerencia(s: GeorefDireccion) {
    setDirForm((f) => ({
      ...f,
      street: s.altura ? `${s.calle} ${s.altura}` : s.calle,
      provincia: s.provincia,
      city: s.ciudad,
    }))
    setSugerencias([])
  }

  return (
    <div>
      {guardadoDir && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
          <CheckCircle2 size={15} /> Dirección guardada correctamente
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {cargando && <DireccionCardSkeleton />}
        {!cargando && direcciones.length === 0 && !showDirForm && (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
            Todavía no cargaste ninguna dirección.
          </div>
        )}
        {!cargando && direcciones.map(d => (
          <div key={d.id} style={{
            background: 'var(--color-bg)', border: `2px solid ${d.isDefault ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: d.isDefault ? 'var(--color-primary-bg)' : 'var(--color-surface)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MapPin size={16} strokeWidth={1.5} color={d.isDefault ? 'var(--color-primary)' : 'var(--color-muted)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{d.alias || 'Dirección'}</span>
                {d.isDefault && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>
                    Predeterminada
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
                {d.street}{d.floor ? ` · Piso ${d.floor}` : ''}{d.depto ? ` · Depto ${d.depto}` : ''}<br />
                {d.city}{d.provincia ? `, ${d.provincia}` : ''}{d.zip ? ` · CP ${d.zip}` : ''}
                {d.referencia && <><br /><span style={{ color: 'var(--color-muted)' }}>Ref: {d.referencia}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirEditarDir(d)} style={{ height: 32, padding: '0 12px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={12} strokeWidth={1.5} /> Editar
              </button>
              <button onClick={() => handleBorrarDir(d.id)} aria-label="Eliminar dirección" style={{ height: 32, width: 32, borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-error)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showDirForm ? (
        <button onClick={abrirNuevaDir} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 10, background: 'var(--color-bg)', border: '1px dashed var(--color-border)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 150ms' }}>
          <Plus size={15} strokeWidth={2} /> Agregar nueva dirección
        </button>
      ) : (
        <form onSubmit={handleGuardarDir} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>{editId ? 'Editar dirección' : 'Nueva dirección'}</div>
          {errorDir && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)', marginBottom: 14 }}>{errorDir}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FI label="Alias (ej: Casa, Trabajo)"><input value={dirForm.alias} onChange={e => setDF('alias')(e.target.value)} placeholder="Mi casa" style={inputStyle} /></FI>

            <div style={{ position: 'relative' }}>
              <FI label="Calle y número">
                <input
                  value={dirForm.street}
                  onChange={e => handleStreetChange(e.target.value)}
                  onBlur={() => setTimeout(() => setSugerencias([]), 150)} // delay para permitir el click en una sugerencia
                  placeholder="Av. Corrientes 1234"
                  style={inputStyle}
                  autoComplete="off"
                />
              </FI>
              {buscandoDireccion && (
                <div style={{ position: 'absolute', right: 12, top: 34, fontSize: 11, color: 'var(--color-muted)' }}>Buscando…</div>
              )}
              {sugerencias.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {sugerencias.map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onMouseDown={() => elegirSugerencia(s)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: 13, color: 'var(--color-text)', background: 'transparent', border: 'none', borderBottom: i < sugerencias.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}
                    >
                      {s.nomenclatura}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FI label="Piso (opcional)"><input value={dirForm.floor} onChange={e => setDF('floor')(e.target.value)} placeholder="3" style={inputStyle} /></FI>
              <FI label="Depto (opcional)"><input value={dirForm.depto} onChange={e => setDF('depto')(e.target.value)} placeholder="A" style={inputStyle} /></FI>
            </div>
            <FI label="Referencia (opcional)">
              <input value={dirForm.referencia} onChange={e => setDF('referencia')(e.target.value)} placeholder="Ej: portón azul, al lado de la farmacia" style={inputStyle} />
            </FI>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
              <FI label="Ciudad"><input value={dirForm.city} onChange={e => setDF('city')(e.target.value)} placeholder="CABA" style={inputStyle} /></FI>
              <FI label="Provincia (opcional)"><input value={dirForm.provincia} onChange={e => setDF('provincia')(e.target.value)} placeholder="Buenos Aires" style={inputStyle} /></FI>
              <FI label="CP (opcional)"><input value={dirForm.zip} onChange={e => setDF('zip')(e.target.value)} placeholder="C1043" style={inputStyle} /></FI>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!dirForm.isDefault} onChange={e => setDF('isDefault')(e.target.checked)} />
              Usar como dirección predeterminada
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={guardando} style={{ height: 40, padding: '0 20px', borderRadius: 8, background: guardando ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar dirección'}
            </button>
            <button type="button" disabled={guardando} onClick={() => setShowDirForm(false)} style={{ height: 40, padding: '0 16px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, border: '1px solid var(--color-border)', cursor: guardando ? 'default' : 'pointer' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

function FI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  )
}
