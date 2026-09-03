// src/modules/ventas/panel/catalogo/types/catalogo.types.ts
// Tipos propios de la UI del catálogo. Los tipos de la API (ApiProductRow,
// ApiCategoryNode, etc.) viven en @/lib/api — acá solo queda lo que la pantalla
// necesita en una forma distinta a la del backend.

// Estado que ve el dueño en la lista. No mapea 1:1 con el backend: 'sin_stock'
// se deriva de que el producto no tenga unidades (ver estadoVisual()).
export type EstadoProducto = 'publicado' | 'borrador' | 'sin_stock'

// Nodo del árbol de categorías tal como lo dibuja la pantalla. Se traduce desde
// ApiCategoryNode en Categorias.tsx (aCatNode).
export interface CatNode {
    id:            string
    nombre:        string
    slug:          string
    icono:         string
    color:         string
    // Foto real de la categoría — opcional, además de ícono/color, no en
    // vez de. El storefront la prioriza sobre el ícono cuando está cargada.
    imagen:        string | null
    productos:     number
    activa:        boolean
    subcategorias: CatNode[]
}
