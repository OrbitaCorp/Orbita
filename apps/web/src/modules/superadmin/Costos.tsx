import { useState } from 'react'
import { RefreshCw, Plus, AlertTriangle, Check, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react'
import {
  platformApi,
  type CostProviderSummary,
  type CostLimitRow,
  type CostAlertRow,
  type CostBusinessRow,
  type CreateCostLimitInput,
} from '@/lib/platform/api'
import {
  useFetch, Card, Table, PageHeader, Loader, ErrorBox, Empty,
  ModalShell, Field, btnGhost, btnGhostSm, btnPrimary, inputStyle,
} from './ui'

// ─── Constantes ──────────────────────────────────────────────────────────────

const MONTHS_RANGES = [
  { value: 1, label: '1M' },
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
] as const

const PROVIDER_ICONS: Record<string, string> = {
  gcloud: '☁️', cloudflare: '🔶', supabase: '⚡', gemini: '✦',
  vercel: '▲', resend: '✉', groq: '⚙',
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtUsdShort(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return fmtUsd(n)
}

function fmtPercent(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function Sparkline({ data, color, width = 100, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return `${x},${y}`
  })
  const pathD = `M${points.join(' L')}`
  const areaD = `${pathD} L${width - pad},${height} L${pad},${height} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Service Card (Account Balance style) ────────────────────────────────────

function ServiceCard({ provider, onClick }: { provider: CostProviderSummary; onClick?: () => void }) {
  const isUp = provider.deltaPercent > 0
  const isDown = provider.deltaPercent < 0
  const deltaColor = isUp ? 'var(--color-error)' : isDown ? '#10B981' : 'var(--color-muted)'
  return (
    <div
      onClick={onClick}
      className="ds-hover"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: provider.color + '18',
          display: 'grid', placeItems: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {PROVIDER_ICONS[provider.slug] ?? '●'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {provider.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: 'var(--color-text)',
              fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>
              {fmtUsd(provider.amountUsd)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: deltaColor }}>
          {isUp && <TrendingUp size={13} />}
          {isDown && <TrendingDown size={13} />}
          {provider.deltaPercent !== 0 ? fmtPercent(provider.deltaPercent) : '='}
          <span style={{ fontWeight: 400, color: 'var(--color-muted)', marginLeft: 2 }}>vs mes ant.</span>
        </div>
        <Sparkline data={provider.sparkline} color={provider.color} width={80} height={28} />
      </div>
    </div>
  )
}

// ─── Limit progress bar ──────────────────────────────────────────────────────

function LimitBar({ limit }: { limit: CostLimitRow }) {
  const pct = Math.min(limit.percent, 100)
  const tone = pct >= 95 ? 'var(--color-error)' : pct >= 80 ? '#F59E0B' : 'var(--color-primary)'
  const label = limit.provider ? limit.provider.name : 'Global'
  const category = limit.category ? ` · ${limit.category}` : ''
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
          {label}{category}
          <span style={{ color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
            {limit.type === 'SPEND' ? 'Gasto' : 'Uso'}
          </span>
        </div>
        <div style={{ fontSize: 12, fontFamily: '"Geist Mono", monospace', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {fmtUsdShort(limit.currentValue)} / {fmtUsdShort(limit.threshold)} {limit.unit}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: tone, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, textAlign: 'right' }}>
        {pct.toFixed(0)}%
      </div>
    </div>
  )
}

// ─── Manual Snapshot Modal ───────────────────────────────────────────────────

function ManualModal({ providers, onClose, onSaved }: {
  providers: CostProviderSummary[]
  onClose: () => void
  onSaved: () => void
}) {
  const [slug, setSlug] = useState(providers[0]?.slug ?? '')
  const [month, setMonth] = useState(currentMonth())
  const [amount, setAmount] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  return (
    <ModalShell title="Cargar costo manual" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Servicio">
          <select value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Mes">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
        </Field>
        <Field label="Monto (USD)">
          <input
            type="number" step="0.01" min="0" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        {error && <ErrorBox msg={error} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button
            type="button"
            className="ds-hover"
            disabled={enviando || !amount}
            onClick={async () => {
              setEnviando(true)
              setError('')
              try {
                await platformApi.costsManualSnapshot({ providerSlug: slug, month, amountUsd: Number(amount) })
                onSaved()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo guardar.')
                setEnviando(false)
              }
            }}
            style={btnPrimary}
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── New Limit Modal ─────────────────────────────────────────────────────────

function LimitModal({ providers, onClose, onSaved }: {
  providers: CostProviderSummary[]
  onClose: () => void
  onSaved: () => void
}) {
  const [slug, setSlug] = useState<string>('')
  const [type, setType] = useState<'SPEND' | 'USAGE'>('SPEND')
  const [threshold, setThreshold] = useState('')
  const [unit, setUnit] = useState('USD')
  const [alertPcts, setAlertPcts] = useState('80,95')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  return (
    <ModalShell title="Nuevo límite" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Servicio" hint="Dejá vacío para un límite global">
          <select value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            <option value="">Global (todos)</option>
            {providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={type} onChange={(e) => setType(e.target.value as 'SPEND' | 'USAGE')} style={{ ...inputStyle, width: '100%' }}>
            <option value="SPEND">Gasto (USD)</option>
            <option value="USAGE">Uso (cantidad)</option>
          </select>
        </Field>
        <Field label="Umbral">
          <input
            type="number" step="0.01" min="0" placeholder="100.00"
            value={threshold} onChange={(e) => setThreshold(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        <Field label="Unidad">
          <input
            type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
            placeholder="USD, tokens, emails…"
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        <Field label="Alertar al %" hint="Separados por coma, ej: 80,95">
          <input
            type="text" value={alertPcts} onChange={(e) => setAlertPcts(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        {error && <ErrorBox msg={error} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-hover" style={btnGhost}>Cancelar</button>
          <button
            type="button"
            className="ds-hover"
            disabled={enviando || !threshold}
            onClick={async () => {
              setEnviando(true)
              setError('')
              try {
                const input: CreateCostLimitInput = {
                  providerSlug: slug || null,
                  type,
                  threshold: Number(threshold),
                  unit,
                  alertAtPercent: alertPcts.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)),
                }
                await platformApi.costsCreateLimit(input)
                onSaved()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo crear.')
                setEnviando(false)
              }
            }}
            style={btnPrimary}
          >
            {enviando ? 'Creando…' : 'Crear límite'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Tab principal ───────────────────────────────────────────────────────────

export function TabCostos() {
  const [months, setMonths] = useState(3)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((k) => k + 1)

  const { data: overview, error: errOverview, loading: loadingOverview } = useFetch(
    () => platformApi.costsOverview(months), [months, tick],
  )
  const { data: limits } = useFetch(() => platformApi.costsLimits(), [tick])
  const { data: alerts } = useFetch(() => platformApi.costsAlerts(), [tick])
  const { data: byBiz } = useFetch(() => platformApi.costsByBusiness(), [tick])

  const [syncing, setSyncing] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showLimit, setShowLimit] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await platformApi.costsSync()
      reload()
    } finally {
      setSyncing(false)
    }
  }

  if (errOverview) return <ErrorBox msg="No se pudo cargar el control de costos." />
  if (!overview && loadingOverview) return <Loader />

  const providers = overview?.providers ?? []
  const totalUsd = overview?.totalUsd ?? 0
  const deltaPercent = overview?.deltaPercent ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <PageHeader
        title="Control de Costos"
        subtitle="Monitoreo de gastos de servicios SaaS — ciclo mensual en USD."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MonthsPicker value={months} onChange={setMonths} />
            <button
              type="button"
              className="ds-hover"
              onClick={handleSync}
              disabled={syncing}
              style={btnGhost}
              title="Sincronizar con APIs externas"
            >
              <RefreshCw size={14} style={{ animation: syncing ? 'orbita-spin 0.7s linear infinite' : undefined }} />
              {syncing ? 'Sync…' : 'Sync'}
            </button>
          </div>
        }
      />

      {/* Servicios - Account Balance grid */}
      <Card
        title="Servicios"
        subtitle={`Gasto total: ${fmtUsd(totalUsd)}${deltaPercent !== 0 ? ` (${fmtPercent(deltaPercent)} vs mes anterior)` : ''}`}
        action={
          <button type="button" className="ds-hover" onClick={() => setShowManual(true)} style={btnGhostSm}>
            <Plus size={13} /> Cargar manual
          </button>
        }
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 14,
          opacity: loadingOverview ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}>
          {providers.map((p) => (
            <ServiceCard key={p.slug} provider={p} />
          ))}
          {providers.length === 0 && !loadingOverview && (
            <Empty text="No hay proveedores configurados. Cargá datos manuales para empezar." />
          )}
        </div>
      </Card>

      {/* Two columns: Limits + Top businesses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Límites activos */}
        <Card
          title="Límites activos"
          action={
            <button type="button" className="ds-hover" onClick={() => setShowLimit(true)} style={btnGhostSm}>
              <Plus size={13} /> Nuevo límite
            </button>
          }
        >
          {limits && limits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {limits.filter((l) => l.active).map((l) => <LimitBar key={l.id} limit={l} />)}
            </div>
          ) : (
            <Empty text="Sin límites configurados." />
          )}
        </Card>

        {/* Top negocios por consumo */}
        <Card title="Top negocios por consumo">
          {byBiz && byBiz.businesses.length > 0 ? (
            <Table
              head={['Negocio', 'Total', '% del total']}
              alignRight={[1, 2]}
              rows={byBiz.businesses.slice(0, 10).map((b) => ({
                key: b.businessId,
                cells: [
                  <span key="n" style={{ fontWeight: 500 }}>{b.businessName}</span>,
                  <span key="t" style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{fmtUsd(b.totalEstimatedUsd)}</span>,
                  <div key="p" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden', minWidth: 40 }}>
                      <div style={{ width: `${Math.min(b.pctOfTotal, 100)}%`, height: '100%', borderRadius: 999, background: 'var(--color-primary)', opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 12, fontFamily: '"Geist Mono", monospace', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {b.pctOfTotal.toFixed(1)}%
                    </span>
                  </div>,
                ],
              }))}
            />
          ) : (
            <Empty text="Sin datos de consumo por negocio." />
          )}
        </Card>
      </div>

      {/* Alertas recientes */}
      <Card title="Alertas recientes">
        {alerts && alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} onAck={async () => { await platformApi.costsAckAlert(a.id); reload() }} />
            ))}
          </div>
        ) : (
          <Empty text="Sin alertas — todo dentro de los límites." />
        )}
      </Card>

      {/* Modales */}
      {showManual && <ManualModal providers={providers} onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); reload() }} />}
      {showLimit && <LimitModal providers={providers} onClose={() => setShowLimit(false)} onSaved={() => { setShowLimit(false); reload() }} />}
    </div>
  )
}

// ─── Alert row ───────────────────────────────────────────────────────────────

function AlertRow({ alert, onAck }: { alert: CostAlertRow; onAck: () => Promise<void> }) {
  const [acking, setAcking] = useState(false)
  const pending = !alert.acknowledgedAt
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: pending ? 'var(--color-warning-bg)' : 'var(--color-surface)',
      border: `1px solid ${pending ? '#F59E0B40' : 'var(--color-border)'}`,
      opacity: pending ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <AlertTriangle size={15} style={{ color: pending ? '#F59E0B' : 'var(--color-muted)', flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--color-text)' }}>
          <span style={{ fontWeight: 600 }}>{alert.limit.provider?.name ?? 'Global'}</span>
          {' alcanzó '}
          <span style={{ fontWeight: 700, fontFamily: '"Geist Mono", monospace' }}>{alert.percentReached}%</span>
          {' del límite '}
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
            ({fmtUsd(alert.currentValue)} / {fmtUsd(alert.limit.threshold)} {alert.limit.unit})
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
          {new Date(alert.notifiedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
        </span>
        {pending && (
          <button
            type="button"
            className="ds-hover"
            disabled={acking}
            onClick={async () => { setAcking(true); await onAck() }}
            style={btnGhostSm}
            title="Marcar como vista"
          >
            <Check size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Months picker ───────────────────────────────────────────────────────────

function MonthsPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div
      role="group"
      aria-label="Período"
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        borderRadius: 10,
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}
    >
      {MONTHS_RANGES.map((r) => {
        const activo = r.value === value
        return (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            aria-pressed={activo}
            className={activo ? undefined : 'ds-hover'}
            style={{
              height: 30, padding: '0 13px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', border: 'none',
              background: activo ? 'var(--color-bg)' : 'transparent',
              color: activo ? 'var(--color-text)' : 'var(--color-muted)',
              fontSize: 13, fontWeight: activo ? 600 : 500,
              boxShadow: activo ? 'var(--shadow-card)' : 'none',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
