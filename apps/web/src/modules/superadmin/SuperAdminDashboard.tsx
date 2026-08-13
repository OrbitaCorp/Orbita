import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'
import { apexUrl } from '@/lib/tenant'
import {
  platformApi,
  type AdminRow,
  type PlatformAdminRole,
  type LogRow,
} from '@/lib/platform/api'
import {
  useFetch, Grid, Row2, Kpi, Card, DistList, Table, StatusBadge, SubBadge, Pill,
  Loader, ErrorBox, Empty, ModalShell, Field, ConfirmModal,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
  money, date, dateTime, OrbitLogo, ROLE_LABELS, ACTION_LABELS,
} from './ui'
import { TwoSeriesAreaChart, SingleSeriesAreaChart, RangePicker, useRange, fmtMoney } from './charts'

// Panel de plataforma (super admin) — apex orbita.site/superadmin.

export function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('resumen')
  if (!user || user.type !== 'platform_admin') return null

  const cerrarSesion = () => void logout().then(() => (window.location.href = apexUrl('/login')))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <OrbitLogo />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Órbita</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '3px 8px', borderRadius: 6 }}>PLATAFORMA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{user.admin.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{ROLE_LABELS[user.admin.role] ?? user.admin.role}</div>
            </div>
            <button onClick={cerrarSesion} style={btnGhost}>Cerrar sesión</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '10px 14px', fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-muted)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: 24 }}>
        {tab === 'resumen' && <TabResumen />}
        {tab === 'negocios' && <TabNegocios />}
        {tab === 'dominios' && <TabDominios />}
        {tab === 'duenos' && <TabDuenos />}
        {tab === 'admins' && <TabAdmins currentAdminId={user.admin.id} />}
        {tab === 'logs' && <TabLogs />}
      </div>
    </div>
  )
}

type Tab = 'resumen' | 'negocios' | 'dominios' | 'duenos' | 'admins' | 'logs'
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'negocios', label: 'Negocios' },
  { id: 'dominios', label: 'Dominios' },
  { id: 'duenos', label: 'Dueños' },
  { id: 'admins', label: 'Admins' },
  { id: 'logs', label: 'Logs' },
]

// ─── Resumen ──────────────────────────────────────────────────────────────────
function TabResumen() {
  const { data, error } = useFetch(() => platformApi.overview(), [])
  const [rangeAltas, setRangeAltas] = useRange(30)
  const [rangeMrr, setRangeMrr] = useRange(30)
  const { data: growth } = useFetch(() => platformApi.growthSeries(rangeAltas), [rangeAltas])
  const { data: revenue } = useFetch(() => platformApi.revenueSeries(rangeMrr), [rangeMrr])
  const { data: subs } = useFetch(() => platformApi.subscriptions(), [])

  if (error) return <ErrorBox msg="No se pudo cargar el resumen." />
  if (!data) return <Loader />

  const topNegocios = (subs ?? [])
    .filter((s) => s.status === 'ACTIVE' && s.origin === 'PAID' && s.business)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Grid>
        <Kpi label="MRR (suscripciones pagas)" value={money(data.subscriptions.mrr)} accent />
        <Kpi label="Negocios totales" value={String(data.businesses.total)} />
        <Kpi label="Activos" value={String(data.businesses.active)} />
        <Kpi label="Pausados" value={String(data.businesses.paused)} />
        <Kpi label="En borrador" value={String(data.businesses.draft)} />
        <Kpi label="Altas (30 días)" value={`+${data.businesses.newLast30Days}`} />
        <Kpi label="Subdominios ocupados" value={String(data.domains.subdomainsInUse)} />
        <Kpi label="Dominios por vencer" value={String(data.domains.expiringSoon)} />
      </Grid>

      <Card
        title="Altas por día — negocios y suscripciones pagas"
        action={<RangePicker value={rangeAltas} onChange={setRangeAltas} />}
      >
        {!growth ? <Loader /> : (
          <TwoSeriesAreaChart
            data={growth.series.map((p) => ({ date: p.date, a: p.businesses, b: p.subscriptions }))}
            labelA="Negocios nuevos"
            labelB="Suscripciones pagas nuevas"
          />
        )}
      </Card>

      <Card
        title="Ingresos por día (pagos aprobados)"
        action={<RangePicker value={rangeMrr} onChange={setRangeMrr} />}
      >
        {!revenue ? <Loader /> : (
          <SingleSeriesAreaChart data={revenue.series.map((p) => ({ date: p.date, value: p.amount }))} formatValue={fmtMoney} />
        )}
      </Card>

      <Card title="Negocios con mayor facturación (suscripción activa)" noPad>
        {!subs ? <Loader /> : topNegocios.length === 0 ? (
          <div style={{ padding: 16 }}><Empty text="Todavía no hay suscripciones pagas activas." /></div>
        ) : (
          <Table
            head={['Negocio', 'Plan', 'Monto/mes', 'Vence']}
            rows={topNegocios.map((s) => ({
              key: s.businessId,
              cells: [
                <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{s.business!.name}</span>,
                s.plan,
                <span key="m" style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{money(s.amount)}</span>,
                date(s.currentPeriodEnd),
              ],
            }))}
          />
        )}
      </Card>

      <Row2>
        <Card title="Suscripciones por estado">
          <DistList map={data.subscriptions.byStatus} />
        </Card>
        <Card title="Suscripciones por origen">
          <DistList map={data.subscriptions.byOrigin} labels={{ PAID: 'Pagas', COMP: 'Cortesía' }} />
        </Card>
      </Row2>

      <Row2>
        <Card title="Negocios por modo">
          <DistList map={data.businesses.byMode} labels={{ FULL: 'Tienda completa', SHOWCASE: 'Vidriera' }} />
        </Card>
        <Card title="Negocios por rubro">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.businesses.byIndustry.slice(0, 8).map((r) => (
              <div key={r.industry} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-body)' }}>{r.industry}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>{r.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </Row2>
    </div>
  )
}

// ─── Negocios ─────────────────────────────────────────────────────────────────
function TabNegocios() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, error } = useFetch(() => platformApi.businesses({ search: debounced, limit: 50 }), [debounced])

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, subdominio o rubro…"
        style={{ width: '100%', maxWidth: 420, height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, marginBottom: 16 }}
      />
      {error ? (
        <ErrorBox msg="No se pudo cargar la lista de negocios." />
      ) : !data ? (
        <Loader />
      ) : (
        <Card noPad>
          <Table
            head={['Negocio', 'Dueño', 'Estado', 'Suscripción', 'Prod.', 'Ped.', 'Cli.']}
            rows={data.data.map((b) => ({
              key: b.id,
              onClick: () => router.push(`/superadmin/negocios/${b.id}`),
              cells: [
                <div key="n">
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{b.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                    {b.subdomain}.orbita.site{b.customDomain ? ` · ${b.customDomain}` : ''}
                  </div>
                </div>,
                b.owner ? (
                  <div key="o">
                    <div style={{ color: 'var(--color-text)' }}>{b.owner.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{b.owner.email}</div>
                  </div>
                ) : <span key="o" style={{ color: 'var(--color-subtle)' }}>—</span>,
                <StatusBadge key="s" status={b.status} />,
                b.subscription ? <SubBadge key="sub" status={b.subscription.status} origin={b.subscription.origin} /> : <span key="sub" style={{ color: 'var(--color-subtle)' }}>Sin sub.</span>,
                String(b.counts.products),
                String(b.counts.orders),
                String(b.counts.customers),
              ],
            }))}
          />
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
            {data.total} negocio(s){data.total > data.data.length ? ` · mostrando ${data.data.length}` : ''}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Dominios ─────────────────────────────────────────────────────────────────
function TabDominios() {
  const { data, error } = useFetch(() => platformApi.domains(), [])
  if (error) return <ErrorBox msg="No se pudieron cargar los dominios." />
  if (!data) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title={`Dominios propios / vendidos (${data.customDomains.length})`} noPad>
        {data.customDomains.length === 0 ? <div style={{ padding: 16 }}><Empty text="Todavía no hay dominios custom." /></div> : (
          <Table
            head={['Dominio', 'Negocio', 'Origen', 'Estado', 'SSL', 'Vence']}
            rows={data.customDomains.map((d) => ({
              key: d.domain,
              cells: [
                <span key="d" style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text)' }}>{d.domain}</span>,
                d.businessName,
                <Pill key="o" text={d.source === 'PURCHASED' ? 'Vendido' : 'Vinculado'} tone={d.source === 'PURCHASED' ? 'blue' : 'gray'} />,
                d.status,
                d.sslStatus,
                d.expiresAt ? date(d.expiresAt) : '—',
              ],
            }))}
          />
        )}
      </Card>

      <Card title={`Subdominios en orbita.site (${data.subdomains.length})`} noPad>
        <Table
          head={['Subdominio', 'Negocio', 'Modo', 'Estado']}
          rows={data.subdomains.map((s) => ({
            key: s.subdomain,
            cells: [
              <span key="s" style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>{s.fullHost}</span>,
              s.businessName,
              s.mode === 'FULL' ? 'Tienda' : 'Vidriera',
              <StatusBadge key="st" status={s.status} />,
            ],
          }))}
        />
      </Card>
    </div>
  )
}

// ─── Dueños ───────────────────────────────────────────────────────────────────
function TabDuenos() {
  const { data, error } = useFetch(() => platformApi.owners(), [])
  if (error) return <ErrorBox msg="No se pudieron cargar los dueños." />
  if (!data) return <Loader />

  return (
    <Card noPad>
      <Table
        head={['Dueño', 'Email', 'Negocio', 'Último acceso']}
        rows={data.map((o) => ({
          key: o.id,
          cells: [
            <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{o.name}</span>,
            <span key="e" style={{ color: 'var(--color-body)' }}>{o.email}{o.emailVerified ? '' : ' ⚠️'}</span>,
            o.business ? `${o.business.name} (${o.business.subdomain})` : '—',
            o.lastAccessAt ? date(o.lastAccessAt) : 'Nunca',
          ],
        }))}
      />
    </Card>
  )
}

// ─── Admins ───────────────────────────────────────────────────────────────────
function TabAdmins({ currentAdminId }: { currentAdminId: string }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [editando, setEditando] = useState<AdminRow | 'nuevo' | null>(null)
  const [desactivando, setDesactivando] = useState<AdminRow | null>(null)
  const { data, error } = useFetch(() => platformApi.admins(), [reloadKey])
  const recargar = () => setReloadKey((k) => k + 1)

  if (error) return <ErrorBox msg="No se pudo cargar la lista de admins." />
  if (!data) return <Loader />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setEditando('nuevo')} style={btnPrimary}>+ Nuevo admin</button>
      </div>
      <Card noPad>
        <Table
          head={['Nombre', 'Email', 'Rol', 'Acceso', 'Último acceso', 'Estado', '']}
          rows={data.map((a) => ({
            key: a.id,
            cells: [
              <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{a.name}{a.id === currentAdminId ? ' (vos)' : ''}</span>,
              <span key="e" style={{ color: 'var(--color-body)' }}>{a.email}</span>,
              <Pill key="r" text={ROLE_LABELS[a.role] ?? a.role} tone={a.role === 'SUPERADMIN' ? 'blue' : 'gray'} />,
              <span key="acc" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{[a.hasPassword && 'Contraseña', a.hasGoogle && 'Google'].filter(Boolean).join(' · ') || '—'}</span>,
              a.lastAccessAt ? date(a.lastAccessAt) : 'Nunca',
              <span key="st" style={{ color: a.isActive ? '#059669' : 'var(--color-subtle)', fontWeight: 600, fontSize: 12 }}>{a.isActive ? 'Activo' : 'Inactivo'}</span>,
              <div key="acciones" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditando(a)} style={btnGhostSm}>Editar</button>
                {a.isActive && a.id !== currentAdminId && (
                  <button onClick={() => setDesactivando(a)} style={{ ...btnGhostSm, color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.35)' }}>Desactivar</button>
                )}
              </div>,
            ],
          }))}
        />
      </Card>

      {editando && (
        <AdminFormModal
          admin={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recargar() }}
        />
      )}
      {desactivando && (
        <ConfirmModal
          title={`¿Desactivar a ${desactivando.name}?`}
          body="No va a poder iniciar sesión hasta que lo reactives creándolo de nuevo con el mismo email."
          confirmLabel="Desactivar"
          onCancel={() => setDesactivando(null)}
          onConfirm={async () => {
            await platformApi.removeAdmin(desactivando.id)
            setDesactivando(null)
            recargar()
          }}
        />
      )}
    </div>
  )
}

function AdminFormModal({ admin, onClose, onSaved }: { admin: AdminRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(admin?.name ?? '')
  const [email, setEmail] = useState(admin?.email ?? '')
  const [role, setRole] = useState<PlatformAdminRole>(admin?.role ?? 'OPERATOR')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim()) {
      setError('Completá el nombre y el email.')
      return
    }
    setGuardando(true)
    try {
      if (admin) await platformApi.updateAdmin(admin.id, { name: name.trim(), email: email.trim(), role })
      else await platformApi.createAdmin({ name: name.trim(), email: email.trim(), role })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={admin ? 'Editar admin' : 'Nuevo admin'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBox msg={error} />}
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Email">
          {/* El backend no soporta cambiar el email de un admin existente. */}
          <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!admin} style={{ ...inputStyle, opacity: admin ? 0.6 : 1 }} />
        </Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value as PlatformAdminRole)} style={inputStyle}>
            <option value="OPERATOR">Operador</option>
            <option value="SUPERADMIN">Super administrador</option>
          </select>
        </Field>
        {!admin && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
            Sin contraseña inicial: entra vinculando su cuenta de Google en el primer login, o pedís que resetee la contraseña.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={guardando} style={btnPrimary}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

// ─── Logs de auditoría ─────────────────────────────────────────────────────────
function TabLogs() {
  const [adminId, setAdminId] = useState('')
  const [action, setAction] = useState('')
  const [businessId, setBusinessId] = useState('')
  const { data: admins } = useFetch(() => platformApi.admins(), [])
  const { data: businesses } = useFetch(() => platformApi.businesses({ limit: 100 }), [])
  const { data, error } = useFetch(
    () => platformApi.logs({ adminId: adminId || undefined, action: action || undefined, businessId: businessId || undefined, limit: 50 }),
    [adminId, action, businessId],
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={adminId} onChange={(e) => setAdminId(e.target.value)} style={{ ...inputStyle, width: 200 }}>
          <option value="">Todos los admins</option>
          {(admins ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{ ...inputStyle, width: 200 }}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} style={{ ...inputStyle, width: 220 }}>
          <option value="">Todos los negocios</option>
          {(businesses?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {error ? (
        <ErrorBox msg="No se pudieron cargar los logs." />
      ) : !data ? (
        <Loader />
      ) : (
        <Card noPad>
          <Table
            head={['Fecha', 'Admin', 'Acción', 'Negocio', 'Detalle']}
            rows={data.data.map((l: LogRow) => ({
              key: l.id,
              cells: [
                <span key="f" style={{ fontFamily: 'monospace', fontSize: 12 }}>{dateTime(l.createdAt)}</span>,
                <span key="a" style={{ color: 'var(--color-text)' }}>{l.admin.name}</span>,
                <Pill key="ac" text={ACTION_LABELS[l.action] ?? l.action} tone="blue" />,
                l.businessName ?? <span key="n" style={{ color: 'var(--color-subtle)' }}>—</span>,
                l.details ? <span key="d" style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{JSON.stringify(l.details)}</span> : <span key="d" style={{ color: 'var(--color-subtle)' }}>—</span>,
              ],
            }))}
          />
          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
            {data.total} registro(s){data.total > data.data.length ? ` · mostrando ${data.data.length}` : ''}
          </div>
        </Card>
      )}
    </div>
  )
}
