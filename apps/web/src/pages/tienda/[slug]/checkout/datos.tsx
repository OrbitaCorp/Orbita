import { RequireAuth } from '@/lib/auth/RequireAuth'
import CheckoutDatos from '@/modules/ventas/cliente/checkout/CheckoutDatos'

// El checkout necesita saber A QUÉ CLIENTE pertenece el pedido (para que
// "Mis pedidos" lo muestre y para poder elegir entre SUS direcciones
// guardadas) — mismo patrón que perfil.tsx.
export default function CheckoutDatosPage() {
  return (
    <RequireAuth type="customer">
      <CheckoutDatos />
    </RequireAuth>
  )
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
