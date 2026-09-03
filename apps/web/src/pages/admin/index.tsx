// Cuando alguien entra a /admin sin especificar negocio ni sección, lo
// mandamos al dashboard. Bajo el subdominio de una tienda el negocio ya está
// identificado por el host, así que la URL no lo repite (ver
// lib/tenant.ts#adminPath); fuera de un subdominio (apex/dev) usamos el
// negocio mock 'rama-tienda' como antes.
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { currentSlug } from '@/lib/tenant'

export default function AdminPage() {
    const router = useRouter()
    useEffect(() => {
        // La query viaja entera (ej: ?tutorial= para forzar una variante del tutorial).
        const query = router.asPath.includes('?') ? `?${router.asPath.split('?')[1]}` : ''
        router.replace(`${currentSlug() ? '/admin/ventas/dashboard' : '/admin/rama-tienda/ventas/dashboard'}${query}`)
    }, [])
    return null
}