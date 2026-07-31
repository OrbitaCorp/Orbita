import { useQuery } from '@tanstack/react-query'
import { panelGetMetrics } from '@/lib/api'
import type { MetricasFiltros } from '../types'

export function useMetricas(filtros?: Partial<MetricasFiltros>) {
  return useQuery({
    queryKey: ['metricas', filtros],
    queryFn: () => panelGetMetrics(filtros ?? {}),
    staleTime: 30_000,
  })
}
