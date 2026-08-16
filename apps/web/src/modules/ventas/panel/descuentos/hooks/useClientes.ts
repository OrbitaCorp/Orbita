import { useQuery } from '@tanstack/react-query'
import { getCustomers, type ApiCustomer } from '@/lib/api'

export function useClientes(busqueda = '') {
  return useQuery({
    queryKey: ['clientes-descuentos', busqueda],
    queryFn: async (): Promise<ApiCustomer[]> => {
      const res = await getCustomers({ search: busqueda.trim() || undefined, limit: 20 })
      return res.data
    },
    staleTime: 60_000,
  })
}

export type { ApiCustomer }
