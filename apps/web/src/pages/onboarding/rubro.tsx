// El alta de Órbita: un solo recorrido que arranca eligiendo el módulo (hoy solo
// Tienda; Turnos figura como "Próximamente") y termina en /onboarding/plan,
// donde se paga y se crea la cuenta. La ruta se sigue llamando "rubro" porque
// todos los links de la landing apuntan acá.
import Head from 'next/head'
import Alta from '@/modules/turnos/onboarding/Alta'

export default function RubroPage() {
  return (
    <>
      <Head><title>Creá tu espacio · Órbita</title></Head>
      <Alta real />
    </>
  )
}
