// Recuperar clientes: campaña "te extrañamos". El segmento se arma solo
// (quienes no vuelven hace N días) y se les manda un WhatsApp con un cupón
// opcional. La estimación de ingresos muestra su supuesto a la vista: es una
// cuenta, no una promesa.
import { useRef, useState } from 'react'
import { Users, TrendingUp, Send, UserRoundCheck } from 'lucide-react'
import { Button } from '@/design-system/components/Button'
import { Card } from '@/design-system/components/Card'
import { ShellFuncion, Seccion, Campo, Segmentado, FilaSwitch, Dato, VistaCliente, ChatWhatsApp, textareaStyle } from './ui'
import { ars, servicioBase, slugDe, INACTIVOS_POR_DIAS, MUESTRA_INACTIVOS, TASA_RETORNO_ESTIMADA } from './datosAvanzado'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { pluralCliente } from '../Clientes'
import type { PropsFuncion } from './tipos'
import { MESES, mesAnterior, partesDe, useReloj } from '@/modules/turnos/reloj'

const VARIABLES = ['{nombre}', '{negocio}', '{servicio}']

export default function Recuperar(p: PropsFuncion) {
  const { rubro } = p
  const { fecha: hoy } = useReloj()
  const negocio = temaDe(rubro).nombre
  const base = servicioBase(rubro)
  const [dias, setDias] = useState(60)
  const [mensaje, setMensaje] = useState('¡Hola {nombre}! Hace un tiempo que no te vemos por {negocio} y te extrañamos. ¿Te reservamos un turno de {servicio} esta semana?')
  const [cupon, setCupon] = useState(true)
  const [pct, setPct] = useState(15)
  const [validez, setValidez] = useState(15)
  const [envio, setEnvio] = useState<'auto' | 'ahora'>('auto')
  const [enviado, setEnviado] = useState(false)
  const txtRef = useRef<HTMLTextAreaElement>(null)

  const cantidad = INACTIVOS_POR_DIAS[dias]
  const vuelven = Math.max(1, Math.round(cantidad * TASA_RETORNO_ESTIMADA))
  const ticket = base.precio * (cupon ? 1 - pct / 100 : 1)
  const estimado = vuelven * ticket
  const codigo = `VOLVE${pct}`
  const plural = pluralCliente(rubro).toLowerCase()

  // Inserta la variable donde está el cursor, no al final: es lo que uno espera al tocar el chip.
  const insertar = (v: string) => {
    const el = txtRef.current
    const ini = el?.selectionStart ?? mensaje.length
    const fin = el?.selectionEnd ?? mensaje.length
    setMensaje(m => m.slice(0, ini) + v + m.slice(fin))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + v.length, ini + v.length) })
  }

  const final = mensaje.replaceAll('{nombre}', 'Juan').replaceAll('{negocio}', negocio).replaceAll('{servicio}', base.nombre.toLowerCase())
    + (cupon ? `\n\nTe dejamos ${pct}% off con el código ${codigo}, válido por ${validez} días.` : '')

  return (
    <ShellFuncion
      {...p}
      bajada={`Un WhatsApp automático para los ${plural} que no vuelven hace un tiempo, con un cupón opcional para darles el empujón. El grupo se arma solo con tu historial de turnos.`}
      textoOn={envio === 'auto' ? `Cada día se escribe a quienes cumplen ${dias} días sin volver. Nadie recibe más de un mensaje cada 90 días.` : 'La campaña sale una sola vez cuando la mandás.'}
      kpis={<>
        <Dato label={`Sin volver hace ${dias}+ días`} valor={String(cantidad)} nota="Datos de ejemplo" Icon={Users} acento="var(--color-warning)" />
        <Dato label="Ingreso estimado" valor={ars(estimado)} nota={`Si vuelven ${vuelven} (ver supuesto abajo)`} Icon={TrendingUp} acento="var(--color-success)" />
        <Dato label="Volvieron con la última" valor="6" nota={`Campaña de ${MESES[partesDe(mesAnterior(hoy).desde).mes - 1]} · ejemplo`} Icon={UserRoundCheck} />
      </>}
      preview={
        <VistaCliente rubro={rubro} cabecera={false} titulo="El mensaje que le llega" nota="WhatsApp de ejemplo, con el nombre de un cliente de muestra.">
          <ChatWhatsApp pantalla negocio={negocio} botones={['Reservar turno']}
            respuesta={() => `¡Qué bueno, Juan! Elegí día y horario acá: ${slugDe(negocio)}.orbita.site/reservar${cupon ? `\n\nEl código ${codigo} ya queda cargado en la reserva.` : ''}`}>
            {final}
          </ChatWhatsApp>
        </VistaCliente>
      }
    >
      <Seccion titulo="A quién" desc="Quienes vinieron al menos una vez y no reservaron desde entonces.">
        <Campo label="Sin volver hace más de">
          <Segmentado label="Días sin volver" valor={dias} onChange={setDias} opciones={Object.keys(INACTIVOS_POR_DIAS).map(Number).map(n => ({ valor: n, label: `${n} días` }))} />
        </Campo>
        <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-alt)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600, marginBottom: 8 }}>{cantidad} {plural} en este grupo <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>· algunos de ejemplo</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MUESTRA_INACTIVOS.slice(0, 4).map(c => (
              <div key={c.nombre} style={{ display: 'flex', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--color-body)', fontWeight: 500 }}>{c.nombre}</span>
                <span style={{ color: 'var(--color-muted)' }}>{c.visitas} visitas · última {c.ultima}</span>
              </div>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Mensaje">
        <Campo label="Texto" htmlFor="tua-rec-msg" ayuda="Tocá una variable para sumarla donde está el cursor.">
          <textarea id="tua-rec-msg" ref={txtRef} className="tuc-field" value={mensaje} onChange={e => setMensaje(e.target.value)} style={textareaStyle} maxLength={400} />
        </Campo>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: -6 }}>
          {VARIABLES.map(v => (
            <button key={v} type="button" className="tua-opc" aria-label={`Insertar la variable ${v}`} onClick={() => insertar(v)} style={{ minHeight: 30, padding: '0 10px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontFamily: '"Geist Mono", monospace', fontSize: 12, cursor: 'pointer' }}>{v}</button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Cupón">
        <FilaSwitch titulo="Sumar un cupón de descuento" desc="Se crea solo y sirve una vez por cliente." on={cupon} onChange={setCupon} />
        {cupon && (
          <div className="tua-2" style={{ marginTop: 8 }}>
            <Campo label="Descuento"><Segmentado label="Porcentaje del cupón" valor={pct} onChange={setPct} opciones={[10, 15, 20].map(n => ({ valor: n, label: `${n}%` }))} /></Campo>
            <Campo label="Válido por"><Segmentado label="Validez del cupón" valor={validez} onChange={setValidez} opciones={[7, 15, 30].map(n => ({ valor: n, label: `${n} días` }))} /></Campo>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Envío">
        <Segmentado label="Tipo de envío" valor={envio} onChange={v => { setEnvio(v); setEnviado(false) }} opciones={[{ valor: 'auto', label: 'Automático, todos los días' }, { valor: 'ahora', label: 'Una vez, ahora' }]} />
        {envio === 'ahora' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <Button variant="outline" icon={<Send size={14} />} onClick={() => setEnviado(true)} disabled={enviado}>{enviado ? 'Enviada' : `Mandar a ${cantidad} ${plural}`}</Button>
            <span role="status" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{enviado ? 'Demo: no se mandó ningún mensaje real.' : ''}</span>
          </div>
        )}
      </Seccion>

      <Card padding="md" style={{ marginBottom: 16, background: 'var(--color-success-bg)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, var(--color-border))' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chip-success-fg)' }}>Cómo sale la estimación</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-body)', marginTop: 4, lineHeight: 1.55 }}>
          {cantidad} {plural} × {Math.round(TASA_RETORNO_ESTIMADA * 100)}% que vuelve = <b>{vuelven}</b> turnos × {ars(ticket)} ({base.nombre.toLowerCase()}{cupon ? ` con ${pct}% off` : ''}) = <b>{ars(estimado)}</b>.
          El {Math.round(TASA_RETORNO_ESTIMADA * 100)}% es un supuesto para hacer la cuenta, no un dato de tu negocio: después de cada campaña vas a ver cuántos volvieron de verdad.
        </div>
      </Card>
    </ShellFuncion>
  )
}
