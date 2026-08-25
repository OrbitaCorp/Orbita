import { useEffect } from 'react'
import { useOrbiStore } from './useOrbiStore'

export function useOrbiKeyboardShortcut() {
  const toggle = useOrbiStore(s => s.toggle)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      const target = e.target as HTMLElement | null
      const enEscritura = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      )
      if (enEscritura) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])
}
