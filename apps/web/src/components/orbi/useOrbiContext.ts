import { useRouter } from 'next/router'
import { useMemo } from 'react'
import type { OrbiContext } from './types'
import { useAuth } from '@/hooks/useAuth'

interface WizardOverrides {
  step?: number
  stepName?: string
  rubro?: string
  availableOptions?: { key: string; label: string; description?: string }[]
}

let wizardOverrides: WizardOverrides = {}

export function setWizardContext(overrides: WizardOverrides) {
  wizardOverrides = overrides
}

export function useOrbiContext(): OrbiContext {
  const router = useRouter()
  const { user } = useAuth()
  const { slug } = router.query

  return useMemo(() => {
    if (router.pathname.startsWith('/onboarding')) {
      return {
        surface: 'wizard' as const,
        ...wizardOverrides,
      }
    }

    const partes = Array.isArray(slug) ? slug : []
    const section = partes[partes.length - 1]
    const module = partes.length >= 2 ? partes[partes.length - 2] : undefined

    return {
      surface: 'panel' as const,
      module: module ?? section ?? undefined,
      section: partes.length >= 2 ? section : undefined,
      businessId: user?.type === 'member' ? user.business.id : undefined,
      permissions: user?.type === 'member' ? user.permissions : undefined,
    }
  }, [router.pathname, slug, user])
}
