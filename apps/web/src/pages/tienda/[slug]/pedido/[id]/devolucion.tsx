import { RequireAuth } from '@/lib/auth/RequireAuth'
import Devolucion from '@/modules/ventas/cliente/pedido/Devolucion'

export default function DevolucionPage() {
  return (
    <RequireAuth type="customer">
      <Devolucion />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
