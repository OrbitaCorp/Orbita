// WhatsApp e Instagram del negocio, simulados. La demo es pública y los
// teléfonos y usuarios de los negocios son inventados: un wa.me le escribiría a
// una persona real y un link a instagram.com mostraría la cuenta de otro
// negocio que se llame igual. Mismo criterio que la tienda demo
// (lib/demo/whatsapp.ts): nada sale de la página. Se abre una ventana que
// muestra lo que pasaría en el sitio de verdad.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarCheck, Check, CheckCheck, Info, SendHorizontal } from 'lucide-react'
import { horaTxt, type RubroTurnos } from '@/modules/turnos/datos'
import { Dialogo, Marca, ruta, useForma } from './piezas'
import { useReloj } from '@/modules/turnos/reloj'
import { altFoto, type TemaNegocio } from './tema'

export type Contacto = { canal: 'whatsapp'; texto: string } | { canal: 'instagram' }

const ContactoDemo = createContext<(c: Contacto) => void>(() => {})
export const ContactoProvider = ContactoDemo.Provider
/** Abre el WhatsApp o el Instagram (simulados) del negocio. Lo provee SitioNegocio. */
export const useContacto = () => useContext(ContactoDemo)

export function DialogoContacto({ c, t, rubro, onCerrar }: { c: Contacto; t: TemaNegocio; rubro: RubroTurnos; onCerrar: () => void }) {
  return c.canal === 'whatsapp'
    ? <WhatsApp texto={c.texto} t={t} rubro={rubro} onCerrar={onCerrar} />
    : <Instagram t={t} onCerrar={onCerrar} />
}

function Nota({ children }: { children: ReactNode }) {
  return <div className="tu-dialogo-nota"><Info size={15} aria-hidden /> <span>{children}</span></div>
}

function WhatsApp({ texto, t, rubro, onCerrar }: { texto: string; t: TemaNegocio; rubro: RubroTurnos; onCerrar: () => void }) {
  const [borrador, setBorrador] = useState(texto)
  const [enviados, setEnviados] = useState<string[]>([])
  const [respondio, setRespondio] = useState(false)
  const forma = useForma()
  const { minutos } = useReloj()
  // La respuesta automática llega un momento después, como en un chat de verdad (una sola vez).
  useEffect(() => {
    if (!enviados.length || respondio) return
    const espera = setTimeout(() => setRespondio(true), 1100)
    return () => clearTimeout(espera)
  }, [enviados.length, respondio])

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const txt = borrador.trim()
    if (!txt) return
    setEnviados(v => [...v, txt])
    setBorrador('')
  }
  const reservar = rubro.modo === 'cupo' ? 'Reservar lugar' : rubro.modo === 'cancha' ? 'Reservar cancha' : 'Reservar turno'
  const hora = horaTxt(minutos)
  return (
    <Dialogo titulo="WhatsApp" onCerrar={onCerrar}>
      <div className="tu-wa">
        <div className="tu-wa-cab">
          <Marca t={t} />
          <span style={{ minWidth: 0 }}>
            <b>{t.nombre}</b>
            <span className="tu-wa-estado">{enviados.length && !respondio ? 'escribiendo…' : 'en línea'}</span>
          </span>
        </div>
        <div className="tu-wa-chat" role="log" aria-live="polite" aria-label={`Chat con ${t.nombre}`}>
          {!enviados.length && <div className="tu-wa-aviso">Escribí tu consulta y tocá enviar.</div>}
          {enviados.map((m, i) => (
            <div key={i} className="tu-wa-msj" data-yo>
              {m}
              <span className="tu-wa-hora"><span className="tu-num">{hora}</span> <CheckCheck size={14} aria-label="Enviado" /></span>
            </div>
          ))}
          {respondio && (
            <div className="tu-wa-msj">
              ¡Hola! Gracias por escribir a {t.nombre}. Te contestamos apenas podamos. Si ya sabés qué querés, reservá online y elegí el horario vos.
              <span className="tu-wa-hora"><span className="tu-num">{hora}</span></span>
            </div>
          )}
        </div>
        <form className="tu-wa-escribir" onSubmit={enviar}>
          <input value={borrador} onChange={e => setBorrador(e.target.value)} placeholder="Escribí un mensaje" aria-label="Mensaje" autoComplete="off" />
          <button type="submit" aria-label="Enviar mensaje" disabled={!borrador.trim()}><SendHorizontal size={18} aria-hidden /></button>
        </form>
      </div>
      {respondio && (
        <div className="tu-dialogo-pie">
          <Link href={ruta('reserva', rubro.key, { forma })} className="tu-btn" onClick={onCerrar}><CalendarCheck size={17} aria-hidden /> {reservar}</Link>
        </div>
      )}
      <Nota>Vista previa: en tu sitio, este botón abre el WhatsApp de tu negocio. En la demo no se envía nada.</Nota>
    </Dialogo>
  )
}

function Instagram({ t, onCerrar }: { t: TemaNegocio; onCerrar: () => void }) {
  const [sigue, setSigue] = useState(false)
  const todas = [t.fotoHero, ...t.galeria.filter(f => f !== t.fotoHero)]
  // Filas completas de tres, como la grilla de Instagram.
  const fotos = todas.slice(0, todas.length >= 6 ? 6 : 3)
  return (
    <Dialogo titulo="Instagram" onCerrar={onCerrar}>
      <div className="tu-ig">
        <div className="tu-ig-cab">
          <Marca t={t} className="tu-ig-avatar" />
          <div style={{ minWidth: 0 }}>
            <b className="tu-ig-usuario">{t.instagram}</b>
            <span className="tu-ig-nombre">{t.nombre}</span>
            <div className="tu-ig-numeros">
              <span><b className="tu-num">{fotos.length * 21}</b> publicaciones</span>
              <span><b className="tu-num">{sigue ? '3.483' : '3.482'}</b> seguidores</span>
            </div>
          </div>
        </div>
        <p className="tu-ig-bio">{t.tagline.replace(/\.$/, '')}.{t.direccion ? ` ${[t.direccion, t.barrio].filter(Boolean).join(', ')}.` : ''}</p>
        <button type="button" className={sigue ? 'tu-btn-sec' : 'tu-btn'} aria-pressed={sigue} onClick={() => setSigue(s => !s)}>
          {sigue ? <><Check size={16} aria-hidden /> Siguiendo</> : 'Seguir'}
        </button>
        <ul className="tu-ig-grilla" aria-label="Publicaciones">
          {/* eslint-disable-next-line @next/next/no-img-element -- demo local */}
          {fotos.map(f => <li key={f}><img src={f} alt={altFoto(f)} loading="lazy" /></li>)}
        </ul>
      </div>
      <Nota>Vista previa: en tu sitio, este link abre el Instagram de tu negocio.</Nota>
    </Dialogo>
  )
}
