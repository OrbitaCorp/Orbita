import { useState, useEffect } from 'react'
import { ArrowLeft, Shuffle, AlertCircle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { SectionCard, FormField, LabelRow } from './components/FormField'
import { LinkCompartibleSection } from './components/LinkCompartibleSection'
import { TipoCuponSelector } from './components/TipoCuponSelector'
import { AlcanceSelector } from './components/AlcanceSelector'
import { CategoriaLista } from './components/CategoriaLista'
import { ProductoArbol } from './components/ProductoArbol'
import { Toggle } from '../../_shared/components/Toggle'
import { CuponResumen } from './components/CuponResumen'
import { AccionesGuardado } from './components/AccionesGuardado'
import { useCupon } from './hooks/useCupon'
import { useCrearCupon } from './hooks/useCrearCupon'
import { useEditarCupon } from './hooks/useEditarCupon'
import { generarCodigoCupon } from './utils'
import type { TipoCupon, AlcanceDescuento } from './types'

interface Props {
  id?: string
  onVolver: () => void
}

export function CuponesCrear({ id, onVolver }: Props) {
  const [codigo, setCodigo] = useState(generarCodigoCupon())
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCupon | null>(null)
  const [valor, setValor] = useState('')
  const [alcance, setAlcance] = useState<AlcanceDescuento>('ticket')
  const [productosIds, setProductosIds] = useState<string[]>([])
  const [categoriasIds, setCategoriasIds] = useState<string[]>([])
  const [montoMinimo, setMontoMinimo] = useState('')
  const [sinMontoMinimo, setSinMontoMinimo] = useState(true)
  const [usosMaxTotal, setUsosMaxTotal] = useState('')
  const [usosMaxPorCliente, setUsosMaxPorCliente] = useState('')
  const [ilimitadoTotal, setIlimitadoTotal] = useState(true)
  const [ilimitadoPorCliente, setIlimitadoPorCliente] = useState(true)
  const [privado, setPrivado] = useState(false)
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().split('T')[0])
  const [fechaExpiracion, setFechaExpiracion] = useState('')
  const [sinVencimiento, setSinVencimiento] = useState(false)
  const [linkActivo, setLinkActivo] = useState(false)
  const [linkRedirect, setLinkRedirect] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const { data: existing, isLoading } = useCupon(id)
  const crearMutation = useCrearCupon()
  const editarMutation = useEditarCupon()

  useEffect(() => {
    if (!existing) return
    setCodigo(existing.codigo)
    setNombre(existing.nombre)
    setTipo(existing.tipoDescuento)
    setValor(String(existing.valor))
    setAlcance(existing.alcance)
    setProductosIds(existing.productosIds ?? [])
    setCategoriasIds(existing.categoriasIds ?? [])
    setSinMontoMinimo(!existing.montoMinimo)
    setMontoMinimo(String(existing.montoMinimo ?? ''))
    setIlimitadoTotal(!existing.usosMaxTotal)
    setUsosMaxTotal(String(existing.usosMaxTotal ?? ''))
    setIlimitadoPorCliente(!existing.usosMaxPorCliente)
    setUsosMaxPorCliente(String(existing.usosMaxPorCliente ?? ''))
    setPrivado(existing.privado)
    setFechaInicio(existing.fechaInicio.split('T')[0])
    setSinVencimiento(!existing.fechaExpiracion)
    setFechaExpiracion(existing.fechaExpiracion?.split('T')[0] ?? '')
    setLinkActivo(existing.link_activo)
    setLinkRedirect(existing.link_redirect)
  }, [existing])

  const validar = () => {
    const e: Record<string, string> = {}
    if (!codigo.trim()) e.codigo = 'El código es obligatorio'
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!tipo) e.tipo = 'Seleccioná un tipo de cupón'
    if (!valor) e.valor = 'Ingresá un valor de descuento'
    if (!fechaInicio) e.fechaInicio = 'Seleccioná fecha de inicio'
    if (!sinVencimiento && !fechaExpiracion) e.fechaExpiracion = 'Seleccioná fecha de expiración o activá "Sin vencimiento"'
    return e
  }

  const handleSubmit = async () => {
    setErrorEnvio(null)
    const e = validar()
    if (Object.keys(e).length) { setErrores(e); return }
    const payload = {
      codigo,
      nombre,
      tipoDescuento: tipo!,
      valor: parseFloat(valor),
      alcance,
      productosIds: alcance === 'producto' ? productosIds : undefined,
      categoriasIds: alcance === 'categoria' ? categoriasIds : undefined,
      montoMinimo: sinMontoMinimo ? null : parseFloat(montoMinimo) || null,
      usosMaxTotal: ilimitadoTotal ? null : parseInt(usosMaxTotal) || null,
      usosMaxPorCliente: ilimitadoPorCliente ? null : parseInt(usosMaxPorCliente) || null,
      fechaInicio,
      fechaExpiracion: sinVencimiento ? null : fechaExpiracion,
      activo: true,
      privado,
      link_activo: linkActivo,
      link_redirect: linkRedirect,
    }
    try {
      if (id) {
        await editarMutation.mutateAsync({ id, data: payload })
      } else {
        await crearMutation.mutateAsync(payload as Parameters<typeof crearMutation.mutateAsync>[0])
      }
      onVolver()
    } catch (err) {
      // Hoy las mutaciones son mock y no fallan, pero cuando se conecten a
      // RBT-615/616 (código duplicado, etc.) sin esto el rechazo quedaría como
      // promesa no capturada en consola y el form colgado, sin nada visible.
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar el cupón. Intentá de nuevo.')
    }
  }

  const isSaving = crearMutation.isPending || editarMutation.isPending

  const header = (
    <div className="dcto-page-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <button
        type="button"
        onClick={onVolver}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', cursor: 'pointer', flexShrink: 0 }}
      >
        <ArrowLeft size={16} />
      </button>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
        {id ? 'Editar cupón' : 'Nuevo cupón'}
      </h1>
    </div>
  )

  if (isLoading && id) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        <style>{`@media (max-width: 768px) { .dcto-2col { grid-template-columns: 1fr !important; } .dcto-form-side { display: none !important; } }`}</style>
        {header}
        <div className="dcto-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[190, 240, 130, 130].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
            ))}
          </div>
          <div className="dcto-form-side" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[190, 170].map((h, i) => <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--color-surface-alt)' }} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`@media (max-width: 768px) { .dcto-2col { grid-template-columns: 1fr !important; } .dcto-form-side { display: none !important; } .dcto-g2 { grid-template-columns: 1fr !important; } }`}</style>
      {header}
      <div className="dcto-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Información básica" subtitle="Definí el código y nombre del cupón.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>
                  Código del cupón
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <FormField
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      placeholder="PROMO-ABCD"
                      mono
                      error={errores.codigo}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCodigo(generarCodigoCupon())}
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 38,
                      padding: '0 16px',
                      borderRadius: 8,
                      border: '1.5px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Shuffle size={14} />
                    Generar
                  </button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  Este es el código que el cliente ingresará en el POS o la tienda online.
                </p>
              </div>
              <div>
                <FormField
                  label="Nombre descriptivo"
                  placeholder="Ej: Cupón bienvenida 10%"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  error={errores.nombre}
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  Solo visible para administradores. No se muestra al cliente.
                </p>
              </div>
              <LabelRow label="Cupón privado" right={<Toggle checked={privado} onChange={setPrivado} />} />
              {privado && <p style={{ margin: '-8px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>Solo canjeable si el cliente conoce el código. No aparece en la tienda.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Configuración" subtitle="Definí qué descuento otorga este cupón.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Tipo de descuento</p>
                <TipoCuponSelector tipo={tipo} onChange={setTipo} error={errores.tipo} />
              </div>
              {tipo && (
                <>
                  <FormField
                    label={tipo === 'porcentaje' ? 'Porcentaje de descuento' : 'Monto de descuento'}
                    prefix={tipo === 'monto_fijo' ? '$' : undefined}
                    suffix={tipo === 'porcentaje' ? '%' : undefined}
                    type="number" min="0"
                    placeholder={tipo === 'porcentaje' ? '10' : '5000'}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    mono
                    error={errores.valor}
                  />
                  <div>
                    <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Alcance</p>
                    <AlcanceSelector alcance={alcance} onChange={(a) => { setAlcance(a); setProductosIds([]); setCategoriasIds([]) }} />
                  </div>
                  {alcance === 'categoria' && <CategoriaLista categoriasIds={categoriasIds} onChange={setCategoriasIds} />}
                  {alcance === 'producto' && <ProductoArbol productosIds={productosIds} onChange={setProductosIds} />}
                  <div>
                    <LabelRow
                      label="Compra mínima"
                      right={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Sin mínimo</span>
                          <Toggle checked={sinMontoMinimo} onChange={setSinMontoMinimo} />
                        </div>
                      }
                    />
                    <FormField prefix="$" type="number" min="0" placeholder="20000" value={montoMinimo} onChange={(e) => setMontoMinimo(e.target.value)} disabled={sinMontoMinimo} mono />
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Límites de uso">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <LabelRow label="Usos totales" right={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Ilimitado</span><Toggle checked={ilimitadoTotal} onChange={setIlimitadoTotal} /></div>} />
                <FormField type="number" min="1" placeholder="500" value={usosMaxTotal} onChange={(e) => setUsosMaxTotal(e.target.value)} disabled={ilimitadoTotal} mono />
              </div>
              <div>
                <LabelRow label="Usos por cliente" right={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Ilimitado</span><Toggle checked={ilimitadoPorCliente} onChange={setIlimitadoPorCliente} /></div>} />
                <FormField type="number" min="1" placeholder="1" value={usosMaxPorCliente} onChange={(e) => setUsosMaxPorCliente(e.target.value)} disabled={ilimitadoPorCliente} mono />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Vigencia">
            <div className="dcto-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Fecha de inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} error={errores.fechaInicio} />
              <div>
                <LabelRow label="Fecha de expiración" right={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Sin vencimiento</span><Toggle checked={sinVencimiento} onChange={setSinVencimiento} /></div>} />
                <FormField type="date" value={fechaExpiracion} onChange={(e) => setFechaExpiracion(e.target.value)} disabled={sinVencimiento} error={errores.fechaExpiracion} />
              </div>
            </div>
          </SectionCard>

          {id && <LinkCompartibleSection codigo={codigo} linkActivo={linkActivo} onToggleActivo={setLinkActivo} linkRedirect={linkRedirect} onRedirectChange={setLinkRedirect} />}

          {errorEnvio && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
              borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)',
            }}>
              <AlertCircle size={16} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-error)' }}>{errorEnvio}</p>
            </div>
          )}

          <AccionesGuardado
            labelConfirmar={id ? 'Guardar cambios' : 'Crear cupón'}
            cargando={isSaving}
            validar={() => { const e = validar(); setErrores(e); return !Object.keys(e).length }}
            onSubmit={handleSubmit}
            onCancelar={onVolver}
            preview={<CuponResumen codigo={codigo} nombre={nombre} tipo={tipo} valor={valor} alcance={alcance} montoMinimo={montoMinimo} fechaInicio={fechaInicio} fechaExpiracion={fechaExpiracion} sinVencimiento={sinVencimiento} ilimitadoTotal={ilimitadoTotal} usosMaxTotal={usosMaxTotal} mostrarLink={!!id} linkActivo={linkActivo} />}
          />
        </div>

        <div className="dcto-form-side" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CuponResumen codigo={codigo} nombre={nombre} tipo={tipo} valor={valor} alcance={alcance} montoMinimo={montoMinimo} fechaInicio={fechaInicio} fechaExpiracion={fechaExpiracion} sinVencimiento={sinVencimiento} ilimitadoTotal={ilimitadoTotal} usosMaxTotal={usosMaxTotal} />
        </div>
      </div>
    </div>
  )
}
