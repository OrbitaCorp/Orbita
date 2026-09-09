import { useReducer, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AlertCircle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { reducerDescuento, initialDescuentoState, validarDescuentoForm } from './reducerDescuento'
import { instanteALocal, localAInstante, scrollToFirstErrorSection } from './utils'
import type { DescuentoFormState } from './reducerDescuento'
import { SectionCard, FormField } from './components/FormField'
import { TipoDescuentoSelector } from './components/TipoDescuentoSelector'
import { useEstadoRelampago } from './hooks/useEstadoRelampago'
import { ConfigPorcentajeProducto } from './components/ConfigPorcentajeProducto'
import { ConfigMontoFijoProducto } from './components/ConfigMontoFijoProducto'
import { ConfigPorcentajeTicket } from './components/ConfigPorcentajeTicket'
import { ConfigMontoFijoTicket } from './components/ConfigMontoFijoTicket'
import { ConfigLlevaXPagaY } from './components/ConfigLlevaXPagaY'
import { ConfigCompraXObtieneZ } from './components/ConfigCompraXObtieneZ'
import { ConfigVolumen } from './components/ConfigVolumen'
import { VigenciaForm } from './components/VigenciaForm'
import { LinkDescuentoSection } from './components/LinkDescuentoSection'
import { ConfigOfertaRelampago } from './components/ConfigOfertaRelampago'
import { PreviewRelampago } from './components/PreviewRelampago'
import { PreviewPOS } from './components/PreviewPOS'
import { ResumenSidebar } from './components/ResumenSidebar'
import { AccionesGuardado } from './components/AccionesGuardado'
import { SkeletonColumna } from './components/DescuentosSkeleton'
import { useDescuento } from './hooks/useDescuento'
import { useCrearDescuento } from './hooks/useCrearDescuento'
import { useEditarDescuento } from './hooks/useEditarDescuento'
import { useToggleDescuentoLink } from './hooks/useToggleDescuentoLink'
import type { AlcanceDescuento, BonusTipoBeneficio, TipoDescuento } from './types'
import { TIPO_DESCUENTO_LABELS } from './types'
import { Volver } from '../_shared/Volver'

interface Props {
  id?: string
  onVolver: () => void
}

function set(dispatch: React.Dispatch<Parameters<typeof reducerDescuento>[1]>, key: keyof DescuentoFormState) {
  return (value: unknown) => dispatch({ type: 'SET', key, value })
}

// Orden visual de arriba hacia abajo — al fallar la validación, se hace
// scroll a la primera sección de esta lista que tenga un error.
const MAPA_SECCIONES_ERROR = [
  { keys: ['nombre', 'tipo'], sectionId: 'descuento-seccion-info' },
  { keys: ['valor', 'llevaCantidad', 'pagaCantidad', 'cantidades', 'escalas', 'seleccion', 'cantidadMinCompra', 'triggerSeleccion', 'bonusSeleccion', 'bonusValor'], sectionId: 'descuento-seccion-config' },
  { keys: ['fechaInicio', 'fechaFin', 'horaFinRelampago'], sectionId: 'descuento-seccion-vigencia' },
]

export function DescuentosCrear({ id, onVolver }: Props) {
  const [state, dispatch] = useReducer(reducerDescuento, initialDescuentoState)
  const { data: existing, isLoading } = useDescuento(id)
  const crearMutation = useCrearDescuento()
  const editarMutation = useEditarDescuento()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  // Tipo preseleccionado por URL (?tipo=oferta_relampago): la tarjeta de
  // Avanzado manda acá con el tipo ya elegido. Solo al crear, y la oferta
  // relámpago solo si de verdad está disponible (paquete pagado e
  // interruptor prendido) — si no, el selector la muestra bloqueada y el
  // dueño elige otro tipo.
  const router = useRouter()
  const tipoInicial = router.query.tipo as string | undefined
  const relampagoDisponible = useEstadoRelampago(id).estado === 'disponible'
  useEffect(() => {
    if (id || !tipoInicial || !(tipoInicial in TIPO_DESCUENTO_LABELS)) return
    if (tipoInicial === 'oferta_relampago' && !relampagoDisponible) return
    dispatch({ type: 'SET_TIPO', tipo: tipoInicial as TipoDescuento })
  }, [id, tipoInicial, relampagoDisponible])

  useEffect(() => {
    if (!existing) return
    // La oferta relámpago guarda el fin como instante exacto: se abre en
    // fecha y hora LOCALES. Los demás tipos siguen siendo solo fecha.
    const esRelampago = existing.tipo === 'oferta_relampago'
    const finLocal = esRelampago && existing.fechaFin ? instanteALocal(existing.fechaFin) : null
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
        fechaInicio: esRelampago ? instanteALocal(existing.fechaInicio).fecha : existing.fechaInicio.split('T')[0],
        fechaFin: finLocal ? finLocal.fecha : (existing.fechaFin?.split('T')[0] ?? ''),
        horaFinRelampago: finLocal ? finLocal.hora : '23:59',
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

  const esRelampago = state.tipo === 'oferta_relampago'

  const handleSubmit = async () => {
    setErrorEnvio(null)
    const errores = validarDescuentoForm(state, !!id)
    if (Object.keys(errores).length) {
      dispatch({ type: 'SET', key: 'errores', value: errores })
      scrollToFirstErrorSection(errores, MAPA_SECCIONES_ERROR)
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
      // La oferta relámpago manda el inicio como instante exacto (las 00:00
      // locales de ese día), igual que el fin: si no, "YYYY-MM-DD" se guarda
      // como medianoche UTC —las 21:00 del día anterior en Argentina— y una
      // oferta "que empieza mañana" aparecía en la tienda hoy a la noche.
      fechaInicio: esRelampago ? (localAInstante(state.fechaInicio, '00:00') ?? state.fechaInicio) : state.fechaInicio,
      // La oferta relámpago manda el instante exacto (fecha + hora locales →
      // ISO); los demás tipos, solo la fecha. La validación ya garantizó que
      // localAInstante no da null acá.
      fechaFin: esRelampago
        ? localAInstante(state.fechaFin, state.horaFinRelampago)
        : (state.sinVencimiento ? null : state.fechaFin),
      // Una oferta relámpago corre todos los días a toda hora hasta que
      // termina: los recortes por día/horario no aplican.
      diasVigencia: !esRelampago && state.diasVigencia.length ? state.diasVigencia : null,
      horaInicio: esRelampago || state.todoElDia ? null : state.horaInicio,
      horaFin: esRelampago || state.todoElDia ? null : state.horaFin,
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

  // El preview lateral: la cartelera de la portada para la oferta relámpago,
  // el ticket para todo lo demás.
  const preview = esRelampago ? (
    <PreviewRelampago nombre={state.nombre} valor={state.valor} fechaFin={state.fechaFin} horaFin={state.horaFinRelampago} cantidadProductos={state.alcance === 'producto' ? state.productosIds.length : state.categoriasIds.length * 3} />
  ) : (
    <PreviewPOS nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} valor={state.valor} llevaCantidad={state.llevaCantidad} pagaCantidad={state.pagaCantidad} montoMinimo={state.montoMinimo} />
  )
  const resumen = (
    <ResumenSidebar nombre={state.nombre} tipo={state.tipo} aplicacion={state.aplicacion} fechaInicio={state.fechaInicio} fechaFin={state.fechaFin} sinVencimiento={state.sinVencimiento} diasVigencia={state.diasVigencia} ilimitadoUsos={state.ilimitadoUsos} limiteUsosTotal={state.limiteUsosTotal} horaFinExacta={esRelampago ? state.horaFinRelampago : undefined} />
  )

  const header = (
    <div className="dcto-page-head" style={{ marginBottom: 20 }}>
      <Volver a="Descuentos" onClick={onVolver} />
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
        {id ? 'Editar descuento' : 'Nuevo descuento'}
      </h1>
    </div>
  )

  if (isLoading && id) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        <style>{`@media (max-width: 768px) { .dcto-2col { grid-template-columns: minmax(0,1fr) !important; } .dcto-form-side { display: none !important; } }`}</style>
        {header}
        <div className="dcto-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <SkeletonColumna alturas={[148, 220, 260, 130]} />
          <div className="dcto-form-side">
            <SkeletonColumna alturas={[190, 170]} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`@media (max-width: 768px) { .dcto-2col { grid-template-columns: minmax(0,1fr) !important; } .dcto-form-side { display: none !important; } .dcto-g2 { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      {header}
      <div className="dcto-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Columna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard id="descuento-seccion-info" title="Información básica">
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
                  editandoId={id}
                />
              </div>
            </div>
          </SectionCard>

          {t && (
            <SectionCard id="descuento-seccion-config" title="Configuración del descuento">
              {t === 'porcentaje_producto' && (
                <ConfigPorcentajeProducto valor={state.valor} alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} onChangeValor={d('valor')} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} errores={state.errores} />
              )}
              {t === 'oferta_relampago' && (
                <ConfigOfertaRelampago editandoId={id} valor={state.valor} alcance={state.alcance} productosIds={state.productosIds} categoriasIds={state.categoriasIds} onChangeValor={d('valor')} onChangeAlcance={d('alcance') as (a: AlcanceDescuento) => void} onChangeProductos={d('productosIds')} onChangeCategorias={d('categoriasIds')} errores={state.errores} />
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

          <SectionCard id="descuento-seccion-vigencia" title={esRelampago ? 'Cuándo empieza y cuándo termina' : 'Vigencia y condiciones'}>
            <VigenciaForm fechaInicio={state.fechaInicio} fechaFin={state.fechaFin} sinVencimiento={state.sinVencimiento} diasVigencia={state.diasVigencia} todosDias={state.todosDias} todoElDia={state.todoElDia} horaInicio={state.horaInicio} horaFin={state.horaFin} limiteUsosTotal={state.limiteUsosTotal} ilimitadoUsos={state.ilimitadoUsos} onChange={(field, value) => dispatch({ type: 'SET', key: field as keyof DescuentoFormState, value })} errores={state.errores} relampago={esRelampago} horaFinRelampago={state.horaFinRelampago} />
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
            validar={() => { const e = validarDescuentoForm(state, !!id); dispatch({ type: 'SET', key: 'errores', value: e }); if (Object.keys(e).length) scrollToFirstErrorSection(e, MAPA_SECCIONES_ERROR); return !Object.keys(e).length }}
            onSubmit={handleSubmit}
            onCancelar={onVolver}
            preview={<>{preview}{resumen}</>}
          />
        </div>

        {/* Sidebar sticky */}
        <div className="dcto-form-side" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {preview}
          {resumen}
        </div>
      </div>
    </div>
  )
}
