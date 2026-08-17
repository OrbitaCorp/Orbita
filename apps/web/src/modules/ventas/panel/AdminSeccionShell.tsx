// Resuelve qué componente mostrar en el panel admin a partir de moduloPadre/
// seccion (de la URL). Sirve para las dos formas de ruta que puede tomar el
// panel — '/admin/{negocioId}/{moduloPadre}/{seccion}' (legacy/apex) y
// '/admin/{moduloPadre}/{seccion}' (subdominio, ver lib/tenant.ts#adminPath)
// — porque ninguna de las dos necesita negocioId acá: el negocio ya lo
// resuelve la sesión (AdminLayout → RequireAuth), no esta pantalla.
//
// Route file única (pages/admin/[...slug].tsx, catch-all) en vez de dos
// carpetas dinámicas hermanas bajo /admin — Next.js no permite dos nombres
// de segmento distintos ([moduloPadre] y [negocioId]) al mismo nivel del
// árbol de páginas ("You cannot use different slug names for the same
// dynamic path"), aunque las rutas resultantes tengan profundidad distinta.
// Con el catch-all, moduloPadre/seccion son siempre los ÚLTIMOS dos
// segmentos del array — sea que venga un negocioId adelante (legacy) o no
// (subdominio) — sin duplicar el archivo ni el componente.

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import AdminLayout from '@/layouts/AdminLayout'
import type { ComponentType } from 'react'

// componentMap: tabla de lookup moduloPadre → seccion → componente.
const componentMap: Record<string, Record<string, ComponentType>> = {
    ventas: {
        dashboard: dynamic(() => import('@/modules/ventas/panel/reportes/Dashboard'), { ssr: false }),
        pedidos:        dynamic(() => import('@/modules/ventas/panel/pedidos/PedidoLista'), { ssr: false }),
        catalogo:       dynamic(() => import('@/modules/ventas/panel/catalogo/ProductoLista'), { ssr: false }),
        categorias:     dynamic(() => import('@/modules/ventas/panel/catalogo/Categorias'), { ssr: false }),
        clientes:       dynamic(() => import('@/modules/ventas/panel/clientes/ClienteLista'), { ssr: false }),
        reportes:       dynamic(() => import('@/modules/ventas/panel/reportes/ReporteVentas'), { ssr: false }),
        configuracion:  dynamic(() => import('@/modules/ventas/panel/configuracion/ConfigGeneral'), { ssr: false }),
        descuentos:     dynamic(() => import('@/modules/ventas/panel/descuentos/DescuentosShell').then(m => ({ default: m.DescuentosShell })), { ssr: false }),
        cupones:        dynamic(() => import('@/modules/ventas/panel/descuentos/CuponesShell').then(m => ({ default: m.CuponesShell })), { ssr: false }),
        mensajes:       dynamic(() => import('@/modules/ventas/panel/mensajes/Bandeja').then(m => ({ default: m.MensajesHub })), { ssr: false }),
        perfil:         dynamic(() => import('@/modules/ventas/panel/perfil/MiPerfil'), { ssr: false }),
    },
}

export default function AdminSeccionShell() {
  const { slug } = useRouter().query
  const partes = Array.isArray(slug) ? slug : []
  // Últimos dos segmentos siempre — con negocioId adelante (legacy) o sin él
  // (subdominio), moduloPadre/seccion quedan en la misma posición relativa.
  const seccion = partes[partes.length - 1]
  const moduloPadre = partes[partes.length - 2]
  const Componente = componentMap[moduloPadre as string]?.[seccion as string]

  if (!Componente) return <div>Página no encontrada</div>

  return (
    <AdminLayout>
      <Componente />
    </AdminLayout>
  )
}
