import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { adminPath, currentSlug } from '@/lib/tenant'
import { CuponesListado } from './CuponesListado'
import { CuponesCrear } from './CuponesCrear'

export function CuponesShell() {
  const router = useRouter()
  const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
  const vista = (router.query.vista as string) || ''
  const idParam = (router.query.id as string) || undefined

  const basePath     = adminPath(negocioId, 'ventas', 'cupones')
  const metricasPath = adminPath(negocioId, 'ventas', 'descuentos')

  const irAListado  = useCallback(() => router.push({ pathname: basePath }), [router, basePath])
  const irACrear    = useCallback(() => router.push({ pathname: basePath, query: { vista: 'crear' } }), [router, basePath])
  const irAEditar   = useCallback((id: string) => router.push({ pathname: basePath, query: { vista: 'editar', id } }), [router, basePath])
  const irAMetricas = useCallback(() => router.push({ pathname: metricasPath, query: { vista: 'metricas' } }), [router, metricasPath])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {!vista && (
          <CuponesListado onEditar={irAEditar} onVerMetricas={irAMetricas} onCrear={irACrear} />
        )}

        {vista === 'crear' && (
          <CuponesCrear onVolver={irAListado} />
        )}

        {vista === 'editar' && idParam && (
          <CuponesCrear id={idParam} onVolver={irAListado} />
        )}

      </div>
    </div>
  )
}

export default CuponesShell
