import { useQuery } from '@tanstack/react-query'
import { panelListCoupons } from '@/lib/api'
import { filaApiACupon, tipoCuponLabelKeyAApi } from './couponApi'
import { type Cupon, type CuponesFiltros, type PaginatedResponse } from '../types'

function valorOrden(c: Cupon, columna: CuponesFiltros['ordenColumna']): string | number {
  switch (columna) {
    case 'codigo':
      return c.codigo.toLowerCase()
    case 'valor':
      return c.valor
    case 'usos':
      return c.usosConsumidos
    case 'estado':
      return c.estado
    case 'vigencia':
      return c.fechaInicio
    default:
      return c.nombre.toLowerCase()
  }
}

// El backend solo ordena por createdAt desc; el resto se reordena en cliente
// sobre la página traída (correcto dentro de la página, aproximado entre
// páginas — misma limitación conocida que descuentos).
function ordenar(items: Cupon[], f: CuponesFiltros): Cupon[] {
  const sign = f.ordenDireccion === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const va = valorOrden(a, f.ordenColumna)
    const vb = valorOrden(b, f.ordenColumna)
    if (va < vb) return -sign
    if (va > vb) return sign
    return 0
  })
}

export async function fetchCupones(f: CuponesFiltros): Promise<PaginatedResponse<Cupon>> {
  const res = await panelListCoupons({
    // 'agotado' no es filtrable en SQL — se ignora como filtro (solo llega por
    // un ?estado=agotado armado a mano).
    status: f.estado !== 'todos' && f.estado !== 'agotado' ? f.estado : undefined,
    type: f.tipo !== 'todos' ? (tipoCuponLabelKeyAApi(f.tipo) ?? undefined) : undefined,
    search: f.busqueda || undefined,
    page: f.pagina,
    limit: f.porPagina,
  })

  return {
    data: ordenar(res.data.map(filaApiACupon), f),
    total: res.total,
    pagina: res.page,
    porPagina: res.limit,
  }
}

export function useCupones(filtros: CuponesFiltros) {
  return useQuery({
    queryKey: ['cupones', filtros],
    queryFn: () => fetchCupones(filtros),
    staleTime: 30_000,
  })
}
