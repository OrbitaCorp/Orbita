import type { Producto, Categoria, ItemCarrito, Direccion, Pedido, TiendaConfig, Usuario, PedidoResumen, Cupon, DescuentoExclusivo } from './types'

export const TIENDA: TiendaConfig = {
  nombre:  'Rama Indumentaria',
  sub:     'Tu tienda de ropa contemporánea. Envíos a todo el país.',
  slug:    'rama',
  dominio: 'rama.orbita.site',
  wpp:     '5491112345678',
  email:   'hola@ramaindumentaria.com.ar',
}

export const CATEGORIAS: Categoria[] = [
  { id: 'remeras',    nombre: 'Remeras',    count: 5,  hue: 200, icon: null, color: null },
  { id: 'pantalones', nombre: 'Pantalones', count: 5,  hue: 215, icon: null, color: null },
  { id: 'buzos',      nombre: 'Buzos',      count: 3,  hue: 220, icon: null, color: null },
  { id: 'camperas',   nombre: 'Camperas',   count: 4,  hue: 35,  icon: null, color: null },
  { id: 'accesorios', nombre: 'Accesorios', count: 3,  hue: 30,  icon: null, color: null },
]

export const PRODUCTOS: Producto[] = [
  { id:'p1',  nombre:'Remera oversize negra',      cat:'Remeras',    precio:24900, precioAnt:null,   badge:'Nuevo',  hue:220, hue2:235, stock:true  },
  { id:'p2',  nombre:'Pantalón cargo verde oliva', cat:'Pantalones', precio:48900, precioAnt:62000,  badge:'Oferta', hue:140,           stock:true  },
  { id:'p3',  nombre:'Buzo frisa con capucha',     cat:'Buzos',      precio:38500, precioAnt:null,   badge:null,     hue:220, hue2:210, stock:true  },
  { id:'p4',  nombre:'Campera bomber beige arena', cat:'Camperas',   precio:89000, precioAnt:110000, badge:'Oferta', hue:35,  hue2:45,  stock:true  },
  { id:'p5',  nombre:'Remera básica blanca',       cat:'Remeras',    precio:18900, precioAnt:null,   badge:null,     hue:200, hue2:215, stock:true  },
  { id:'p6',  nombre:'Jogger gris melange',        cat:'Pantalones', precio:34500, precioAnt:null,   badge:null,     hue:210,           stock:true  },
  { id:'p7',  nombre:'Buzo sin capucha crema',     cat:'Buzos',      precio:32000, precioAnt:40000,  badge:'Oferta', hue:45,  hue2:55,  stock:true  },
  { id:'p8',  nombre:'Campera cortaviento azul',   cat:'Camperas',   precio:67000, precioAnt:null,   badge:null,     hue:215, hue2:225, stock:true  },
  { id:'p9',  nombre:'Remera estampada gráfica',   cat:'Remeras',    precio:27500, precioAnt:null,   badge:'Nuevo',  hue:280, hue2:295, stock:true  },
  { id:'p10', nombre:'Gorra trucker bordada',      cat:'Accesorios', precio:15900, precioAnt:null,   badge:'Nuevo',  hue:30,            stock:true  },
  { id:'p11', nombre:'Jean tiro medio celeste',    cat:'Pantalones', precio:56000, precioAnt:68000,  badge:'Oferta', hue:200,           stock:true  },
  { id:'p12', nombre:'Remera orgánica oversize',   cat:'Remeras',    precio:26900, precioAnt:null,   badge:null,     hue:195, hue2:205, stock:true  },
]

// Desde que existe CartContext (carrito real, persistido por tienda en
// localStorage) esto ya no se usa como estado inicial de ningún carrito real
// — queda solo por si algún mock visual lo necesita todavía.
export const CARRITO_INICIAL: ItemCarrito[] = [
  { id:'v-p3',  productId:'p3',  nombre:'Buzo frisa con capucha',   variante:'Azul marino · Talle M',  qty:1, precio:38500, precioAnt:null,  hue:220 },
  { id:'v-p12', productId:'p12', nombre:'Remera orgánica oversize',  variante:'Negro · Talle L',         qty:2, precio:26900, precioAnt:32000, hue:195 },
  { id:'v-p10', productId:'p10', nombre:'Gorra trucker bordada',     variante:'Terracota · Talle único', qty:1, precio:15900, precioAnt:null,  hue:30  },
]

export const DIRECCIONES: Direccion[] = [
  { id:'d1', alias:'Casa',    calle:'Av. Corrientes 1234', piso:'Piso 5 · Depto B', ciudad:'CABA', cp:'C1043AAZ', default:true  },
  { id:'d2', alias:'Trabajo', calle:'Paraguay 857',        piso:'Piso 2',           ciudad:'CABA', cp:'C1057AAH', default:false },
]

export const USUARIO_MOCK: Usuario = {
  nombre:   'María',
  apellido: 'Fernández',
  email:    'maria@mail.com',
  telefono: '+54 9 11 2345-6789',
  avatar:   'MF',
  miembro:  'Mayo 2025',
}

export const HISTORIAL_MOCK: PedidoResumen[] = [
  { id: 'ORB-2847', fecha: '17 may 2026', total: 92280,  items: 4, estado: 'En preparación', estadoTipo: 'warning' },
  { id: 'ORB-2610', fecha: '03 abr 2026', total: 47800,  items: 2, estado: 'Entregado',       estadoTipo: 'success' },
  { id: 'ORB-2391', fecha: '12 feb 2026', total: 24900,  items: 1, estado: 'Entregado',       estadoTipo: 'success' },
  { id: 'ORB-2104', fecha: '28 ene 2026', total: 134700, items: 3, estado: 'Cancelado',       estadoTipo: 'error'   },
]

export const CUPONES_MOCK: Cupon[] = [
  { codigo: 'BIENVENIDA15', tipo: 'porcentaje', valor: 15, descripcion: '15% off en tu primera compra. Bienvenido a la tienda.', minCompra: 30000, vencimiento: '31 jul 2026' },
  { codigo: 'ORBITA10',     tipo: 'porcentaje', valor: 10, descripcion: '10% off en toda la tienda. Sin mínimo de compra.', vencimiento: '30 jun 2026' },
  { codigo: 'REMERAS20',    tipo: 'porcentaje', valor: 20, descripcion: '20% off exclusivo en remeras. Temporada de verano.', categorias: ['Remeras'], minCompra: 20000, vencimiento: '15 jul 2026' },
  { codigo: 'ENVIOGRATIS',  tipo: 'monto',      valor: 5000, descripcion: 'Envío bonificado: $5.000 de descuento en tu pedido.', minCompra: 50000, vencimiento: '20 jun 2026' },
]

export const DESCUENTOS_EXCLUSIVOS: DescuentoExclusivo[] = [
  { codigo: 'vip30verano',   nombre: '30% OFF — Club VIP Verano',   descripcion: 'Precio especial exclusivo para clientes VIP. Válido en toda la tienda por tiempo limitado.', tipo: 'porcentaje', valor: 30, vencimiento: '30 jun 2026' },
  { codigo: 'influencer20',  nombre: '20% OFF — Descuento especial', descripcion: 'Tu descuento personal. Válido en toda la tienda. No acumulable con otras promociones.',         tipo: 'porcentaje', valor: 20, vencimiento: '15 jul 2026' },
]

export interface MensajeCliente {
  from: 'cliente' | 'tienda'
  txt:  string
  hora: string
}

// Conversación única del cliente con la tienda (no por pedido). El cliente
// puede mencionar cualquier pedido de su historial dentro del mismo hilo.
export const MENSAJES_MOCK: MensajeCliente[] = [
  { from: 'tienda',  txt: 'Hola María! Gracias por tu compra 😊 Cualquier consulta sobre tus pedidos, escribinos por acá.', hora: 'Lun 10:02' },
  { from: 'cliente', txt: 'Hola! Quería consultar por el pedido #ORB-2847, ¿cuándo estaría llegando?',                     hora: 'Lun 10:15' },
  { from: 'tienda',  txt: 'Tu pedido #ORB-2847 está en preparación, calculamos que sale mañana. Te aviso apenas tengamos el código de seguimiento.', hora: 'Lun 10:20' },
  { from: 'cliente', txt: 'Genial, muchas gracias!',                                                                        hora: 'Lun 10:21' },
  { from: 'cliente', txt: 'Otra consulta: el pedido #ORB-2610 me llegó todo perfecto, quería agradecerles.',                hora: 'Ayer 16:40' },
  { from: 'tienda',  txt: 'Qué alegría leer esto! Gracias a vos por elegirnos 🙌',                                          hora: 'Ayer 16:50' },
]

export const PEDIDO_MOCK: Pedido = {
  id:         'ORB-2847',
  fecha:      '17 may 2026 · 14:32',
  total:      92280,
  items:      4,
  tracking:   'AR3489573',
  metodoPago: 'Mercado Pago',
  comprador:  {
    nombre:    'María Fernández',
    email:     'maria@mail.com',
    telefono:  '+54 9 11 2345-6789',
    direccion: 'Av. Corrientes 1234, Piso 5 B · CABA C1043AAZ',
  },
  timeline: [
    { label:'Pendiente',       done:true,  fecha:'17 may · 14:32' },
    { label:'Confirmado',      done:true,  fecha:'17 may · 14:33' },
    { label:'En preparación',  done:true,  fecha:'17 may · 15:10' },
    { label:'Enviado',         done:false, fecha:'Est. 18 may'    },
    { label:'Entregado',       done:false, fecha:'Est. 19 may'    },
  ],
}
