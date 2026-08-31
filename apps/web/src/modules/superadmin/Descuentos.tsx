import { useCallback, useEffect, useState } from 'react'
import { Plus, Copy, Check, AlertTriangle, Mail, Loader2 } from 'lucide-react'
import {
  platformApi,
  type DiscountCodeRow,
  type DiscountCodeDetail,
  type DiscountCodeEstado,
} from '@/lib/platform/api'
import { Toast, type ToastVariant } from '@/design-system/components/Toast'
import {
  useFetch, Card, Table, Chip, Loader, ErrorBox, Empty, PageHeader,
  ModalShell, Field, ConfirmModal, money, date, dateTime,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// Códigos de descuento que Órbita le hace a un negocio sobre SU suscripción,
// para cerrar un trato puntual. El descuento se aplica en el checkout del
// wizard (ver subscriptions.service.ts) y queda registrado quién lo usó.

const TONO_ESTADO: Record<DiscountCodeEstado, 'green' | 'gray' | 'amber' | 'red'> = {
  ACTIVO: 'green',
  DESACTIVADO: 'gray',
  VENCIDO: 'amber',
  AGOTADO: 'amber',
}
const LABEL_ESTADO: Record<DiscountCodeEstado, string> = {
  ACTIVO: 'Activo',
  DESACTIVADO: 'Desactivado',
  VENCIDO: 'Vencido',
  AGOTADO: 'Sin usos',
}

type Aviso = { variant: ToastVariant; title: string; description?: string }

export function TabDescuentos() {
  const [reloadKey, setReloadKey] = useState(0)
  const [creando, setCreando] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const { data, error } = useFetch(() => platformApi.discountCodes(), [reloadKey])
  const recargar = useCallback(() => setReloadKey((k) => k + 1), [])

  // Los usos NO suben desde esta pantalla: suben cuando alguien canjea el
  // codigo en el alta. Sin esto, el contador quedaba clavado en lo que habia
  // al abrir la seccion y habia que recargar a mano para enterarse.
  //
  // Se refresca al volver a la pestaña y cada 30s, pero solo con la pestaña
  // visible: en segundo plano no hay nadie mirando y seria pegarle a la API al
  // pedo. `useFetch` no borra los datos viejos mientras recarga, asi que el
  // refresco es invisible (no parpadea la tabla).
  useEffect(() => {
    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    const timer = setInterval(refrescarSiVisible, 30_000)
    window.addEventListener('focus', refrescarSiVisible)
    document.addEventListener('visibilitychange', refrescarSiVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refrescarSiVisible)
      document.removeEventListener('visibilitychange', refrescarSiVisible)
    }
  }, [recargar])

  // Los avisos de exito se van solos; los de error se quedan hasta que el
  // admin los cierre, porque suelen pedir que haga algo.
  useEffect(() => {
    if (!aviso || aviso.variant === 'error') return
    const t = setTimeout(() => setAviso(null), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Códigos de descuento"
        subtitle="Descuentos sobre la suscripción a Órbita, para cerrar un trato puntual. El código se usa al momento de pagar, en el último paso del alta."
        action={
          <button onClick={() => setCreando(true)} className="ds-hover" style={btnPrimary}>
            <Plus size={16} strokeWidth={2} /> Nuevo código
          </button>
        }
      />

      {error ? (
        <ErrorBox msg="No se pudieron cargar los códigos de descuento." />
      ) : !data ? (
        <Loader />
      ) : data.length === 0 ? (
        <Card>
          <Empty text="Todavía no creaste ningún código. Con el botón de arriba armás el primero." />
        </Card>
      ) : (
        <Card noPad>
          <Table
            head={['Código', 'Descuento', 'Usos', 'Estado', 'Vence', 'Para qué', 'Creado por']}
            alignRight={[1, 2]}
            rows={data.map((c) => ({
              key: c.id,
              onClick: () => setDetalleId(c.id),
              cells: [
                <span key="c" style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.03em' }}>{c.code}</span>,
                <span key="p" style={{ fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{c.percentOff}%</span>,
                <Usos key="u" usados={c.usedCount} tope={c.maxUses} />,
                <Chip key="e" text={LABEL_ESTADO[c.estado]} tone={TONO_ESTADO[c.estado]} dot />,
                c.expiresAt ? date(c.expiresAt) : <span key="v" style={{ color: 'var(--color-subtle)' }}>Sin vencimiento</span>,
                c.note ?? <span key="n" style={{ color: 'var(--color-subtle)' }}>-</span>,
                c.createdBy ?? <span key="cb" style={{ color: 'var(--color-subtle)' }}>-</span>,
              ],
            }))}
          />
        </Card>
      )}

      {creando && (
        <ModalNuevoCodigo
          onClose={() => setCreando(false)}
          onCreado={(code) => {
            setCreando(false)
            recargar()
            setAviso({ variant: 'success', title: `Código ${code} creado` })
          }}
        />
      )}
      {detalleId && (
        <ModalDetalle
          id={detalleId}
          onClose={() => setDetalleId(null)}
          onCambio={recargar}
          onAviso={setAviso}
        />
      )}

      {aviso && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
          <Toast variant={aviso.variant} title={aviso.title} description={aviso.description} onClose={() => setAviso(null)} />
        </div>
      )}
    </div>
  )
}

// "3 de 10" dice mucho más que un número suelto: se ve de una cuánto queda.
function Usos({ usados, tope }: { usados: number; tope: number | null }) {
  return (
    <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)' }}>
      {usados}
      <span style={{ color: 'var(--color-subtle)' }}>{tope === null ? ' / sin tope' : ` / ${tope}`}</span>
    </span>
  )
}

function ModalNuevoCodigo({ onClose, onCreado }: { onClose: () => void; onCreado: (code: string) => void }) {
  // Mercado Pago no cobra por debajo de un minimo, asi que hay un techo real
  // para el porcentaje. Se consulta para poder avisarlo MIENTRAS se escribe:
  // enterarse al guardar (o peor, cuando el dueño va a pagar) es tardisimo.
  const { data: limites } = useFetch(() => platformApi.discountLimits(), [])
  const [code, setCode] = useState('')
  const [percentOff, setPercentOff] = useState('20')
  const [sinTope, setSinTope] = useState(false)
  const [maxUses, setMaxUses] = useState('1')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // El 100% queda SIEMPRE permitido aunque el plan valga lo mismo que el
  // minimo: esa alta no pasa por MP, crea el negocio con una cortesia.
  const pctActual = Number(percentOff)
  const sinDescuentosParciales = !!limites && limites.maxPercentOff < 1
  const excedeTope = !!limites && pctActual !== 100 && Number.isInteger(pctActual) && pctActual > limites.maxPercentOff
  // null mientras no se sepa el precio, o si el porcentaje todavia no es un
  // numero usable: mejor no mostrar nada que mostrar "$NaN".
  const precioResultante = !limites || !Number.isInteger(pctActual) || pctActual < 1 || pctActual > 100
    ? null
    : {
        antes: money(limites.amountBase),
        despues: pctActual === 100 ? 'Gratis' : money(Math.round(limites.amountBase * (1 - pctActual / 100) * 100) / 100),
      }
  const mensajeTope = !limites
    ? ''
    : sinDescuentosParciales
      ? `El plan cuesta $${limites.amountBase} y Mercado Pago no cobra menos de $${limites.minAmount}, así que hoy ningún descuento parcial se puede cobrar. Solo se puede crear uno del 100%.`
      : `Con ${pctActual}% el plan queda en $${Math.round(limites.amountBase * (1 - pctActual / 100) * 100) / 100} y Mercado Pago no cobra menos de $${limites.minAmount}. El máximo es ${limites.maxPercentOff}%, o 100% para regalarlo.`

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const pct = Number(percentOff)
    if (!code.trim()) { setError('Escribí el código.'); return }
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) { setError('El descuento tiene que ser un número entero entre 1 y 100.'); return }
    if (excedeTope) { setError(mensajeTope); return }
    if (!sinTope && (!Number.isInteger(Number(maxUses)) || Number(maxUses) < 1)) { setError('La cantidad de usos tiene que ser 1 o más.'); return }

    setGuardando(true)
    try {
      await platformApi.createDiscountCode({
        code: code.trim(),
        percentOff: pct,
        maxUses: sinTope ? null : Number(maxUses),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        note: note.trim() || null,
      })
      onCreado(code.trim().toUpperCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el código.')
      setGuardando(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title="Nuevo código de descuento">
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <ErrorBox msg={error} />}

        <Field label="Código" hint="Lo que va a tipear el cliente al pagar. Se guarda en mayúsculas.">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AMIGOS2026"
            className="ds-field"
            style={{ ...inputStyle, fontFamily: '"Geist Mono", monospace', letterSpacing: '0.05em' }}
          />
        </Field>

        <Field label="Descuento" hint="Porcentaje sobre el precio de la suscripción, en cada cobro.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="number" min={1} max={100}
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              className="ds-field"
              style={{ ...inputStyle, width: 110 }}
            />
            <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>% menos</span>
            {/* El precio resultante, al lado y en vivo: el porcentaje solo no
                dice nada, lo que importa es en cuanto le queda la suscripcion
                al negocio. */}
            {precioResultante && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 2,
                fontSize: 13, color: 'var(--color-body)',
              }}>
                <span style={{ color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>
                  {precioResultante.antes}
                </span>
                <span style={{ color: 'var(--color-subtle)' }}>&rarr;</span>
                <strong style={{ color: excedeTope ? 'var(--color-error)' : 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                  {precioResultante.despues}
                </strong>
                <span style={{ color: 'var(--color-subtle)', fontSize: 12 }}>por período</span>
              </span>
            )}
          </div>
        </Field>

        {/* Se pasó del techo que Mercado Pago puede cobrar. Se avisa acá y se
            bloquea el botón: si no, el código se crea igual y el que se come el
            error es el dueño, recién al apretar Pagar. */}
        {excedeTope && (
          <div style={{
            display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 10,
            background: 'var(--color-error-bg)', border: '1px solid var(--color-error)',
          }}>
            <AlertTriangle size={15} strokeWidth={2} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>{mensajeTope}</span>
          </div>
        )}

        {/* El 100% no es "un descuento más grande": cambia el alta entera (no
            pasa por Mercado Pago y regala una cuenta). Se avisa mientras se
            está por crear el código, no después. */}
        {Number(percentOff) === 100 && (
          <div style={{
            display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 10,
            background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)',
          }}>
            <AlertTriangle size={15} strokeWidth={2} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
              Con 100% el alta es <strong>gratis</strong>: no pasa por Mercado Pago y el negocio queda con
              una licencia de cortesía. Cada uso disponible de este código regala una cuenta, así que
              limitá bien los usos y a quién se lo pasás.
            </span>
          </div>
        )}

        <Field label="Cuántas veces se puede usar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="number" min={1}
              value={maxUses}
              disabled={sinTope}
              onChange={(e) => setMaxUses(e.target.value)}
              className="ds-field"
              style={{ ...inputStyle, width: 110, opacity: sinTope ? 0.5 : 1 }}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--color-body)', cursor: 'pointer' }}>
              <input type="checkbox" checked={sinTope} onChange={(e) => setSinTope(e.target.checked)} />
              Sin límite
            </label>
          </div>
        </Field>

        <Field label="Vence el (opcional)" hint="Si lo dejás vacío, no vence nunca.">
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="ds-field" style={inputStyle} />
        </Field>

        <Field label="Para qué es (opcional)" hint="Queda a la vista del equipo, para acordarse del trato.">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: canje por difusión en redes"
            className="ds-field"
            style={inputStyle}
          />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button
            type="submit"
            disabled={guardando || excedeTope}
            className="ds-hover"
            style={{ ...btnPrimary, ...(excedeTope ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
          >
            {guardando ? 'Creando…' : 'Crear código'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalDetalle({ id, onClose, onCambio, onAviso }: {
  id: string
  onClose: () => void
  onCambio: () => void
  onAviso: (a: Aviso) => void
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [confirmando, setConfirmando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const { data, error } = useFetch(() => platformApi.discountCode(id), [id, reloadKey])

  async function copiar(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* si el navegador lo bloquea, el código igual está a la vista */
    }
  }

  return (
    <>
      <ModalShell onClose={onClose} title={data ? `Código ${data.code}` : 'Código'}>
        {error ? (
          <ErrorBox msg="No se pudo cargar el código." />
        ) : !data ? (
          <Loader />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Chip text={LABEL_ESTADO[data.estado]} tone={TONO_ESTADO[data.estado]} dot />
              <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>{data.percentOff}% de descuento</span>
              <button onClick={() => copiar(data.code)} className="ds-hover" style={{ ...btnGhostSm, marginLeft: 'auto' }}>
                {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar código</>}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <Dato label="Veces usado" valor={data.maxUses === null ? `${data.usedCount} (sin tope)` : `${data.usedCount} de ${data.maxUses}`} />
              <Dato label="Vence" valor={data.expiresAt ? date(data.expiresAt) : 'No vence'} />
              <Dato label="Creado" valor={date(data.createdAt)} />
            </div>

            {data.note && (
              <div style={{ fontSize: 13.5, color: 'var(--color-body)', background: 'var(--color-surface)', borderRadius: 10, padding: '10px 12px' }}>
                {data.note}
              </div>
            )}

            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>
                Quién lo usó
              </div>
              {data.redemptions.length === 0 ? (
                <Empty text="Todavía no lo usó nadie." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {data.redemptions.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                      <span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{r.businessName ?? r.email}</span>
                        {r.businessName && <span style={{ color: 'var(--color-muted)' }}> · {r.email}</span>}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>{money(r.amountBase)}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{money(r.amountFinal)}</span>
                        <span style={{ color: 'var(--color-subtle)', fontSize: 12 }}>{dateTime(r.createdAt)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <EnviarPorMail id={id} code={data.code} onAviso={onAviso} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} className="ds-hover" style={btnGhost}>Cerrar</button>
              {data.isActive ? (
                <button onClick={() => setConfirmando(true)} className="ds-hover" style={{ ...btnGhost, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await platformApi.updateDiscountCode(id, { isActive: true })
                      setReloadKey((k) => k + 1)
                      onCambio()
                      onAviso({ variant: 'success', title: `Código ${data.code} reactivado` })
                    } catch (err) {
                      onAviso({ variant: 'error', title: 'No se pudo reactivar', description: err instanceof Error ? err.message : undefined })
                    }
                  }}
                  className="ds-hover"
                  style={btnPrimary}
                >
                  Reactivar
                </button>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      {confirmando && data && (
        <ConfirmModal
          title={`¿Desactivar el código ${data.code}?`}
          body="Deja de funcionar al instante para altas nuevas. Los negocios que ya lo usaron mantienen su precio con descuento."
          confirmLabel="Desactivar"
          onCancel={() => setConfirmando(false)}
          onConfirm={async () => {
            try {
              await platformApi.updateDiscountCode(id, { isActive: false })
              setConfirmando(false)
              setReloadKey((k) => k + 1)
              onCambio()
              onAviso({ variant: 'success', title: `Código ${data.code} desactivado` })
            } catch (err) {
              setConfirmando(false)
              onAviso({ variant: 'error', title: 'No se pudo desactivar', description: err instanceof Error ? err.message : undefined })
            }
          }}
        />
      )}
    </>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{valor}</div>
    </div>
  )
}

// ─── Ofrecer el código por mail ───────────────────────────────────────────────
//
// Manda la plantilla "Oferta de código de descuento" (se puede previsualizar en
// Emails) a las casillas que se carguen acá. Los mails van uno por uno del lado
// del backend: si una casilla falla, las demás salen igual, y el aviso dice
// cuántas llegaron.
function EnviarPorMail({ id, code, onAviso }: { id: string; code: string; onAviso: (a: Aviso) => void }) {
  const [emails, setEmails] = useState<string[]>([])
  const [borrador, setBorrador] = useState('')
  const [saludo, setSaludo] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Se aceptan varios de una: pegar una lista separada por comas, espacios o
  // saltos de linea es la forma natural de cargar destinatarios.
  function agregar(texto: string) {
    const nuevos = texto
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@') && e.length > 3)
    if (nuevos.length === 0) return
    setEmails((prev) => [...new Set([...prev, ...nuevos])].slice(0, 25))
    setBorrador('')
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      agregar(borrador)
      return
    }
    // Backspace con el campo vacío borra el último chip: es lo que espera
    // cualquiera que haya cargado destinatarios en un cliente de mail.
    if (e.key === 'Backspace' && !borrador && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1))
    }
  }

  async function enviar() {
    // Lo que quedó tipeado sin confirmar cuenta igual: olvidarse de apretar
    // Enter no puede hacer que ese destinatario se pierda en silencio.
    const pendientes = borrador.trim() ? [...emails, borrador.trim().toLowerCase()] : emails
    const destinatarios = [...new Set(pendientes)]
    if (destinatarios.length === 0) {
      onAviso({ variant: 'warning', title: 'Cargá al menos un email' })
      return
    }
    setEnviando(true)
    try {
      const r = await platformApi.sendDiscountOffer(id, {
        emails: destinatarios,
        ...(destinatarios.length === 1 && saludo.trim() ? { saludo: saludo.trim() } : {}),
      })
      setEmails([])
      setBorrador('')
      setSaludo('')
      if (r.enviados === r.total) {
        onAviso({
          variant: 'success',
          title: r.total === 1 ? `Código ${code} enviado` : `Código ${code} enviado a ${r.total} personas`,
        })
      } else {
        const fallaron = r.resultados.filter((x) => !x.enviado).map((x) => x.email)
        onAviso({
          variant: 'warning',
          title: `Se enviaron ${r.enviados} de ${r.total}`,
          description: `No salieron: ${fallaron.join(', ')}`,
        })
      }
    } catch (err) {
      onAviso({
        variant: 'error',
        title: 'No se pudo enviar',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setEnviando(false)
    }
  }

  const total = emails.length + (borrador.trim() ? 1 : 0)

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>
        Ofrecerlo por mail
      </div>

      <div
        className="ds-field"
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
          minHeight: 42, padding: '7px 10px', borderRadius: 10,
          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
        }}
      >
        {emails.map((e) => (
          <span
            key={e}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 999, fontSize: 12.5,
              background: 'var(--color-surface)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {e}
            <button
              type="button"
              onClick={() => setEmails((prev) => prev.filter((x) => x !== e))}
              aria-label={`Quitar ${e}`}
              className="ds-hover"
              style={{ background: 'none', border: 'none', padding: 0, lineHeight: 1, color: 'var(--color-muted)', cursor: 'pointer', borderRadius: 4 }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)}
          onKeyDown={alTeclear}
          onBlur={() => agregar(borrador)}
          onPaste={(ev) => { ev.preventDefault(); agregar(ev.clipboardData.getData('text')) }}
          placeholder={emails.length === 0 ? 'email@ejemplo.com' : 'Agregar otro…'}
          style={{
            flex: 1, minWidth: 160, border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--color-text)', fontSize: 13.5, fontFamily: 'inherit',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 6 }}>
        Enter o coma para separar. Podés pegar una lista entera. Hasta 25 por envío.
      </div>

      {/* El saludo solo tiene sentido con un destinatario: mandarle "Hola
          Lorena" a diez personas seria peor que no saludar. */}
      {total === 1 && (
        <input
          value={saludo}
          onChange={(ev) => setSaludo(ev.target.value)}
          placeholder="Nombre para el saludo (opcional)"
          className="ds-field"
          style={{ ...inputStyle, marginTop: 10 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || total === 0}
          className="ds-hover"
          style={{ ...btnGhost, ...(enviando || total === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
        >
          {enviando
            ? <><Loader2 size={14} style={{ animation: 'orbita-spin 1s linear infinite' }} /> Enviando…</>
            : <><Mail size={14} /> Enviar{total > 1 ? ` a ${total}` : ''}</>}
        </button>
      </div>
    </div>
  )
}
