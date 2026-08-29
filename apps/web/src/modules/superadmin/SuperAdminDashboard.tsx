import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/hooks/useAuth'
import { apexUrl } from '@/lib/tenant'
import {
  platformApi,
  type AdminRow,
  type PlatformAdminRole,
  type LogRow,
  type MailTemplateRow,
} from '@/lib/platform/api'
import {
  LayoutDashboard, Store, Globe, Users, ShieldCheck, ScrollText, Mail,
  Search, Plus,
} from 'lucide-react'
import { SuperAdminShell, type ItemNav } from './Shell'
import {
  useFetch, Grid, Row2, Kpi, Card, Table, StatusBadge, SubBadge, Pill, Chip,
  Loader, ErrorBox, Empty, ModalShell, Field, ConfirmModal, PageHeader,
  btnGhost, btnGhostSm, btnPrimary, inputStyle,
  money, date, dateTime, ROLE_LABELS, ACTION_LABELS,
  humanize, MODE_LABELS, DOMAIN_SOURCE_LABELS, DOMAIN_STATUS_LABELS, SSL_LABELS,
  SUB_ORIGIN_LABELS, SUB_STATUS_LABELS, PLAN_LABELS,
} from './ui'
import { LineSeriesChart, AreaSeriesChart, BarDistribution, ChartSkeleton, RangePicker, useRange, fmtMoney } from './charts'

// Panel de plataforma (super admin) — apex orbita.site/superadmin.

const ES_TAB = (v: unknown): v is Tab => typeof v === 'string' && NAV.some((n) => n.id === v)

export function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  // La sección vive en la URL (?seccion=negocios), no en un useState: así cada
  // sección queda enlazable, el botón "atrás" del navegador funciona, y el
  // "volver" de la ficha de un negocio aterriza en Negocios y no en Resumen.
  const tab: Tab = ES_TAB(router.query.seccion) ? router.query.seccion : 'resumen'
  const setTab = (t: Tab) => void router.push(`/superadmin?seccion=${t}`, undefined, { shallow: true })
  if (!user || user.type !== 'platform_admin') return null

  const cerrarSesion = () => void logout().then(() => (window.location.href = apexUrl('/login')))

  return (
    <SuperAdminShell
      items={NAV}
      activo={tab}
      onNavegar={setTab}
      usuario={{ nombre: user.admin.name, rol: ROLE_LABELS[user.admin.role] ?? user.admin.role }}
      onCerrarSesion={cerrarSesion}
    >
      {tab === 'resumen' && <TabResumen />}
      {tab === 'negocios' && <TabNegocios />}
      {tab === 'dominios' && <TabDominios />}
      {tab === 'duenos' && <TabDuenos />}
      {tab === 'admins' && <TabAdmins currentAdminId={user.admin.id} />}
      {tab === 'logs' && <TabLogs />}
      {tab === 'testeo' && <TabTesteo />}
    </SuperAdminShell>
  )
}

export type Tab = 'resumen' | 'negocios' | 'dominios' | 'duenos' | 'admins' | 'logs' | 'testeo'
// Mismos 7 destinos de siempre, en el mismo orden, ahora agrupados en el
// sidebar: primero la foto general, después lo que es de los clientes y al
// final lo de puertas adentro de Órbita.
export const NAV: ItemNav<Tab>[] = [
  { id: 'resumen', label: 'Resumen', Icono: LayoutDashboard, grupo: 'General' },
  { id: 'negocios', label: 'Negocios', Icono: Store, grupo: 'Clientes' },
  { id: 'dominios', label: 'Dominios', Icono: Globe, grupo: 'Clientes' },
  { id: 'duenos', label: 'Dueños', Icono: Users, grupo: 'Clientes' },
  { id: 'admins', label: 'Admins', Icono: ShieldCheck, grupo: 'Interno' },
  { id: 'logs', label: 'Actividad', Icono: ScrollText, grupo: 'Interno' },
  { id: 'testeo', label: 'Emails', Icono: Mail, grupo: 'Interno' },
]

// ─── Resumen ──────────────────────────────────────────────────────────────────
function TabResumen() {
  const { data, error } = useFetch(() => platformApi.overview(), [])
  // Un solo rango para toda la pantalla: antes había un selector adentro de
  // cada tarjeta y los dos gráficos podían quedar mirando períodos distintos,
  // que es la forma más fácil de sacar una conclusión equivocada.
  const [range, setRange] = useRange(30)
  const { data: growth, loading: cargandoGrowth } = useFetch(() => platformApi.growthSeries(range), [range])
  const { data: revenue, loading: cargandoRevenue } = useFetch(() => platformApi.revenueSeries(range), [range])
  const { data: subs } = useFetch(() => platformApi.subscriptions(), [])

  if (error) return <ErrorBox msg="No se pudo cargar el resumen." />
  if (!data) return <Loader />

  const topNegocios = (subs ?? [])
    .filter((s) => s.status === 'ACTIVE' && s.origin === 'PAID' && s.business)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Resumen"
        subtitle="Cómo viene la plataforma hoy: facturación, negocios y dominios."
        action={<RangePicker value={range} onChange={setRange} />}
      />

      <Grid>
        <Kpi label="Facturación mensual" value={money(data.subscriptions.mrr)} accent hint="Suma de las suscripciones pagas activas" />
        <Kpi label="Negocios totales" value={String(data.businesses.total)} hint={`${data.businesses.active} funcionando hoy`} />
        <Kpi label="Altas últimos 30 días" value={`+${data.businesses.newLast30Days}`} hint="Negocios nuevos" />
        <Kpi label="Negocios activos" value={String(data.businesses.active)} hint="Vendiendo con normalidad" />
        <Kpi label="Negocios pausados" value={String(data.businesses.paused)} hint="Su tienda no acepta pedidos" />
        <Kpi label="En borrador" value={String(data.businesses.draft)} hint="Todavía sin publicar" />
        <Kpi label="Direcciones web en uso" value={String(data.domains.subdomainsInUse)} hint="Subdominios de orbita.site ocupados" />
        <Kpi
          label="Dominios por vencer"
          value={String(data.domains.expiringSoon)}
          hint={data.domains.expiringSoon === 0 ? 'Ninguno por ahora' : 'Hay que renovarlos pronto'}
        />
      </Grid>

      <Card
        title="Altas por día"
        subtitle="Negocios nuevos y suscripciones pagas nuevas, día por día"
      >
        {!growth ? <ChartSkeleton /> : (
          <LineSeriesChart
            data={growth.series.map((p) => ({ date: p.date, negocios: p.businesses, suscripciones: p.subscriptions }))}
            series={[
              { key: 'negocios', label: 'Negocios nuevos' },
              { key: 'suscripciones', label: 'Suscripciones pagas nuevas' },
            ]}
            cargando={cargandoGrowth}
          />
        )}
      </Card>

      <Card
        title="Ingresos por día"
        subtitle="Solo pagos ya aprobados"
      >
        {!revenue ? <ChartSkeleton /> : (
          <AreaSeriesChart
            data={revenue.series.map((p) => ({ date: p.date, value: p.amount }))}
            label="Ingresos"
            formatValue={fmtMoney}
            cargando={cargandoRevenue}
          />
        )}
      </Card>

      <Card title="Los que más facturan" subtitle="Negocios con suscripción paga activa, de mayor a menor" noPad>
        {!subs ? <Loader /> : topNegocios.length === 0 ? (
          <Empty text="Todavía no hay suscripciones pagas activas." />
        ) : (
          <Table
            head={['Negocio', 'Plan', 'Por mes', 'Vence el']}
            alignRight={[2, 3]}
            rows={topNegocios.map((s) => ({
              key: s.businessId,
              cells: [
                <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{s.business!.name}</span>,
                humanize(s.plan, PLAN_LABELS),
                <span key="m" style={{ fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{money(s.amount)}</span>,
                date(s.currentPeriodEnd),
              ],
            }))}
          />
        )}
      </Card>

      <Row2>
        {/* El estado de una suscripción SÍ significa bien/mal, así que acá el
            color es de estado. En los otros repartos la categoría es solo
            identidad, y todas las barras van del mismo color: el largo ya
            codifica la magnitud, teñirlas además sería decir dos veces lo
            mismo y gastar el único canal libre. */}
        <Card title="Suscripciones por estado">
          <BarDistribution items={repartoConEstado(data.subscriptions.byStatus, SUB_STATUS_LABELS)} />
        </Card>
        <Card title="Suscripciones por origen">
          <BarDistribution items={reparto(data.subscriptions.byOrigin, SUB_ORIGIN_LABELS)} />
        </Card>
      </Row2>

      <Row2>
        <Card title="Negocios por modo" subtitle="Vidriera (solo catálogo) o checkout (venden y cobran online)">
          <BarDistribution items={reparto(data.businesses.byMode, MODE_LABELS)} />
        </Card>
        <Card title="Negocios por rubro" subtitle="Los rubros con más negocios">
          <BarDistribution
            items={data.businesses.byIndustry.map((r) => ({ label: r.industry, value: r.count }))}
            maxItems={8}
          />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Negocios"
        subtitle="Todos los negocios de la plataforma. Hacé clic en una fila para ver su detalle."
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, dirección web o rubro…"
          className="ds-field"
          style={{ ...inputStyle, width: '100%', paddingLeft: 38 }}
        />
      </div>

      {error ? (
        <ErrorBox msg="No se pudo cargar la lista de negocios." />
      ) : !data ? (
        <Loader />
      ) : (
        <Card noPad>
          <Table
            head={['Negocio', 'Dueño', 'Estado', 'Suscripción', 'Productos', 'Pedidos', 'Clientes']}
            alignRight={[4, 5, 6]}
            rows={data.data.map((b) => ({
              key: b.id,
              onClick: () => router.push(`/superadmin/negocios/${b.id}`),
              cells: [
                <div key="n">
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
                    {b.subdomain}.orbita.site{b.customDomain ? ` · ${b.customDomain}` : ''}
                  </div>
                </div>,
                b.owner ? (
                  <div key="o">
                    <div style={{ color: 'var(--color-text)', marginBottom: 2 }}>{b.owner.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{b.owner.email}</div>
                  </div>
                ) : <span key="o" style={{ color: 'var(--color-subtle)' }}>Sin dueño</span>,
                <StatusBadge key="s" status={b.status} />,
                b.subscription ? <SubBadge key="sub" status={b.subscription.status} origin={b.subscription.origin} /> : <Chip key="sub" text="Sin suscripción" tone="gray" />,
                <Num key="p" n={b.counts.products} />,
                <Num key="pe" n={b.counts.orders} />,
                <Num key="c" n={b.counts.customers} />,
              ],
            }))}
          />
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
            {data.total === 1 ? '1 negocio' : `${data.total} negocios`}{data.total > data.data.length ? ` · se muestran los primeros ${data.data.length}` : ''}
          </div>
        </Card>
      )}
    </div>
  )
}

// El backend devuelve los repartos como {clave: cantidad}. Acá se traducen las
// claves y se ordenan de mayor a menor, que es como se leen: primero lo que más
// pesa.
function reparto(map: Record<string, number>, labels?: Record<string, string>) {
  return Object.entries(map)
    .map(([k, v]) => ({ label: labels?.[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value)
}

const TONO_SUB_ESTADO: Record<string, string> = {
  ACTIVE: 'var(--color-success)',
  PAST_DUE: 'var(--color-warning)',
  SUSPENDED: 'var(--color-error)',
  CANCELLED: 'var(--color-subtle)',
}
function repartoConEstado(map: Record<string, number>, labels?: Record<string, string>) {
  return Object.entries(map)
    .map(([k, v]) => ({ label: labels?.[k] ?? k, value: v, tono: TONO_SUB_ESTADO[k] ?? 'var(--chart-1)' }))
    .sort((a, b) => b.value - a.value)
}

// Número de tabla: alineado a la derecha y en la mono del panel, para que las
// columnas de conteo se lean como una columna y no como texto suelto.
function Num({ n }: { n: number }) {
  return <span style={{ fontFamily: '"Geist Mono", monospace', color: n === 0 ? 'var(--color-subtle)' : 'var(--color-text)', fontWeight: 500 }}>{n.toLocaleString('es-AR')}</span>
}

// ─── Dominios ─────────────────────────────────────────────────────────────────
function TabDominios() {
  const { data, error } = useFetch(() => platformApi.domains(), [])
  if (error) return <ErrorBox msg="No se pudieron cargar los dominios." />
  if (!data) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Dominios"
        subtitle="Las direcciones web de cada negocio: las propias que compraron o vincularon, y las de orbita.site."
      />

      <Card
        title="Dominios propios"
        subtitle="Comprados a través de Órbita o vinculados por el negocio"
        action={<Chip text={`${data.customDomains.length}`} tone="gray" />}
        noPad
      >
        {data.customDomains.length === 0 ? <Empty text="Todavía ningún negocio tiene un dominio propio." /> : (
          <Table
            head={['Dominio', 'Negocio', 'Origen', 'Estado', 'Certificado SSL', 'Vence el']}
            alignRight={[5]}
            rows={data.customDomains.map((d) => ({
              key: d.domain,
              cells: [
                <span key="d" style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600, color: 'var(--color-text)' }}>{d.domain}</span>,
                d.businessName,
                <Pill key="o" text={humanize(d.source, DOMAIN_SOURCE_LABELS)} tone={d.source === 'PURCHASED' ? 'blue' : 'gray'} />,
                <Chip key="st" text={humanize(d.status, DOMAIN_STATUS_LABELS)} tone={toneEstado(d.status)} dot title={`Estado en el sistema: ${d.status}`} />,
                <Chip key="ssl" text={humanize(d.sslStatus, SSL_LABELS)} tone={toneEstado(d.sslStatus)} dot title={`Estado en el sistema: ${d.sslStatus}`} />,
                d.expiresAt ? date(d.expiresAt) : <span key="v" style={{ color: 'var(--color-subtle)' }}>Sin vencimiento</span>,
              ],
            }))}
          />
        )}
      </Card>

      <Card
        title="Direcciones en orbita.site"
        subtitle="El subdominio gratuito que recibe cada negocio al crearse"
        action={<Chip text={`${data.subdomains.length}`} tone="gray" />}
        noPad
      >
        <Table
          head={['Dirección', 'Negocio', 'Modo', 'Estado']}
          rows={data.subdomains.map((s) => ({
            key: s.subdomain,
            cells: [
              <span key="s" style={{ fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)' }}>{s.fullHost}</span>,
              s.businessName,
              humanize(s.mode, MODE_LABELS),
              <StatusBadge key="st" status={s.status} />,
            ],
          }))}
        />
      </Card>
    </div>
  )
}

// Tono del chip según el estado crudo del backend: verde si está todo bien,
// ámbar si está en trámite, rojo si falló.
function toneEstado(estado: string): 'green' | 'amber' | 'red' | 'gray' {
  if (estado === 'ACTIVE') return 'green'
  if (['PENDING', 'VERIFYING', 'PROVISIONING'].includes(estado)) return 'amber'
  if (['FAILED', 'EXPIRED', 'SUSPENDED'].includes(estado)) return 'red'
  return 'gray'
}

// ─── Dueños ───────────────────────────────────────────────────────────────────
function TabDuenos() {
  const { data, error } = useFetch(() => platformApi.owners(), [])
  if (error) return <ErrorBox msg="No se pudieron cargar los dueños." />
  if (!data) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Dueños"
        subtitle="Las personas que crearon un negocio en Órbita y su último ingreso al panel."
      />
      <Card noPad>
        <Table
          head={['Dueño', 'Email', 'Negocio', 'Último acceso']}
          alignRight={[3]}
          rows={data.map((o) => ({
            key: o.id,
            cells: [
              <span key="n" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{o.name}</span>,
              <span key="e" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--color-body)' }}>{o.email}</span>
                {!o.emailVerified && <Chip text="Sin verificar" tone="amber" />}
              </span>,
              o.business ? (
                <div key="b">
                  <div style={{ color: 'var(--color-text)', marginBottom: 2 }}>{o.business.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{o.business.subdomain}.orbita.site</div>
                </div>
              ) : <span key="b" style={{ color: 'var(--color-subtle)' }}>Sin negocio</span>,
              o.lastAccessAt ? date(o.lastAccessAt) : <span key="la" style={{ color: 'var(--color-subtle)' }}>Nunca entró</span>,
            ],
          }))}
        />
      </Card>
    </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Admins"
        subtitle="Quién puede entrar a este panel de plataforma y con qué permisos."
        action={
          <button onClick={() => setEditando('nuevo')} className="ds-hover" style={btnPrimary}>
            <Plus size={16} strokeWidth={2} /> Nuevo admin
          </button>
        }
      />
      <Card noPad>
        <Table
          head={['Nombre', 'Email', 'Rol', 'Cómo entra', 'Último acceso', 'Estado', 'Acciones']}
          alignRight={[6]}
          rows={data.map((a) => ({
            key: a.id,
            cells: [
              <span key="n" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{a.name}</span>
                {a.id === currentAdminId && <Chip text="Vos" tone="blue" />}
              </span>,
              <span key="e" style={{ color: 'var(--color-body)' }}>{a.email}</span>,
              <Pill key="r" text={ROLE_LABELS[a.role] ?? a.role} tone={a.role === 'SUPERADMIN' ? 'blue' : 'gray'} />,
              <span key="acc" style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
                {[a.hasPassword && 'Contraseña', a.hasGoogle && 'Google'].filter(Boolean).join(' · ') || 'Todavía no configuró'}
              </span>,
              a.lastAccessAt ? date(a.lastAccessAt) : <span key="la" style={{ color: 'var(--color-subtle)' }}>Nunca entró</span>,
              <Chip key="st" text={a.isActive ? 'Activo' : 'Inactivo'} tone={a.isActive ? 'green' : 'gray'} dot />,
              <div key="acciones" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditando(a)} className="ds-hover" style={btnGhostSm}>Editar</button>
                {a.isActive && a.id !== currentAdminId && (
                  <button onClick={() => setDesactivando(a)} className="ds-hover" style={{ ...btnGhostSm, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>Desactivar</button>
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
          <input value={name} onChange={(e) => setName(e.target.value)} className="ds-field" style={inputStyle} />
        </Field>
        <Field label="Email">
          {/* El backend no soporta cambiar el email de un admin existente. */}
          <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!admin} className="ds-field" style={{ ...inputStyle, opacity: admin ? 0.6 : 1 }} />
        </Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value as PlatformAdminRole)} className="ds-field" style={inputStyle}>
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
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button type="submit" disabled={guardando} className="ds-hover" style={btnPrimary}>{guardando ? 'Guardando…' : 'Guardar'}</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Registro de actividad"
        subtitle="Todo lo que hicieron los admins sobre los negocios, con fecha y responsable."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 500 }}>Filtrar por</span>
        <select value={adminId} onChange={(e) => setAdminId(e.target.value)} className="ds-field" style={{ ...inputStyle, minWidth: 200 }}>
          <option value="">Todos los admins</option>
          {(admins ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="ds-field" style={{ ...inputStyle, minWidth: 200 }}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="ds-field" style={{ ...inputStyle, minWidth: 220 }}>
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
            head={['Cuándo', 'Quién', 'Qué hizo', 'Negocio', 'Detalle']}
            rows={data.data.map((l: LogRow) => ({
              key: l.id,
              cells: [
                <span key="f" style={{ fontSize: 13, color: 'var(--color-body)', whiteSpace: 'nowrap' }}>{dateTime(l.createdAt)}</span>,
                <span key="a" style={{ color: 'var(--color-text)', fontWeight: 500 }}>{l.admin.name}</span>,
                <Pill key="ac" text={ACTION_LABELS[l.action] ?? l.action} tone="blue" />,
                l.businessName ?? <span key="n" style={{ color: 'var(--color-subtle)' }}>-</span>,
                <DetalleLog key="d" details={l.details} />,
              ],
            }))}
          />
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)' }}>
            {data.total === 1 ? '1 movimiento' : `${data.total} movimientos`}{data.total > data.data.length ? ` · se muestran los últimos ${data.data.length}` : ''}
          </div>
        </Card>
      )}
    </div>
  )
}

// El detalle del log venía del backend como un objeto suelto y se mostraba con
// JSON.stringify — llaves, comillas y nombres en inglés en el medio de la
// tabla. Acá se abre en "Etiqueta: valor", que es lo mismo pero legible.
const DETAIL_LABELS: Record<string, string> = {
  reason: 'Motivo',
  grantReason: 'Motivo',
  currentPeriodEnd: 'Vigente hasta',
  name: 'Nombre',
  email: 'Email',
  role: 'Rol',
  plan: 'Plan',
  amount: 'Monto',
  status: 'Estado',
}

// Valores conocidos que pueden aparecer dentro del detalle de un log.
const VALORES_DETALLE: Record<string, string> = {
  ...ROLE_LABELS,
  ...SUB_STATUS_LABELS,
  ...PLAN_LABELS,
}

function DetalleLog({ details }: { details: unknown }) {
  if (!details || typeof details !== 'object') return <span style={{ color: 'var(--color-subtle)' }}>-</span>
  const entradas = Object.entries(details as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entradas.length === 0) return <span style={{ color: 'var(--color-subtle)' }}>-</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5 }}>
      {entradas.map(([k, v]) => {
        const crudo = typeof v === 'object' ? JSON.stringify(v) : String(v)
        // Las fechas ISO llegan como string largo; se muestran en formato local.
        const esFecha = /^\d{4}-\d{2}-\d{2}T/.test(crudo)
        // Los valores también se traducen, no solo la etiqueta: si no, el
        // detalle terminaba diciendo "Rol: SUPERADMIN".
        const valor = esFecha ? date(crudo) : humanize(crudo, VALORES_DETALLE)
        return (
          <div key={k}>
            <span style={{ color: 'var(--color-muted)' }}>{DETAIL_LABELS[k] ?? k}: </span>
            <span style={{ color: 'var(--color-body)' }}>{valor}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Testeo (RBT-607) ───────────────────────────────────────────────────────
// Preview de las 15 plantillas de email (+ variantes con/sin datos
// opcionales) con datos ficticios, y un botón para mandarse una prueba real
// — pedido de Ale 16/08 tras el rediseño visual, para poder chequear cómo se
// ven sin tener que disparar un flujo real (pedido, invitación, etc.).
function TabTesteo() {
  const { data: templates, error } = useFetch(() => platformApi.mailTemplates(), [])
  const [selected, setSelected] = useState<string | null>(null)
  const { data: preview } = useFetch(
    () => (selected ? platformApi.mailPreview(selected) : Promise.resolve(null)),
    [selected],
  )
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (templates && !selected && templates.length > 0) setSelected(templates[0].id)
  }, [templates, selected])

  async function enviarPrueba() {
    if (!selected) return
    if (!to.trim() || !to.includes('@')) {
      setSendMsg({ ok: false, text: 'Escribí un email válido.' })
      return
    }
    setSending(true)
    setSendMsg(null)
    try {
      const { sent } = await platformApi.sendMailTest(selected, to.trim())
      setSendMsg(sent ? { ok: true, text: `Enviado a ${to.trim()}.` } : { ok: false, text: 'El proveedor de email rechazó el envío.' })
    } catch (err) {
      setSendMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo enviar.' })
    } finally {
      setSending(false)
    }
  }

  if (error) return <ErrorBox msg="No se pudo cargar la lista de plantillas." />
  if (!templates) return <Loader />

  const grupos: MailTemplateRow['group'][] = ['Cuenta', 'Equipo', 'Pedidos', 'Plataforma']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Testeo de emails"
        subtitle="Mirá cómo le llega cada email a un cliente, con datos de ejemplo, y mandate una prueba real para verlo en tu bandeja."
      />
      <div className="sa-testeo" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
        <style>{`@media (max-width: 860px) { .sa-testeo { grid-template-columns: 1fr !important; } }`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-card)' }}>
          {grupos.map((g) => {
            const items = templates.filter((t) => t.group === g)
            if (items.length === 0) return null
            return (
              <div key={g}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7, paddingLeft: 10 }}>{g}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelected(t.id); setSendMsg(null) }}
                      className="ds-hover"
                      style={{
                        textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '9px 10px',
                        fontSize: 13, lineHeight: 1.35, fontFamily: 'inherit',
                        background: selected === t.id ? 'var(--color-primary-bg)' : 'transparent',
                        color: selected === t.id ? 'var(--color-primary)' : 'var(--color-body)',
                        fontWeight: selected === t.id ? 700 : 500,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title={preview?.subject ?? 'Cargando…'} subtitle="Así se ve el asunto y el cuerpo del email">
            {!preview ? <Loader /> : (
              <iframe
                title="Preview del email"
                srcDoc={preview.html}
                style={{ width: '100%', maxWidth: 600, height: 700, border: '1px solid var(--color-border)', borderRadius: 12, display: 'block', margin: '0 auto', background: '#fff' }}
              />
            )}
          </Card>

          <Card title="Enviar una prueba" subtitle="Llega un email real, con datos de ejemplo, a la dirección que pongas">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="tu@email.com"
                className="ds-field"
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
              />
              <button onClick={enviarPrueba} disabled={sending || !selected} className="ds-hover" style={btnPrimary}>
                {sending ? 'Enviando…' : 'Enviar prueba'}
              </button>
            </div>
            {sendMsg && (
              <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 500, color: sendMsg.ok ? 'var(--color-success)' : 'var(--color-error)' }}>{sendMsg.text}</p>
            )}
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Se manda igual que un email de verdad (con reintentos y queda registrado en Actividad), así podés chequear cómo se ve en Gmail, Outlook y demás.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
