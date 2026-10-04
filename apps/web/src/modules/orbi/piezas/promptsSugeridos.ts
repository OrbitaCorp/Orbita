// Las frases sugeridas debajo del input (spec fase 3, §6.3): de 4 a 6 por
// pantalla, y solo las que el rol de la persona puede contestar. Ofrecerle a un
// empleado "¿cuánto vendí este mes?" sin `reports.dashboard` es ofrecerle un
// "no tenés permiso". Al tocarlas se copian en la caja, no se envían.
//
// El permiso de cada una es el de la tool que Orbi necesita para contestarla
// (apps/api/src/orbi/tools/definitions). Sin permiso: se contesta con el
// manual, que no pide ninguno.

export interface PromptSugerido {
  texto: string
  permiso?: string
}

const DEL_MANUAL: PromptSugerido[] = [
  { texto: '¿Cómo cargo un producto con variantes?' },
  { texto: '¿Dónde configuro los envíos?' },
]

const POR_PANTALLA: Record<string, PromptSugerido[]> = {
  dashboard: [
    { texto: '¿Cómo vengo este mes comparado con el anterior?', permiso: 'reports.dashboard' },
    { texto: '¿Qué me falta para empezar a vender?', permiso: 'reports.dashboard' },
    { texto: '¿Qué pedidos tengo sin enviar?', permiso: 'orders.view' },
    { texto: '¿Qué productos se están quedando sin stock?', permiso: 'catalog.view' },
  ],
  pedidos: [
    { texto: '¿Qué pedidos tengo pendientes?', permiso: 'orders.view' },
    { texto: '¿Cuáles están pagados y sin enviar?', permiso: 'orders.view' },
    { texto: 'Mostrame los pedidos de esta semana', permiso: 'orders.view' },
    { texto: '¿Cómo hago una devolución?' },
  ],
  catalogo: [
    { texto: '¿Qué productos no tienen stock?', permiso: 'catalog.view' },
    { texto: '¿Qué productos están en borrador?', permiso: 'catalog.view' },
    { texto: '¿Cuáles son los más vendidos?', permiso: 'reports.view' },
    { texto: '¿Cómo cargo un producto con variantes?' },
  ],
  categorias: [
    { texto: '¿Cómo ordeno las categorías en la tienda?' },
    { texto: '¿Qué productos no tienen categoría?', permiso: 'catalog.view' },
  ],
  clientes: [
    { texto: '¿Quiénes son mis mejores clientes?', permiso: 'reports.view' },
    { texto: '¿Cuántos clientes nuevos tuve este mes?', permiso: 'reports.view' },
    { texto: 'Buscá a un cliente por nombre', permiso: 'customers.view' },
  ],
  reportes: [
    { texto: 'Resumime las ventas de la última semana', permiso: 'reports.dashboard' },
    { texto: '¿Qué productos venden más?', permiso: 'reports.view' },
    { texto: '¿Cuál es mi ticket promedio?', permiso: 'reports.view' },
  ],
  descuentos: [
    { texto: '¿Qué descuentos tengo activos?', permiso: 'discounts.view' },
    { texto: 'Armá un 10 % de descuento para toda la tienda', permiso: 'discounts.manage' },
    { texto: '¿Qué diferencia hay entre un descuento y un cupón?' },
  ],
  cupones: [
    { texto: 'Creá un cupón del 15 % para clientes nuevos', permiso: 'discounts.manage' },
    { texto: '¿Qué cupones tengo activos?', permiso: 'discounts.view' },
    { texto: '¿Cómo comparto un cupón con un link?' },
  ],
  configuracion: [
    { texto: '¿Qué medios de pago tengo activos?' },
    { texto: '¿Cómo configuro el envío gratis desde un monto?' },
    { texto: '¿Quiénes del equipo tienen acceso al panel?', permiso: 'config.team.view' },
  ],
  mensajes: [
    { texto: '¿Cómo uso las plantillas de mensajes?' },
    { texto: '¿Cómo le aviso a un cliente que su pedido salió?' },
  ],
}

const MAXIMO = 6

/**
 * Las frases para esta pantalla que esta persona puede usar. El dueño pasa
 * siempre (como en la API: permisosDeOrbi). Si quedan menos de 4, se completan
 * con preguntas del manual.
 */
export function promptsSugeridos(pantalla: string | undefined, rol: string | undefined, permisos: string[] | undefined): string[] {
  const puede = (p: PromptSugerido) => !p.permiso || rol === 'owner' || (permisos ?? []).includes(p.permiso)
  const propios = (pantalla ? POR_PANTALLA[pantalla] ?? [] : []).filter(puede)
  const vistos = new Set(propios.map(p => p.texto))
  const relleno = DEL_MANUAL.filter(p => !vistos.has(p.texto))
  const lista = propios.length >= 4 ? propios : [...propios, ...relleno]
  return lista.slice(0, MAXIMO).map(p => p.texto)
}
