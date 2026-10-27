// Temporadas y precios: por propiedad, el precio base por noche, el recargo del
// fin de semana, la limpieza y las temporadas con su precio. Abajo, el
// calendario dice qué temporada rige cada día y cuánto vale esa noche, así se
// ve de un vistazo que Carnaval queda adentro de la alta y que diciembre ya
// está en temporada.
import { useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { DIAS_CORTOS, fechaLarga, grillaMes, mesTxt, moverMes, partes, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { pesos } from '@/lib/reservas/precio'
import { precioNoche, temporadaDe, type TarifaEstadia, type Temporada } from '@/lib/reservas/estadia'
import { Campo, Seccion, Selector } from '@/design-system/reservas/piezas'
import { HOY, TIPOS, type Propiedad } from '../../datos'
import { Guardar } from '../piezas'
import { PaginaForm, idNuevo, igual, num, type Form } from './comun'

/**
 * El tinte de una temporada en el calendario: un solo color (el acento), más
 * fuerte cuanto más cara que la base; las más baratas que la base van en gris.
 * Es una escala de magnitud, no de identidad: por eso no hay un color por temporada.
 */
function tinteDe(t: Temporada, base: number): string {
  if (t.precioNoche < base) return 'var(--color-surface-alt)'
  const pct = Math.max(16, Math.min(48, 16 + Math.round((t.precioNoche / Math.max(1, base) - 1) * 50)))
  return `color-mix(in srgb, var(--color-primary) ${pct}%, transparent)`
}

/** "$98.000" no entra en una celda de 46 px: "98k", y el precio entero queda en el aria-label. */
const corto = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export default function Temporadas({ negocio, onGuardar }: Form) {
  const [lista, setLista] = useState<Propiedad[]>(negocio.propiedades)
  const [abierta, setAbierta] = useState(lista[0]?.id ?? '')
  const [mes, setMes] = useState<ISO>(HOY)
  const cambiado = !igual(lista, negocio.propiedades)
  const p = lista.find(x => x.id === abierta)
  const tarifa = (c: Partial<TarifaEstadia>) => p && setLista(lista.map(x => (x.id === abierta ? { ...x, tarifa: { ...x.tarifa, ...c } } : x)))
  const temporada = (id: string, c: Partial<Temporada>) => p && tarifa({ temporadas: p.tarifa.temporadas.map(t => (t.id === id ? { ...t, ...c } : t)) })
  const nuevaTemporada = (nombre: string, factor: number) => p && tarifa({ temporadas: [...p.tarifa.temporadas, { id: idNuevo('t'), nombre, desde: sumarDias(HOY, 30), hasta: sumarDias(HOY, 90), precioNoche: Math.round((p.tarifa.precioNoche * factor) / 1000) * 1000 }] })
  const celdas = grillaMes(partes(mes).anio, partes(mes).mes)
  return (
    <PaginaForm rotulo={TIPOS.estadia.label} titulo="Temporadas y precios" bajada="Por propiedad: el precio base por noche, el recargo del fin de semana, la limpieza y las temporadas. El calendario muestra qué rige cada día.">
      <div className="rv-seg" role="group" aria-label="Propiedad" style={{ marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
        {lista.map(x => <button key={x.id} type="button" aria-pressed={x.id === abierta} onClick={() => setAbierta(x.id)}>{x.nombre}</button>)}
      </div>
      {p && (
        <div className="rv-pila">
          <Seccion titulo="Precio base" bajada="Lo que vale una noche fuera de temporada.">
            <div className="rv-grid rv-grid--3">
              <Campo label="Precio por noche" prefijo="$" value={String(p.tarifa.precioNoche)} onChange={x => tarifa({ precioNoche: num(x) })} inputMode="numeric" />
              <Selector label="Fin de semana" ayuda="Recargo de las noches del viernes y del sábado." valor={p.tarifa.finDeSemanaPct} onChange={x => tarifa({ finDeSemanaPct: x })} opciones={[0, 10, 15, 20, 30].map(n => ({ id: n, label: n ? `+${n}%` : 'Sin recargo' }))} />
              <Campo label="Limpieza" prefijo="$" value={String(p.tarifa.limpieza)} onChange={x => tarifa({ limpieza: num(x) })} inputMode="numeric" ayuda="Fija, una vez por estadía." />
            </div>
          </Seccion>
          <Seccion titulo="Temporadas" bajada={p.tarifa.temporadas.length > 1 ? 'Si dos se pisan, vale la más corta (por ejemplo, Carnaval adentro de la alta).' : 'Un precio distinto por noche entre dos fechas.'}
            acciones={<span className="rv-fila" style={{ gap: 6 }}>
              <button type="button" className="rv-btn rv-btn--sm" onClick={() => nuevaTemporada('Temporada alta', 1.4)}><Plus size={14} aria-hidden /> Alta</button>
              <button type="button" className="rv-btn rv-btn--sm" onClick={() => nuevaTemporada('Temporada baja', 0.8)}><Plus size={14} aria-hidden /> Baja</button>
            </span>}>
            <div className="rv-pila">
              {p.tarifa.temporadas.map(t => (
                <div key={t.id} className="alc-fila alc-fila--temporada">
                  <Campo label="Nombre" value={t.nombre} onChange={x => temporada(t.id, { nombre: x })} />
                  <Campo label="Desde" type="date" value={t.desde} onChange={x => x && temporada(t.id, { desde: x })} />
                  <Campo label="Hasta" type="date" value={t.hasta} onChange={x => x && temporada(t.id, { hasta: x })} />
                  <Campo label="Por noche" prefijo="$" value={String(t.precioNoche)} onChange={x => temporada(t.id, { precioNoche: num(x) })} inputMode="numeric" />
                  <button type="button" className="rv-btn rv-btn--icono" onClick={() => tarifa({ temporadas: p.tarifa.temporadas.filter(y => y.id !== t.id) })} aria-label={`Quitar ${t.nombre}`}><Trash2 size={16} /></button>
                </div>
              ))}
              {p.tarifa.temporadas.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Sin temporadas: todas las noches valen lo mismo (más el recargo del fin de semana, si lo hay).</p>}
            </div>
          </Seccion>
          <Seccion titulo="Qué rige cada día" bajada={`Cada noche con su precio en ${p.nombre}, con las temporadas y el fin de semana puestos.`}>
            <div className="rv-cal-cab">
              <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
              <span className="rv-cal-mes" aria-live="polite">{mesTxt(mes)}</span>
              <button type="button" className="rv-btn rv-btn--icono rv-btn--sm" onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
            </div>
            <div className="rv-cal-dias" aria-hidden>{DIAS_CORTOS.map(d => <span key={d}>{d}</span>)}</div>
            <div className="alc-temp-dias" role="list" aria-label={`Precio por noche en ${mesTxt(mes)}`}>
              {celdas.map(c => {
                const n = precioNoche(c.fecha, p.tarifa)
                const t = temporadaDe(c.fecha, p.tarifa.temporadas)
                return (
                  <div key={c.fecha} role="listitem" className="alc-temp-dia" data-fuera={!c.delMes} data-hoy={c.fecha === HOY}
                    style={{ ['--alc-tinte' as string]: t ? tinteDe(t, p.tarifa.precioNoche) : 'transparent' } as CSSProperties}
                    aria-label={`${fechaLarga(c.fecha)}: ${pesos(n.precio)}${t ? `, ${t.nombre}` : ''}${n.finDeSemana ? ', fin de semana' : ''}`}>
                    <span>{partes(c.fecha).dia}</span><small aria-hidden>{corto(n.precio)}</small>
                  </div>
                )
              })}
            </div>
            <div className="alc-leyenda" aria-hidden>
              <span><i style={{ background: 'transparent' }} />Base {pesos(p.tarifa.precioNoche)}</span>
              {p.tarifa.temporadas.map(t => <span key={t.id}><i style={{ background: tinteDe(t, p.tarifa.precioNoche) }} />{t.nombre} {pesos(t.precioNoche)}</span>)}
              {p.tarifa.finDeSemanaPct > 0 && <span>Viernes y sábados +{p.tarifa.finDeSemanaPct}%</span>}
            </div>
          </Seccion>
        </div>
      )}
      <Guardar cambiado={cambiado} onDescartar={() => { setLista(negocio.propiedades); setAbierta(negocio.propiedades[0]?.id ?? '') }} onGuardar={() => onGuardar({ propiedades: lista })} />
    </PaginaForm>
  )
}
