// DEMO INTERNA — los 28 subrubros de Tienda, copiados del catálogo real
// (apps/api/src/onboarding/onboarding.service.ts, TIENDA_SUBRUBROS): mismas
// keys, mismos textos y el mismo `tipo`, que es lo que decide cómo se arma el
// alta de producto. Acá el ícono es el componente (allá viaja como string).
// Si el catálogo real cambia, esta copia hay que actualizarla a mano.
import type { LucideIcon } from 'lucide-react'
import {
  Store, Shirt, Footprints, Sparkles, Smartphone, Hammer, Package2, BookOpen, Gift, PawPrint, Car, Gem, Sofa, Monitor,
  Package, Droplets, Sprout, Palette, Scissors, Cake, Boxes, Fish, Dumbbell, Baby, Apple, Headphones, Lamp, Bike,
  Layers, ScanLine, Scale,
} from 'lucide-react'

export type TipoProducto = 'simple' | 'variantes' | 'serie' | 'volumen'
export interface SubrubroTienda { key: string; Icon: LucideIcon; label: string; descripcion: string; tipo: TipoProducto }

export const SUBRUBROS_TIENDA: SubrubroTienda[] = [
  { key: 'detodo', Icon: Store, label: 'De todo un poco', descripcion: 'Tienda variada sin un rubro fijo', tipo: 'simple' },
  { key: 'indumentaria', Icon: Shirt, label: 'Indumentaria', descripcion: 'Talles, colores y variantes', tipo: 'variantes' },
  { key: 'calzado', Icon: Footprints, label: 'Calzado', descripcion: 'Numeración y variantes por talle', tipo: 'variantes' },
  { key: 'cosmetica', Icon: Sparkles, label: 'Perfumería / Cosmética', descripcion: 'Vencimientos y control de lotes', tipo: 'simple' },
  { key: 'electronica', Icon: Smartphone, label: 'Electrónica', descripcion: 'N° de serie / IMEI por unidad', tipo: 'serie' },
  { key: 'ferreteria', Icon: Hammer, label: 'Ferretería', descripcion: 'Miles de SKUs, venta por unidad', tipo: 'simple' },
  { key: 'corralon', Icon: Package2, label: 'Corralón / Construcción', descripcion: 'Venta por m², kg o litro', tipo: 'volumen' },
  { key: 'libreria', Icon: BookOpen, label: 'Librería', descripcion: 'ISBN, editorial y autor', tipo: 'simple' },
  { key: 'jugueteria', Icon: Gift, label: 'Juguetería / Regalería', descripcion: 'Edad recomendada por producto y regalos por ocasión', tipo: 'simple' },
  { key: 'petshop', Icon: PawPrint, label: 'Pet Shop', descripcion: 'Alimentos por peso y accesorios', tipo: 'volumen' },
  { key: 'repuestos', Icon: Car, label: 'Repuestos Automotor', descripcion: 'Compatibilidad por modelo de vehículo', tipo: 'serie' },
  { key: 'joyeria', Icon: Gem, label: 'Joyería', descripcion: 'Materiales, peso y tasación', tipo: 'simple' },
  { key: 'muebleria', Icon: Sofa, label: 'Mueblería', descripcion: 'Medidas físicas y variantes de color', tipo: 'simple' },
  { key: 'informatica', Icon: Monitor, label: 'Informática', descripcion: 'Compatibilidades técnicas', tipo: 'serie' },
  { key: 'mayorista', Icon: Package, label: 'Distribuidora / Mayorista', descripcion: 'Precios escalonados por volumen', tipo: 'volumen' },
  { key: 'limpieza', Icon: Droplets, label: 'Limpieza', descripcion: 'Litros y concentración', tipo: 'volumen' },
  { key: 'vivero', Icon: Sprout, label: 'Vivero / Floricultura', descripcion: 'Plantas y flores con cuidados especiales', tipo: 'volumen' },
  { key: 'artistica', Icon: Palette, label: 'Artística', descripcion: 'Materiales, técnica y tamaño de cada obra', tipo: 'simple' },
  { key: 'merceria', Icon: Scissors, label: 'Mercería', descripcion: 'Hilos, telas y variantes de color y medida', tipo: 'variantes' },
  { key: 'pasteleria', Icon: Cake, label: 'Pastelerías', descripcion: 'Tamaños, sabores y fecha de entrega', tipo: 'variantes' },
  { key: 'insumos', Icon: Boxes, label: 'Insumos', descripcion: 'Materiales y materias primas variadas, sin rubro fijo', tipo: 'simple' },
  { key: 'pesca', Icon: Fish, label: 'Artículos de pesca', descripcion: 'Largo de caña, diámetro de línea y número de anzuelo', tipo: 'variantes' },
  { key: 'deportes', Icon: Dumbbell, label: 'Deportes / Fitness', descripcion: 'Talles, pesos y equipamiento', tipo: 'variantes' },
  { key: 'bebes', Icon: Baby, label: 'Bebés / Maternidad', descripcion: 'Talles por edad y pañales por tamaño', tipo: 'variantes' },
  { key: 'alimentos', Icon: Apple, label: 'Almacén / Dietética', descripcion: 'Peso, sabor y presentación', tipo: 'variantes' },
  { key: 'celulares', Icon: Headphones, label: 'Accesorios de celular', descripcion: 'Fundas por modelo, cargadores y conectores', tipo: 'variantes' },
  { key: 'hogar', Icon: Lamp, label: 'Hogar / Deco / Bazar', descripcion: 'Medidas de cama, capacidad y colores', tipo: 'variantes' },
  { key: 'bicicleteria', Icon: Bike, label: 'Bicicletería', descripcion: 'Rodado, talle de cuadro y repuestos', tipo: 'variantes' },
]

export const subrubroPorKey = (key: string) => SUBRUBROS_TIENDA.find(s => s.key === key)

/** Lo que cada tipo de producto le agrega al catálogo: etiqueta de la tarjeta y explicación del panel de al lado. */
export const TIPOS: Record<TipoProducto, { etiqueta: string | null; Icon: LucideIcon; titulo: string; texto: string }> = {
  variantes: { etiqueta: 'Talles y variantes', Icon: Layers, titulo: 'Variantes por talle, color o medida', texto: 'Cada producto con su matriz de variantes y el stock de cada una.' },
  serie: { etiqueta: 'N° de serie / IMEI', Icon: ScanLine, titulo: 'Número de serie o IMEI', texto: 'Cada unidad con su número, para garantías y seguimiento.' },
  volumen: { etiqueta: 'Cantidad variable', Icon: Scale, titulo: 'Venta por peso, metro o litro', texto: 'Cantidades variables con el precio por unidad de medida.' },
  simple: { etiqueta: null, Icon: Package, titulo: 'Productos simples', texto: 'Precio, fotos y stock por unidad, sin vueltas.' },
}

/** "De todo un poco" es excluyente: limpia el resto, y elegir cualquier otro la saca. */
export function alternarTipo(elegidos: string[], key: string): string[] {
  if (key === 'detodo') return elegidos.includes('detodo') ? [] : ['detodo']
  const sinDetodo = elegidos.filter(k => k !== 'detodo')
  return sinDetodo.includes(key) ? sinDetodo.filter(k => k !== key) : [...sinDetodo, key]
}
