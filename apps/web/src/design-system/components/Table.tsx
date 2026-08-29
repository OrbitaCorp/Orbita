import type { ReactNode } from 'react';
import { useState } from 'react';

export interface Column<T> {
  key:      keyof T | string;
  header:   string;
  render?:  (row: T) => ReactNode;
  align?:   'left' | 'right';
  width?:   string;
}

interface PaginationProps {
  page:     number;
  total:    number;
  perPage:  number;
  onChange: (page: number) => void;
}

interface TableProps<T> {
  columns:     Column<T>[];
  data:        T[];
  keyField:    keyof T;
  pagination?: PaginationProps;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}

function ChevronLeft() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ChevronRight() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
}

function PageButton({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      className="ds-hover"
      disabled={disabled}
      onClick={onClick}
      style={{
        height:     30,
        padding:    '0 10px',
        borderRadius: 6,
        border:     `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary-bg, #EFF6FF)' : 'var(--color-surface)',
        color:      active ? 'var(--color-primary)' : 'var(--color-body)',
        fontWeight: active ? 600 : 500,
        fontSize:   12,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? 0.5 : 1,
        fontFamily: '"Geist Mono", monospace',
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
      }}
    >
      {children}
    </button>
  );
}

export function Table<T>({ columns, data, keyField, pagination, emptyState, onRowClick }: TableProps<T>) {
  const [hovered, setHovered] = useState<number | null>(null);

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.perPage) : 1;
  const start      = pagination ? (pagination.page - 1) * pagination.perPage + 1 : 1;
  const end        = pagination ? Math.min(pagination.page * pagination.perPage, pagination.total) : data.length;

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border)',
      borderRadius: 10,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        display:          'grid',
        gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
        gap:              12,
        padding:          '0 16px',
        height:           40,
        background:       'var(--color-surface-alt)',
        borderBottom:     '1px solid var(--color-border)',
      }}>
        {columns.map(col => (
          <div key={String(col.key)} style={{
            fontSize:      11,
            fontWeight:    600,
            color:         'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display:       'flex',
            alignItems:    'center',
            justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
          }}>
            {col.header}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 13 }}>
          {emptyState ?? 'Sin datos'}
        </div>
      ) : (
        data.map((row, i) => (
          <div
            key={String(row[keyField])}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onRowClick?.(row)}
            style={{
              display:          'grid',
              gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
              gap:              12,
              padding:          '0 16px',
              height:           52,
              borderBottom:     i < data.length - 1 ? '1px solid var(--color-border)' : 'none',
              background:       hovered === i ? 'var(--color-surface-alt)' : 'transparent',
              transition:       'background 150ms ease',
              cursor:           onRowClick ? 'pointer' : 'default',
              alignItems:       'center',
            }}
          >
            {columns.map(col => (
              <div key={String(col.key)} style={{
                fontSize:      13,
                color:         'var(--color-body)',
                display:       'flex',
                alignItems:    'center',
                justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                overflow:      'hidden',
              }}>
                {col.render
                  ? col.render(row)
                  : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Pagination */}
      {pagination && (
        <div style={{
          padding:        '12px 16px',
          borderTop:      '1px solid var(--color-border)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          flexWrap:       'wrap',
        }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>
            {start}–{end} de {pagination.total}
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            <PageButton disabled={pagination.page === 1} onClick={() => pagination.onChange(pagination.page - 1)}>
              <ChevronLeft /> Anterior
            </PageButton>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <PageButton key={p} active={p === pagination.page} onClick={() => pagination.onChange(p)}>
                {p}
              </PageButton>
            ))}

            <PageButton disabled={pagination.page === totalPages} onClick={() => pagination.onChange(pagination.page + 1)}>
              Siguiente <ChevronRight />
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}
