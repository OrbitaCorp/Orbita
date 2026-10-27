// Precios por horario: descuento en las franjas flojas (o recargo en las de
// pico) para repartir la demanda. El mapa de ocupación de ejemplo ayuda a ver
// dónde conviene; la vista previa muestra los horarios con su precio final.
import { useState, type CSSProperties } from 'react'
import { Plus, Trash2, TrendingDown, Percent, CalendarCheck, Grid3x3, BadgePercent } from 'lucide-react'
import { Boton, ShellFuncion, SecCard, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono } from './ui'
import { ars, servicioBase, FRANJAS_INICIALES, OCUPACION, FRANJAS_OCUPACION, type Franja } from './datosAvanzado'
import { DIAS_CORTOS } from '@/modules/turnos/datos'
import type { PropsFuncion } from './tipos'

const DIAS_OPC = ['Lun a vie', 'Lun a jue', 'Sábados', 'Todos los días']
const HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
const AJUSTES = [-25, -20, -15, -10, 10, 15, 20]

/** ¿La franja aplica un lunes a esta hora? (la vista previa muestra un lunes) */
const aplicaLunes = (f: Franja, hora: string) => f.dias !== 'Sábados' && hora >= f.desde && hora < f.hasta

export default function PreciosHorario(p: PropsFuncion) {
  const [franjas, setFranjas] = useState<Franja[]>(FRANJAS_INICIALES)
  const [siguiente, setSiguiente] = useState(5)
  const [tachado, setTachado] = useState(true)

  const editar = (id: string, c: Partial<Franja>) => setFranjas(l => l.map(f => f.id === id ? { ...f, ...c } : f))
  const conDescuento = franjas.filter(f => f.ajuste < 0)

  return (
    <ShellFuncion
      {...p}
      bajada="Poné un descuento en los horarios que cuesta llenar. El precio final se ve al elegir horario, así cada uno decide."
      textoOn="Los horarios con descuento se marcan en la reserva con el porcentaje y el precio final."
      kpis={<>
        <Dato label="Ocupación en franjas con descuento" valor="+18 pts" nota="Antes vs. después · ejemplo" Icon={TrendingDown} />
        <Dato label="Descuento promedio" valor={`${Math.round(Math.abs(conDescuento.reduce((s, f) => s + f.ajuste, 0) / Math.max(1, conDescuento.length)))}%`} nota="Según tus franjas" Icon={Percent} />
        <Dato label="Turnos con precio especial" valor="37" nota="Este mes · ejemplo" Icon={CalendarCheck} />
      </>}
      preview={<PreviewHorarios {...p} franjas={franjas} tachado={tachado} />}
    >
      <SecCard titulo="Dónde sobra lugar" Icon={Grid3x3} bajada="Ocupación de ejemplo de las últimas 4 semanas. Cuanto más claro, más cuesta llenar.">
        <div style={{ overflowX: 'auto' }}>
          <table className="tua-mapa">
            <caption className="rv-sr">Ocupación por día y franja horaria, en porcentaje</caption>
            <thead>
              <tr>
                <th />
                {FRANJAS_OCUPACION.map(h => <th key={h} scope="col">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {OCUPACION.map((fila, d) => (
                <tr key={d}>
                  <th scope="row">{DIAS_CORTOS[d]}</th>
                  {fila.map((v, h) => (
                    <td key={h} data-vacio={v === 0} style={{ ['--p' as string]: `${Math.min(55, Math.max(6, v * 0.55))}%` } as CSSProperties}>
                      {v === 0 ? '—' : `${v}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SecCard>

      <SecCard titulo="Franjas con precio especial" Icon={BadgePercent} badge={
        <Boton variant="outline" size="sm" icon={<Plus size={14} aria-hidden />} onClick={() => { setFranjas(l => [...l, { id: `f${siguiente}`, dias: 'Lun a vie', desde: '12:00', hasta: '14:00', ajuste: -10 }]); setSiguiente(n => n + 1) }}>Agregar</Boton>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {franjas.map((f, i) => (
            <div key={f.id} className="tua-bloque">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select aria-label={`Días de la franja ${i + 1}`} className="rv-select" value={f.dias} onChange={e => editar(f.id, { dias: e.target.value })} style={{ width: 'auto', flex: '1 1 130px' }}>
                  {DIAS_OPC.map(d => <option key={d}>{d}</option>)}
                </select>
                <select aria-label={`Desde, franja ${i + 1}`} className="rv-select rv-num" value={f.desde} onChange={e => editar(f.id, { desde: e.target.value })} style={{ width: 104 }}>
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
                <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>a</span>
                <select aria-label={`Hasta, franja ${i + 1}`} className="rv-select rv-num" value={f.hasta} onChange={e => editar(f.id, { hasta: e.target.value })} style={{ width: 104 }}>
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
                <BotonIcono Icon={Trash2} peligro label={`Borrar franja ${i + 1}`} onClick={() => setFranjas(l => l.filter(x => x.id !== f.id))} style={{ marginLeft: 'auto' }} />
              </div>
              {f.hasta <= f.desde && <p role="alert" className="rv-error" style={{ margin: '6px 0 0' }}>El “hasta” tiene que ser más tarde que el “desde”.</p>}
              <div style={{ marginTop: 10 }}>
                <Segmentado label={`Ajuste de la franja ${i + 1}`} valor={f.ajuste} onChange={v => editar(f.id, { ajuste: v })} opciones={AJUSTES.map(a => ({ id: a, label: a > 0 ? `+${a}%` : `${a}%` }))} />
              </div>
            </div>
          ))}
          {franjas.length === 0 && <p className="rv-ayuda" style={{ margin: 0 }}>Sin franjas: todos los horarios tienen el precio de lista.</p>}
        </div>
        <div style={{ marginTop: 14 }}>
          <FilaSwitch titulo="Mostrar el precio de lista tachado" ayuda="Así se nota el descuento al elegir horario." on={tachado} onChange={setTachado} />
        </div>
      </SecCard>
    </ShellFuncion>
  )
}

function PreviewHorarios({ rubro, franjas, tachado }: PropsFuncion & { franjas: Franja[]; tachado: boolean }) {
  const base = servicioBase(rubro)
  const horarios = ['09:00', '10:00', '11:00', '13:00', '14:30', '16:00', '18:00', '19:30']
  const [elegido, setElegido] = useState('10:00')
  const precioDe = (h: string) => {
    const f = franjas.find(x => aplicaLunes(x, h))
    return Math.round((f ? base.precio * (1 + f.ajuste / 100) : base.precio) / 100) * 100
  }
  return (
    <VistaCliente rubro={rubro} nota="Horarios de ejemplo de un lunes. Cambiá las franjas y mirá cómo se actualizan.">
      <div>
        <div className="tua-titulo" style={{ fontSize: 19 }}>Elegí horario</div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{base.nombre} · lunes 28/09</div>
      </div>
      <div role="radiogroup" aria-label="Horarios del lunes (vista previa)" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {horarios.map(h => {
          const f = franjas.find(x => aplicaLunes(x, h))
          const desc = f && f.ajuste < 0
          const sel = elegido === h
          return (
            <button key={h} type="button" role="radio" aria-checked={sel} className="tua-opc" onClick={() => setElegido(h)} style={desc ? { background: 'var(--color-primary-bg)' } : undefined}>
              {f && <span style={{ position: 'absolute', top: -8, right: 8, padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: desc ? 'var(--color-primary)' : 'var(--color-text)', color: desc ? 'var(--color-on-primary)' : 'var(--color-bg)' }}>{f.ajuste > 0 ? `+${f.ajuste}` : f.ajuste}%</span>}
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{h}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--color-body)', marginTop: 2 }}>
                {ars(precioDe(h))}
                {desc && tachado && <span style={{ marginLeft: 5, textDecoration: 'line-through', color: 'var(--color-muted)', fontSize: 11 }}>{ars(base.precio)}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <BotonVista aviso={`Demo: sigue la reserva de las ${elegido} por ${ars(precioDe(elegido))}.`}>Reservar a las {elegido} · {ars(precioDe(elegido))}</BotonVista>
    </VistaCliente>
  )
}
