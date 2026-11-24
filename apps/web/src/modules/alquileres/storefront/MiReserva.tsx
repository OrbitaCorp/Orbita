// "Mi reserva": lo que abre el enlace personal de una reserva hecha en el
// sitio de un negocio real (<slug>.orbita.site/mi-reserva/<token>, el mismo
// que va en los emails). Sin cuenta: el token es la única llave.
//
// Lo primero que se lee es en qué está la reserva y qué falta hacer; después
// el detalle y la plata; al final lo que se puede hacer: cancelar si la
// política del negocio lo permite (con confirmación, porque no se deshace),
// escribirle al negocio y agendarla. Cambiar las fechas todavía no se hace
// desde acá: se le pide al negocio.
//
// Funciona aunque el sitio del negocio no se pueda cargar (reservas en pausa):
// en ese caso se dibuja con un marco mínimo, con el nombre que trae la reserva.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CalendarPlus, ChevronLeft, MessageCircle } from 'lucide-react'
import { ReservasApiError, sitio } from '@/lib/reservasApi/cliente'
import type { Estado, MiReserva as MiReservaApi, SenaAlCancelar } from '@/lib/reservasApi/tipos'
import { fechaLarga, hhmm, rangoTxt } from '@/lib/reservas/fechas'
import { nochesEntre } from '@/lib/reservas/estadia'
import { pesos } from '@/lib/reservas/precio'
import { descargarICS, generarICS } from '@/lib/reservas/ics'
import { Chip, Modal } from '@/design-system/reservas/piezas'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { nochesTxt, type NegocioAlquiler } from '../datos'
import { fechaArgentina } from '../datos/origen/mapear'
import { linkWhatsApp } from '../datos/textos'
import Sitio, { CSS_SITIO } from './Sitio'
import { CSS_RESERVA } from './Reserva'
import { useSitio } from './rutas'

interface P {
  slug: string
  token: string
  /** El negocio ya cargado para el sitio; null si no se pudo (se dibuja con un marco mínimo). */
  negocio: NegocioAlquiler | null
}

const ESTADO: Record<Estado, { texto: string; tono: 'ok' | 'aviso' | 'error' | 'gris' }> = {
  RETENIDA: { texto: 'Sin terminar', tono: 'aviso' },
  PENDIENTE: { texto: 'Pendiente de confirmación', tono: 'aviso' },
  CONFIRMADA: { texto: 'Confirmada', tono: 'ok' },
  COMPLETADA: { texto: 'Finalizada', tono: 'gris' },
  CANCELADA: { texto: 'Cancelada', tono: 'error' },
  VENCIDA: { texto: 'Vencida', tono: 'gris' },
  AUSENTE: { texto: 'No se presentó', tono: 'gris' },
}

const SENA_AL_CANCELAR: Record<SenaAlCancelar, string> = {
  DEVUELTA: 'Si cancelás ahora, te devuelven la seña.',
  PERDIDA: 'Si cancelás ahora, la seña no se devuelve.',
  SIN_SENA: '',
}

const SENA_EN_EL_MODAL: Record<SenaAlCancelar, string> = { DEVUELTA: 'Te devuelven la seña.', PERDIDA: 'La seña que pagaste no se devuelve.', SIN_SENA: '' }

/** Los minutos del día, en Argentina, de un instante ISO. */
const minutosArgentina = (iso: string) => { const d = new Date(Date.parse(iso) - 3 * 60 * 60 * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes() }

export default function MiReserva({ slug, token, negocio }: P) {
  const { ruta } = useSitio()
  const [datos, setDatos] = useState<MiReservaApi | null>(null)
  const [error, setError] = useState<{ texto: string; noExiste: boolean } | null>(null)
  const [preguntando, setPreguntando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [falloCancelar, setFalloCancelar] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vigente = true
    sitio(slug).miReserva(token).then(
      d => { if (vigente) { setDatos(d); setError(null) } },
      e => { if (vigente) setError(e instanceof ReservasApiError ? { texto: e.message, noExiste: e.status === 404 } : { texto: 'No pudimos conectarnos. Revisá tu conexión.', noExiste: false }) },
    )
    return () => { vigente = false }
  }, [slug, token, vuelta])

  const reintentar = useCallback(() => { setError(null); setVuelta(v => v + 1) }, [])
  const cerrar = useCallback(() => { setPreguntando(false); setFalloCancelar(null) }, [])
  const nombreNegocio = negocio?.nombre ?? datos?.negocio.nombre ?? ''
  const inicio = ruta('inicio', 'estadia')

  if (error && !datos) {
    return (
      <Marco negocio={negocio} nombre={nombreNegocio} inicio={inicio}>
        <div className="rv-card rv-card--pad" style={{ textAlign: 'center', padding: 28 }}>
          <h1 className="rv-h1" style={{ fontSize: 24 }}>{error.noExiste ? 'No encontramos esa reserva' : 'No pudimos abrir tu reserva'}</h1>
          <p className="rv-bajada" role="alert" style={{ margin: '10px auto 0' }}>{error.noExiste ? 'Revisá que el enlace esté completo: tiene que ser el mismo que te llegó al reservar.' : error.texto}</p>
          <div className="rv-fila" style={{ justifyContent: 'center', marginTop: 18 }}>
            {!error.noExiste && <button type="button" className="rv-btn rv-btn--primario" onClick={reintentar}>Probar de nuevo</button>}
            <Link href={inicio} className="rv-btn">Ir al inicio</Link>
          </div>
        </div>
      </Marco>
    )
  }

  if (!datos) {
    return (
      <Marco negocio={negocio} nombre={nombreNegocio} inicio={inicio}>
        <div className="rv-card rv-card--pad" role="status" aria-live="polite" style={{ textAlign: 'center', padding: 40, color: 'var(--color-muted)' }}>Buscando tu reserva…</div>
      </Marco>
    )
  }

  const { reserva: r, politica, recurso } = datos
  const entrada = r.fecha
  const salida = fechaArgentina(r.fin)
  const noches = nochesEntre(entrada, salida)
  const huespedes = typeof r.datos?.huespedes === 'number' ? r.datos.huespedes : 0
  const activa = r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA' || r.estado === 'RETENIDA'
  const faltaSena = r.estado === 'PENDIENTE' && r.sena > 0 && r.pagado < r.sena
  const estado = ESTADO[r.estado]
  const propiedad = negocio?.propiedades.find(p => p.id === r.recursoId)
  const donde = [propiedad?.direccion || negocio?.direccion, propiedad?.ciudad || negocio?.ciudad].filter(Boolean).join(', ')
  const wa = negocio ? linkWhatsApp(negocio.telefono, `Hola, te escribo por la reserva ${r.codigo} en ${nombreNegocio}: ${recurso?.nombre ?? ''}, ${rangoTxt(entrada, salida)}.`) : null
  const alias = negocio?.pagos.alias ?? ''

  const bajada = r.estado === 'CANCELADA' ? `Esta reserva se canceló${r.canceladaPor === 'NEGOCIO' ? ` desde ${nombreNegocio}` : ''}. Las fechas volvieron a quedar libres.`
    : faltaSena ? `Las fechas están tomadas a tu nombre. ${nombreNegocio} la confirma cuando reciba la seña de ${pesos(r.sena - r.pagado)}.`
      : r.estado === 'PENDIENTE' ? `Las fechas están tomadas a tu nombre. ${nombreNegocio} te la confirma a la brevedad.`
        : r.estado === 'CONFIRMADA' ? `Te esperamos en ${nombreNegocio}.`
          : r.estado === 'COMPLETADA' ? `Gracias por quedarte en ${nombreNegocio}.` : ''

  const cancelar = () => {
    setCancelando(true)
    setFalloCancelar(null)
    sitio(slug).cancelar(token, { version: r.version }).then(
      res => {
        setPreguntando(false)
        setAviso(`Reserva cancelada.${res.sena === 'DEVUELTA' ? ` ${nombreNegocio} te devuelve la seña.` : res.sena === 'PERDIDA' ? ' La seña no se devuelve.' : ''}`)
        setVuelta(v => v + 1)
      },
      e => setFalloCancelar(e instanceof ReservasApiError ? e.message : 'No pudimos conectarnos. Probá de nuevo.'),
    ).finally(() => setCancelando(false))
  }
  const calendario = () => descargarICS(generarICS([{ uid: `${r.id}@orbita`, titulo: `${recurso?.nombre ?? nombreNegocio} · ${nombreNegocio}`, fecha: entrada, hasta: salida, lugar: donde }], { nombre: nombreNegocio }), `reserva-${r.codigo}`)

  return (
    <Marco negocio={negocio} nombre={nombreNegocio} inicio={inicio}>
      {aviso && <p className="alm-aviso" role="status">{aviso}</p>}
      <div className="rv-card rv-card--pad rv-entra" style={{ padding: 24 }}>
        <Chip tono={estado.tono}>{estado.texto}</Chip>
        <Titulo>{recurso?.nombre ?? nombreNegocio}</Titulo>
        {bajada && <p className="rv-bajada" style={{ margin: '8px 0 0' }}>{bajada}</p>}

        {faltaSena && (
          <div className="alr-sena">
            <b>Cómo pagar la seña</b>
            {alias
              ? <p>Transferí <span className="rv-num">{pesos(r.sena - r.pagado)}</span> al alias <span className="rv-num">{alias}</span>{negocio?.pagos.titular ? ` (${negocio.pagos.titular})` : ''}{wa ? ' y mandá el comprobante por WhatsApp.' : '.'}</p>
              : <p>{wa ? `Escribile a ${nombreNegocio} por WhatsApp y te pasa los datos para transferir.` : `${nombreNegocio} se va a comunicar con vos para coordinarla.`}</p>}
          </div>
        )}

        <dl className="alr-ticket" style={{ marginTop: 20 }}>
          <div><dt>Código</dt><dd className="rv-num">{r.codigo}</dd></div>
          <div><dt>Entrada</dt><dd>{fechaLarga(entrada)}, desde las {hhmm(r.inicioMinutos)}</dd></div>
          <div><dt>Salida</dt><dd>{fechaLarga(salida)}, hasta las {hhmm(minutosArgentina(r.fin))}</dd></div>
          <div><dt>Estadía</dt><dd>{nochesTxt(noches)}</dd></div>
          {donde && <div><dt>Dónde</dt><dd>{donde}</dd></div>}
          {huespedes > 0 && <div><dt>Huéspedes</dt><dd>{huespedes}</dd></div>}
          {r.notas && <div><dt>Tu nota</dt><dd>{r.notas}</dd></div>}
        </dl>
        <dl className="alr-ticket alm-plata">
          <div><dt>Total</dt><dd className="rv-num">{pesos(r.precio)}</dd></div>
          {r.sena > 0 && <div><dt>Seña</dt><dd className="rv-num">{pesos(r.sena)}{r.pagado >= r.sena ? ' · pagada' : ''}</dd></div>}
          {r.pagado > 0 && <div><dt>Pagaste</dt><dd className="rv-num">{pesos(r.pagado)}</dd></div>}
          {activa && r.precio > r.pagado && <div><dt>Queda por pagar</dt><dd className="rv-num">{pesos(r.precio - r.pagado)}</dd></div>}
        </dl>

        {activa && (
          <p className="rv-ayuda" style={{ margin: '16px 0 0' }}>
            {politica.puedeCancelar
              ? <>{politica.cancelarHasta ? `Podés cancelarla hasta el ${fechaLarga(fechaArgentina(politica.cancelarHasta)).toLowerCase()} a las ${hhmm(minutosArgentina(politica.cancelarHasta))}. ` : ''}{SENA_AL_CANCELAR[politica.senaSiCancela]}</>
              : politica.motivo}
            {' '}Para cambiar las fechas, escribile a {nombreNegocio}.
          </p>
        )}

        <div className="rv-fila" style={{ marginTop: 18 }}>
          {wa && <a className="rv-btn rv-btn--primario" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> Escribir por WhatsApp</a>}
          {activa && <button type="button" className="rv-btn" onClick={calendario}><CalendarPlus size={16} aria-hidden /> Agregar al calendario</button>}
          {activa && politica.puedeCancelar && <button type="button" className="rv-btn rv-btn--peligro" onClick={() => setPreguntando(true)}>Cancelar la reserva</button>}
          {!activa && <Link href={ruta('reserva', 'estadia')} className="rv-btn rv-btn--primario">Hacer otra reserva</Link>}
        </div>
      </div>

      {preguntando && (
        <Modal titulo="¿Cancelar la reserva?" onCerrar={cerrar} ancho={440}
          bajada={`${recurso?.nombre ?? nombreNegocio} · ${rangoTxt(entrada, salida)}`}
          pie={<>
            {/* El foco arranca en "No": un Enter por reflejo no cancela nada. */}
            <button type="button" className="rv-btn" onClick={cerrar} disabled={cancelando} autoFocus>No, la dejo</button>
            <button type="button" className="rv-btn rv-btn--peligro" onClick={cancelar} disabled={cancelando} aria-busy={cancelando}>{cancelando ? 'Cancelando…' : 'Sí, cancelar'}</button>
          </>}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>Las fechas vuelven a quedar libres y no se puede deshacer. {SENA_EN_EL_MODAL[politica.senaSiCancela]}</p>
          {falloCancelar && <p className="rv-error" role="alert" style={{ margin: '12px 0 0' }}>{falloCancelar}</p>}
        </Modal>
      )}
    </Marco>
  )
}

/** El título recibe el foco al llegar: un lector de pantalla anuncia de qué reserva se trata. */
function Titulo({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus({ preventScroll: true }) }, [])
  return <h1 ref={ref} tabIndex={-1} className="rv-h1" style={{ fontSize: 26, marginTop: 12, outline: 'none' }}>{children}</h1>
}

const CSS_MI = `
  .alm { max-width: 640px; padding-top: 28px; }
  .alm-plata { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--color-border); }
  .alm-aviso { margin: 0 0 14px; padding: 12px 14px; border-radius: 12px; background: var(--color-success-bg); color: var(--chip-success-fg); font-size: 14px; font-weight: 600; }
  .alm-cabecera { display: flex; align-items: center; min-height: 64px; border-bottom: 1px solid var(--color-border); }
  .alm-cabecera b { font-size: 15px; color: var(--color-text); }
  .alm .rv-fila { flex-wrap: wrap; }
  @media (max-width: 480px) { .alm .rv-fila .rv-btn { flex: 1 1 100%; } }
`

/** El sitio del negocio alrededor; si no se pudo cargar, un marco mínimo con su nombre. */
function Marco({ negocio, nombre, inicio, children }: { negocio: NegocioAlquiler | null; nombre: string; inicio: string; children: ReactNode }) {
  const volver = <div style={{ marginBottom: 12 }}><Link href={inicio} className="als-link"><ChevronLeft size={15} aria-hidden /> Inicio</Link></div>
  if (negocio) {
    return (
      <Sitio negocio={negocio} pagina="mis-reservas">
        <style>{CSS_RESERVA}{CSS_MI}</style>
        <div className="als-cont alm">{volver}{children}</div>
      </Sitio>
    )
  }
  return (
    <div className="rv als" data-tipo="estadia" data-real>
      <EstiloReservas />
      <style>{CSS_SITIO}{CSS_RESERVA}{CSS_MI}</style>
      <header className="als-cont alm-cabecera"><b>{nombre}</b></header>
      <main className="als-main"><div className="als-cont alm">{children}</div></main>
    </div>
  )
}
