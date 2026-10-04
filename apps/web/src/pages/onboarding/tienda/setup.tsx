import { useEffect } from 'react'
import { useRouter } from 'next/router'

// El alta ahora es una sola pantalla (/onboarding/rubro, ver
// modules/turnos/onboarding/Alta.tsx). Esta ruta queda como redirect por
// compatibilidad con links y pestañas viejas.
export default function SetupRedirect() {
  const router = useRouter()
  useEffect(() => { void router.replace('/onboarding/rubro') }, [router])
  return null
}
