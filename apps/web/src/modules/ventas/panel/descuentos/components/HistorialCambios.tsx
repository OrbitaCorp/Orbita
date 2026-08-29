import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { LogAuditoria } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

const ACCION_LABEL: Record<string, string> = {
  crear: 'creó el descuento',
  editar: 'editó el descuento',
  activar: 'activó el descuento',
  desactivar: 'desactivó el descuento',
  eliminar: 'eliminó el descuento',
}

function formatTimestamp(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso)
  const fecha = d
    .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '/')
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return { fecha, hora }
}

interface Props {
  logs: LogAuditoria[]
  tituloEntidad?: string // 'descuento' | 'cupón' para personalizar los textos
}

export function HistorialCambios({ logs, tituloEntidad = 'descuento' }: Props) {
  const [abierto, setAbierto] = useState(false)

  const accionLabel = (accion: string) =>
    ACCION_LABEL[accion]?.replace('el descuento', `el ${tituloEntidad}`) ?? accion

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        className="ds-hover"
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-muted)',
          }}
        >
          Historial de cambios
          <span
            style={{
              marginLeft: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--color-surface)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-body)',
            }}
          >
            {logs.length}
          </span>
        </span>
        {abierto ? <ChevronUp size={14} color="var(--color-muted)" /> : <ChevronDown size={14} color="var(--color-muted)" />}
      </button>

      {abierto && (
        <div style={{ padding: '4px 20px 20px' }}>
          {logs.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Sin historial registrado.</p>
          )}
          {logs.map((log, i) => {
            const { fecha, hora } = formatTimestamp(log.timestamp)
            const isLast = i === logs.length - 1
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  paddingBottom: isLast ? 0 : 16,
                  position: 'relative',
                }}
              >
                {/* Línea de timeline */}
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 5,
                      top: 14,
                      bottom: 0,
                      width: 1,
                      background: 'var(--color-border)',
                    }}
                  />
                )}
                {/* Punto */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    marginTop: 3,
                    background: 'var(--color-border-strong)',
                    border: '2px solid var(--color-bg)',
                    zIndex: 1,
                  }}
                />
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>
                    <strong>{log.usuarioNombre}</strong> {accionLabel(log.accion)}.
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: 'var(--color-muted)',
                      fontFamily: MONO,
                    }}
                  >
                    {fecha} · {hora}
                  </p>
                  {log.cambios.length > 0 && (
                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', listStyle: 'disc' }}>
                      {log.cambios.map((c, ci) => (
                        <li key={ci} style={{ fontSize: 12, color: 'var(--color-muted)', margin: '2px 0' }}>
                          <span style={{ color: 'var(--color-body)' }}>{c.campo}</span>:{' '}
                          <span style={{ fontFamily: MONO }}>{String(c.antes ?? '-')}</span> →{' '}
                          <span style={{ fontFamily: MONO }}>{String(c.despues ?? '-')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
