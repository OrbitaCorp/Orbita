import { RequireAuth } from '@/lib/auth/RequireAuth'
import Seguimiento from '@/modules/ventas/cliente/pedido/Seguimiento'

// El pedido es del cliente que lo hizo — mismo patrón que perfil.tsx.
export default function SeguimientoPage() {
  return (
    <RequireAuth type="customer">
      <Seguimiento />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
