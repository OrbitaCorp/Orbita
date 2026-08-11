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
