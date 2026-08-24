import { useReducer, useEffect, useState } from 'react'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { reducerDescuento, initialDescuentoState, validarDescuentoForm } from './reducerDescuento'
import type { DescuentoFormState } from './reducerDescuento'
import { SectionCard, FormField } from './components/FormField'
import { TipoDescuentoSelector } from './components/TipoDescuentoSelector'
import { ConfigPorcentajeProducto } from './components/ConfigPorcentajeProducto'
import { ConfigMontoFijoProducto } from './components/ConfigMontoFijoProducto'
import { ConfigPorcentajeTicket } from './components/ConfigPorcentajeTicket'
import { ConfigMontoFijoTicket } from './components/ConfigMontoFijoTicket'
import { ConfigLlevaXPagaY } from './components/ConfigLlevaXPagaY'
import { ConfigCompraXObtieneZ } from './components/ConfigCompraXObtieneZ'
import { ConfigVolumen } from './components/ConfigVolumen'
import { VigenciaForm } from './components/VigenciaForm'
import { LinkDescuentoSection } from './components/LinkDescuentoSection'
import { PreviewPOS } from './components/PreviewPOS'
import { ResumenSidebar } from './components/ResumenSidebar'
import { AccionesGuardado } from './components/AccionesGuardado'
import { useDescuento } from './hooks/useDescuento'
import { useCrearDescuento } from './hooks/useCrearDescuento'
import { useEditarDescuento } from './hooks/useEditarDescuento'
import { useToggleDescuentoLink } from './hooks/useToggleDescuentoLink'
import type { AlcanceDescuento, BonusTipoBeneficio } from './types'

interface Props {
  id?: string
  onVolver: () => void
}

function set(dispatch: React.Dispatch<Parameters<typeof reducerDescuento>[1]>, key: keyof DescuentoFormState) {
  return (value: unknown) => dispatch({ type: 'SET', key, value })
}

export function DescuentosCrear({ id, onVolver }: Props) {
  const [state, dispatch] = useReducer(reducerDescuento, initialDescuentoState)
  const { data: existing, isLoading } = useDescuento(id)
  const crearMutation = useCrearDescuento()
  const editarMutation = useEditarDescuento()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    dispatch({
      type: 'PRECARGAR',
      state: {
        nombre: existing.nombre,
        tipo: existing.tipo,
        valor: String(existing.valor),
        alcance: existing.alcance,
        productosIds: existing.productosIds ?? [],
        categoriasIds: existing.categoriasIds ?? [],
        montoMinimo: String(existing.condicion?.montoMinimo ?? ''),
        sinMontoMinimo: !existing.condicion?.montoMinimo,
        llevaCantidad: String(existing.condicion?.llevaCantidad ?? ''),
        pagaCantidad: String(existing.condicion?.pagaCantidad ?? ''),
        bonusTipoBeneficio: existing.bonusTipoBeneficio ?? 'gratis',
        bonusValor: String(existing.bonusValor ?? ''),
        bonusProductosIds: existing.bonusProductosIds ?? [],
        bonusCategoriasIds: existing.bonusCategoriasIds ?? [],
        sinVencimiento: !existing.fechaFin,
        fechaInicio: existing.fechaInicio.split('T')[0],
        fechaFin: existing.fechaFin?.split('T')[0] ?? '',
        diasVigencia: existing.diasVigencia ?? [],
        ilimitadoUsos: !existing.limiteUsosTotal,
        limiteUsosTotal: String(existing.limiteUsosTotal ?? ''),
        aplicacion: existing.aplicacion,
      },
    })
  }, [existing])

  // El link siempre está activo para un descuento con alcance producto/
  // categoría, sin toggle que el dueño tenga que tocar — ver
  // LinkDescuentoSection.tsx. Un descuento creado antes de este cambio puede
  // todavía tener linkActive=false en el backend: esto lo activa solo,
  // una vez, apenas se detecta (no espera a que el dueño guarde el form).
  const toggleLink = useToggleDescuentoLink()
  useEffect(() => {
    if (!existing || existing.alcance === 'ticket' || existing.linkActive) return
    toggleLink.mutate({ descuento: existing, linkActive: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing])

  const handleSubmit = async () => {
    setErrorEnvio(null)
    const errores = validarDescuentoForm(state, !!id)
    if (Object.keys(errores).length) {
      dispatch({ type: 'SET', key: 'errores', value: errores })
      return
    }
    const payload = {
      nombre: state.nombre,
      tipo: state.tipo!,
      valor: parseFloat(state.valor) || 0,
      alcance: state.alcance,
      productosIds: state.productosIds,
      categoriasIds: state.categoriasIds,
      condicion: state.tipo === 'lleva_x_paga_y'
        ? { llevaCantidad: parseInt(state.llevaCantidad), pagaCantidad: parseInt(state.pagaCantidad) }
        : state.sinMontoMinimo ? undefined : { montoMinimo: parseFloat(state.montoMinimo) },
      bonusTipoBeneficio: state.tipo === 'compra_x_obtiene_z' ? state.bonusTipoBeneficio : undefined,
      bonusValor: state.tipo === 'compra_x_obtiene_z' && state.bonusTipoBeneficio !== 'gratis' ? parseFloat(state.bonusValor) : undefined,
      bonusProductosIds: state.tipo === 'compra_x_obtiene_z' ? state.bonusProductosIds : undefined,
      bonusCategoriasIds: state.tipo === 'compra_x_obtiene_z' ? state.bonusCategoriasIds : undefined,
      bonusAlcance: state.tipo === 'compra_x_obtiene_z' ? (state.bonusAlcance as Exclude<AlcanceDescuento, 'ticket'>) : undefined,
      // Sin POS no hay quien lo aplique "a mano" en el momento — todo descuento
      // es automático (el selector de Modo de aplicación se sacó de la UI).
      aplicacion: 'automatico' as const,
      fechaInicio: state.fechaInicio,
      fechaFin: state.sinVencimiento ? null : state.fechaFin,
      diasVigencia: state.diasVigencia.length ? state.diasVigencia : null,
      horaInicio: state.todoElDia ? null : state.horaInicio,
      horaFin: state.todoElDia ? null : state.horaFin,
      limiteUsosTotal: state.ilimitadoUsos ? null : parseInt(state.limiteUsosTotal),
      activo: true,
      // Siempre activo para alcance producto/categoría, sin toggle que el
      // dueño tenga que prender — no tiene sentido en alcance ticket (no hay
      // productos puntuales que mostrar), así que se apaga solo en ese caso.
      linkActive: state.alcance !== 'ticket',
    }
    try {
      if (id) {
        await editarMutation.mutateAsync({ id, data: payload })
      } else {
        await crearMutation.mutateAsync(payload as Parameters<typeof crearMutation.mutateAsync>[0])
      }
      onVolver()
    } catch (err) {
      // Sin esto, un rechazo del backend (400 de validación, nombre
      // duplicado, etc.) quedaba como promesa no capturada en la consola y
      // el formulario se veía "colgado" sin ningún mensaje para el usuario.
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo guardar el descuento. Intentá de nuevo.')
    }
  }

  const isSaving = crearMutation.isPending || editarMutation.isPending
  const d = (key: keyof DescuentoFormState) => set(dispatch, key)
  const t = state.tipo

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
        {id ? 'Editar descuento' : 'Nuevo descuento'}
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
            {[148, 220, 260, 130].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
            ))}
          </div>
          <div className="dcto-form-side" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 190, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
            <div style={{ height: 170, borderRadius: 12, background: 'var(--color-surface-alt)' }} />
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
        {/* Columna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Información básica">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormField
                label="Nombre del descuento"
                placeholder="Ej: Promo Invierno 20%"
                value={state.nombre}
                onChange={(e) => d('nombre')(e.target.value)}
                error={state.errores.nombre}
              />
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}>Tipo de descuento</p>
                <TipoDescuentoSelector
                  tipo={state.tipo}
                  onChange={(tipo) => dispatch({ type: 'SET_TIPO', tipo })}
                  error={state.errores.tipo}
                />
              </div>
            </div>
          </SectionCard>

          {t && (
            <SectionCard title="Configuración del descuento">
              {t === 'porcentaje_producto' && (
                <ConfigPorcentajeProducto valor={state.valor} alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} onChangeValor={d('valor')} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} errores={state.errores} />
              )}
              {t === 'monto_fijo_producto' && (
                <ConfigMontoFijoProducto valor={state.valor} alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} onChangeValor={d('valor')} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} errores={state.errores} />
              )}
              {t === 'porcentaje_ticket' && (
                <ConfigPorcentajeTicket valor={state.valor} montoMinimo={state.montoMinimo} sinMontoMinimo={state.sinMontoMinimo} onChangeValor={d('valor')} onChangeMontoMinimo={d('montoMinimo')} onToggleSinMinimo={d('sinMontoMinimo') as (v: boolean) => void} errores={state.errores} />
              )}
              {t === 'monto_fijo_ticket' && (
                <ConfigMontoFijoTicket valor={state.valor} montoMinimo={state.montoMinimo} sinMontoMinimo={state.sinMontoMinimo} onChangeValor={d('valor')} onChangeMontoMinimo={d('montoMinimo')} onToggleSinMinimo={d('sinMontoMinimo') as (v: boolean) => void} errores={state.errores} />
              )}
              {t === 'lleva_x_paga_y' && (
                <ConfigLlevaXPagaY llevaCantidad={state.llevaCantidad} pagaCantidad={state.pagaCantidad} alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} onChangeLleva={d('llevaCantidad')} onChangePaga={d('pagaCantidad')} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} errores={state.errores} />
              )}
              {t === 'compra_x_obtiene_z' && (
                <ConfigCompraXObtieneZ cantidadMinCompra={state.cantidadMinCompra} triggerAlcance={state.triggerAlcance} triggerProductosIds={state.triggerProductosIds} triggerCategoriasIds={state.triggerCategoriasIds} bonusAlcance={state.bonusAlcance} bonusProductosIds={state.bonusProductosIds} bonusCategoriasIds={state.bonusCategoriasIds} bonusTipoBeneficio={state.bonusTipoBeneficio} bonusValor={state.bonusValor} onChangeCantidadMin={d('cantidadMinCompra')} onChangeTriggerAlcance={d('triggerAlcance') as (a: AlcanceDescuento) => void} onChangeTriggerProductos={d('triggerProductosIds')} onChangeTriggerCategorias={d('triggerCategoriasIds')} onChangeBonusAlcance={d('bonusAlcance') as (a: AlcanceDescuento) => void} onChangeBonusProductos={d('bonusProductosIds')} onChangeBonusCategorias={d('bonusCategoriasIds')} onChangeBonusTipo={d('bonusTipoBeneficio') as (t: BonusTipoBeneficio) => void} onChangeBonusValor={d('bonusValor')} errores={state.errores} />
              )}
              {t === 'volumen' && (
                <ConfigVolumen alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} escalas={state.escalasVolumen} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} onUpdateEscala={(idx, field, value) => dispatch({ type: 'UPDATE_ESCALA', idx, field, value })} onAddEscala={() => dispatch({ type: 'ADD_ESCALA' })} onRemoveEscala={(idx) => dispatch({ type: 'REMOVE_ESCALA', idx })} errores={state.errores} />
              )}
            </SectionCard>
          )}

          <SectionCard title="Vigencia y condiciones">
            <VigenciaForm fechaInicio={state.fechaInicio} fechaFin={state.fechaFin} sinVencimiento={state.sinVencimiento} diasVigencia={state.diasVigencia} todosDias={state.todosDias} todoElDia={state.todoElDia} horaInicio={state.horaInicio} horaFin={state.horaFin} limiteUsosTotal={state.limiteUsosTotal} ilimitadoUsos={state.ilimitadoUsos} onChange={(field, value) => dispatch({ type: 'SET', key: field as keyof DescuentoFormState, value })} errores={state.errores} />
          </SectionCard>

          {id && state.alcance !== 'ticket' && (
            <LinkDescuentoSection id={id} guardado={existing?.linkActive ?? false} />
          )}

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
            labelConfirmar={id ? 'Guardar cambios' : 'Crear descuento'}
            cargando={isSaving}
            validar={() => { const e = validarDescuentoForm(state, !!id); dispatch({ type: 'SET', key: 'errores', value: e }); return !Object.keys(e).length }}
            onSubmit={handleSubmit}
            onCancelar={onVolver}
            preview={
              <>
                <PreviewPOS nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} valor={state.valor} llevaCantidad={state.llevaCantidad} pagaCantidad={state.pagaCantidad} montoMinimo={state.montoMinimo} />
                <ResumenSidebar nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} fechaInicio={state.fechaInicio} fechaFin={state.fechaFin} sinVencimiento={state.sinVencimiento} diasVigencia={state.diasVigencia} ilimitadoUsos={state.ilimitadoUsos} limiteUsosTotal={state.limiteUsosTotal} />
              </>
            }
          />
        </div>

        {/* Sidebar sticky */}
        <div className="dcto-form-side" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PreviewPOS nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} valor={state.valor} llevaCantidad={state.llevaCantidad} pagaCantidad={state.pagaCantidad} montoMinimo={state.montoMinimo} />
          <ResumenSidebar nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} fechaInicio={state.fechaInicio} fechaFin={state.fechaFin} sinVencimiento={state.sinVencimiento} diasVigencia={state.diasVigencia} ilimitadoUsos={state.ilimitadoUsos} limiteUsosTotal={state.limiteUsosTotal} />
        </div>
      </div>
    </div>
  )
}
