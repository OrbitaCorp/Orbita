import { RequireAuth } from '@/lib/auth/RequireAuth'
import CheckoutPago from '@/modules/ventas/cliente/checkout/CheckoutPago'

export default function CheckoutPagoPage() {
  return (
    <RequireAuth type="customer">
      <CheckoutPago />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
