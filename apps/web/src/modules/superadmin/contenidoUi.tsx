import { useCallback, useEffect, useState } from 'react'
import { PlatformApiError } from '@/lib/platform/api'
import { ErrorBox, btnGhostSm } from './ui'

// Piezas compartidas por el contenido de las cuentas de la empresa en Marketing (Instagram y TikTok): publicaciones,
// comentarios y números. Son pantallas de lectura que muestran tal cual el motivo que da el servidor cuando falla
// (por ejemplo "Falta autorizar los comentarios: volvé a conectar Instagram") en vez de un "no se pudo cargar" mudo.

/** El motivo de un error de la API, o `porDefecto` si no hay uno legible. */
export function motivoDe(e: unknown, porDefecto: string): string {
  if (e instanceof PlatformApiError && e.message && !/^Platform API \d+$/.test(e.message)) return e.message
  return porDefecto
}

/** Carga con motivo del error y `recargar`. `fn` se vuelve a pedir cuando cambia `deps` o se llama a `recargar`. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[], porDefecto = 'No se pudo cargar. Probá de nuevo.') {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [n, setN] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    fn()
      .then((r) => { if (vigente) { setData(r); setError('') } })
      .catch((e: unknown) => { if (vigente) setError(motivoDe(e, porDefecto)) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])

  const recargar = useCallback(() => setN((x) => x + 1), [])
  return { data, error, cargando, recargar, setData }
}

export function ErrorConReintento({ msg, onReintentar }: { msg: string; onReintentar: () => void }) {
  return <ErrorBox msg={msg} action={<button type="button" onClick={onReintentar} className="ds-hover" style={btnGhostSm}>Reintentar</button>} />
}

/** Un número grande con su nombre, y cuánto cambió contra el período anterior si se sabe. */
export function Numero({ etiqueta, valor, cambio, ayuda }: { etiqueta: string; valor: string; cambio?: number | null; ayuda?: string }) {
  return (
    <div title={ayuda} style={{ padding: '14px 16px', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-bg)', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{etiqueta}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginTop: 4, letterSpacing: '-0.01em' }}>{valor}</div>
      {cambio !== undefined && cambio !== null && (
        <div style={{ fontSize: 11.5, marginTop: 3, color: cambio >= 0 ? 'var(--chip-success-fg)' : 'var(--chip-error-fg)' }}>
          {cambio >= 0 ? '▲' : '▼'} {Math.abs(cambio)}% vs. el período anterior
        </div>
      )}
    </div>
  )
}

export function Miniatura({ url, alto = 140, children }: { url: string | null; alto?: number; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', height: alto, background: 'var(--color-surface-alt)', overflow: 'hidden' }}>
      {url && <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      {children}
    </div>
  )
}

export const grillaDeTarjetas: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }

export const tarjeta: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }

/** Una fila de números chicos (me gusta, comentarios, vistas…) bajo una publicación. */
export function Cifras({ items }: { items: { etiqueta: string; valor: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--color-muted)' }}>
      {items.map((i) => (
        <span key={i.etiqueta}><strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{i.valor}</strong> {i.etiqueta}</span>
      ))}
    </div>
  )
}
