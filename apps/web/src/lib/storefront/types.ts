export type Producto = {
  id:        string
  nombre:    string
  cat:       string
  precio:    number
  precioAnt: number | null
  badge:     string | null
  hue:       number
  hue2?:     number   // segunda imagen para efecto hover
  stock:     boolean
  lowStock?: boolean  // últimas unidades — gateado por showLowStock en el llamador. Opcional: PRODUCTOS (mock.ts) no lo trae.
  imgUrl?:   string | null  // foto real (Supabase Storage); sin ella se usa el degradé (hue) de siempre
  // Swatches de la opción "visual" (ej. Color) — [] si el producto no tiene
  // una. `imageUrl` puede ser null (ese valor no tiene foto tagueada, cae a
  // un degradé). ProductCard.tsx los muestra (máximo 2 + "+N") y cambia la
  // foto de la card al pasar el mouse o hacer click.
  variantes?: { valor: string; imageUrl: string | null }[]
}

export type Categoria = {
  id:     string
  nombre: string
  count:  number
  hue:    number
}

// `id` es el id de la VARIANTE (product_variants.id), no del producto — es lo
// que el checkout real necesita mandar (CheckoutDto.items[].variantId) y lo
// que identifica una línea del carrito de forma única (mismo producto con dos
// talles distintos son dos líneas). `productId` se guarda aparte solo para
// poder volver al detalle del producto desde el carrito.
export type ItemCarrito = {
  id:        string
  productId: string
  nombre:    string
  variante:  string
  qty:       number
  precio:    number
  precioAnt: number | null
  hue:       number
  // Foto real de la variante (o del producto si no hay una específica) —
  // null/undefined = sin foto, se ve el degradé de `hue` como fallback. La
  // llena quien agrega (ProductCard/ProductoDetalle) y CartContext.
  // revalidar() la refresca contra el backend (por si el dueño cambió las
  // fotos después de que el cliente agregó al carrito).
  imgUrl?:   string | null
  // Lo llena CartContext.revalidar() contra el backend — ausente hasta la
  // primera revalidación (recién agregado, todavía no se consultó).
  // `maxQty` es el tope real de stock (agregar()/actualizarQty() lo respetan).
  // `noDisponible` = el ítem cayó del todo (producto borrado o sin stock,
  // ver `motivo`); si solo alcanzaba para MENOS de lo pedido, el ítem se
  // recorta a `maxQty` en vez de caer (motivo queda en STOCK_INSUFICIENTE
  // para poder avisar igual, aunque `noDisponible` sea false).
  maxQty?:       number
  noDisponible?: boolean
  motivo?:       'NO_DISPONIBLE' | 'SIN_STOCK' | 'STOCK_INSUFICIENTE'
}

export type Direccion = {
  id:      string
  alias:   string
  calle:   string
  piso:    string
  ciudad:  string
  cp:      string
  default: boolean
}

export type TimelineStep = {
  label: string
  done:  boolean
  fecha: string
}

export type Pedido = {
  id:          string
  fecha:       string
  total:       number
  items:       number
  tracking:    string
  timeline:    TimelineStep[]
  metodoPago?: string
  comprador?:  { nombre: string; email: string; telefono: string; direccion: string }
}

export type Usuario = {
  nombre:   string
  apellido: string
  email:    string
  telefono: string
  avatar:   string
  miembro:  string
}

export type PedidoResumen = {
  id:         string
  fecha:      string
  total:      number
  items:      number
  estado:     string
  estadoTipo: 'success' | 'warning' | 'error' | 'neutral'
}

export type TiendaConfig = {
  nombre:  string
  sub:     string
  slug:    string
  dominio: string
  wpp:     string
  email:   string
}

export type Cupon = {
  codigo:      string
  tipo:        'porcentaje' | 'monto'
  valor:       number
  descripcion: string
  minCompra?:  number
  vencimiento?: string
  categorias?: string[]
  // Solo lo trae el link exclusivo (DescuentoExclusivo.tsx) — determina si
  // tiene sentido mostrar los productos puntuales alcanzados por el link.
  alcance?: 'producto' | 'categoria' | 'ticket'
}

// Descuento compartido por link (DescuentoCompartido.tsx) — sin `codigo`: a
// diferencia del cupón, un descuento automático nunca tiene uno (ver
// discounts.service.ts, `code` siempre null ahí). Se identifica por `id`.
export type Oferta = {
  id:          string
  tipo:        'porcentaje' | 'monto'
  valor:       number
  descripcion: string
  minCompra?:  number
  vencimiento?: string
  categorias?: string[]
  alcance:     'producto' | 'categoria' | 'ticket'
}

export type DescuentoExclusivo = {
  codigo:      string
  nombre:      string
  descripcion: string
  tipo:        'porcentaje' | 'monto'
  valor:       number
  vencimiento?: string
  categorias?: string[]
}
