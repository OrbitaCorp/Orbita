// src/modules/propuestas/home/datos.ts — Contenido de la propuesta de nueva
// home (pages/nueva-home.tsx). TODO el texto del sitio actual (orbita.site)
// está acá, más los módulos reales del panel que la landing vieja no cuenta.
// DEMO INTERNA para debatir con el equipo — no reemplaza pages/index.tsx.

export interface Modulo {
  id: string
  nombre: string
  corto: string
  color: string
  anillo: 1 | 2
  /** Ícono de lucide-react (nombre) */
  icono: 'CalendarDays' | 'Store' | 'ShoppingBag' | 'Users' | 'Percent' | 'Boxes' | 'MessageCircle' | 'BarChart3' | 'Sparkles' | 'CreditCard' | 'Globe' | 'LayoutTemplate'
}

export const MODULOS: Modulo[] = [
  { id: 'turnos',     nombre: 'Turnos',      corto: 'Agenda online con recordatorios por WhatsApp.',            color: '#60A5FA', anillo: 1, icono: 'CalendarDays' },
  { id: 'tienda',     nombre: 'Tienda',      corto: 'Catálogo, carrito y checkout con Mercado Pago. Sin comisiones.', color: '#34D399', anillo: 1, icono: 'Store' },
  { id: 'pedidos',    nombre: 'Pedidos',     corto: 'Cada pedido con su estado, de pendiente a entregado.',     color: '#FBBF24', anillo: 1, icono: 'ShoppingBag' },
  { id: 'clientes',   nombre: 'Clientes',    corto: 'Historial completo de cada cliente, en un lugar.',          color: '#F472B6', anillo: 1, icono: 'Users' },
  { id: 'pos',        nombre: 'Punto de venta', corto: 'Cobrá en el mostrador con el mismo stock de la tienda.',  color: '#A78BFA', anillo: 1, icono: 'CreditCard' },
  { id: 'descuentos', nombre: 'Descuentos',  corto: 'Cupones, promos por cantidad y ofertas con cuenta regresiva.', color: '#FB7185', anillo: 2, icono: 'Percent' },
  { id: 'inventario', nombre: 'Inventario',  corto: 'Stock sincronizado entre la tienda y el mostrador.',       color: '#2DD4BF', anillo: 2, icono: 'Boxes' },
  { id: 'mensajes',   nombre: 'Mensajes',    corto: 'Las consultas de tus clientes, sin perderlas en el celular.', color: '#38BDF8', anillo: 2, icono: 'MessageCircle' },
  { id: 'reportes',   nombre: 'Reportes',    corto: 'Ventas, productos que rotan y clientes VIP, en tiempo real.', color: '#FB923C', anillo: 2, icono: 'BarChart3' },
  { id: 'plantillas', nombre: 'Plantillas',  corto: 'Veinte portadas listas para que tu tienda se vea como tu marca.', color: '#C084FC', anillo: 2, icono: 'LayoutTemplate' },
  { id: 'dominios',   nombre: 'Dominio propio', corto: 'Tu tienda en tunegocio.com.ar, comprado desde el panel.', color: '#818CF8', anillo: 2, icono: 'Globe' },
  { id: 'orbi',       nombre: 'Orbi',        corto: 'Tu asistente con IA: crea productos, lee reportes y te guía.', color: '#8B5CF6', anillo: 2, icono: 'Sparkles' },
]

export const PILLS = ['Turnos online', 'Tienda propia', 'Analytics', 'Multi-canal', 'Sin comisiones']

export interface Paso {
  id: string
  etiqueta: string
  variante: 'rojo' | 'verde' | 'azul'
  titulo: string
  resaltado: string
  desc: string
  items: { ok: boolean; texto: string }[]
  mock: 'chat' | 'panel' | 'calendario' | 'tienda' | 'dashboard'
}

export const PASOS: Paso[] = [
  {
    id: 'step-problem', etiqueta: 'Antes de Órbita', variante: 'rojo',
    titulo: 'Tu negocio está', resaltado: 'fragmentado.',
    desc: 'Pedidos por WhatsApp, catálogo en Instagram, stock en Excel... información desconectada que te quita tiempo y dinero.',
    items: [
      { ok: false, texto: 'Información duplicada en todas partes' },
      { ok: false, texto: 'Carga manual lenta y propensa a errores' },
      { ok: false, texto: '48 mensajes sin responder a la vez' },
    ],
    mock: 'chat',
  },
  {
    id: 'step-solution', etiqueta: 'La solución', variante: 'verde',
    titulo: 'Una sola plataforma.', resaltado: 'Todo conectado.',
    desc: 'Órbita reemplaza todas esas apps sueltas. Tus turnos, ventas, pedidos y clientes, sincronizados en tiempo real.',
    items: [
      { ok: true, texto: 'Panel único de gestión centralizado' },
      { ok: true, texto: 'Sincronización automática en tiempo real' },
    ],
    mock: 'panel',
  },
  {
    id: 'step-turnos', etiqueta: 'Módulo · Turnos', variante: 'azul',
    titulo: 'Agenda online.', resaltado: 'Sin WhatsApps.',
    desc: 'Tus clientes reservan turno desde tu link. Vos recibís la confirmación y ellos el recordatorio automático.',
    items: [
      { ok: true, texto: 'Calendario visual con reservas en tiempo real' },
      { ok: true, texto: 'Recordatorios automáticos por WhatsApp' },
    ],
    mock: 'calendario',
  },
  {
    id: 'step-tienda', etiqueta: 'Módulo · Tienda', variante: 'azul',
    titulo: 'Tu tienda,', resaltado: 'abierta 24/7.',
    desc: 'Cargá tus productos y compartí el link. Tus clientes navegan, buscan y te hacen el pedido directo. Sin comisiones.',
    items: [
      { ok: true, texto: 'Catálogo con fotos, precios y variantes' },
      { ok: true, texto: 'Link propio para compartir en redes sociales' },
    ],
    mock: 'tienda',
  },
  {
    id: 'step-dash', etiqueta: 'Resultados', variante: 'verde',
    titulo: 'Un negocio organizado', resaltado: 'crece más rápido.',
    desc: 'Cuando todo está en un solo lugar, tomás mejores decisiones. Sabés cuánto vendiste y qué funciona más.',
    items: [
      { ok: true, texto: 'Dashboard con métricas en tiempo real' },
      { ok: true, texto: 'Historial completo de cada cliente' },
    ],
    mock: 'dashboard',
  },
]

export const RUBROS = [
  { img: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80', nombre: 'Pet Shops' },
  { img: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=80', nombre: 'Manicura' },
  { img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80', nombre: 'Tienda Online' },
  { img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=80', nombre: 'Barbería' },
  { img: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=400&q=80', nombre: 'Estética' },
  { img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80', nombre: 'Gastronomía' },
  { img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80', nombre: 'Spa' },
  { img: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=80', nombre: 'Automotriz' },
  { img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80', nombre: 'Restaurante' },
  { img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80', nombre: 'Gimnasio' },
]

export const TESTIMONIOS = [
  { texto: 'Antes tardaba 2 horas por día respondiendo WhatsApps de turnos. Ahora mis clientes reservan solos y yo me concentro en trabajar.', nombre: 'Martina C.', rol: 'Estilista · CABA', ini: 'MC', color: '#F472B6' },
  { texto: 'La tienda online me permitió vender fuera de mi barrio. Mis ventas crecieron un 40% en el primer mes con el catálogo compartido.', nombre: 'Lucas R.', rol: 'Dueño de tienda · Córdoba', ini: 'LR', color: '#34D399' },
  { texto: 'El dashboard me hizo entender qué días son mejores para promociones. Datos que antes no tenía ni en Excel. Impresionante.', nombre: 'Sofía P.', rol: 'Manicurista · Rosario', ini: 'SP', color: '#A78BFA' },
  { texto: 'Me olvidé de los turnos solapados. El calendario visual es súper claro y a los clientes les encanta el recordatorio por WhatsApp.', nombre: 'Diego F.', rol: 'Barbero · Mendoza', ini: 'DF', color: '#60A5FA' },
  { texto: 'Centralizar todo en Órbita me cambió la vida. Pasé de usar 4 aplicaciones distintas a tener todo mi negocio en un solo panel.', nombre: 'Valeria M.', rol: 'Indumentaria · La Plata', ini: 'VM', color: '#FBBF24' },
]

export const PROXIMAMENTE = [
  { titulo: 'Chat Integrado', desc: 'Habla con tus clientes directamente desde la plataforma, sin salir a WhatsApp.', eta: 'Q3 2026', color: '#60A5FA' },
  { titulo: 'Multi-Sucursal', desc: 'Gestioná varias sucursales desde un solo panel. Reportes cruzados y control total.', eta: 'Q4 2026', color: '#A78BFA' },
  { titulo: 'IA Predictiva', desc: 'Predicciones de demanda, stock inteligente y sugerencias automáticas basadas en datos.', eta: '2027', color: '#34D399' },
]

export const NAV = [
  { label: 'Módulos', href: '#modulos' },
  { label: 'Rubros', href: '#rubros' },
  { label: 'Testimonios', href: '#testimonios' },
  { label: 'Próximamente', href: '#proximamente' },
]

export const FOOTER_COLS = [
  { titulo: 'Navegación', links: [{ label: 'Módulos', href: '#modulos' }, { label: 'Rubros', href: '#rubros' }, { label: 'Testimonios', href: '#testimonios' }, { label: 'Próximamente', href: '#proximamente' }] },
  { titulo: 'Plataforma', links: [{ label: 'Turnos', href: '#modulos' }, { label: 'Tienda', href: '#modulos' }, { label: 'Dashboard', href: '#modulos' }, { label: 'Clientes', href: '#modulos' }] },
]
