import { useState } from 'react'
import { Plus, Copy, Check, AlertTriangle } from 'lucide-react'
import {
  platformApi,
  type DiscountCodeRow,
  type DiscountCodeDetail,
  type DiscountCodeEstado,
} from '@/lib/platform/api'
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

export function TabDescuentos() {
  const [reloadKey, setReloadKey] = useState(0)
  const [creando, setCreando] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const { data, error } = useFetch(() => platformApi.discountCodes(), [reloadKey])
  const recargar = () => setReloadKey((k) => k + 1)

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
          onCreado={() => { setCreando(false); recargar() }}
        />
      )}
      {detalleId && (
        <ModalDetalle
          id={detalleId}
          onClose={() => setDetalleId(null)}
          onCambio={recargar}
        />
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

function ModalNuevoCodigo({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
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
      onCreado()
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={1} max={100}
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              className="ds-field"
              style={{ ...inputStyle, width: 110 }}
            />
            <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>% menos</span>
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

function ModalDetalle({ id, onClose, onCambio }: { id: string; onClose: () => void; onCambio: () => void }) {
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} className="ds-hover" style={btnGhost}>Cerrar</button>
              {data.isActive ? (
                <button onClick={() => setConfirmando(true)} className="ds-hover" style={{ ...btnGhost, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await platformApi.updateDiscountCode(id, { isActive: true })
                    setReloadKey((k) => k + 1)
                    onCambio()
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
            await platformApi.updateDiscountCode(id, { isActive: false })
            setConfirmando(false)
            setReloadKey((k) => k + 1)
            onCambio()
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
