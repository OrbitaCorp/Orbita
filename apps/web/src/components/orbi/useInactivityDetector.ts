import { useState, useEffect, useRef, useCallback } from 'react'

interface Options {
  thresholdMs?: number
}

export function useInactivityDetector(
  fields: Record<string, string>,
  { thresholdMs = 30000 }: Options = {},
) {
  const [idleField, setIdleField] = useState<string | null>(null)
  const dismissed = useRef(new Set<string>())
  const lastChange = useRef<Record<string, number>>({})
  const prevValues = useRef<Record<string, string>>({})

  useEffect(() => {
    for (const [name, value] of Object.entries(fields)) {
      if (prevValues.current[name] !== value) {
        lastChange.current[name] = Date.now()
        prevValues.current[name] = value
        if (idleField === name) setIdleField(null)
      }
      if (!(name in lastChange.current)) {
        lastChange.current[name] = Date.now()
      }
    }
  }, [fields, idleField])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      for (const [name, value] of Object.entries(fields)) {
        if (value) continue
        if (dismissed.current.has(name)) continue
        const last = lastChange.current[name] ?? now
        if (now - last >= thresholdMs) {
          setIdleField(name)
          return
        }
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [fields, thresholdMs])

  const dismissField = useCallback((name: string) => {
    dismissed.current.add(name)
    setIdleField(f => f === name ? null : f)
  }, [])

  return { idleField, dismissField }
}
