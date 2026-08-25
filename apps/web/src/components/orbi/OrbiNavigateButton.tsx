import { useRouter } from 'next/router'
import { ArrowRight } from 'lucide-react'
import { useOrbiStore } from './useOrbiStore'

export function OrbiNavigateButton({ path, label }: { path: string; label: string }) {
  const router = useRouter()
  const close = useOrbiStore(s => s.close)

  return (
    <button
      onClick={() => { router.push(path); close() }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        background: '#EFF6FF', color: '#1D4ED8',
        border: '1px solid #BFDBFE', cursor: 'pointer',
        fontSize: 12, fontWeight: 600,
        transition: 'background 140ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
    >
      {label}
      <ArrowRight size={13} strokeWidth={2} />
    </button>
  )
}
