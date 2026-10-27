// Membresías y abonos: planes mensuales (N turnos por semana o pase libre)
// con renovación automática. Sirve para lo que se repite todas las semanas:
// sesiones de kinesio, de electroestimulación o de estética.
import { useState } from 'react'
import { Plus, Trash2, Users, Wallet, CalendarClock, Check, Crown, CreditCard, PauseCircle } from 'lucide-react'
import { Boton, ShellFuncion, SecCard, CampoLibre, Segmentado, FilaSwitch, Dato, VistaCliente, BotonVista, BotonIcono } from './ui'
import { ars, planesDe, type PlanMembresia } from './datosAvanzado'
import type { PropsFuncion } from './tipos'

export default function Membresias(p: PropsFuncion) {
  const { rubro } = p
  const unidad = 'turnos'
  const [planes, setPlanes] = useState<PlanMembresia[]>(() => planesDe(rubro))
  const [siguiente, setSiguiente] = useState(4)
  const [renueva, setRenueva] = useState(true)
  const [diaCobro, setDiaCobro] = useState<string>('1')
  const [pausa, setPausa] = useState(true)
  const [diasPausa, setDiasPausa] = useState(15)
  const [matricula, setMatricula] = useState<number | ''>('')

  const editar = (id: string, cambios: Partial<PlanMembresia>) => setPlanes(l => l.map(x => x.id === id ? { ...x, ...cambios } : x))
  const destacar = (id: string) => setPlanes(l => l.map(x => ({ ...x, destacado: x.id === id })))
  const detalle = (x: PlanMembresia) => x.porSemana === 0 ? 'Turnos ilimitados' : `${x.porSemana} ${unidad} por semana`

  // Clientes con plan, de ejemplo, repartidos entre los planes para el ingreso recurrente.
  const conPlan = [34, 38, 14]
  const recurrente = planes.reduce((s, x, i) => s + x.precio * (conPlan[i] ?? 5), 0)

  return (
    <ShellFuncion
      {...p}
      bajada={`Planes mensuales con ${unidad} por semana o pase libre. Se cobran solos cada mes y quien tiene uno reserva sin pagar cada vez.`}
      textoOn={`Los planes se ven en tu sitio y quien tiene uno activo reserva sus ${unidad} sin pagar en el momento.`}
      kpis={<>
        <Dato label="Con plan activo" valor={String(conPlan.reduce((a, b) => a + b, 0))} nota="Datos de ejemplo" Icon={Users} />
        <Dato label="Ingreso mensual recurrente" valor={ars(recurrente)} nota="Si todos renuevan · ejemplo" Icon={Wallet} />
        <Dato label="Vencen esta semana" valor="7" nota="Se les avisa 3 días antes" Icon={CalendarClock} />
      </>}
      preview={<PreviewPlanes planes={planes} detalle={detalle} renueva={renueva} pausa={pausa} diasPausa={diasPausa} matricula={matricula === '' ? 0 : matricula} unidad={unidad} {...p} />}
    >
      <SecCard titulo="Planes" Icon={Crown} bajada="Marcá uno como “Más elegido” para destacarlo." badge={
        <Boton variant="outline" size="sm" icon={<Plus size={14} aria-hidden />} onClick={() => { setPlanes(l => [...l, { id: `m${siguiente}`, nombre: 'Plan nuevo', porSemana: 1, precio: 20000 }]); setSiguiente(n => n + 1) }}>Agregar</Boton>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {planes.map(x => (
            <div key={x.id} className="tua-bloque" data-sel={!!x.destacado}>
              <div className="tua-2">
                <CampoLibre label="Nombre" htmlFor={`tua-mem-n-${x.id}`} style={{ marginBottom: 10 }}>
                  <input id={`tua-mem-n-${x.id}`} className="rv-input" value={x.nombre} onChange={e => editar(x.id, { nombre: e.target.value })} />
                </CampoLibre>
                <CampoLibre label="Precio por mes" htmlFor={`tua-mem-p-${x.id}`} style={{ marginBottom: 10 }}>
                  <span className="rv-con-prefijo"><i>$</i><input id={`tua-mem-p-${x.id}`} className="rv-input rv-num" type="number" inputMode="numeric" min={0} step={1000} value={x.precio} onChange={e => editar(x.id, { precio: Number(e.target.value) })} /></span>
                </CampoLibre>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Segmentado label={`${unidad} por semana de ${x.nombre}`} valor={x.porSemana} onChange={v => editar(x.id, { porSemana: v })} opciones={[{ id: 1, label: '1 x sem' }, { id: 2, label: '2 x sem' }, { id: 3, label: '3 x sem' }, { id: 5, label: '5 x sem' }, { id: 0, label: 'Libre' }]} />
                <span style={{ flex: 1 }} />
                <button type="button" className="rv-chip rv-chip--borde" aria-pressed={!!x.destacado} onClick={() => destacar(x.id)}>
                  {x.destacado && <Check size={12} aria-hidden />} Más elegido
                </button>
                <BotonIcono Icon={Trash2} peligro label={planes.length === 1 ? 'Tiene que quedar al menos un plan' : `Borrar plan ${x.nombre}`} disabled={planes.length === 1} onClick={() => setPlanes(l => l.filter(y => y.id !== x.id))} />
              </div>
            </div>
          ))}
        </div>
      </SecCard>

      <SecCard titulo="Cobro y renovación" Icon={CreditCard}>
        <FilaSwitch titulo="Renovación automática" ayuda="Se cobra solo cada mes con la tarjeta que cargó. Puede darla de baja cuando quiera desde su cuenta." on={renueva} onChange={setRenueva} />
        <CampoLibre label="Día de cobro" style={{ marginTop: 14 }}>
          <Segmentado label="Día de cobro" valor={diaCobro} onChange={setDiaCobro} opciones={[{ id: '1', label: 'El 1 de cada mes' }, { id: '10', label: 'El 10' }, { id: 'alta', label: 'El día que se anotó' }]} />
        </CampoLibre>
        <CampoLibre label="Matrícula (opcional)" htmlFor="tua-mem-mat" ayuda="Se cobra una sola vez, con el primer mes. Dejalo vacío si no cobrás." style={{ marginBottom: 0 }}>
          <span className="rv-con-prefijo" style={{ display: 'block', maxWidth: 240 }}><i>$</i><input id="tua-mem-mat" className="rv-input rv-num" type="number" inputMode="numeric" min={0} step={500} placeholder="Sin matrícula" value={matricula} onChange={e => setMatricula(e.target.value === '' ? '' : Number(e.target.value))} /></span>
        </CampoLibre>
      </SecCard>

      <SecCard titulo="Pausas y vencimientos" Icon={PauseCircle}>
        <FilaSwitch titulo="Permitir congelar el plan" ayuda="Por vacaciones o lesión: el mes se corre sin perder lo pagado." on={pausa} onChange={setPausa}>
          <CampoLibre label="Hasta cuántos días por año" style={{ marginBottom: 0 }}>
            <Segmentado label="Días de pausa por año" valor={diasPausa} onChange={setDiasPausa} opciones={[7, 15, 30].map(n => ({ id: n, label: `${n} días` }))} />
          </CampoLibre>
        </FilaSwitch>
      </SecCard>
    </ShellFuncion>
  )
}

function PreviewPlanes({ planes, detalle, renueva, pausa, diasPausa, matricula, unidad, rubro }: { planes: PlanMembresia[]; detalle: (x: PlanMembresia) => string; renueva: boolean; pausa: boolean; diasPausa: number; matricula: number; unidad: string } & PropsFuncion) {
  return (
    <VistaCliente rubro={rubro}>
      <div className="tua-titulo">Elegí tu plan</div>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: -6 }}>Reservá tus {unidad} desde el celular, sin pagar cada vez.</div>
      {planes.map(x => (
        <div key={x.id} className="tua-tarjeta" style={{ position: 'relative', ...(x.destacado ? { borderColor: 'var(--color-primary)', background: 'var(--color-primary-bg)' } : null) }}>
          {x.destacado && <span style={{ position: 'absolute', top: -10, right: 12, padding: '2px 9px', borderRadius: 999, background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Más elegido</span>}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: 'var(--tu-fh)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{x.nombre || 'Sin nombre'}</span>
            <span style={{ whiteSpace: 'nowrap' }}><b style={{ fontSize: 18, color: 'var(--color-text)' }}>{ars(x.precio)}</b><span style={{ fontSize: 11, color: 'var(--color-muted)' }}>/mes</span></span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[detalle(x), renueva ? 'Se renueva solo, cancelás cuando quieras' : 'Pago mes a mes', ...(pausa ? [`Congelalo hasta ${diasPausa} días al año`] : [])].map(t => (
              <li key={t} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--color-body)' }}><Check size={13} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />{t}</li>
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
