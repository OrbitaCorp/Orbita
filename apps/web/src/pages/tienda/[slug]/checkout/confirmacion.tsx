import Confirmacion from '@/modules/ventas/cliente/checkout/Confirmacion'

// SIN RequireAuth — ver el comentario en checkout/datos.tsx. Confirmacion ya
// resuelve el pedido por tracking público (?email=) cuando no hay sesión.
export default function ConfirmacionPage() {
  return <Confirmacion />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
