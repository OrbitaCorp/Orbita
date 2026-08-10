import { RequireAuth } from '@/lib/auth/RequireAuth'
import Cancelar from '@/modules/ventas/cliente/pedido/Cancelar'

export default function CancelarPage() {
  return (
    <RequireAuth type="customer">
      <Cancelar />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
