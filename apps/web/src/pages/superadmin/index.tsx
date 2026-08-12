import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { apexUrl } from '@/lib/tenant'
import {
  platformApi,
  type Overview,
  type BusinessRow,
  type BusinessDetail,
  type DomainsList,
  type OwnerRow,
  type BusinessStatus,
  type AdminRow,
  type PlatformAdminRole,
} from '@/lib/platform/api'

// Panel de plataforma (super admin) — apex orbita.site/superadmin. Fase B: el
// contenido real (negocios, dueños, dominios, métricas) sobre los endpoints
// /platform/* del backend.
export default function SuperAdminPage() {
  return (
    <RequireAuth type="platform_admin">
      <Panel />
    </RequireAuth>
  )
}

type Tab = 'resumen' | 'negocios' | 'dominios' | 'duenos' | 'admins'
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'negocios', label: 'Negocios' },
  { id: 'dominios', label: 'Dominios' },
  { id: 'duenos', label: 'Dueños' },
  { id: 'admins', label: 'Admins' },
]
const ROLE_LABELS: Record<string, string> = { SUPERADMIN: 'Super administrador', OPERATOR: 'Operador' }

function Panel() {
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
      </div>
    </div>
  )
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
function TabResumen() {
  const { data, error } = useFetch(() => platformApi.overview(), [])
  if (error) return <ErrorBox msg="No se pudo cargar el resumen." />
  if (!data) return <Loader />

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
              <DistRow key={r.industry} label={r.industry} value={r.count} />
            ))}
          </div>
        </Card>
      </Row2>
    </div>
  )
}

// ─── Negocios ─────────────────────────────────────────────────────────────────
function TabNegocios() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
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
              onClick: () => setDetailId(b.id),
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
      {detailId && <BusinessDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function BusinessDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = useFetch(() => platformApi.business(id), [id])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 80, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', background: 'var(--color-bg)', borderLeft: '1px solid var(--color-border)', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cerrar ✕</button>
        </div>
        {error ? <ErrorBox msg="No se pudo cargar el negocio." /> : !data ? <Loader /> : <BusinessDetailView d={data} />}
      </div>
    </div>
  )
}

function BusinessDetailView({ d }: { d: BusinessDetail }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{d.name}</h2>
          <StatusBadge status={d.status} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{d.subdomain}.orbita.site</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2 }}>{d.industry}{d.subrubros?.length ? ` · ${d.subrubros.join(', ')}` : ''} · alta {date(d.createdAt)}</div>
      </div>

      <Grid small>
        <Kpi label="Ventas totales" value={money(d.metrics.salesAllTime)} />
        <Kpi label="Ventas (30 días)" value={money(d.metrics.salesLast30Days)} />
        <Kpi label="Pedidos" value={String(d.metrics.orders)} />
        <Kpi label="Clientes" value={String(d.metrics.customers)} />
        <Kpi label="Productos" value={String(d.metrics.products)} />
        <Kpi label="Pedidos (30d)" value={String(d.metrics.ordersLast30Days)} />
      </Grid>

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
          </div>
        ) : <Empty text="Sin suscripción." />}
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
                {date(a.createdAt)} · <strong style={{ color: 'var(--color-body)' }}>{a.action}</strong>{a.admin ? ` — ${a.admin.name}` : ''}
              </div>
            ))}
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

// ─── Admins (RBT-647) ─────────────────────────────────────────────────────────
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

function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onCancel} title={title}>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-body)' }}>{body}</p>
      {error && <div style={{ marginBottom: 12 }}><ErrorBox msg={error} /></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} style={btnGhost}>Cancelar</button>
        <button
          type="button"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true)
            setError('')
            try {
              await onConfirm()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
              setEnviando(false)
            }
          }}
          style={{ ...btnPrimary, background: 'var(--color-error)' }}
        >
          {enviando ? 'Confirmando…' : confirmLabel}
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)' }}>
      {label}
      {children}
    </label>
  )
}

// ─── Hook de fetch mínimo (sin dependencias externas) ────────────────────────
function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const stable = useCallback(fn, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    stable()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [stable])
  return { data, error }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Grid({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${small ? 130 : 160}px, 1fr))`, gap: 12 }}>{children}</div>
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>{children}</div>
}
function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
function Card({ title, children, noPad }: { title?: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      {title && <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{title}</div>}
      <div style={{ padding: noPad ? 0 : 14 }}>{children}</div>
    </div>
  )
}
function DistList({ map, labels }: { map: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(map)
  if (entries.length === 0) return <Empty text="Sin datos." />
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{entries.map(([k, v]) => <DistRow key={k} label={labels?.[k] ?? k} value={v} />)}</div>
}
function DistRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--color-body)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
function Table({ head, rows }: { head: string[]; rows: { key: string; cells: React.ReactNode[]; onClick?: () => void }[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={{ textAlign: i >= head.length - 3 && head.length > 4 ? 'right' : 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid var(--color-border)' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} style={{ padding: 20, textAlign: 'center', color: 'var(--color-muted)' }}>Sin resultados</td></tr>
          ) : rows.map((r) => (
            <tr key={r.key} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default', borderBottom: '1px solid var(--color-border)' }}>
              {r.cells.map((c, i) => <td key={i} style={{ padding: '10px 14px', textAlign: i >= r.cells.length - 3 && r.cells.length > 4 ? 'right' : 'left', color: 'var(--color-body)', verticalAlign: 'top' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const STATUS_STYLE: Record<BusinessStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,0.12)', fg: '#059669', label: 'Activo' },
  paused: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309', label: 'Pausado' },
  draft: { bg: 'rgba(100,116,139,0.14)', fg: '#475569', label: 'Borrador' },
}
function StatusBadge({ status }: { status: BusinessStatus }) {
  const s = STATUS_STYLE[status]
  return <span style={{ background: s.bg, color: s.fg, padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
}
function SubBadge({ status, origin }: { status: string; origin: string }) {
  const tone = status === 'ACTIVE' ? { bg: 'rgba(16,185,129,0.12)', fg: '#059669' } : status === 'PAST_DUE' ? { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' } : { bg: 'rgba(239,68,68,0.12)', fg: '#DC2626' }
  return <span style={{ background: tone.bg, color: tone.fg, padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{status}{origin === 'COMP' ? ' · cortesía' : ''}</span>
}
function Pill({ text, tone }: { text: string; tone: 'blue' | 'gray' }) {
  const c = tone === 'blue' ? { bg: 'var(--color-primary-bg)', fg: 'var(--color-primary)' } : { bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)' }
  return <span style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>{text}</span>
}
function Loader() {
  return <div style={{ padding: 40, display: 'grid', placeItems: 'center' }}><div style={{ width: 26, height: 26, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'orbita-spin 0.7s linear infinite' }} /><style>{`@keyframes orbita-spin{to{transform:rotate(360deg)}}`}</style></div>
}
function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: 'var(--color-error)', fontSize: 13 }}>{msg}</div>
}
function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--color-subtle)' }}>{text}</div>
}
const btnGhost: React.CSSProperties = { height: 36, padding: '0 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGhostSm: React.CSSProperties = { height: 28, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const inputStyle: React.CSSProperties = { height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13.5 }

function money(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function date(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function OrbitLogo() {
  return (
    <svg viewBox="0 0 30 30" fill="none" style={{ width: 30, height: 30 }}>
      <circle cx="15" cy="15" r="13" stroke="#2563eb" strokeWidth="3.2" strokeDasharray="60 22" strokeLinecap="round" />
      <circle cx="25.5" cy="7.5" r="4" fill="#93c5fd" />
      <circle cx="15" cy="15" r="4.5" fill="#1e3a8a" />
    </svg>
  )
}
