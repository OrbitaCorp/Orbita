import DocumentoLegal from '@/modules/ventas/cliente/legales/DocumentoLegal'

// Política de Privacidad del Comercio (footer de la tienda).
export default function PrivacidadPage() {
  return <DocumentoLegal tipo="privacidad" />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
