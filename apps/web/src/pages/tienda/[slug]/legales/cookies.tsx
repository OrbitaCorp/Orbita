import DocumentoLegal from '@/modules/ventas/cliente/legales/DocumentoLegal'

// Política de Cookies del Comercio (footer de la tienda y aviso de cookies).
export default function CookiesPage() {
  return <DocumentoLegal tipo="cookies" />
}

export { getServerSideProps } from '@/lib/storefront/forceSSR'
