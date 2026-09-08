import { Timer } from 'lucide-react'
import { fmtFechaHora, isoADisplay } from '../utils'
import type { Descuento } from '../types'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function DataRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 12,
        padding: '9px 0',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{children}</div>
    </div>
  )
}

interface Props { descuento: Descuento }

export function DetalleVigencia({ descuento }: Props) {
  const { fechaInicio, fechaFin, diasVigencia, horaInicio, horaFin, limiteUsosTotal } = descuento
  const sinVencimiento = fechaFin === null
  const todoElDia = horaInicio === null

  const diasActivos = diasVigencia ?? [0, 1, 2, 3, 4, 5, 6]

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-muted)',
        }}
      >
        Vigencia
      </p>

      <DataRow label="Inicio">{isoADisplay(fechaInicio) || fechaInicio}</DataRow>

      <DataRow label="Fin">
        {sinVencimiento ? (
          <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Sin vencimiento</span>
        ) : descuento.tipo === 'oferta_relampago' ? (
          // La oferta relámpago termina en un instante exacto: se muestra con
          // la hora, en la zona horaria del navegador.
          fmtFechaHora(fechaFin!) || fechaFin
        ) : (
          isoADisplay(fechaFin!) || fechaFin
        )}
      </DataRow>

      {descuento.tipo === 'oferta_relampago' && (
        <DataRow label="Reloj en la portada">
          {descuento.estado === 'expirado' ? (
            // La fila sigue apuntando a este descuento, pero la portada ya no
            // muestra nada: decir "en la portada" acá mentiría.
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-muted)' }}>
              <Timer size={14} strokeWidth={2.2} aria-hidden />
              Terminó: ya no se muestra
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-warning)' }}>
              <Timer size={14} strokeWidth={2.2} aria-hidden />
              Corriendo hasta la hora de fin
            </span>
          )}
        </DataRow>
      )}

      <DataRow label="Días activos">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DIAS.map((dia, i) => {
            const activo = diasActivos.includes(i)
            return (
              <span
                key={dia}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  fontSize: 11,
                  fontWeight: 600,
                  background: activo ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: activo ? '#fff' : 'var(--color-muted)',
                  border: activo ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {dia.slice(0, 2)}
              </span>
            )
          })}
        </div>
      </DataRow>

      {!todoElDia && (
        <DataRow label="Horario">
          {horaInicio} – {horaFin}
        </DataRow>
      )}

      <DataRow label="Límite de usos" last>
        {limiteUsosTotal === null ? (
          <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>Ilimitado</span>
        ) : (
          <span style={{ fontFamily: '"Geist Mono", "Fira Code", monospace' }}>
            {limiteUsosTotal.toLocaleString('es-AR')}
          </span>
        )}
      </DataRow>
    </div>
  )
}
