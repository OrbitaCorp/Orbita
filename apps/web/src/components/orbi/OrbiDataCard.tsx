export function OrbiDataCard({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
  if (!entries.length) return null

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      margin: '6px 0',
    }}>
      {entries.map(([key, val], i) => (
        <div key={key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px',
          background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-alt)',
          fontSize: 12,
        }}>
          <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>{key}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{String(val)}</span>
        </div>
      ))}
    </div>
  )
}
