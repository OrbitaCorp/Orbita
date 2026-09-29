import PagoSimulado from '@/modules/demo/PagoSimulado'

// Solo existe para la tienda demo: reemplaza a Mercado Pago (ver
// lib/demo/recursos/checkout.ts). En otra tienda no encuentra ningún pedido.
export default function PagoSimuladoPage() {
  return <PagoSimulado />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
