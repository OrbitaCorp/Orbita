import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { adminPath, currentSlug } from '@/lib/tenant'
import { DescuentosListado } from './DescuentosListado'
import { DescuentosCrear } from './DescuentosCrear'
import { DescuentosDetalle } from './DescuentosDetalle'
import { DescuentosMetricas } from './DescuentosMetricas'
import CountdownExitIntentConfig from '../avanzado/CountdownExitIntentConfig'

export function DescuentosShell() {
  const router = useRouter()
  const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
  const vista = (router.query.vista as string) || ''
  const idParam = (router.query.id as string) || undefined

  const basePath = adminPath(negocioId, 'ventas', 'descuentos')

  const irAListado   = useCallback(() => router.push({ pathname: basePath }), [router, basePath])
  const irACrear     = useCallback(() => router.push({ pathname: basePath, query: { vista: 'crear' } }), [router, basePath])
  const irADetalle   = useCallback((id: string) => router.push({ pathname: basePath, query: { vista: 'detalle', id } }), [router, basePath])
  const irAEditar    = useCallback((id: string) => router.push({ pathname: basePath, query: { vista: 'editar', id } }), [router, basePath])
  const irAMetricas  = useCallback(() => router.push({ pathname: basePath, query: { vista: 'metricas' } }), [router, basePath])
  // La cuenta regresiva (paquete Avanzado) se configura acá adentro: es la
  // misma pantalla que en Avanzado, pero quien entra a Descuentos a armar una
  // promo con fecha no tiene por qué irse a otro módulo. Ver CountdownAvanzadoCard.
  const irACountdown = useCallback(() => router.push({ pathname: basePath, query: { vista: 'countdown' } }), [router, basePath])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        {!vista && (
          <DescuentosListado onVerDetalle={irADetalle} onEditar={irAEditar} onVerMetricas={irAMetricas} onCrear={irACrear} onConfigurarCountdown={irACountdown} />
        )}

        {vista === 'crear' && (
          <DescuentosCrear onVolver={irAListado} />
        )}

        {vista === 'editar' && idParam && (
          <DescuentosCrear id={idParam} onVolver={irAListado} />
        )}

        {vista === 'detalle' && idParam && (
          <DescuentosDetalle
            id={idParam}
            onVolver={irAListado}
            onEditar={() => irAEditar(idParam)}
            onVerMetricas={irAMetricas}
          />
        )}

        {vista === 'metricas' && (
          <DescuentosMetricas onVolver={irAListado} onVerDetalle={irADetalle} />
        )}

        {vista === 'countdown' && (
          <CountdownExitIntentConfig volverA="Descuentos" onVolver={irAListado} />
        )}

      </div>
    </div>
  )
}
