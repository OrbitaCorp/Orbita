import { useQuery } from '@tanstack/react-query'
import { panelListDiscounts } from '@/lib/api'
import { filaApiADescuento, tipoAApi, tipoFiltroEsSoportado } from './discountApi'
import type { Descuento, DescuentosFiltros, PaginatedResponse } from '../types'

function valorOrden(d: Descuento, columna: DescuentosFiltros['ordenColumna']): string | number {
  switch (columna) {
    case 'usos':
      return d.usosConsumidos
    case 'estado':
      return d.estado
    case 'vigencia':
      return d.fechaInicio
    default:
      return d.nombre.toLowerCase()
  }
}

// El backend no soporta orden de columna (solo createdAt desc) — se reordena
// del lado del cliente la página ya traída. Correcto dentro de una página,
// aproximado entre páginas (limitación conocida, ver PENDIENTES.md).
function ordenar(items: Descuento[], f: DescuentosFiltros): Descuento[] {
  const sign = f.ordenDireccion === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const va = valorOrden(a, f.ordenColumna)
    const vb = valorOrden(b, f.ordenColumna)
    if (va < vb) return -sign
    if (va > vb) return sign
    return 0
  })
}

export async function fetchDescuentos(f: DescuentosFiltros): Promise<PaginatedResponse<Descuento>> {
  // Ningún descuento real puede tener un tipo avanzado (el backend los
  // rechaza al crear) — filtrar por uno de ellos siempre da vacío, sin pegarle
  // a la API con un filtro que no existe del otro lado.
  if (!tipoFiltroEsSoportado(f.tipo)) {
    return { data: [], total: 0, pagina: f.pagina, porPagina: f.porPagina }
  }

  const res = await panelListDiscounts({
    status: f.estado !== 'todos' ? f.estado : undefined,
    type: f.tipo !== 'todos' ? (tipoAApi(f.tipo) ?? undefined) : undefined,
    search: f.busqueda || undefined,
    page: f.pagina,
    limit: f.porPagina,
  })

  return {
    data: ordenar(res.data.map(filaApiADescuento), f),
    total: res.total,
    pagina: res.page,
    porPagina: res.limit,
  }
}

export function useDescuentos(filtros: DescuentosFiltros) {
  return useQuery({
    queryKey: ['descuentos', filtros],
    queryFn: () => fetchDescuentos(filtros),
    staleTime: 30_000,
  })
}
