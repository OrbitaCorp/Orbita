import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Datos para transferir que el negocio cargó en Configuración → Pagos
// (alias, titular y entidad, los tres opcionales). Se usa en el checkout de
// "Coordinar por WhatsApp" y en la pantalla de pedido registrado: así el
// cliente que quiere adelantar el pago no tiene que pedirlos por chat.
// Devuelve null si el negocio no cargó ninguno.
export function DatosTransferencia({ alias, titular, entidad }: {
  alias?: string | null
  titular?: string | null
  entidad?: string | null
}) {
  const [copiado, setCopiado] = useState(false)
  const filas: { etiqueta: string; valor: string; copiable?: boolean }[] = []
  if (alias) filas.push({ etiqueta: 'Alias', valor: alias, copiable: true })
  if (titular) filas.push({ etiqueta: 'Titular', valor: titular })
  if (entidad) filas.push({ etiqueta: 'Entidad', valor: entidad })
  if (filas.length === 0) return null

  function copiar(valor: string) {
    // Sin permiso de portapapeles (o sin https) no pasa nada: el alias sigue visible.
    navigator.clipboard?.writeText(valor).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    }).catch(() => {})
  }

  return (
    <div style={{ textAlign: 'left', padding: '4px 14px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      {filas.map((f, i) => (
        <div key={f.etiqueta} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '10px 0', borderBottom: i < filas.length - 1 ? '1px solid var(--color-border)' : 'none',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600 }}>{f.etiqueta}</div>
            <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600, wordBreak: 'break-word' }}>{f.valor}</div>
          </div>
          {f.copiable && (
            <button
              type="button"
              className="ds-hover"
              onClick={e => { e.stopPropagation(); copiar(f.valor) }}
              style={{
                flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--color-border)',
                color: 'var(--color-body)', fontSize: 12, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
