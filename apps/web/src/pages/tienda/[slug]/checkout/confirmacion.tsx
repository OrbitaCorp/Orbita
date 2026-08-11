import { RequireAuth } from '@/lib/auth/RequireAuth'
import Confirmacion from '@/modules/ventas/cliente/checkout/Confirmacion'

export default function ConfirmacionPage() {
  return (
    <RequireAuth type="customer">
      <Confirmacion />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
