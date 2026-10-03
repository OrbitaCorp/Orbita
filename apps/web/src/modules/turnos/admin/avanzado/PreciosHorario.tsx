// Precios por horario: descuento en las franjas flojas (o recargo en las de
// pico) para repartir la demanda. El mapa de ocupación de ejemplo ayuda a ver
// dónde conviene; la vista previa muestra los horarios con su precio final.
import { useState } from 'react'
import { Plus, Trash2, TrendingDown, Percent, CalendarCheck } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ShellFuncion, Seccion, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono, inputStyle } from './ui'
import { ars, servicioBase, FRANJAS_INICIALES, OCUPACION, FRANJAS_OCUPACION, type Franja } from './datosAvanzado'
import { DIAS_CORTOS } from '@/modules/turnos/datos'
import type { PropsFuncion } from './tipos'
import { fechaCorta, sumarDias, useReloj } from '@/modules/turnos/reloj'

const DIAS_OPC = ['Lun a vie', 'Lun a jue', 'Sábados', 'Todos los días']
const HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
const AJUSTES = [-25, -20, -15, -10, 10, 15, 20]

/** ¿La franja aplica un lunes a esta hora? (la vista previa muestra un lunes) */
const aplicaLunes = (f: Franja, hora: string) => f.dias !== 'Sábados' && hora >= f.desde && hora < f.hasta

export default function PreciosHorario(p: PropsFuncion) {
  const { rubro } = p
  const [franjas, setFranjas] = useState<Franja[]>(() => rubro.modo === 'cancha'
    ? [...FRANJAS_INICIALES, { id: 'f3', dias: 'Lun a vie', desde: '19:00', hasta: '22:00', ajuste: 15 }]
    : FRANJAS_INICIALES)
  const [siguiente, setSiguiente] = useState(5)
  const [tachado, setTachado] = useState(true)

  const editar = (id: string, c: Partial<Franja>) => setFranjas(l => l.map(f => f.id === id ? { ...f, ...c } : f))

  return (
    <ShellFuncion
      {...p}
      bajada={`Poné un descuento en los horarios que cuesta llenar${rubro.modo === 'cancha' ? ' y, si querés, un recargo en los de más demanda' : ''}. El precio final se ve al elegir horario, así cada uno decide.`}
      textoOn="Los horarios con descuento se marcan en la reserva con el porcentaje y el precio final."
      kpis={<>
        <Dato label="Ocupación en franjas con descuento" valor="+18 pts" nota="Antes vs. después · ejemplo" Icon={TrendingDown} acento="var(--color-success)" />
        <Dato label="Descuento promedio" valor={`${Math.round(Math.abs(franjas.filter(f => f.ajuste < 0).reduce((s, f) => s + f.ajuste, 0) / Math.max(1, franjas.filter(f => f.ajuste < 0).length)))}%`} nota="Según tus franjas" Icon={Percent} />
        <Dato label="Turnos con precio especial" valor="37" nota="Este mes · ejemplo" Icon={CalendarCheck} acento="#8B5CF6" />
      </>}
      preview={<PreviewHorarios {...p} franjas={franjas} tachado={tachado} />}
    >
      <Seccion titulo="Dónde sobra lugar" desc="Ocupación de ejemplo de las últimas 4 semanas. En gris claro, lo que cuesta llenar.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', minWidth: 300, fontSize: 11 }}>
            <caption className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ocupación por día y franja horaria, en porcentaje</caption>
            <thead>
              <tr>
                <th />
                {FRANJAS_OCUPACION.map(h => <th key={h} scope="col" style={{ fontWeight: 600, color: 'var(--color-muted)', padding: '0 0 4px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {OCUPACION.map((fila, d) => (
                <tr key={d}>
                  <th scope="row" style={{ fontWeight: 600, color: 'var(--color-muted)', textAlign: 'left', paddingRight: 4 }}>{DIAS_CORTOS[d]}</th>
                  {fila.map((v, h) => (
                    <td key={h} style={{ height: 30, borderRadius: 6, textAlign: 'center', fontFamily: '"Geist Mono", monospace', fontWeight: 600, background: v === 0 ? 'transparent' : `color-mix(in srgb, var(--color-primary) ${Math.max(8, v * 0.85)}%, var(--color-surface-alt))`, color: v >= 65 ? 'var(--color-on-primary)' : 'var(--color-body)', border: v === 0 ? '1px dashed var(--color-border)' : 'none' }}>
                      {v === 0 ? '—' : `${v}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Franjas con precio especial" accion={
        <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => { setFranjas(l => [...l, { id: `f${siguiente}`, dias: 'Lun a vie', desde: '12:00', hasta: '14:00', ajuste: -10 }]); setSiguiente(n => n + 1) }}>Agregar</Button>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {franjas.map((f, i) => (
            <div key={f.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select aria-label={`Días de la franja ${i + 1}`} className="tuc-field" value={f.dias} onChange={e => editar(f.id, { dias: e.target.value })} style={{ ...inputStyle, width: 'auto', flex: '1 1 130px' }}>
                  {DIAS_OPC.map(d => <option key={d}>{d}</option>)}
                </select>
                <select aria-label={`Desde, franja ${i + 1}`} className="tuc-field" value={f.desde} onChange={e => editar(f.id, { desde: e.target.value })} style={{ ...inputStyle, width: 92 }}>
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
                <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>a</span>
                <select aria-label={`Hasta, franja ${i + 1}`} className="tuc-field" value={f.hasta} onChange={e => editar(f.id, { hasta: e.target.value })} style={{ ...inputStyle, width: 92 }}>
                  {HORAS.map(h => <option key={h}>{h}</option>)}
                </select>
                <BotonIcono Icon={Trash2} peligro label={`Borrar franja ${i + 1}`} onClick={() => setFranjas(l => l.filter(x => x.id !== f.id))} style={{ marginLeft: 'auto' }} />
              </div>
              {f.hasta <= f.desde && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 6 }}>El “hasta” tiene que ser más tarde que el “desde”.</div>}
              <div style={{ marginTop: 10 }}>
                <Segmentado label={`Ajuste de la franja ${i + 1}`} valor={f.ajuste} onChange={v => editar(f.id, { ajuste: v })} opciones={AJUSTES.map(a => ({ valor: a, label: a > 0 ? `+${a}%` : `${a}%` }))} />
              </div>
            </div>
          ))}
          {franjas.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Sin franjas: todos los horarios tienen el precio de lista.</div>}
        </div>
        <FilaSwitch titulo="Mostrar el precio de lista tachado" desc="Así se nota el descuento al elegir horario." on={tachado} onChange={setTachado} />
      </Seccion>
    </ShellFuncion>
  )
}

function PreviewHorarios({ rubro, franjas, tachado }: PropsFuncion & { franjas: Franja[]; tachado: boolean }) {
  const base = servicioBase(rubro)
  // El próximo lunes (de mañana en adelante).
  const { fecha: hoy, diaSemana } = useReloj()
  const lunes = fechaCorta(sumarDias(hoy, 7 - diaSemana))
  const horarios = ['09:00', '10:00', '11:00', '13:00', '14:30', '16:00', '18:00', '19:30']
  const [elegido, setElegido] = useState('10:00')
  const precioDe = (h: string) => {
    const f = franjas.find(x => aplicaLunes(x, h))
    return Math.round((f ? base.precio * (1 + f.ajuste / 100) : base.precio) / 100) * 100
  }
  return (
    <VistaCliente rubro={rubro} nota="Horarios de ejemplo de un lunes. Cambiá las franjas y mirá cómo se actualizan.">
      <div>
        <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>Elegí horario</div>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{base.nombre} · lunes {lunes}</div>
      </div>
      <div role="radiogroup" aria-label="Horarios del lunes (vista previa)" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {horarios.map(h => {
          const f = franjas.find(x => aplicaLunes(x, h))
          const desc = f && f.ajuste < 0
          const sel = elegido === h
          return (
            <button key={h} type="button" role="radio" aria-checked={sel} className="tua-opc" onClick={() => setElegido(h)} style={{ position: 'relative', padding: '10px 10px 9px', borderRadius: 'var(--tu-r)', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${sel || desc ? 'var(--color-primary)' : 'var(--color-border)'}`, background: desc ? 'var(--color-primary-bg)' : 'var(--color-surface)', boxShadow: sel ? '0 0 0 2px var(--color-primary)' : 'none' }}>
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
