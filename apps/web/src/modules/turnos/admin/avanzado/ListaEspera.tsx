// Lista de espera inteligente: cuando alguien cancela, el turno no queda
// vacío. Se le avisa por WhatsApp a quien estaba esperando esa franja y el
// primero que confirma dentro del plazo se lo queda; si nadie responde, pasa
// al siguiente. El dueño no tiene que hacer nada.
import { useState } from 'react'
import { CalendarCheck, Wallet, Timer, Star, Send, Check, X, Hourglass } from 'lucide-react'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, ChatWhatsApp, Boton, BotonIcono, Vacio } from './ui'
import { ars, servicioBase, EN_ESPERA } from './datosAvanzado'
import { recursosDe } from '@/modules/turnos/datos'
import { temaDe } from '@/modules/turnos/storefront/tema'
import type { PropsFuncion } from './tipos'

type Orden = 'llegada' | 'frecuentes'

export default function ListaEspera(p: PropsFuncion) {
  const { rubro } = p
  const [minutos, setMinutos] = useState(10)
  const [orden, setOrden] = useState<Orden>('frecuentes')
  const [aCuantos, setACuantos] = useState<'uno' | 'tres'>('uno')
  const [anticipacion, setAnticipacion] = useState(2)
  const [automatico, setAutomatico] = useState(true)
  const [mostrarPublico, setMostrarPublico] = useState(true)
  // La lista en memoria: a quién ya se le avisó a mano y a quién se sacó.
  const [espera, setEspera] = useState(EN_ESPERA)
  const [avisados, setAvisados] = useState<string[]>([])
  const [estado, setEstado] = useState('')

  const base = servicioBase(rubro)
  const lista = [...espera].sort((a, b) => orden === 'frecuentes' ? Number(b.frecuente) - Number(a.frecuente) : 0)
  const primero = (lista[0] ?? EN_ESPERA[0]).cliente.split(' ')[0]
  const avisarA = (cliente: string) => {
    setAvisados(l => [...l, cliente])
    setEstado(`Demo: a ${cliente.split(' ')[0]} le llegaría el WhatsApp de la vista previa. No se mandó ningún mensaje real.`)
  }
  const quitar = (cliente: string) => {
    setEspera(l => l.filter(x => x.cliente !== cliente))
    setEstado(`${cliente} salió de la lista de espera.`)
  }
  const recurso = recursosDe(rubro)[0]
  const conQuien = rubro.modo === 'profesional' ? ` con ${recurso.nombre.split(' ')[0]}` : rubro.modo === 'cupo' ? '' : ` en ${recurso.nombre}`
  const que = rubro.modo === 'cupo' ? `un lugar en ${base.nombre}` : `un turno de ${base.nombre}`

  return (
    <ShellFuncion
      {...p}
      bajada={`Cuando alguien cancela, le avisamos por WhatsApp a quien estaba esperando ese horario. El primero que confirma se queda con ${rubro.modo === 'cupo' ? 'el lugar' : 'el turno'}; si nadie responde a tiempo, pasa al siguiente.`}
      textoOn={`En los horarios completos tu sitio muestra “Avisame si se libera”${rubro.modo === 'cupo' ? ' en cada clase llena' : ''}.`}
      kpis={<>
        <Dato label="Turnos recuperados este mes" valor="23" nota="Cancelaciones que se volvieron a ocupar · ejemplo" Icon={CalendarCheck} acento="var(--color-success)" />
        <Dato label="Plata que no se perdió" valor={ars(23 * base.precio)} nota={`23 × ${ars(base.precio)} · ejemplo`} Icon={Wallet} acento="var(--color-success)" />
        <Dato label="Tiempo hasta cubrirse" valor="11 min" nota="Promedio · ejemplo" Icon={Timer} />
      </>}
      preview={
        <VistaCliente rubro={rubro} cabecera={false} titulo="El mensaje que le llega" nota="WhatsApp de ejemplo. Fecha y horario salen del turno que se liberó.">
          <ChatWhatsApp pantalla negocio={temaDe(rubro).nombre} botones={['Lo quiero', 'No, gracias']}
            respuesta={b => b === 'Lo quiero'
              ? `¡Listo, ${primero}! Es tuyo: lunes 28/09 a las 16:30${conQuien}. Te mandamos el recordatorio un día antes.`
              : `Dale, ${primero}. Seguís en la lista de espera y te avisamos si se libera otro horario.`}>
            {`¡Hola ${primero}! Se liberó ${que} el lunes 28/09 a las 16:30${conQuien}.\n\nEstabas en la lista de espera, así que es tuyo si lo confirmás en los próximos ${minutos} minutos.`}
            {aCuantos === 'tres' ? '\n\nSe lo ofrecimos a 3 personas: gana quien confirme primero.' : ''}
          </ChatWhatsApp>
        </VistaCliente>
      }
    >
      <Seccion titulo="Cómo se avisa">
        <FilaSwitch titulo="Avisar automáticamente" desc="Apagado, te llega a vos la lista y elegís a quién escribirle." on={automatico} onChange={setAutomatico} />
        <Campo label="Tiempo para confirmar" style={{ marginTop: 8 }} ayuda="Pasado ese tiempo, el aviso pasa al siguiente de la lista.">
          <Segmentado label="Minutos para confirmar" valor={minutos} onChange={setMinutos} opciones={[5, 10, 15, 30].map(n => ({ valor: n, label: `${n} min` }))} />
        </Campo>
        <Campo label="A cuántas personas por vez">
          <Segmentado label="A cuántas personas avisar" valor={aCuantos} onChange={setACuantos} opciones={[{ valor: 'uno', label: 'De a una, en orden' }, { valor: 'tres', label: 'A 3 juntas: gana la más rápida' }]} />
        </Campo>
        <Campo label="No avisar si falta menos de" ayuda="Así nadie recibe un turno al que no llega." style={{ marginBottom: 0 }}>
          <Segmentado label="Anticipación mínima" valor={anticipacion} onChange={setAnticipacion} opciones={[1, 2, 3].map(n => ({ valor: n, label: `${n} h` }))} />
        </Campo>
      </Seccion>

      <Seccion titulo="Orden de la lista">
        <div role="radiogroup" aria-label="Orden de la lista" className="tua-2">
          {([
            ['llegada', 'Por orden de llegada', 'El primero que se anotó es el primero en enterarse.'],
            ['frecuentes', 'Clientes frecuentes primero', 'Premia a quienes más vienen. Después, por orden de llegada.'],
          ] as [Orden, string, string][]).map(([v, t, d]) => {
            const sel = orden === v
            return (
              <button key={v} type="button" role="radio" aria-checked={sel} className="tua-opc" onClick={() => setOrden(v)} style={{ textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sel ? 'var(--color-primary-bg)' : 'var(--color-bg)', color: 'var(--color-body)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: sel ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sel ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {sel && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)' }} />}
                  </span>
                  {t}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.5 }}>{d}</div>
              </button>
            )
          })}
        </div>
        <FilaSwitch titulo="Mostrar cuántos hay esperando" desc="“2 personas antes que vos” en el sitio: ayuda a decidir si anotarse." on={mostrarPublico} onChange={setMostrarPublico} />
      </Seccion>

      <Seccion titulo="En espera ahora" desc="Datos de ejemplo, en el orden en que se les avisaría. También podés avisarle a alguien a mano.">
        {lista.length === 0 ? (
          <Vacio Icon={Hourglass} titulo="Nadie en espera" accion={<Boton variant="outline" size="sm" onClick={() => { setEspera(EN_ESPERA); setAvisados([]); setEstado('Volvió la lista de ejemplo.') }}>Volver a cargar el ejemplo</Boton>}>
            Cuando un horario se llena, quien quiera ese turno se anota desde tu sitio.
          </Vacio>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {lista.map((x, i) => {
              const avisado = avisados.includes(x.cliente)
              return (
                <li key={x.cliente} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--color-border)' : 'none', flexWrap: 'wrap' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: i === 0 ? 'var(--color-primary)' : 'var(--color-surface-alt)', color: i === 0 ? 'var(--color-on-primary)' : 'var(--color-muted)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {x.cliente}
                      {x.frecuente && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 20, padding: '0 7px', borderRadius: 999, background: 'var(--color-warning-bg)', color: 'var(--chip-warning-fg)', fontSize: 11, fontWeight: 600 }}><Star size={10} aria-hidden /> Frecuente</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{x.franja} · {x.desde}</div>
                  </div>
                  <Boton variant="outline" size="sm" className="tua-opc" disabled={avisado} aria-label={avisado ? `${x.cliente}: ya se le avisó` : `Avisarle a ${x.cliente}`}
                    icon={avisado ? <Check size={14} aria-hidden /> : <Send size={14} aria-hidden />} onClick={() => avisarA(x.cliente)}>
                    {avisado ? 'Avisado' : 'Avisar'}
                  </Boton>
                  <BotonIcono Icon={X} label={`Sacar a ${x.cliente} de la lista`} onClick={() => quitar(x.cliente)} />
                </li>
              )
            })}
          </ol>
        )}
        <div role="status" className="tua-estado" style={{ marginTop: 8 }}>{estado}</div>
      </Seccion>
    </ShellFuncion>
  )
}
