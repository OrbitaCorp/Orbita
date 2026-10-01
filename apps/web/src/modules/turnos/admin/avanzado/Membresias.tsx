// Membresías y abonos: planes mensuales (N clases por semana o pase libre)
// con renovación automática. Pensado para rubros con cupo (gimnasio,
// crossfit, yoga, danza), pero un rubro por turno también puede tener un
// "abono" de N turnos al mes; por eso la unidad cambia con el modo.
import { useState } from 'react'
import { Plus, Trash2, Users, Wallet, CalendarClock, Check } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono, inputStyle } from './ui'
import { ars, planesDe, type PlanMembresia } from './datosAvanzado'
import type { PropsFuncion } from './tipos'

export default function Membresias(p: PropsFuncion) {
  const { rubro } = p
  const unidad = rubro.modo === 'cupo' ? 'clases' : 'turnos'
  const [planes, setPlanes] = useState<PlanMembresia[]>(() => planesDe(rubro))
  const [siguiente, setSiguiente] = useState(4)
  const [renueva, setRenueva] = useState(true)
  const [diaCobro, setDiaCobro] = useState<string>('1')
  const [pausa, setPausa] = useState(true)
  const [diasPausa, setDiasPausa] = useState(15)
  const [matricula, setMatricula] = useState<number | ''>(rubro.modo === 'cupo' ? 8000 : '')

  const editar = (id: string, cambios: Partial<PlanMembresia>) => setPlanes(l => l.map(x => x.id === id ? { ...x, ...cambios } : x))
  const destacar = (id: string) => setPlanes(l => l.map(x => ({ ...x, destacado: x.id === id })))
  const detalle = (x: PlanMembresia) => x.porSemana === 0 ? `${unidad[0].toUpperCase() + unidad.slice(1)} ilimitad${unidad === 'clases' ? 'as' : 'os'}` : `${x.porSemana} ${unidad} por semana`

  // Socios de ejemplo repartidos entre los planes para el ingreso recurrente.
  const socios = [34, 38, 14]
  const recurrente = planes.reduce((s, x, i) => s + x.precio * (socios[i] ?? 5), 0)

  return (
    <ShellFuncion
      {...p}
      bajada={`Planes mensuales con ${unidad} por semana o pase libre. Se cobran solos cada mes y quien tiene uno reserva sin pagar cada vez.`}
      textoOn={`Los planes se ven en tu sitio y quien tiene uno activo reserva sus ${unidad} sin pagar en el momento.`}
      kpis={<>
        <Dato label="Con plan activo" valor={String(socios.reduce((a, b) => a + b, 0))} nota="Datos de ejemplo" Icon={Users} />
        <Dato label="Ingreso mensual recurrente" valor={ars(recurrente)} nota="Si todos renuevan · ejemplo" Icon={Wallet} acento="var(--color-success)" />
        <Dato label="Vencen esta semana" valor="7" nota="Se les avisa 3 días antes" Icon={CalendarClock} acento="var(--color-warning)" />
      </>}
      preview={<PreviewPlanes planes={planes} detalle={detalle} renueva={renueva} pausa={pausa} diasPausa={diasPausa} matricula={matricula === '' ? 0 : matricula} unidad={unidad} {...p} />}
    >
      <Seccion titulo="Planes" desc="Marcá uno como “Más elegido” para destacarlo." accion={
        <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => { setPlanes(l => [...l, { id: `m${siguiente}`, nombre: 'Plan nuevo', porSemana: 1, precio: 20000 }]); setSiguiente(n => n + 1) }}>Agregar</Button>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {planes.map(x => (
            <div key={x.id} style={{ padding: 12, borderRadius: 10, border: `1.5px solid ${x.destacado ? 'var(--color-primary)' : 'var(--color-border)'}`, background: 'var(--color-bg)' }}>
              <div className="tua-2">
                <Campo label="Nombre" htmlFor={`tua-mem-n-${x.id}`} style={{ marginBottom: 10 }}>
                  <input id={`tua-mem-n-${x.id}`} className="tuc-field" value={x.nombre} onChange={e => editar(x.id, { nombre: e.target.value })} style={inputStyle} />
                </Campo>
                <Campo label="Precio por mes" htmlFor={`tua-mem-p-${x.id}`} style={{ marginBottom: 10 }}>
                  <input id={`tua-mem-p-${x.id}`} className="tuc-field" type="number" inputMode="numeric" min={0} step={1000} value={x.precio} onChange={e => editar(x.id, { precio: Number(e.target.value) })} style={inputStyle} />
                </Campo>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Segmentado label={`${unidad} por semana de ${x.nombre}`} valor={x.porSemana} onChange={v => editar(x.id, { porSemana: v })} opciones={[{ valor: 1, label: '1 x sem' }, { valor: 2, label: '2 x sem' }, { valor: 3, label: '3 x sem' }, { valor: 5, label: '5 x sem' }, { valor: 0, label: 'Libre' }]} />
                <span style={{ flex: 1 }} />
                <button type="button" className="tua-opc" aria-pressed={!!x.destacado} onClick={() => destacar(x.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 32, padding: '0 10px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${x.destacado ? 'var(--color-primary)' : 'var(--color-border)'}`, background: x.destacado ? 'var(--color-primary-bg)' : 'transparent', color: x.destacado ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  {x.destacado && <Check size={12} />} Más elegido
                </button>
                <BotonIcono Icon={Trash2} peligro label={planes.length === 1 ? 'Tiene que quedar al menos un plan' : `Borrar plan ${x.nombre}`} disabled={planes.length === 1} onClick={() => setPlanes(l => l.filter(y => y.id !== x.id))} />
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Cobro y renovación">
        <FilaSwitch titulo="Renovación automática" desc="Se cobra solo cada mes con la tarjeta que cargó. Puede darla de baja cuando quiera desde su cuenta." on={renueva} onChange={setRenueva} />
        <Campo label="Día de cobro" style={{ marginTop: 8 }}>
          <Segmentado label="Día de cobro" valor={diaCobro} onChange={setDiaCobro} opciones={[{ valor: '1', label: 'El 1 de cada mes' }, { valor: '10', label: 'El 10' }, { valor: 'alta', label: 'El día que se anotó' }]} />
        </Campo>
        <Campo label="Matrícula (opcional)" htmlFor="tua-mem-mat" ayuda="Se cobra una sola vez, con el primer mes. Dejalo vacío si no cobrás.">
          <input id="tua-mem-mat" className="tuc-field" type="number" inputMode="numeric" min={0} step={500} placeholder="Sin matrícula" value={matricula} onChange={e => setMatricula(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inputStyle, maxWidth: 220 }} />
        </Campo>
      </Seccion>

      <Seccion titulo="Pausas y vencimientos">
        <FilaSwitch titulo="Permitir congelar el plan" desc="Por vacaciones o lesión: el mes se corre sin perder lo pagado." on={pausa} onChange={setPausa} />
        {pausa && (
          <Campo label="Hasta cuántos días por año" style={{ marginTop: 6 }}>
            <Segmentado label="Días de pausa por año" valor={diasPausa} onChange={setDiasPausa} opciones={[7, 15, 30].map(n => ({ valor: n, label: `${n} días` }))} />
          </Campo>
        )}
      </Seccion>
    </ShellFuncion>
  )
}

function PreviewPlanes({ planes, detalle, renueva, pausa, diasPausa, matricula, unidad, rubro }: { planes: PlanMembresia[]; detalle: (x: PlanMembresia) => string; renueva: boolean; pausa: boolean; diasPausa: number; matricula: number; unidad: string } & PropsFuncion) {
  return (
    <VistaCliente rubro={rubro}>
      <div style={{ fontFamily: 'var(--tu-fh)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1 }}>Elegí tu plan</div>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: -6 }}>Reservá tus {unidad} desde el celular, sin pagar cada vez.</div>
      {planes.map(x => (
        <div key={x.id} style={{ position: 'relative', borderRadius: 'var(--tu-r2)', padding: 14, border: `${x.destacado ? 2 : 1}px solid ${x.destacado ? 'var(--color-primary)' : 'var(--color-border)'}`, background: x.destacado ? 'var(--color-primary-bg)' : 'var(--color-surface)' }}>
          {x.destacado && <span style={{ position: 'absolute', top: -10, right: 12, padding: '2px 9px', borderRadius: 999, background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Más elegido</span>}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: 'var(--tu-fh)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{x.nombre || 'Sin nombre'}</span>
            <span style={{ whiteSpace: 'nowrap' }}><b style={{ fontSize: 18, color: 'var(--color-text)' }}>{ars(x.precio)}</b><span style={{ fontSize: 11, color: 'var(--color-muted)' }}>/mes</span></span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[detalle(x), renueva ? 'Se renueva solo, cancelás cuando quieras' : 'Pago mes a mes', ...(pausa ? [`Congelalo hasta ${diasPausa} días al año`] : [])].map(t => (
              <li key={t} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--color-body)' }}><Check size={13} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />{t}</li>
            ))}
          </ul>
          <BotonVista variante={x.destacado ? 'primario' : 'borde'} style={{ marginTop: 12, fontSize: 13.5 }}
            aviso={`Demo: acá se paga ${x.nombre || 'el plan'} (${ars(x.precio + matricula)} el primer mes) y queda activo al instante.`}>
            Elegir plan
          </BotonVista>
        </div>
      ))}
      {matricula > 0 && <div style={{ fontSize: 11.5, color: 'var(--color-muted)', textAlign: 'center' }}>Matrícula única de {ars(matricula)} con el primer mes.</div>}
    </VistaCliente>
  )
}
