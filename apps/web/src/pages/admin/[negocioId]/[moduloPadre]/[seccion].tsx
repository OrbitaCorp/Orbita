// export default function SeccionPage() {
//   return null;
// }
// Este archivo maneja TODAS las rutas del panel admin con esta forma:
//   /admin/rama-tienda/ventas/pedidos
//   /admin/rama-tienda/ventas/catalogo
//   /admin/rama-tienda/ventas/dashboard  etc.

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import AdminLayout from '@/layouts/AdminLayout'
import type { ComponentType } from 'react'

// componentMap: tabla de lookup moduloPadre → seccion → componente.
const componentMap: Record<string, Record<string, ComponentType>> = {
    ventas: {
        dashboard: dynamic(() => import('@/modules/ventas/panel/reportes/Dashboard'), { ssr: false }),pedidos:        dynamic(() => import('@/modules/ventas/panel/pedidos/PedidoLista'), { ssr: false }),
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

export default function SeccionPage() {
  const { moduloPadre, seccion } = useRouter().query
  const Componente = componentMap[moduloPadre as string]?.[seccion as string]

  if (!Componente) return <div>Página no encontrada</div>

  return (
    <AdminLayout>
      <Componente />
    </AdminLayout>
  )
}