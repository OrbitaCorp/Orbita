// Cómo cobra una persona del equipo: la forma (comisión, sueldo fijo, las dos
// cosas, alquiler del sillón o por clase), sus montos y cada cuánto se le
// liquida. Lo usan el formulario de la persona (Equipo) y el de Ganancias: es
// el mismo dato en los dos lados.
//
// Abajo va siempre un ejemplo con números del negocio: un porcentaje suelto no
// dice nada; "de un turno de $12.000 se lleva $6.000" sí.
import { Info } from 'lucide-react'
import type { RubroTurnos } from '@/modules/turnos/datos'
import { Campo, Dos, OpcionTarjeta, Segmentado } from './configuracion/ui'
import { formasDe, lugarAlquiler, plata, type Cada, type Pago } from './equipoDemo'

export const CSS_PAGO = `
  .tu-pago-formas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
  .tu-pago-formas > .tuc-opcion { padding: 12px; }
  .tu-pago-rapidos { display: flex; flex-wrap: wrap; gap: 6px; margin: -8px 0 16px; }
  @media (max-width: 560px) { .tu-pago-formas { grid-template-columns: minmax(0, 1fr); } }
`

const COMISIONES = [30, 40, 50, 60, 70]
const CADA: { id: Cada; label: string }[] = [{ id: 'semana', label: 'Por semana' }, { id: 'quincena', label: 'Por quincena' }, { id: 'mes', label: 'Por mes' }]
const numero = (v: string, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Math.round(Number(v.replace(',', '.')) || 0)))
const campo = (n: number) => (n ? String(n) : '')

export function CamposPago({ pago, onChange, rubro, nombre }: { pago: Pago; onChange: (p: Pago) => void; rubro: RubroTurnos; nombre: string }) {
  const formas = formasDe(rubro)
  const pila = nombre.trim().split(' ')[0] || 'Esta persona'
  // Un turno típico del rubro para el ejemplo: el primer servicio que se cobra.
  const turno = rubro.servicios.find(s => s.precio > 0)?.precio ?? 10000
  const set = (c: Partial<Pago>) => onChange({ ...pago, ...c })
  const conComision = pago.forma === 'comision' || pago.forma === 'mixto'
  const conSueldo = pago.forma === 'sueldo' || pago.forma === 'mixto'
  const parte = Math.round(turno * pago.comision / 100)

  const ejemplo = pago.forma === 'comision' ? <>De un turno de <b>{plata(turno)}</b>, {pila} se lleva <b>{plata(parte)}</b> y al negocio le quedan <b>{plata(turno - parte)}</b>.</>
    : pago.forma === 'sueldo' ? <>{pila} cobra <b>{plata(pago.sueldo)}</b> por mes, atienda lo que atienda. Todo lo que factura queda para el negocio.</>
      : pago.forma === 'mixto' ? <>{pila} cobra <b>{plata(pago.sueldo)}</b> fijos por mes y, de cada turno de <b>{plata(turno)}</b>, suma <b>{plata(parte)}</b>.</>
        : pago.forma === 'alquiler' ? <>{pila} se queda con todo lo que factura y le paga al negocio <b>{plata(pago.alquiler)}</b> por mes por usar {lugarAlquiler(rubro)}.</>
          : <>Si {pila} da 12 clases en el mes, cobra <b>{plata(pago.porClase * 12)}</b>.</>

  return (
    <>
      <div role="radiogroup" aria-label="Cómo cobra" className="tu-pago-formas">
        {formas.map(f => <OpcionTarjeta key={f.id} activa={pago.forma === f.id} onClick={() => set({ forma: f.id })} titulo={f.label} ayuda={f.ayuda} />)}
      </div>

      {conSueldo && conComision ? (
        <Dos>
          <Campo label="Sueldo por mes" type="number" mono prefijo="$" value={campo(pago.sueldo)} onChange={v => set({ sueldo: numero(v) })} placeholder="0" />
          <Campo label="Comisión" type="number" mono sufijo="%" value={campo(pago.comision)} onChange={v => set({ comision: numero(v, 100) })} placeholder="0" />
        </Dos>
      ) : conSueldo ? (
        <Campo label="Sueldo por mes" type="number" mono prefijo="$" value={campo(pago.sueldo)} onChange={v => set({ sueldo: numero(v) })} placeholder="0" />
      ) : conComision ? (
        <Campo label="Comisión" ayuda="El porcentaje de cada turno atendido que se lleva." type="number" mono sufijo="%" value={campo(pago.comision)} onChange={v => set({ comision: numero(v, 100) })} placeholder="0" />
      ) : pago.forma === 'alquiler' ? (
        <Campo label={`Alquiler de ${lugarAlquiler(rubro).replace(/^(el|la) /, '')} por mes`} type="number" mono prefijo="$" value={campo(pago.alquiler)} onChange={v => set({ alquiler: numero(v) })} placeholder="0" />
      ) : (
        <Campo label="Por cada clase que da" type="number" mono prefijo="$" value={campo(pago.porClase)} onChange={v => set({ porClase: numero(v) })} placeholder="0" />
      )}
      {conComision && (
        <div className="tu-pago-rapidos" role="group" aria-label="Porcentajes habituales">
          {COMISIONES.map(c => <button key={c} type="button" className="tuc-pastilla tuo-num" aria-pressed={pago.comision === c} onClick={() => set({ comision: c })}>{c}%</button>)}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div className="tuc-rotulo" style={{ marginBottom: 8 }}>{pago.forma === 'alquiler' ? 'Te lo paga' : 'Se le liquida'}</div>
        <Segmentado label={pago.forma === 'alquiler' ? 'Cada cuánto paga' : 'Cada cuánto se le liquida'} lleno valor={pago.cada} onChange={cada => set({ cada })} opciones={CADA} />
      </div>

      <div className="tu-nota tu-nota--info" style={{ marginBottom: 0 }}>
        <Info size={15} />
        <span>{ejemplo}</span>
      </div>
    </>
  )
}
