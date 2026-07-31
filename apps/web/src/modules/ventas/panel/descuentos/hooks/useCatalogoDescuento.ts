// Categorías/productos reales del negocio para los selectores de alcance del
// formulario de descuentos (antes leían de mock/productos.ts). No hay
// endpoint que traiga "todos los productos" de una — el listado pagina de a
// 100 (ver apps/api/src/products/dto/find-products-query.dto.ts) — así que
// el árbol carga productos por categoría al expandirla, y la búsqueda pega
// directo al servidor en vez de filtrar un array ya cargado.
import { useQuery, useQueries } from '@tanstack/react-query'
import { panelGetCategoriesFlat, panelListProducts, panelGetProduct, type ApiCategory, type ApiProductRow } from '@/lib/api'

const LIMITE_PRODUCTOS = 100

export function useCategoriasDescuento() {
  return useQuery({
    queryKey: ['descuentos', 'categorias'],
    queryFn: async () => (await panelGetCategoriesFlat()).filter((c) => c.isActive),
    staleTime: 60_000,
  })
}

export interface ProductosPorCategoria {
  productos: ApiProductRow[]
  total: number
}

export function useProductosPorCategoria(categoryId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['descuentos', 'productos-categoria', categoryId],
    queryFn: async (): Promise<ProductosPorCategoria> => {
      const res = await panelListProducts({ categoryId, status: 'PUBLISHED', limit: LIMITE_PRODUCTOS })
      return { productos: res.data, total: res.total }
    },
    enabled,
    staleTime: 60_000,
  })
}

export function useBuscarProductosDescuento(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['descuentos', 'productos-busqueda', q],
    queryFn: async (): Promise<ProductosPorCategoria> => {
      const res = await panelListProducts({ search: q, status: 'PUBLISHED', limit: LIMITE_PRODUCTOS })
      return { productos: res.data, total: res.total }
    },
    enabled: q.length > 0,
    staleTime: 30_000,
  })
}

// Para el detalle de un descuento ya creado: resolver nombres reales a partir
// de los productIds guardados (no hay endpoint "traer por lista de ids", así
// que se resuelven en paralelo — la selección de un descuento es una lista
// acotada, no todo el catálogo).
export function useProductosPorIds(ids: string[]) {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['descuentos', 'producto', id],
      queryFn: () => panelGetProduct(id),
      staleTime: 60_000,
    })),
  })
  return {
    productos: queries.map((q) => q.data).filter((p): p is NonNullable<typeof p> => !!p),
    isLoading: queries.some((q) => q.isLoading),
  }
}

export type { ApiCategory }
