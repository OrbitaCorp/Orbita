import { RequireAuth } from '@/lib/auth/RequireAuth'
import Comprobante from '@/modules/ventas/cliente/pedido/Comprobante'

export default function ComprobantePage() {
  return (
    <RequireAuth type="customer">
      <Comprobante />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
