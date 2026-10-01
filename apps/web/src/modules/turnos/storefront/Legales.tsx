// Los tres legales del pie del sitio: términos, privacidad y botón de
// arrepentimiento. Se abren en una ventana, sin salir de la página. Los textos
// son de ejemplo (cada negocio carga los suyos) y el pedido de arrepentimiento
// se simula: queda en memoria, no se envía a ningún lado.
import { useEffect, useState } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { Dialogo } from './piezas'
import { CODIGO_DEMO } from './reserva/acciones'
import type { TemaNegocio } from './tema'

export type Legal = 'terminos' | 'privacidad' | 'arrepentimiento'

export const LEGALES: { id: Legal; label: string }[] = [
  { id: 'terminos', label: 'Términos y condiciones' },
  { id: 'privacidad', label: 'Política de privacidad' },
  { id: 'arrepentimiento', label: 'Botón de arrepentimiento' },
]

export function Legales({ cual, t, onCerrar }: { cual: Legal; t: TemaNegocio; onCerrar: () => void }) {
  return (
    <Dialogo titulo={LEGALES.find(l => l.id === cual)!.label} onCerrar={onCerrar}>
      {cual === 'terminos' && <Terminos t={t} />}
      {cual === 'privacidad' && <Privacidad t={t} />}
      {cual === 'arrepentimiento' && <Arrepentimiento t={t} onCerrar={onCerrar} />}
      {cual !== 'arrepentimiento' && (
        <div className="tu-dialogo-pie"><button type="button" className="tu-btn" onClick={onCerrar}>Entendido</button></div>
      )}
    </Dialogo>
  )
}

function Nota() {
  return <div className="tu-dialogo-nota"><Info size={15} aria-hidden /> <span>Vista previa: es un texto de ejemplo. Cada negocio publica sus propias condiciones.</span></div>
}

function Terminos({ t }: { t: TemaNegocio }) {
  return (
    <>
      <p>Estas condiciones valen para las reservas que hacés online en {t.nombre}, {t.direccion}, {t.barrio}.</p>
      <h3>Reservas</h3>
      <p>El turno queda confirmado cuando ves la pantalla de confirmación y te llega el mensaje por WhatsApp. Los precios publicados son finales.</p>
      <h3>Cambios y cancelaciones</h3>
      <p>Podés cancelar o reprogramar sin cargo hasta 24 h antes, desde Mis turnos o desde el link del recordatorio. Pasado ese plazo, si pagaste una seña, no se devuelve.</p>
      <h3>Llegadas tarde</h3>
      <p>Guardamos tu lugar 10 minutos. Después de ese tiempo el turno puede darse a otra persona o acortarse para no demorar al siguiente.</p>
      <Nota />
    </>
  )
}

function Privacidad({ t }: { t: TemaNegocio }) {
  return (
    <>
      <p>{t.nombre} usa tus datos solo para gestionar tus turnos. No se venden ni se comparten con terceros.</p>
      <h3>Qué datos pedimos</h3>
      <p>Nombre, celular y, si querés, tu email. Con el celular te mandamos la confirmación y el recordatorio por WhatsApp.</p>
      <h3>Tus derechos</h3>
      <p>Podés pedir que te mostremos, corrijamos o borremos tus datos cuando quieras, escribiendo al <span className="tu-num">{t.telefono}</span>. Es tu derecho según la Ley 25.326 de Protección de Datos Personales.</p>
      <h3>Pagos</h3>
      <p>Las señas se pagan por Mercado Pago: los datos de tu tarjeta no pasan por este sitio.</p>
      <Nota />
    </>
  )
}

function Arrepentimiento({ t, onCerrar }: { t: TemaNegocio; onCerrar: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [contacto, setContacto] = useState('')
  const [intento, setIntento] = useState(false)
  const [estado, setEstado] = useState<'form' | 'enviando' | 'listo'>('form')

  // El "envío" simulado tarda un momento, como pasaría de verdad.
  useEffect(() => {
    if (estado !== 'enviando') return
    const x = setTimeout(() => setEstado('listo'), 900)
    return () => clearTimeout(x)
  }, [estado])

  const errCodigo = codigo.trim().length < 4 ? 'Escribí el código de tu reserva: está en la confirmación.' : undefined
  const errContacto = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contacto.trim()) && contacto.replace(/\D/g, '').length < 10 ? 'Escribí un email o un celular con código de área.' : undefined

  if (estado === 'listo') {
    return (
      <div className="tu-listo" role="status">
        <span className="tu-listo-ico"><Check size={28} strokeWidth={2.6} aria-hidden /></span>
        <div className="tu-h" style={{ fontSize: 22 }}>Recibimos tu pedido</div>
        <p>Anulamos la reserva <b className="tu-num">{codigo.trim().toUpperCase()}</b>. Si pagaste una seña, se devuelve al mismo medio de pago dentro de los 10 días. Te avisamos a <b>{contacto.trim()}</b>.</p>
        <p>Número de trámite: <b className="tu-num">ARR-2026-0142</b></p>
        <div className="tu-dialogo-pie" style={{ width: '100%' }}><button type="button" className="tu-btn" onClick={onCerrar}>Listo</button></div>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={e => { e.preventDefault(); if (errCodigo || errContacto) { setIntento(true); document.getElementById(errCodigo ? 'tu-arr-codigo' : 'tu-arr-contacto')?.focus() } else setEstado('enviando') }}>
      <p>Si reservaste online en {t.nombre} y te arrepentiste, podés anular la reserva dentro de los 10 días, sin dar explicaciones y sin costo.</p>
      <label className="tu-campo" htmlFor="tu-arr-codigo">
        Código de reserva
        <input id="tu-arr-codigo" type="text" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder={CODIGO_DEMO} autoComplete="off" autoCapitalize="characters" maxLength={20}
          aria-invalid={intento && !!errCodigo} aria-describedby={intento && errCodigo ? 'tu-arr-codigo-error' : undefined} />
        {intento && errCodigo && <span id="tu-arr-codigo-error" className="tu-campo-error"><AlertCircle size={15} aria-hidden /> {errCodigo}</span>}
      </label>
      <label className="tu-campo" htmlFor="tu-arr-contacto">
        Email o celular
        <input id="tu-arr-contacto" type="text" value={contacto} onChange={e => setContacto(e.target.value)} placeholder="nombre@mail.com" autoComplete="email" autoCapitalize="none" maxLength={120}
          aria-invalid={intento && !!errContacto} aria-describedby={intento && errContacto ? 'tu-arr-contacto-error' : undefined} />
        {intento && errContacto && <span id="tu-arr-contacto-error" className="tu-campo-error"><AlertCircle size={15} aria-hidden /> {errContacto}</span>}
      </label>
      <div className="tu-dialogo-pie">
        <button type="button" className="tu-btn-sec" onClick={onCerrar} disabled={estado === 'enviando'}>Volver</button>
        <button type="submit" className="tu-btn" disabled={estado === 'enviando'} aria-busy={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Anular mi reserva'}</button>
      </div>
      <div className="tu-dialogo-nota"><Info size={15} aria-hidden /> <span>Vista previa: el pedido está simulado, no se anula ninguna reserva.</span></div>
    </form>
  )
}
