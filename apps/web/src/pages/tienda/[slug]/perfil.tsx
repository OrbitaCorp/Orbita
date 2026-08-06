import { RequireAuth } from '@/lib/auth/RequireAuth'
import Perfil from '@/modules/ventas/cliente/perfil/Perfil'

// Cuenta del cliente (RBT-290): solo accesible con sesión de tipo customer
// para ESTE negocio. El mismo patrón se aplica a otras rutas de cuenta
// (pedidos, etc.) envolviéndolas con <RequireAuth type="customer">.
export default function PerfilPage() {
  return (
    <RequireAuth type="customer">
      <Perfil />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
