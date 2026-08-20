import CheckoutDatos from '@/modules/ventas/cliente/checkout/CheckoutDatos'

// SIN RequireAuth a propósito: comprar como invitado es un flujo real y
// completo (el backend ya lo soporta — checkout() es @Public(), el pedido
// nace con customerId null, "venta anónima" mismo criterio que el POS —
// y CheckoutDatos/CheckoutPago/Confirmacion ya están armados para eso: el
// banner "Estás comprando como invitado", el email que viaja como
// ?email= hasta la confirmación, getOrderTracking() para verla sin sesión).
// Antes esta página exigía sesión de cliente ANTES de mostrar ese flujo,
// dejándolo inalcanzable en la práctica — bug, no una decisión vigente (el
// comentario viejo de acá citaba RBT-351, que es justo el ticket que definió
// el login opcional en el checkout). Lo que sí sigue exigiendo sesión: ver
// el estado del pedido después de comprar, devoluciones, cancelaciones y
// "Mis pedidos" (pedido/[id].tsx, perfil.tsx, etc. — sin cambios acá).
export default function CheckoutDatosPage() {
  return <CheckoutDatos />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
