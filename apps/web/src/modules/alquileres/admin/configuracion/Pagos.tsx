// Pagos y señas: cuánto se paga al reservar y sobre qué se calcula, las
// formas de pago que se aceptan (efectivo, transferencia, Mercado Pago, con
// "Conectar" simulado), el depósito de garantía del salón y qué pasa con la
// seña cuando cancelan. El plazo de cancelación está en Reglas de reserva.
import { useState } from 'react'
import { ArrowRight, CircleCheck, PlugZap, Unplug, Wallet } from 'lucide-react'
import { pesos, senaDe } from '@/lib/reservas/precio'
import { BarraGuardar, Campo, Chip, FilaSwitch, Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { FORMAS_PAGO, TIPOS, palabrasDe, type FormaPago, type NegocioAlquiler } from '../../datos'
import type { Vista } from '../navegacion'
import { PaginaForm, igual, num, type Form } from './comun'
import { plazoTxt } from './Reglas'

const de = (n: NegocioAlquiler) => ({ senaPct: n.senaPct, pagos: n.pagos, depositos: Object.fromEntries(n.salones.map(s => [s.id, s.deposito])) as Record<string, number> })

const A_TIEMPO = { devolver: 'se devuelve la seña entera', credito: 'la seña queda como crédito para otra reserva' }
const TARDE = { pierde: 'se pierde la seña', mitad: 'se devuelve la mitad de la seña', credito: 'la seña queda como crédito para otra reserva' }

export default function Pagos({ negocio, onGuardar, onIr }: Form & { onIr: (vista: Vista) => void }) {
  const [v, setV] = useState(de(negocio))
  const cambiado = !igual(v, de(negocio))
  const tipo = negocio.tipo
  const palabras = palabrasDe(negocio)
  const setPagos = (c: Partial<NegocioAlquiler['pagos']>) => setV({ ...v, pagos: { ...v.pagos, ...c } })
  const forma = (f: FormaPago, on: boolean) => setPagos({ formas: on ? [...v.pagos.formas.filter(x => x !== f), f] : v.pagos.formas.filter(x => x !== f) })
  const tiene = (f: FormaPago) => v.pagos.formas.includes(f)

  // Conectar o desconectar Mercado Pago se guarda al instante (es un paso aparte del formulario), y el borrador lo sigue.
  const conectar = (on: boolean) => {
    setPagos({ mpConectado: on })
    onGuardar({ pagos: { ...negocio.pagos, mpConectado: on } }, on ? 'Mercado Pago conectado' : 'Mercado Pago desconectado', on ? 'Demo: no se conectó ninguna cuenta real.' : 'Mientras tanto la seña se registra a mano.')
  }

  // Un ejemplo con los precios del negocio, para ver cuánto es la seña.
  const ejemplo = tipo === 'cancha'
    ? { que: `una hora de ${negocio.unidades[0]?.nombre ?? 'cancha'} con ${negocio.extras[0]?.nombre.toLowerCase() ?? 'un extra'}`, base: negocio.unidades[0]?.tarifaHora ?? 0, total: (negocio.unidades[0]?.tarifaHora ?? 0) + (negocio.extras[0]?.precio ?? 0) }
    : tipo === 'bloque'
      ? { que: `${negocio.salones[0]?.paquetes[0]?.nombre.toLowerCase() ?? 'un paquete'} con ${negocio.extras[0]?.nombre ?? 'un extra'}`, base: negocio.salones[0]?.paquetes[0]?.precio ?? 0, total: (negocio.salones[0]?.paquetes[0]?.precio ?? 0) + (negocio.extras[0]?.precio ?? 0) }
      : { que: `dos noches en ${negocio.propiedades[0]?.nombre ?? 'una propiedad'} más la limpieza`, base: (negocio.propiedades[0]?.tarifa.precioNoche ?? 0) * 2, total: (negocio.propiedades[0]?.tarifa.precioNoche ?? 0) * 2 + (negocio.propiedades[0]?.tarifa.limpieza ?? 0) }
  const senaEjemplo = senaDe(v.pagos.senaSobre === 'base' ? ejemplo.base : ejemplo.total, v.senaPct)
  const baseTxt = tipo === 'cancha' ? `Solo ${palabras.genero === 'm' ? 'el' : 'la'} ${palabras.unidad} (sin extras)` : tipo === 'bloque' ? 'Solo el paquete (sin extras)' : negocio.propiedades.some(x => x.modalidad === 'mes') ? 'Solo las noches o el primer mes' : 'Solo las noches (sin limpieza)'

  const guardar = () => onGuardar({ senaPct: v.senaPct, pagos: v.pagos, ...(tipo === 'bloque' ? { salones: negocio.salones.map(s => ({ ...s, deposito: v.depositos[s.id] ?? s.deposito })) } : {}) }, 'Pagos guardados')

  return (
    <PaginaForm rotulo={TIPOS[tipo].label} titulo="Pagos y señas" bajada="Cuánto se paga al reservar, cómo te pagan y qué pasa con la seña si cancelan.">
      <div className="rv-pila">
        <Seccion titulo="Seña" bajada="Lo que se paga al reservar. El resto, en el lugar.">
          <div className="rv-dos">
            <Selector label="Seña al reservar" valor={v.senaPct} onChange={x => setV({ ...v, senaPct: x })} opciones={[0, 20, 30, 50, 100].map(p => ({ id: p, label: p === 0 ? 'Sin seña' : p === 100 ? 'Se paga todo' : `${p}%` }))} />
            <Selector label="Se calcula sobre" valor={v.pagos.senaSobre} onChange={x => setPagos({ senaSobre: x })} opciones={[{ id: 'total' as const, label: 'El total, con todo' }, { id: 'base' as const, label: baseTxt }]} />
          </div>
          <p className="ala-pie-nota">{v.senaPct === 0 ? 'Sin seña: la reserva queda confirmada en el momento y todo se paga en el lugar.' : `Por ejemplo, ${ejemplo.que}: total ${pesos(ejemplo.total)}, seña ${pesos(senaEjemplo)}${senaEjemplo < ejemplo.total ? ` y ${pesos(ejemplo.total - senaEjemplo)} en el lugar` : ''}.`}</p>
        </Seccion>

        <Seccion titulo="Formas de pago" bajada="Se muestran al reservar, para que lleguen sabiendo cómo pagar.">
          <FilaSwitch titulo={FORMAS_PAGO.efectivo.label} ayuda={FORMAS_PAGO.efectivo.ayuda} on={tiene('efectivo')} onChange={x => forma('efectivo', x)} />
          <FilaSwitch titulo={FORMAS_PAGO.transferencia.label} ayuda={FORMAS_PAGO.transferencia.ayuda} on={tiene('transferencia')} onChange={x => forma('transferencia', x)} />
          {tiene('transferencia') && (
            <div className="rv-dos" style={{ padding: '2px 0 14px' }}>
              <Campo label="Alias" value={v.pagos.alias} onChange={x => setPagos({ alias: x })} autoComplete="off" />
              <Campo label="Titular" value={v.pagos.titular} onChange={x => setPagos({ titular: x })} />
            </div>
          )}
          <FilaSwitch titulo={FORMAS_PAGO.mercadopago.label} ayuda={FORMAS_PAGO.mercadopago.ayuda} on={tiene('mercadopago')} onChange={x => forma('mercadopago', x)} />
          {tiene('mercadopago') && (
            <div className="alc-mp" style={{ marginTop: 2 }}>
              <span className="rv-kpi-ico" aria-hidden><Wallet size={16} strokeWidth={1.6} /></span>
              <span className="rv-item-cuerpo">
                <span className="rv-item-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', whiteSpace: 'normal' }}>{v.pagos.mpConectado ? negocio.nombre : 'Conectá tu cuenta'} {v.pagos.mpConectado ? <Chip tono="ok"><CircleCheck size={12} aria-hidden /> Conectada</Chip> : <Chip tono="aviso">Sin conectar</Chip>}</span>
                <span className="rv-item-sub">{v.pagos.mpConectado ? 'La seña se cobra online al reservar y va directo a tu cuenta.' : 'Te lleva a Mercado Pago, aceptás y volvés. Hasta entonces, la seña se registra a mano.'}</span>
              </span>
              {v.pagos.mpConectado
                ? <button type="button" className="rv-btn rv-btn--sm" onClick={() => conectar(false)}><Unplug size={14} aria-hidden /> Desconectar</button>
                : <button type="button" className="rv-btn rv-btn--primario" onClick={() => conectar(true)}><PlugZap size={15} aria-hidden /> Conectar Mercado Pago</button>}
            </div>
          )}
          {v.pagos.formas.length === 0 && <p className="rv-error" style={{ margin: '10px 0 0' }}>Dejá al menos una forma de pago.</p>}
        </Seccion>

        {tipo === 'bloque' && (
          <Seccion titulo="Depósito de garantía" bajada={`Se entrega el día del evento y se devuelve al terminar. Solo se registra: no se cobra desde Órbita.${negocio.salones.length > 1 ? ` Cada ${palabras.unidad} tiene el suyo.` : ''}`}>
            <div className="rv-dos">
              {negocio.salones.map(s => <Campo key={s.id} label={negocio.salones.length > 1 ? s.nombre : 'Depósito'} prefijo="$" value={String(v.depositos[s.id] ?? 0)} onChange={x => setV({ ...v, depositos: { ...v.depositos, [s.id]: num(x) } })} inputMode="numeric" ayuda="0 = no se pide." />)}
            </div>
          </Seccion>
        )}

        <Seccion titulo="Cancelaciones" bajada={`Se cancela sin cargo hasta ${plazoTxt(negocio.cancelaHastaHoras)} antes (el plazo se cambia en Reglas de reserva).`}>
          <div className="rv-dos">
            <Selector label="Si cancelan a tiempo" valor={v.pagos.cancelaATiempo} onChange={x => setPagos({ cancelaATiempo: x })} opciones={[{ id: 'devolver' as const, label: 'Se devuelve la seña' }, { id: 'credito' as const, label: 'Queda como crédito' }]} />
            <Selector label="Si cancelan tarde" valor={v.pagos.cancelaTarde} onChange={x => setPagos({ cancelaTarde: x })} opciones={[{ id: 'pierde' as const, label: 'Se pierde la seña' }, { id: 'mitad' as const, label: 'Se devuelve la mitad' }, { id: 'credito' as const, label: 'Queda como crédito' }]} />
          </div>
          <Nota tono="info"><span style={{ flex: 1, minWidth: 0 }}>Así lo lee el cliente: “Si cancelás hasta {plazoTxt(negocio.cancelaHastaHoras)} antes, {A_TIEMPO[v.pagos.cancelaATiempo]}. Después, {TARDE[v.pagos.cancelaTarde]}.”</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('reglas')}>Reglas de reserva <ArrowRight size={14} aria-hidden /></button></Nota>
        </Seccion>
      </div>
      <BarraGuardar cambiado={cambiado} motivo={v.pagos.formas.length === 0 ? 'Dejá al menos una forma de pago.' : undefined} onDescartar={() => setV(de(negocio))} onGuardar={guardar} />
    </PaginaForm>
  )
}
