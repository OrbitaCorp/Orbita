// "Mi turno": lo que abre el enlace personal de un turno reservado en el
// sitio de un negocio real (<slug>.orbita.site/mi-turno/<token>, el mismo que
// va en los emails: RUTA_MI_RESERVA en apps/api/src/reservas). Sin cuenta: el
// token es la única llave. Semana 4 del plan de Turnos (tarea del 26/11).
//
// Arriba, en qué está el turno; después cuándo, con quién y cuánto sale; al
// final lo que se puede hacer según la política del negocio: cambiar el
// horario (otro día y otra hora con la misma persona y el mismo servicio) o
// cancelar, con confirmación porque no se deshace. Si la política no lo deja,
// se dice por qué con el texto de la API.
//
// Va con un marco propio y simple (el kit de reservas): no depende de la
// portada de Turnos, que todavía no tiene sus rutas de producción.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CalendarClock, Repeat, X } from 'lucide-react'
import { ReservasApiError, sitio } from '@/lib/reservasApi/cliente'
import type { Estado, MiReserva, SenaAlCancelar } from '@/lib/reservasApi/tipos'
import { fechaLarga, hhmm, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { Chip, Modal } from '@/design-system/reservas/piezas'
import { EstiloReservas } from '@/design-system/reservas/estilo'
import { ahoraArgentina } from '@/modules/turnos/datos/origen/mapear'

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

/** En qué está el turno, en palabras de quien reservó. */
export const ESTADO_TXT: Record<Estado, { titulo: string; tono?: 'ok' | 'aviso' | 'error' }> = {
  RETENIDA: { titulo: 'Sin terminar', tono: 'aviso' },
  PENDIENTE: { titulo: 'Esperando que el negocio lo confirme', tono: 'aviso' },
  CONFIRMADA: { titulo: 'Confirmado', tono: 'ok' },
  COMPLETADA: { titulo: 'Ya fuiste' },
  CANCELADA: { titulo: 'Cancelado', tono: 'error' },
  VENCIDA: { titulo: 'No se terminó de reservar', tono: 'error' },
  AUSENTE: { titulo: 'No fuiste', tono: 'error' },
}

/** Qué pasa con la seña si cancela ahora. */
export function senaAlCancelarTxt(s: SenaAlCancelar, sena: number, pagado: number): string {
  if (s === 'SIN_SENA' || sena <= 0 || pagado <= 0) return ''
  return s === 'DEVUELTA' ? `Si cancelás ahora, te devolvemos la seña de ${pesos(Math.min(sena, pagado))}.` : `Si cancelás ahora, la seña de ${pesos(Math.min(sena, pagado))} no se devuelve.`
}

const DIAS_PARA_ELEGIR = 21

export default function MiTurno({ slug, token }: { slug: string; token: string }) {
  const api = sitio(slug)
  const [estado, setEstado] = useState<{ datos: MiReserva | null; error: string | null }>({ datos: null, error: null })
  const [vuelta, setVuelta] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const [confirmarCancelar, setCancelandoConfirmar] = useState(false)
  const recargar = useCallback(() => setVuelta(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    sitio(slug).miReserva(token).then(
      datos => { if (vivo) setEstado({ datos, error: null }) },
      (e: unknown) => { if (vivo) setEstado({ datos: null, error: e instanceof ReservasApiError && e.status === 404 ? 'No encontramos ese turno. Revisá que el enlace esté completo.' : e instanceof Error && e.message ? e.message : 'No pudimos abrir tu turno.' }) },
    )
    return () => { vivo = false }
  }, [slug, token, vuelta])

  if (estado.error) return <Marco negocio={null}><p role="alert" className="rv-h3" style={{ margin: 0 }}>{estado.error}</p></Marco>
  if (!estado.datos) return <Marco negocio={null}><p aria-busy="true" style={{ margin: 0, color: 'var(--color-muted)' }}>Abriendo tu turno…</p></Marco>

  const { reserva: r, politica: p, recurso, negocio } = estado.datos
  const e = ESTADO_TXT[r.estado]
  const activo = r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE'
  const sena = senaAlCancelarTxt(p.senaSiCancela, r.sena, r.pagado)

  const cancelar = async () => {
    setCancelando(true)
    try {
      await api.cancelar(token)
      setAviso('Listo: cancelaste el turno. El horario quedó libre para otra persona.')
      recargar()
    } catch (err) {
      setAviso(err instanceof Error && err.message ? err.message : 'No pudimos cancelarlo. Probá de nuevo.')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <Marco negocio={negocio.nombre}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Chip tono={e.tono}>{e.titulo}</Chip>
        <span className="rv-num" style={{ fontSize: 13, color: 'var(--color-muted)' }}>Código {r.codigo}</span>
      </div>
      <h1 className="rv-h2" style={{ margin: '14px 0 4px' }}>{r.servicio?.nombre ?? 'Tu turno'}</h1>
      <p style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>
        {fechaLarga(r.fecha)} · <span className="rv-num">{hhmm(r.inicioMinutos)}</span>
        {recurso ? <> · con {recurso.nombre}</> : null}
      </p>

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', margin: '20px 0 0', fontSize: 14 }}>
        <dt style={{ color: 'var(--color-muted)' }}>Precio</dt><dd className="rv-num" style={{ margin: 0 }}>{r.precio > 0 ? pesos(r.precio) : 'Sin cargo'}</dd>
        {r.sena > 0 && <><dt style={{ color: 'var(--color-muted)' }}>Seña</dt><dd className="rv-num" style={{ margin: 0 }}>{pesos(r.sena)} · {r.pagado >= r.sena ? 'pagada' : 'a coordinar con el negocio'}</dd></>}
        {r.reprogramaciones > 0 && <><dt style={{ color: 'var(--color-muted)' }}>Cambios</dt><dd style={{ margin: 0 }}>Lo cambiaste {r.reprogramaciones === 1 ? '1 vez' : `${r.reprogramaciones} veces`}</dd></>}
      </dl>

      {aviso && <p role="status" style={{ margin: '20px 0 0', fontSize: 14, color: 'var(--color-text)' }}>{aviso}</p>}

      {activo && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {p.puedeReprogramar && r.servicioId ? (
            <button type="button" className="rv-btn" onClick={() => setMoviendo(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Repeat size={16} aria-hidden /> Cambiar el horario
            </button>
          ) : null}
          {p.puedeCancelar ? (
            <button type="button" className="rv-btn" onClick={() => setCancelandoConfirmar(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <X size={16} aria-hidden /> Cancelar el turno
            </button>
          ) : null}
          {(!p.puedeCancelar || !p.puedeReprogramar) && p.motivo && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-muted)' }}>{p.motivo}</p>}
        </div>
      )}

      {confirmarCancelar && (
        <Modal titulo="¿Cancelás el turno?" bajada={`${fechaLarga(r.fecha)} a las ${hhmm(r.inicioMinutos)}. No se puede deshacer.`} onCerrar={() => setCancelandoConfirmar(false)}
          pie={<>
            <button type="button" className="rv-btn" onClick={() => setCancelandoConfirmar(false)}>Volver</button>
            <button type="button" className="rv-btn rv-btn--primario" disabled={cancelando} onClick={() => { setCancelandoConfirmar(false); void cancelar() }}>Sí, cancelar</button>
          </>}>
          {sena ? <p style={{ margin: 0 }}>{sena}</p> : <p style={{ margin: 0 }}>El horario queda libre para otra persona.</p>}
        </Modal>
      )}

      {moviendo && r.servicioId && (
        <CambiarHorario slug={slug} token={token} recursoId={r.recursoId} servicioId={r.servicioId} actual={{ fecha: r.fecha, inicio: r.inicioMinutos }}
          restantes={p.reprogramacionesRestantes}
          onCerrar={() => setMoviendo(false)}
          onListo={(f, m) => { setMoviendo(false); setAviso(`Listo: tu turno pasó al ${fechaLarga(f).toLowerCase()} a las ${hhmm(m)}.`); recargar() }} />
      )}
    </Marco>
  )
}

/** Elegir otro día y otra hora: los libres de la misma agenda y el mismo servicio. */
function CambiarHorario({ slug, token, recursoId, servicioId, actual, restantes, onCerrar, onListo }: {
  slug: string; token: string; recursoId: string; servicioId: string; actual: { fecha: ISO; inicio: number }; restantes: number
  onCerrar: () => void; onListo: (fecha: ISO, inicio: number) => void
}) {
  const api = sitio(slug)
  const [dias, setDias] = useState<{ fecha: ISO; libres: number; cerrado: boolean }[] | null>(null)
  const [fecha, setFecha] = useState<ISO | null>(null)
  const [horas, setHoras] = useState<Record<ISO, number[]>>({})
  const [hora, setHora] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const { hoy } = ahoraArgentina()
    sitio(slug).disponibilidadRango({ modulo: 'TURNOS', recursoId, servicioId, desde: hoy, hasta: sumarDias(hoy, DIAS_PARA_ELEGIR - 1) }).then(
      r => { if (!vivo) return; setDias(r.dias); setFecha(f => f ?? r.dias.find(d => d.libres > 0)?.fecha ?? null) },
      (e: unknown) => { if (vivo) setError(e instanceof Error && e.message ? e.message : 'No pudimos traer los días.') },
    )
    return () => { vivo = false }
  }, [slug, recursoId, servicioId])

  useEffect(() => {
    if (!fecha || horas[fecha]) return
    let vivo = true
    sitio(slug).disponibilidad({ modulo: 'TURNOS', recursoId, servicioId, fecha }).then(
      d => { if (vivo) setHoras(h => ({ ...h, [fecha]: d.franjas.filter(f => f.libres > 0).map(f => f.inicioMinutos) })) },
      (e: unknown) => { if (vivo) setError(e instanceof Error && e.message ? e.message : 'No pudimos traer los horarios.') },
    )
    return () => { vivo = false }
  }, [slug, recursoId, servicioId, fecha, horas])

  const guardar = async () => {
    if (!fecha || hora === null) return
    setGuardando(true); setError(null)
    try {
      await api.reprogramar(token, { fecha, inicioMinutos: hora })
      onListo(fecha, hora)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No pudimos cambiarlo. Probá con otro horario.')
      // Si se ocupó en el medio, se vuelven a traer los horarios de ese día.
      if (e instanceof ReservasApiError && e.esConflicto) { setHora(null); setHoras(h => { const resto = { ...h }; delete resto[fecha]; return resto }) }
    } finally {
      setGuardando(false)
    }
  }

  const libresDelDia = fecha ? horas[fecha] : undefined
  return (
    <Modal titulo="Cambiar el horario" icono={<CalendarClock size={18} aria-hidden />}
      bajada={`Ahora: ${fechaLarga(actual.fecha)} a las ${hhmm(actual.inicio)}.${restantes ? ` Te ${restantes === 1 ? 'queda 1 cambio' : `quedan ${restantes} cambios`}.` : ''}`}
      onCerrar={onCerrar}
      pie={<>
        <button type="button" className="rv-btn" onClick={onCerrar}>Volver</button>
        <button type="button" className="rv-btn rv-btn--primario" disabled={!fecha || hora === null || guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Cambiar'}</button>
      </>}>
      {!dias && !error && <p aria-busy="true" style={{ margin: 0, color: 'var(--color-muted)' }}>Buscando días con lugar…</p>}
      {dias && (
        <div role="radiogroup" aria-label="Día" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {dias.map(d => {
            const sinLugar = d.cerrado || d.libres === 0
            return (
              <button key={d.fecha} type="button" role="radio" aria-checked={fecha === d.fecha} disabled={sinLugar}
                className={`rv-btn rv-btn--sm${fecha === d.fecha ? ' rv-btn--primario' : ''}`} style={{ flexShrink: 0, minHeight: 44 }}
                onClick={() => { setFecha(d.fecha); setHora(null) }}>
                {fechaLarga(d.fecha).split(' ').slice(0, 2).join(' ')}
              </button>
            )
          })}
        </div>
      )}
      {fecha && (
        <div role="radiogroup" aria-label="Hora" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {!libresDelDia && <p aria-busy="true" style={{ margin: 0, color: 'var(--color-muted)' }}>Buscando horarios…</p>}
          {libresDelDia?.length === 0 && <p style={{ margin: 0, color: 'var(--color-muted)' }}>Ese día ya no quedan horarios. Elegí otro.</p>}
          {libresDelDia?.map(m => (
            <button key={m} type="button" role="radio" aria-checked={hora === m} className={`rv-btn rv-btn--sm rv-num${hora === m ? ' rv-btn--primario' : ''}`} style={{ minHeight: 44 }} onClick={() => setHora(m)}>{hhmm(m)}</button>
          ))}
        </div>
      )}
      {error && <p role="alert" style={{ margin: '12px 0 0', color: 'var(--color-error)', fontSize: 13.5 }}>{error}</p>}
    </Modal>
  )
}

/** El marco de la página: el kit de reservas, con el nombre del negocio arriba. */
function Marco({ negocio, children }: { negocio: string | null; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface-alt)', padding: '32px 16px' }}>
      <EstiloReservas />
      <main style={{ maxWidth: 560, margin: '0 auto' }}>
        {negocio && <p className="rv-rotulo" style={{ margin: '0 0 12px' }}>{negocio}</p>}
        <section className="rv-card" style={{ padding: '24px 20px' }}>{children}</section>
      </main>
    </div>
  )
}
