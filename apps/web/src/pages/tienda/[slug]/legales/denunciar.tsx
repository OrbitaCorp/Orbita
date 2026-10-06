import DenunciarTienda from '@/modules/ventas/cliente/legales/DenunciarTienda'

// "Denunciar esta tienda": link del pie de toda tienda. Sin tipo de SEO, así que
// sale con noindex (ver forceSSR.ts): no es una página para Google.
export default DenunciarTienda

export { getServerSideProps } from '@/lib/storefront/forceSSR'
