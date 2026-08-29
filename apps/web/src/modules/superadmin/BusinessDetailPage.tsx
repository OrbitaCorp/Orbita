import { useState } from 'react'
import { useRouter } from 'next/router'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { platformApi } from '@/lib/platform/api'
import {
  useFetch, Grid, Card, Table, StatusBadge, SubBadge, Loader, ErrorBox, Empty,
  ModalShell, Field, ConfirmModal, Kpi,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
  money, date, OrbitLogo, ACTION_LABELS,
} from './ui'
import { TwoSeriesAreaChart, SingleSeriesAreaChart, RangePicker, useRange, fmtMoney } from './charts'

// Página completa de detalle de negocio — orbita.site/superadmin/negocios/:id.
// Reemplaza el drawer lateral que existía antes (RBT — dashboard de super
// admin): un negocio real tiene demasiada información como para vivir en un
// panel de 560px, y no tenía sentido perder el gráfico/catálogo/reseñas ahí.

export function BusinessDetailPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : null

  return (
    <RequireAuth type="platform_admin">
      <div style={{ minHeight: '100vh', background: 'var(--color-surface)' }}>
        <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14, height: 60 }}>
            <OrbitLogo />
            <button onClick={() => router.push('/superadmin')} className="ds-hover" style={btnGhost}>← Volver al panel</button>
          </div>
        </div>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: 24 }}>
          {id ? <Detalle businessId={id} /> : <Loader />}
        </div>
      </div>
    </RequireAuth>
  )
}

function Detalle({ businessId }: { businessId: string }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [suspendiendo, setSuspendiendo] = useState(false)
  const [reactivando, setReactivando] = useState(false)
  const [cediendo, setCediendo] = useState(false)
  const [range, setRange] = useRange(30)

  const { data: d, error } = useFetch(() => platformApi.business(businessId), [businessId, reloadKey])
  const { data: series } = useFetch(() => platformApi.businessSeries(businessId, range), [businessId, range])
  const { data: productos } = useFetch(() => platformApi.businessProducts(businessId), [businessId])
  const { data: reseñas } = useFetch(() => platformApi.businessReviews(businessId), [businessId])

  if (error) return <ErrorBox msg="No se pudo cargar el negocio." />
  if (!d) return <Loader />

  const onChanged = () => setReloadKey((k) => k + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{d.name}</h1>
          <StatusBadge status={d.status} />
          {d.status === 'paused' ? (
            <button onClick={() => setReactivando(true)} className="ds-hover" style={{ ...btnGhostSm, marginLeft: 'auto' }}>Reactivar</button>
          ) : (
            <button onClick={() => setSuspendiendo(true)} className="ds-hover" style={{ ...btnGhostSm, marginLeft: 'auto', color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.35)' }}>Suspender</button>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{d.subdomain}.orbita.site</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>{d.industry}{d.subrubros?.length ? ` · ${d.subrubros.join(', ')}` : ''} · alta {date(d.createdAt)}</div>
      </div>

      <Grid>
        <Kpi label="Ventas totales" value={money(d.metrics.salesAllTime)} />
        <Kpi label="Ventas (30 días)" value={money(d.metrics.salesLast30Days)} />
        <Kpi label="Pedidos" value={String(d.metrics.orders)} />
        <Kpi label="Clientes" value={String(d.metrics.customers)} />
        <Kpi label="Productos" value={String(d.metrics.products)} />
        <Kpi label="Pedidos (30d)" value={String(d.metrics.ordersLast30Days)} />
      </Grid>

      <Card
        title="Pedidos y clientes nuevos por día"
        action={<RangePicker value={range} onChange={setRange} />}
      >
        {!series ? <Loader /> : (
          <TwoSeriesAreaChart
            data={series.series.map((p) => ({ date: p.date, a: p.orders, b: p.newCustomers }))}
            labelA="Pedidos"
            labelB="Clientes nuevos"
          />
        )}
      </Card>

      <Card title="Ventas por día">
        {!series ? <Loader /> : (
          <SingleSeriesAreaChart data={series.series.map((p) => ({ date: p.date, value: p.sales }))} formatValue={fmtMoney} />
        )}
      </Card>

      <Card title="Suscripción">
        {d.subscription ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SubBadge status={d.subscription.status} origin={d.subscription.origin} />
              <span style={{ color: 'var(--color-body)' }}>{d.subscription.plan} · {money(d.subscription.amount)}/mes</span>
            </div>
            <div style={{ color: 'var(--color-muted)' }}>Período actual hasta {date(d.subscription.currentPeriodEnd)}</div>
            {d.subscription.grantReason && <div style={{ color: 'var(--color-muted)' }}>Cortesía: {d.subscription.grantReason}{d.subscription.grantedBy ? ` (${d.subscription.grantedBy.name})` : ''}</div>}
            {d.subscription.payments.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {d.subscription.payments.slice(0, 5).map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--color-muted)' }}>
                    <span>{date(p.periodStart)} – {date(p.periodEnd)}</span>
                    <span>{money(p.amount)} · {p.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <button onClick={() => setCediendo(true)} className="ds-hover" style={{ ...btnGhostSm, marginTop: 4 }}>Ceder licencia de cortesía</button>
            </div>
          </div>
        ) : (
          <div>
            <Empty text="Sin suscripción." />
            <button onClick={() => setCediendo(true)} className="ds-hover" style={{ ...btnGhostSm, marginTop: 8 }}>Ceder licencia de cortesía</button>
          </div>
        )}
      </Card>

      <Card title={`Catálogo (${productos?.data.length ?? '…'})`} noPad>
        {!productos ? <Loader /> : productos.data.length === 0 ? (
          <div style={{ padding: 16 }}><Empty text="Todavía no cargó productos." /></div>
        ) : (
          <Table
            head={['Producto', 'Categoría', 'Estado', 'Precio', 'Stock']}
            rows={productos.data.map((p) => ({
              key: p.id,
              cells: [
                <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</span>,
                p.categoryName ?? <span key="c" style={{ color: 'var(--color-subtle)' }}>Sin categoría</span>,
                p.status,
                <span key="pr" style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{money(p.basePrice)}</span>,
                String(p.totalStock),
              ],
            }))}
          />
        )}
      </Card>

      <Card title={`Reseñas de productos (${reseñas?.data.length ?? '…'})`}>
        {!reseñas ? <Loader /> : reseñas.data.length === 0 ? <Empty text="Todavía no tiene reseñas." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reseñas.data.map((r) => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 4 }}>
                  <span><strong style={{ color: 'var(--color-text)' }}>{r.customerName}</strong> · {r.productName}</span>
                  <span>{date(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-body)' }}>{r.text}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Equipo (${d.team.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.team.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text)' }}>{m.name} <span style={{ color: 'var(--color-muted)', fontSize: 11.5 }}>· {m.email}</span></span>
              <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{m.role}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Dominios (${d.customDomains.length})`}>
        {d.customDomains.length === 0 ? <Empty text="Solo el subdominio de Órbita." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.customDomains.map((dom) => (
              <div key={dom.domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{dom.domain}</span>
                <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{dom.source} · {dom.status}{dom.expiresAt ? ` · vence ${date(dom.expiresAt)}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.activity.length > 0 && (
        <Card title="Actividad de plataforma">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.activity.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                {date(a.createdAt)} · <strong style={{ color: 'var(--color-body)' }}>{ACTION_LABELS[a.action] ?? a.action}</strong>{a.admin ? ` (${a.admin.name})` : ''}
              </div>
            ))}
          </div>
        </Card>
      )}

      {suspendiendo && (
        <SuspendModal
          businessName={d.name}
          onCancel={() => setSuspendiendo(false)}
          onConfirm={async (reason) => {
            await platformApi.suspendBusiness(d.id, reason)
            setSuspendiendo(false)
            onChanged()
          }}
        />
      )}
      {reactivando && (
        <ConfirmModal
          title={`¿Reactivar ${d.name}?`}
          body="El negocio vuelve a operar con normalidad: storefront y suscripción quedan activos de nuevo."
          confirmLabel="Reactivar"
          onCancel={() => setReactivando(false)}
          onConfirm={async () => {
            await platformApi.reactivateBusiness(d.id)
            setReactivando(false)
            onChanged()
          }}
        />
      )}
      {cediendo && (
        <GrantCompModal
          businessName={d.name}
          onCancel={() => setCediendo(false)}
          onConfirm={async (input) => {
            await platformApi.grantComp(d.id, input)
            setCediendo(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function GrantCompModal({ businessName, onCancel, onConfirm }: { businessName: string; onCancel: () => void; onConfirm: (input: { currentPeriodEnd: string; grantReason: string }) => Promise<void> }) {
  // Default: 3 meses desde hoy — mismo horizonte que un ciclo de facturación
  // normal (ver MP_SUBSCRIPTION_FREQUENCY en .env.example), el admin lo ajusta si quiere otra fecha.
  const defaultEnd = new Date()
  defaultEnd.setMonth(defaultEnd.getMonth() + 3)
  const [fecha, setFecha] = useState(defaultEnd.toISOString().slice(0, 10))
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  return (
    <ModalShell onClose={onCancel} title={`Ceder licencia a ${businessName}`}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--color-body)' }}>
        El negocio queda con acceso completo y gratuito hasta la fecha elegida. Al vencer sin
        renovar, se suspende automáticamente — mismo destino que una suscripción paga sin cobrar.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Vigente hasta">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="ds-field" style={inputStyle} />
        </Field>
        <Field label="Motivo (queda en el log de auditoría)">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: cliente fundador, canje, prueba extendida…" className="ds-field" style={inputStyle} />
        </Field>
      </div>
      {error && <div style={{ marginTop: 12 }}><ErrorBox msg={error} /></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} className="ds-hover" style={btnGhost}>Cancelar</button>
        <button
          type="button"
          className="ds-hover"
          disabled={enviando}
          onClick={async () => {
            if (!motivo.trim()) { setError('Completá el motivo.'); return }
            setEnviando(true)
            setError('')
            try {
              await onConfirm({ currentPeriodEnd: new Date(fecha).toISOString(), grantReason: motivo.trim() })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo ceder la licencia.')
              setEnviando(false)
            }
          }}
          style={btnPrimary}
        >
          {enviando ? 'Cediendo…' : 'Ceder licencia'}
        </button>
      </div>
    </ModalShell>
  )
}

function SuspendModal({ businessName, onCancel, onConfirm }: { businessName: string; onCancel: () => void; onConfirm: (reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onCancel} title={`¿Suspender ${businessName}?`}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--color-body)' }}>
        El storefront deja de aceptar pedidos hasta que lo reactives. El equipo del negocio
        todavía puede entrar al panel — la suspensión no bloquea el login.
      </p>
      <Field label="Motivo (opcional, queda en el log de auditoría)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: falta de pago, incumplimiento de términos…" className="ds-field" style={inputStyle} />
      </Field>
      {error && <div style={{ marginTop: 12 }}><ErrorBox msg={error} /></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} className="ds-hover" style={btnGhost}>Cancelar</button>
        <button
          type="button"
          className="ds-hover"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true)
            setError('')
            try {
              await onConfirm(reason.trim() || undefined)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo suspender el negocio.')
              setEnviando(false)
            }
          }}
          style={{ ...btnPrimary, background: 'var(--color-error)' }}
        >
          {enviando ? 'Suspendiendo…' : 'Suspender'}
        </button>
      </div>
    </ModalShell>
  )
}
