import { useState } from 'react'
import { useRouter } from 'next/router'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { platformApi } from '@/lib/platform/api'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apexUrl } from '@/lib/tenant'
import { SuperAdminShell } from './Shell'
import { NAV } from './SuperAdminDashboard'
import {
  useFetch, Grid, Card, Table, StatusBadge, SubBadge, Loader, ErrorBox, Empty, Chip,
  ModalShell, Field, ConfirmModal, Kpi, ROLE_LABELS,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
  money, date, ACTION_LABELS,
  humanize, PRODUCT_STATUS_LABELS, PAYMENT_STATUS_LABELS, MEMBER_ROLE_LABELS,
  DOMAIN_SOURCE_LABELS, DOMAIN_STATUS_LABELS, PLAN_LABELS,
} from './ui'
import { LineSeriesChart, AreaSeriesChart, ChartSkeleton, RangePicker, useRange, fmtMoney } from './charts'

// Página completa de detalle de negocio — orbita.site/superadmin/negocios/:id.
// Reemplaza el drawer lateral que existía antes (RBT — dashboard de super
// admin): un negocio real tiene demasiada información como para vivir en un
// panel de 560px, y no tenía sentido perder el gráfico/catálogo/reseñas ahí.

export function BusinessDetailPage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const id = typeof router.query.id === 'string' ? router.query.id : null
  const cerrarSesion = () => void logout().then(() => (window.location.href = apexUrl('/login')))

  return (
    <RequireAuth type="platform_admin">
      <SuperAdminShell
        items={NAV}
        activo="negocios"
        onNavegar={(seccion) => void router.push(`/superadmin?seccion=${seccion}`)}
        usuario={{
          nombre: user?.type === 'platform_admin' ? user.admin.name : '',
          rol: user?.type === 'platform_admin' ? (ROLE_LABELS[user.admin.role] ?? user.admin.role) : '',
        }}
        onCerrarSesion={cerrarSesion}
      >
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => router.push('/superadmin?seccion=negocios')} className="ds-hover" style={btnGhostSm}>
            <ArrowLeft size={14} strokeWidth={1.75} /> Volver a Negocios
          </button>
        </div>
        {id ? <Detalle businessId={id} /> : <Loader />}
      </SuperAdminShell>
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
  const { data: series, loading: cargandoSeries } = useFetch(() => platformApi.businessSeries(businessId, range), [businessId, range])
  const { data: productos } = useFetch(() => platformApi.businessProducts(businessId), [businessId])
  const { data: reseñas } = useFetch(() => platformApi.businessReviews(businessId), [businessId])

  if (error) return <ErrorBox msg="No se pudo cargar el negocio." />
  if (!d) return <Loader />

  const onChanged = () => setReloadKey((k) => k + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>{d.name}</h1>
          <StatusBadge status={d.status} />
          <div style={{ marginLeft: 'auto' }}>
            {d.status === 'paused' ? (
              <button onClick={() => setReactivando(true)} className="ds-hover" style={btnGhostSm}>Reactivar negocio</button>
            ) : (
              <button onClick={() => setSuspendiendo(true)} className="ds-hover" style={{ ...btnGhostSm, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>Suspender negocio</button>
            )}
          </div>
        </div>
        <a
          href={`https://${d.subdomain}.orbita.site`}
          target="_blank"
          rel="noreferrer"
          className="ds-link"
          style={{ fontSize: 13.5, color: 'var(--color-primary)', fontFamily: '"Geist Mono", monospace', textDecoration: 'none' }}
        >
          {d.subdomain}.orbita.site ↗
        </a>
        {/* Se arman las partes y recién después se unen: un negocio sin rubro
            dejaba la línea empezando con un "·" suelto. */}
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 6 }}>
          {[
            d.industry,
            d.subrubros?.length ? d.subrubros.join(', ') : null,
            `dado de alta el ${date(d.createdAt)}`,
          ].filter(Boolean).join(' · ')}
        </div>
      </div>

      <Grid>
        <Kpi label="Ventas totales" value={money(d.metrics.salesAllTime)} accent hint="Desde que abrió" />
        <Kpi label="Ventas últimos 30 días" value={money(d.metrics.salesLast30Days)} hint="Lo facturado este mes" />
        <Kpi label="Pedidos totales" value={String(d.metrics.orders)} hint={`${d.metrics.ordersLast30Days} en los últimos 30 días`} />
        <Kpi label="Pedidos últimos 30 días" value={String(d.metrics.ordersLast30Days)} />
        <Kpi label="Clientes" value={String(d.metrics.customers)} hint="Compraron alguna vez" />
        <Kpi label="Productos" value={String(d.metrics.products)} hint="Cargados en el catálogo" />
      </Grid>

      {/* Un solo selector de período para los dos gráficos de abajo: antes
          vivía adentro de la primera tarjeta y solo se entendía que también
          afectaba a la segunda probándolo. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>Actividad</h2>
        <RangePicker value={range} onChange={setRange} />
      </div>

      <Card
        title="Pedidos y clientes nuevos por día"
        subtitle="Cómo se mueve el negocio día a día"
      >
        {!series ? <ChartSkeleton /> : (
          <LineSeriesChart
            data={series.series.map((p) => ({ date: p.date, pedidos: p.orders, clientes: p.newCustomers }))}
            series={[
              { key: 'pedidos', label: 'Pedidos' },
              { key: 'clientes', label: 'Clientes nuevos' },
            ]}
            cargando={cargandoSeries}
          />
        )}
      </Card>

      <Card title="Ventas por día" subtitle="Facturación diaria del negocio">
        {!series ? <ChartSkeleton /> : (
          <AreaSeriesChart
            data={series.series.map((p) => ({ date: p.date, value: p.sales }))}
            label="Ventas"
            formatValue={fmtMoney}
            cargando={cargandoSeries}
          />
        )}
      </Card>

      <Card
        title="Suscripción"
        subtitle="El plan que paga el negocio para usar Órbita"
        action={
          <button onClick={() => setCediendo(true)} className="ds-hover" style={btnGhostSm}>Ceder licencia de cortesía</button>
        }
      >
        {d.subscription ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <SubBadge status={d.subscription.status} origin={d.subscription.origin} />
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>Plan {humanize(d.subscription.plan, PLAN_LABELS)}</span>
              <span style={{ color: 'var(--color-muted)' }}>·</span>
              <span style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{money(d.subscription.amount)}</span>
              <span style={{ color: 'var(--color-muted)' }}>por mes</span>
            </div>
            <div style={{ color: 'var(--color-body)' }}>
              Pago al día hasta el <strong style={{ color: 'var(--color-text)' }}>{date(d.subscription.currentPeriodEnd)}</strong>
            </div>
            {d.subscription.grantReason && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--color-violet-bg)', color: 'var(--color-body)', fontSize: 13 }}>
                <strong style={{ color: 'var(--color-text)' }}>Cortesía:</strong> {d.subscription.grantReason}
                {d.subscription.grantedBy ? `, la cedió ${d.subscription.grantedBy.name}` : ''}
              </div>
            )}
            {d.subscription.payments.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>Últimos pagos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {d.subscription.payments.slice(0, 5).map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13, padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-muted)' }}>{date(p.periodStart)} – {date(p.periodEnd)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{money(p.amount)}</span>
                        <Chip text={humanize(p.status, PAYMENT_STATUS_LABELS)} tone={p.status === 'APPROVED' ? 'green' : p.status === 'PENDING' ? 'amber' : 'red'} title={`Estado en el sistema: ${p.status}`} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Empty text="Este negocio todavía no tiene ninguna suscripción." />
        )}
      </Card>

      <Card
        title="Catálogo"
        subtitle="Los productos que tiene cargados el negocio"
        action={<Chip text={`${productos?.data.length ?? '…'}`} tone="gray" />}
        noPad
      >
        {!productos ? <Loader /> : productos.data.length === 0 ? (
          <Empty text="Todavía no cargó ningún producto." />
        ) : (
          <Table
            head={['Producto', 'Categoría', 'Estado', 'Precio', 'Stock']}
            alignRight={[3, 4]}
            rows={productos.data.map((p) => ({
              key: p.id,
              cells: [
                <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</span>,
                p.categoryName ?? <span key="c" style={{ color: 'var(--color-subtle)' }}>Sin categoría</span>,
                <Chip key="st" text={humanize(p.status, PRODUCT_STATUS_LABELS)} tone={p.status === 'PUBLISHED' ? 'green' : p.status === 'OUT_OF_STOCK' ? 'amber' : 'gray'} dot title={`Estado en el sistema: ${p.status}`} />,
                <span key="pr" style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 500 }}>{money(p.basePrice)}</span>,
                <span key="s" style={{ fontFamily: '"Geist Mono", monospace', color: p.totalStock === 0 ? 'var(--color-error)' : 'var(--color-text)', fontWeight: 500 }}>{p.totalStock}</span>,
              ],
            }))}
          />
        )}
      </Card>

      <Card
        title="Reseñas de clientes"
        subtitle="Lo que escribieron los compradores sobre los productos"
        action={<Chip text={`${reseñas?.data.length ?? '…'}`} tone="gray" />}
      >
        {!reseñas ? <Loader /> : reseñas.data.length === 0 ? <Empty text="Todavía nadie dejó una reseña." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reseñas.data.map((r) => (
              <div key={r.id} style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-muted)' }}>
                    <strong style={{ color: 'var(--color-text)' }}>{r.customerName}</strong> sobre {r.productName}
                  </span>
                  <span style={{ color: 'var(--color-subtle)', fontSize: 12.5 }}>{date(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>{r.text}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Equipo"
        subtitle="Las personas que trabajan en este negocio"
        action={<Chip text={`${d.team.length}`} tone="gray" />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {d.team.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13.5, padding: '9px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
              <span>
                <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{m.name}</span>
                <span style={{ color: 'var(--color-muted)', fontSize: 12.5 }}> · {m.email}</span>
              </span>
              <Chip text={humanize(m.role, MEMBER_ROLE_LABELS)} tone={m.role === 'owner' ? 'blue' : 'gray'} />
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Dominios propios"
        subtitle="Direcciones web además de la de orbita.site"
        action={<Chip text={`${d.customDomains.length}`} tone="gray" />}
      >
        {d.customDomains.length === 0 ? <Empty text="Usa solo su dirección de orbita.site." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {d.customDomains.map((dom) => (
              <div key={dom.domain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13.5, padding: '9px 0', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 500 }}>{dom.domain}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Chip text={humanize(dom.source, DOMAIN_SOURCE_LABELS)} tone={dom.source === 'PURCHASED' ? 'blue' : 'gray'} />
                  <Chip text={humanize(dom.status, DOMAIN_STATUS_LABELS)} tone={dom.status === 'ACTIVE' ? 'green' : 'amber'} dot title={`Estado en el sistema: ${dom.status}`} />
                  {dom.expiresAt && <span style={{ color: 'var(--color-muted)', fontSize: 12.5 }}>vence {date(dom.expiresAt)}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.activity.length > 0 && (
        <Card title="Qué hicimos con este negocio" subtitle="Acciones tomadas desde el panel de plataforma">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {d.activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 13.5, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-subtle)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{date(a.createdAt)}</span>
                <span style={{ color: 'var(--color-body)' }}>
                  <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{ACTION_LABELS[a.action] ?? a.action}</strong>
                  {a.admin ? ` por ${a.admin.name}` : ''}
                </span>
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
          body="El negocio vuelve a operar con normalidad: su tienda y su suscripción quedan activas de nuevo."
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
        renovar, se suspende automáticamente, igual que una suscripción paga sin cobrar.
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
        La tienda deja de aceptar pedidos hasta que la reactives. El equipo del negocio
        todavía puede entrar a su panel: suspenderla no les bloquea el acceso.
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
