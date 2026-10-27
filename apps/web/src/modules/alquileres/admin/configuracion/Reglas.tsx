// Reglas de reserva: hasta cuándo se cancela sin cargo y, según el modo, cómo
// se arma un turno (duración, saltos, turnos seguidos) o cómo se entra y se
// sale de cada propiedad (noches mínimas, check-in y check-out). La seña y las
// formas de pago viven en Pagos y señas.
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { duracionTxt } from '@/lib/reservas/fechas'
import { Nota, Seccion, Selector } from '@/design-system/reservas/piezas'
import { TIPOS, type NegocioAlquiler, type Propiedad } from '../../datos'
import type { Vista } from '../navegacion'
import { Guardar } from '../piezas'
import { HORAS, PaginaForm, igual, type Form } from './comun'

/** "24 horas antes", "3 días antes": las opciones del plazo de cancelación. */
export const PLAZOS = [2, 6, 12, 24, 48, 72, 168].map(h => ({ id: h, label: h < 24 ? `${h} horas antes` : `${h / 24} ${h / 24 === 1 ? 'día' : 'días'} antes` }))
export const plazoTxt = (h: number) => (h < 24 ? `${h} horas` : `${h / 24} ${h / 24 === 1 ? 'día' : 'días'}`)

const de = (n: NegocioAlquiler) => ({ cancelaHastaHoras: n.cancelaHastaHoras, pasoMin: n.pasoMin, duracionMin: n.duracionMin, maxFranjas: n.maxFranjas, propiedades: n.propiedades })

export default function Reglas({ negocio, onGuardar, onIr }: Form & { onIr: (vista: Vista) => void }) {
  const [v, setV] = useState(de(negocio))
  const cambiado = !igual(v, de(negocio))
  const tipo = negocio.tipo
  const editarProp = (id: string, c: Partial<Propiedad>) => setV({ ...v, propiedades: v.propiedades.map(p => (p.id === id ? { ...p, ...c } : p)) })
  const guardar = () => {
    const { propiedades, ...resto } = v
    onGuardar(tipo === 'estadia' ? { ...resto, propiedades } : resto)
  }
  return (
    <PaginaForm rotulo={TIPOS[tipo].label} titulo="Reglas de reserva" bajada={tipo === 'cancha' ? 'Cómo se arma un turno y hasta cuándo se puede cancelar.' : tipo === 'bloque' ? 'Hasta cuándo se puede cancelar un evento.' : 'Noches mínimas, horarios de entrada y salida, y hasta cuándo se puede cancelar.'}>
      <div className="rv-pila">
        <Seccion titulo="Cancelación" bajada="Hasta cuánto antes se cancela sin cargo. Lo que pasa con la seña se define en Pagos y señas.">
          <div className="rv-dos">
            <Selector label="Cancelación sin cargo" valor={v.cancelaHastaHoras} onChange={x => setV({ ...v, cancelaHastaHoras: x })} opciones={PLAZOS} />
          </div>
        </Seccion>
        {tipo === 'cancha' && (
          <Seccion titulo="El turno" bajada="Lo mínimo que se reserva, cada cuánto arranca uno y cuántos seguidos puede tomar la misma persona.">
            <div className="rv-dos">
              <Selector label="Duración mínima" ayuda="Un turno: lo menos que se puede reservar." valor={v.duracionMin} onChange={x => setV({ ...v, duracionMin: x, pasoMin: Math.min(v.pasoMin, x) })} opciones={[30, 60, 90, 120].map(m => ({ id: m, label: duracionTxt(m) }))} />
              <Selector label="Saltos de horario" ayuda="Cada cuánto arranca un turno: 9:00, 9:30, 10:00…" valor={v.pasoMin} onChange={x => setV({ ...v, pasoMin: x })} opciones={[15, 30, 60, 90, 120].filter(m => m <= v.duracionMin).map(m => ({ id: m, label: `Cada ${duracionTxt(m)}` }))} />
            </div>
            <div className="rv-dos" style={{ marginTop: 12 }}>
              <Selector label="Turnos seguidos" ayuda="Cuántos puede tomar la misma persona de una vez." valor={v.maxFranjas} onChange={x => setV({ ...v, maxFranjas: x })} opciones={[1, 2, 3, 4].map(n => ({ id: n, label: n === 1 ? 'Solo uno' : `Hasta ${n} (${duracionTxt(v.duracionMin * n)})` }))} />
            </div>
          </Seccion>
        )}
        {tipo === 'bloque' && (
          <Nota><span style={{ flex: 1, minWidth: 0 }}>El salón se reserva por bloques fijos (tarde, noche): cuánto dura cada uno y la limpieza del medio se cambian en Salón; los días y el horario, en Horarios.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('salon')}>Ir a Salón <ArrowRight size={14} aria-hidden /></button></Nota>
        )}
        {tipo === 'estadia' && (
          <Seccion titulo="Entrada, salida y noches mínimas" bajada="Por propiedad: el Depto Centro puede admitir una sola noche y las cabañas pedir dos.">
            <div className="rv-pila">
              {v.propiedades.map(p => (
                <div key={p.id} className="rv-card rv-card--pad" style={{ background: 'var(--color-surface)' }}>
                  <div className="rv-h3" style={{ marginBottom: 10 }}>{p.nombre}</div>
                  <div className="rv-grid rv-grid--3">
                    <Selector label="Mínimo de noches" valor={p.tarifa.minNoches} onChange={x => editarProp(p.id, { tarifa: { ...p.tarifa, minNoches: x } })} opciones={[1, 2, 3, 5, 7].map(n => ({ id: n, label: n === 1 ? '1 noche' : `${n} noches` }))} />
                    <Selector label="Entrada desde" valor={p.checkIn} onChange={x => editarProp(p.id, { checkIn: x })} opciones={HORAS.slice(10, 22)} />
                    <Selector label="Salida hasta" valor={p.checkOut} onChange={x => editarProp(p.id, { checkOut: x })} opciones={HORAS.slice(7, 14)} />
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}
        <Nota><span style={{ flex: 1, minWidth: 0 }}>La seña ({negocio.senaPct ? `${negocio.senaPct}%` : 'sin seña'}), las formas de pago y qué pasa con la seña al cancelar están en Pagos y señas.</span><button type="button" className="rv-btn rv-btn--sm" onClick={() => onIr('pagos')}>Ir a Pagos y señas <ArrowRight size={14} aria-hidden /></button></Nota>
      </div>
      <Guardar cambiado={cambiado} onDescartar={() => setV(de(negocio))} onGuardar={guardar} />
    </PaginaForm>
  )
}
