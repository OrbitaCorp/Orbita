import { ChevronRight } from 'lucide-react'

type Crumb = { label: string; href?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: 'var(--color-muted)', marginBottom: 24, flexWrap: 'wrap',
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {item.href ? (
            <a href={item.href} className="ds-link" style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>
              {item.label}
            </a>
          ) : (
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight size={12} color="var(--color-subtle)" />}
        </span>
      ))}
    </div>
  )
}
