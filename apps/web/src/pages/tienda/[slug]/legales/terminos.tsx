import DocumentoLegal from '@/modules/ventas/cliente/legales/DocumentoLegal'

// Términos y Condiciones de Compra del Comercio (footer de la tienda).
export default function TerminosPage() {
  return <DocumentoLegal tipo="terminos" />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
