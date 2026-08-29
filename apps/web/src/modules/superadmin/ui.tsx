import { useEffect, useState, useCallback } from 'react'
import type { BusinessStatus } from '@/lib/platform/api'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

// Piezas de UI compartidas entre el dashboard de super admin
// (SuperAdminDashboard) y la página de detalle de negocio (BusinessDetailPage)
// — extraídas de lo que antes vivía todo en pages/superadmin/index.tsx.

export const ROLE_LABELS: Record<string, string> = { SUPERADMIN: 'Super administrador', OPERATOR: 'Operador' }
// Mismos strings que escribe PlatformService en platformAdminLog.create (ver platform.service.ts).
export const ACTION_LABELS: Record<string, string> = {
  suspend_business: 'Suspender negocio',
  reactivate_business: 'Reactivar negocio',
  grant_comp: 'Ceder cortesía',
  create_admin: 'Crear admin',
  update_admin: 'Editar admin',
  deactivate_admin: 'Desactivar admin',
}

// ─── Hook de fetch mínimo (sin dependencias externas) ────────────────────────
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: boolean } {
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

// ─── Layout / contenedores ────────────────────────────────────────────────────
export function Grid({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${small ? 130 : 160}px, 1fr))`, gap: 12 }}>{children}</div>
}
export function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>{children}</div>
}
export function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
export function Card({ title, children, noPad, action }: { title?: string; children: React.ReactNode; noPad?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : 14 }}>{children}</div>
    </div>
  )
}
export function DistList({ map, labels }: { map: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(map)
  if (entries.length === 0) return <Empty text="Sin datos." />
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{entries.map(([k, v]) => <DistRow key={k} label={labels?.[k] ?? k} value={v} />)}</div>
}
export function DistRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--color-body)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
export function Table({ head, rows }: { head: string[]; rows: { key: string; cells: React.ReactNode[]; onClick?: () => void }[] }) {
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
            <tr key={r.key} onClick={r.onClick} className={r.onClick ? 'ds-hover' : undefined} style={{ cursor: r.onClick ? 'pointer' : 'default', borderBottom: '1px solid var(--color-border)' }}>
              {r.cells.map((c, i) => <td key={i} style={{ padding: '10px 14px', textAlign: i >= r.cells.length - 3 && r.cells.length > 4 ? 'right' : 'left', color: 'var(--color-body)', verticalAlign: 'top' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Badges / pills ───────────────────────────────────────────────────────────
const STATUS_STYLE: Record<BusinessStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,0.12)', fg: '#059669', label: 'Activo' },
  paused: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309', label: 'Pausado' },
  draft: { bg: 'rgba(100,116,139,0.14)', fg: '#475569', label: 'Borrador' },
}
export function StatusBadge({ status }: { status: BusinessStatus }) {
  const s = STATUS_STYLE[status]
  return <span style={{ background: s.bg, color: s.fg, padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
}
export function SubBadge({ status, origin }: { status: string; origin: string }) {
  const tone = status === 'ACTIVE' ? { bg: 'rgba(16,185,129,0.12)', fg: '#059669' } : status === 'PAST_DUE' ? { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' } : { bg: 'rgba(239,68,68,0.12)', fg: '#DC2626' }
  return <span style={{ background: tone.bg, color: tone.fg, padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{status}{origin === 'COMP' ? ' · cortesía' : ''}</span>
}
export function Pill({ text, tone }: { text: string; tone: 'blue' | 'gray' }) {
  const c = tone === 'blue' ? { bg: 'var(--color-primary-bg)', fg: 'var(--color-primary)' } : { bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)' }
  return <span style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>{text}</span>
}

// ─── Estados de carga/error ───────────────────────────────────────────────────
export function Loader() {
  return <div style={{ padding: 40, display: 'grid', placeItems: 'center' }}><div style={{ width: 26, height: 26, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'orbita-spin 0.7s linear infinite' }} /><style>{`@keyframes orbita-spin{to{transform:rotate(360deg)}}`}</style></div>
}
export function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: 'var(--color-error)', fontSize: 13 }}>{msg}</div>
}
export function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--color-subtle)' }}>{text}</div>
}

// ─── Botones / inputs ─────────────────────────────────────────────────────────
export const btnGhost: React.CSSProperties = { height: 36, padding: '0 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
export const btnGhostSm: React.CSSProperties = { height: 28, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
export const btnPrimary: React.CSSProperties = { height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
export const inputStyle: React.CSSProperties = { height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13.5 }

// ─── Modales ───────────────────────────────────────────────────────────────────
export function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--color-body)' }}>
      {label}
      {children}
    </label>
  )
}
export function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onCancel} title={title}>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-body)' }}>{body}</p>
      {error && <div style={{ marginBottom: 12 }}><ErrorBox msg={error} /></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} className="ds-hover" style={btnGhost}>Cancelar</button>
        <button
          type="button"
          className="ds-hover"
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

// ─── Formato ───────────────────────────────────────────────────────────────────
export function money(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
export function date(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function OrbitLogo() {
  // El orbital animado oficial del design-system (mismo que el panel y el login).
  return <OrbitaLogo size={30} />
}
