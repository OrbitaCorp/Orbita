// DEMO INTERNA — página de una propuesta. Ver modules/propuestas/datos.ts.
import { useRouter } from 'next/router'
import Link from 'next/link'
import { propuestaPorId } from '@/modules/propuestas/datos'
import { ShellPropuesta } from '@/modules/propuestas/Shell'
import { PROTOTIPOS } from '@/modules/propuestas/prototipos'

export default function PropuestaPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : ''
  const p = propuestaPorId(id)
  if (!router.isReady) return null
  if (!p) {
    return (
      <div style={{ minHeight: '100vh', background: '#070B16', color: '#CBD5E1', display: 'grid', placeItems: 'center', fontFamily: 'Geist, sans-serif' }}>
        <div>No existe esa propuesta. <Link href="/propuestas" style={{ color: '#93C5FD' }}>Volver al hub</Link></div>
      </div>
    )
  }
  const Proto = PROTOTIPOS[p.id]
  return (
    <ShellPropuesta p={p}>
      {Proto ? <Proto /> : <div style={{ padding: 40, color: '#94A3B8' }}>Prototipo en construcción…</div>}
    </ShellPropuesta>
  )
}
