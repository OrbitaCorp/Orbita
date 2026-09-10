// src/modules/ventas/panel/reportes/ReporteInventario.tsx — Vista 14
//
// Hasta el 10/09 esta pestaña mostraba un "inventario valorizado" armado con
// los datos de ejemplo del prototipo de Inventario (mock): un valor total de
// $4.280.000, 54 productos, categorías inventadas y un botón Exportar que no
// hacía nada — el dueño lo veía como si fueran sus números (auditoría interna
// 10/09, ítem web.panel.reportes). Hasta que exista un reporte real calculado
// en el servidor, la pestaña lo dice y manda al stock real, en Productos.

import { useRouter } from 'next/router'
import { Archive, ArrowRight } from 'lucide-react'
import { Card } from '@/design-system/components/Card'
import { Button } from '@/design-system/components/Button'
import { adminPath, currentSlug } from '@/lib/tenant'
import { ReporteTabs, type VistaReporte } from './components/ReporteTabs'

export default function ReporteInventario({ ir }: { ir: (v: VistaReporte) => void }) {
    const router = useRouter()

    const irAProductos = () => {
        const negocioId = currentSlug() ?? (router.query.negocioId as string)
        void router.push(adminPath(negocioId, 'ventas', 'catalogo'))
    }

    return (
        <div style={pageWrap}>
            <ReporteTabs activo="inventario" ir={ir} />

            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 20px' }}>Inventario valorizado</h1>

            <Card padding="md" style={{ maxWidth: 560 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Archive size={20} aria-hidden="true" />
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Este reporte todavía no está disponible</div>
                        <p style={{ fontSize: 14, color: 'var(--color-body)', lineHeight: 1.6, margin: '0 0 14px' }}>
                            Estamos armando el inventario valorizado con los datos reales de tu tienda. Mientras tanto, el stock de cada producto y sus alertas de stock mínimo están en Productos.
                        </p>
                        <Button variant="outline" icon={<ArrowRight size={15} />} onClick={irAProductos}>Ver el stock en Productos</Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}

const pageWrap: React.CSSProperties = { padding: '24px 32px 64px', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
