import CheckoutPago from '@/modules/ventas/cliente/checkout/CheckoutPago'

// SIN RequireAuth — ver el comentario en checkout/datos.tsx. CheckoutPago
// ya distingue invitado/logueado por su cuenta (authStatus === 'anonymous').
export default function CheckoutPagoPage() {
  return <CheckoutPago />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
