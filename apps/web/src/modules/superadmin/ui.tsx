import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
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

// ─── Diccionarios de jerga ────────────────────────────────────────────────────
// El backend devuelve enums en inglés y en mayúsculas (ACTIVE, PAST_DUE,
// SHOWCASE…). Mostrarlos crudos era lo que hacía que el panel se leyera como
// una consola de base de datos: acá se traducen una sola vez y todas las
// pantallas los usan.
// Las claves son los valores EXACTOS de los enums de Prisma
// (apps/api/prisma/schema.prisma) — si no coinciden, humanize() cae al valor
// crudo y el panel vuelve a hablar en mayúsculas.
export const SUB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Al día',
  PAST_DUE: 'Pago vencido',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
}
export const SUB_ORIGIN_LABELS: Record<string, string> = { PAID: 'Paga', COMP: 'Cortesía' }
// Los dos planes que escribe hoy el backend: 'starter' en un alta paga
// (subscriptions.service.ts) y 'standard' al ceder una cortesía
// (platform.service.ts).
export const PLAN_LABELS: Record<string, string> = { starter: 'Inicial', standard: 'Estándar' }
// Los dos modos que ofrece Órbita: vidriera (catálogo sin carrito) y checkout
// (la tienda vende y cobra online).
export const MODE_LABELS: Record<string, string> = { FULL: 'Modo checkout', SHOWCASE: 'Modo vidriera' }
export const DOMAIN_SOURCE_LABELS: Record<string, string> = { PURCHASED: 'Vendido', LINKED: 'Vinculado' }
export const DOMAIN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', VERIFYING: 'Verificando', ACTIVE: 'Activo', SUSPENDED: 'Suspendido', EXPIRED: 'Vencido',
}
export const SSL_LABELS: Record<string, string> = {
  PROVISIONING: 'Emitiéndose', ACTIVE: 'Activo', FAILED: 'Falló',
}
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  PUBLISHED: 'Publicado', DRAFT: 'Borrador', OUT_OF_STOCK: 'Sin stock',
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobado', FAILED: 'Falló el cobro', PENDING: 'Pendiente',
}
// Ojo: acá el backend NO manda un enum sino el nombre del rol tal como lo creó
// el seed (platform.service.ts devuelve `m.role.name`), que va en minúscula.
export const MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño', admin: 'Administrador', empleado: 'Empleado',
}
// Traduce si conoce la clave; si no, deja el valor crudo (nunca esconde datos).
export function humanize(value: string, dict: Record<string, string>): string {
  return dict[value] ?? value
}

// ─── Hook de fetch mínimo (sin dependencias externas) ────────────────────────
// Al recargar (ej. cambiar el rango de un gráfico) NO se borran los datos
// viejos: se marca `loading` y quien lo consume atenúa lo que ya está dibujado.
// Antes se ponía data en null y la sección entera se reemplazaba por un
// spinner, así que la página saltaba de alto en cada cambio de filtro.
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: boolean; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const stable = useCallback(fn, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    stable()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => {
      cancelled = true
    }
  }, [stable])
  return { data, error, loading }
}

// ─── Layout / contenedores ────────────────────────────────────────────────────
export function Grid({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${small ? 170 : 200}px, 1fr))`, gap: 14 }}>{children}</div>
}
export function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>{children}</div>
}

// Encabezado de pantalla: dice dónde estás y qué estás mirando antes de
// mostrar el primer número. Sin esto se aterrizaba directo en una pared de
// datos sin contexto.
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        {/* 26px es el h1 del panel (ver ClienteLista/ProductoLista): con 19px
            el título pesaba menos que el número de cualquier KPI. */}
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle && <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.45, maxWidth: 640 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Kpi({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div style={{
      background: 'var(--color-bg)',
      border: `1px solid ${accent ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 14,
      padding: '16px 18px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 10, lineHeight: 1.3 }}>{label}</div>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        color: accent ? 'var(--color-primary)' : 'var(--color-text)',
        fontFamily: '"Geist Mono", monospace',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--color-subtle)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

export function Card({ title, subtitle, children, noPad, action }: { title?: string; subtitle?: string; children: React.ReactNode; noPad?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
      {title && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : 18 }}>{children}</div>
    </div>
  )
}

export function DistList({ map, labels }: { map: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(map)
  if (entries.length === 0) return <Empty text="Sin datos." />
  // Barra proporcional: de un vistazo se ve el reparto sin tener que comparar
  // números uno por uno.
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 5 }}>
            <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{labels?.[k] ?? k}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{v}</span>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((v / max) * 100)}%`, height: '100%', borderRadius: 999, background: 'var(--color-primary)', opacity: 0.75 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
export function DistRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--color-body)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{value}</span>
    </div>
  )
}

export function Table({ head, rows, alignRight }: {
  head: string[]
  rows: { key: string; cells: React.ReactNode[]; onClick?: () => void }[]
  // Índices de columna alineados a la derecha. Sin esto cae en la heurística
  // vieja (las últimas 3 columnas si hay más de 4), que acertaba en las tablas
  // de conteos pero desalineaba las demás.
  alignRight?: number[]
}) {
  const esDerecha = (i: number, total: number) =>
    alignRight ? alignRight.includes(i) : i >= total - 3 && total > 4
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} style={{
              textAlign: esDerecha(i, head.length) ? 'right' : 'left',
              padding: '12px 18px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-muted)',
              background: 'var(--color-surface)',
              whiteSpace: 'nowrap',
              borderBottom: '1px solid var(--color-border)',
            }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} style={{ padding: 28, textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>Sin resultados</td></tr>
          ) : rows.map((r) => (
            <tr key={r.key} onClick={r.onClick} className={r.onClick ? 'ds-hover' : undefined} style={{ borderBottom: '1px solid var(--color-border)' }}>
              {r.cells.map((c, i) => (
                <td key={i} style={{
                  padding: '13px 18px',
                  textAlign: esDerecha(i, r.cells.length) ? 'right' : 'left',
                  color: 'var(--color-body)',
                  verticalAlign: 'middle',
                  lineHeight: 1.45,
                }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Badges / pills ───────────────────────────────────────────────────────────
// Todos los tonos salen de tokens del tema. Antes eran hexadecimales fijos de
// la paleta clara, así que en modo oscuro quedaban píldoras casi blancas
// (mismo bug que ya se había arreglado en el Badge del design system).
type Tone = 'blue' | 'gray' | 'green' | 'amber' | 'red' | 'violet'
const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  blue:   { bg: 'var(--color-primary-bg)', fg: 'var(--chip-primary-fg)', dot: '#3B82F6' },
  green:  { bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)', dot: '#10B981' },
  amber:  { bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)', dot: '#F59E0B' },
  red:    { bg: 'var(--color-error-bg)',   fg: 'var(--chip-error-fg)',   dot: '#EF4444' },
  violet: { bg: 'var(--color-violet-bg)',  fg: 'var(--chip-violet-fg)',  dot: '#8B5CF6' },
  gray:   { bg: 'var(--color-surface-alt)', fg: 'var(--color-muted)',    dot: '#94A3B8' },
}

function Chip({ text, tone, dot = false, title }: { text: string; tone: Tone; dot?: boolean; title?: string }) {
  const c = TONES[tone]
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: `0 ${dot ? 10 : 9}px`, borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />}
      {text}
    </span>
  )
}
export { Chip }

const STATUS_TONE: Record<BusinessStatus, { tone: Tone; label: string }> = {
  active: { tone: 'green', label: 'Activo' },
  paused: { tone: 'amber', label: 'Pausado' },
  draft:  { tone: 'gray',  label: 'Borrador' },
}
export function StatusBadge({ status }: { status: BusinessStatus }) {
  const s = STATUS_TONE[status]
  return <Chip text={s.label} tone={s.tone} dot />
}

export function SubBadge({ status, origin }: { status: string; origin: string }) {
  const tone: Tone = status === 'ACTIVE' ? 'green' : status === 'PAST_DUE' ? 'amber' : 'red'
  const label = humanize(status, SUB_STATUS_LABELS)
  // La cortesía se marca aparte, en violeta: no es un estado de cobro sino un
  // origen, y mezclarlos en el mismo chip escondía uno de los dos.
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Chip text={label} tone={tone} dot title={`Estado en el sistema: ${status}`} />
      {origin === 'COMP' && <Chip text="Cortesía" tone="violet" />}
    </span>
  )
}

export function Pill({ text, tone }: { text: string; tone: Tone }) {
  return <Chip text={text} tone={tone} />
}

// ─── Estados de carga/error ───────────────────────────────────────────────────
export function Loader() {
  return <div style={{ padding: 44, display: 'grid', placeItems: 'center' }}><div style={{ width: 26, height: 26, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'orbita-spin 0.7s linear infinite' }} /><style>{`@keyframes orbita-spin{to{transform:rotate(360deg)}}`}</style></div>
}
export function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ padding: '14px 16px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', borderRadius: 12, color: 'var(--color-error)', fontSize: 13.5, fontWeight: 500 }}>{msg}</div>
}
export function Empty({ text }: { text: string }) {
  return <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)' }}>{text}</div>
}

// ─── Botones / inputs ─────────────────────────────────────────────────────────
// fontFamily: 'inherit' es obligatorio — <button> e <input> NO heredan la
// tipografía de la página, así que sin esto el panel mezclaba la fuente de
// Órbita con la fuente por defecto del navegador en cada control.
export const btnGhost: React.CSSProperties = { height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }
export const btnGhostSm: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-body)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
// color-on-primary y no '#fff': en oscuro el primario es un celeste claro, y
// el blanco encima queda sin contraste.
export const btnPrimary: React.CSSProperties = { height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }
export const inputStyle: React.CSSProperties = { height: 40, padding: '0 13px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }

// ─── Modales ───────────────────────────────────────────────────────────────────
export function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 90, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: 'var(--shadow-card-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ds-hover" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-muted)', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
      {label}
      {children}
      {hint && <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}
export function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <ModalShell onClose={onCancel} title={title}>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.55 }}>{body}</p>
      {error && <div style={{ marginBottom: 14 }}><ErrorBox msg={error} /></div>}
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
