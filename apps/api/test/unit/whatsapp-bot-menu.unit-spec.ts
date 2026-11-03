import {
  LIMITES_MENU, MARCA_MENU_TEXTO, OPCIONES_POR_DEFECTO, armarMenuInteractivo, armarMenuTexto, esSaludoOPedidoDeMenu, opcionDeNumero, opcionesActivas,
  opcionesDelMenu, validarMenu, type OpcionDeMenu,
} from '../../src/whatsapp/whatsapp-bot-menu';

// El menú de opciones de Orbi: por defecto, validación de lo que edita el dueño, y el mensaje que sale por WhatsApp.

const opcion = (id: string, titulo: string, extra: Partial<OpcionDeMenu> = {}): OpcionDeMenu => ({ id, titulo, activa: true, ...extra });

describe('opcionesDelMenu', () => {
  it('sin nada guardado devuelve el menú de fábrica (una copia: editarla no toca el original)', () => {
    const a = opcionesDelMenu(null);
    expect(a.map((o) => o.id)).toEqual(['catalogo', 'pedidos', 'promos', 'envios', 'horarios', 'persona']);
    a[0].titulo = 'otra cosa';
    expect(OPCIONES_POR_DEFECTO[0].titulo).toBe('Ver el catálogo');
  });
  it('lo guardado se respeta (orden, títulos, activas) y lo mal formado se descarta sin tirar', () => {
    const r = opcionesDelMenu([{ id: 'persona', titulo: 'Ayuda humana', activa: true }, 'basura', null, { id: 'x' }, { id: 'catalogo', titulo: 'Productos', activa: false }]);
    expect(r.map((o) => [o.id, o.titulo, o.activa])).toEqual([['persona', 'Ayuda humana', true], ['catalogo', 'Productos', false]]);
  });
  it('si no queda ninguna válida, vuelve a las de fábrica; opcionesActivas saca las apagadas', () => {
    expect(opcionesDelMenu([{ nada: 1 }])).toHaveLength(6);
    expect(opcionesActivas([{ id: 'catalogo', titulo: 'A', activa: true }, { id: 'persona', titulo: 'B', activa: false }]).map((o) => o.id)).toEqual(['catalogo']);
  });
});

describe('validarMenu', () => {
  it('el menú de fábrica es válido en lista y en botones solo si se apagan las que sobran', () => {
    expect(validarMenu(OPCIONES_POR_DEFECTO, 'LISTA')).toBeNull();
    expect(validarMenu(OPCIONES_POR_DEFECTO, 'BOTONES')).toMatch(/hasta 3/);
    const tres = OPCIONES_POR_DEFECTO.map((o, i) => ({ ...o, activa: i < 3 }));
    expect(validarMenu(tres, 'BOTONES')).toBeNull();
  });
  it('respeta los límites de WhatsApp: 10 opciones, títulos de 24 (lista) o 20 (botones), descripciones de 72', () => {
    const once = Array.from({ length: 11 }, (_, i) => opcion(`custom-${i}`, `Op ${i}`, { respuesta: 'x' }));
    expect(validarMenu(once, 'LISTA')).toMatch(/hasta 10/);
    expect(validarMenu([opcion('catalogo', 'x'.repeat(25))], 'LISTA')).toMatch(/24/);
    expect(validarMenu([opcion('catalogo', 'x'.repeat(21))], 'BOTONES')).toMatch(/20/);
    expect(validarMenu([opcion('catalogo', 'x'.repeat(21))], 'LISTA')).toBeNull();
    expect(validarMenu([opcion('catalogo', 'Ok', { descripcion: 'd'.repeat(73) })], 'LISTA')).toMatch(/72/);
  });
  it('las opciones propias necesitan su respuesta, y las de fábrica tienen que existir, sin repetirse', () => {
    expect(validarMenu([opcion('custom-1', 'Mayoristas')], 'LISTA')).toMatch(/necesita el texto/);
    expect(validarMenu([opcion('custom-1', 'Mayoristas', { respuesta: 'Escribinos a mayor@x.com' })], 'LISTA')).toBeNull();
    expect(validarMenu([opcion('inventada', 'Algo')], 'LISTA')).toMatch(/no existe/);
    expect(validarMenu([opcion('catalogo', 'A'), opcion('catalogo', 'B')], 'LISTA')).toMatch(/repetidas/);
    expect(validarMenu([opcion('custom-1', 'Mayor', { respuesta: 'r'.repeat(LIMITES_MENU.respuesta + 1) })], 'LISTA')).toMatch(/1000/);
  });
  it('tiene que quedar al menos una activa, y todas con título', () => {
    expect(validarMenu([opcion('catalogo', 'A', { activa: false })], 'LISTA')).toMatch(/al menos una/);
    expect(validarMenu([opcion('catalogo', '  ')], 'LISTA')).toMatch(/título/);
    expect(validarMenu('no es una lista', 'LISTA')).toMatch(/lista de opciones/);
  });
});

describe('armarMenuInteractivo', () => {
  const tres = [opcion('catalogo', 'Ver el catálogo'), opcion('pedidos', 'Mis pedidos', { descripcion: 'Estado de tus compras' }), opcion('persona', 'Hablar con una persona')];

  it('en lista: un botón "Ver opciones" y una fila por opción con su id (el que vuelve al tocarla)', () => {
    const m = armarMenuInteractivo('¡Hola!', tres, 'LISTA') as any;
    expect(m.type).toBe('list');
    expect(m.body.text).toBe('¡Hola!');
    expect(m.action.button).toBe('Ver opciones');
    expect(m.action.sections[0].rows).toEqual([
      { id: 'catalogo', title: 'Ver el catálogo' },
      { id: 'pedidos', title: 'Mis pedidos', description: 'Estado de tus compras' },
      { id: 'persona', title: 'Hablar con una persona' },
    ]);
  });
  it('en botones: hasta 3 botones de respuesta con título de hasta 20 caracteres', () => {
    const m = armarMenuInteractivo('¡Hola!', [opcion('persona', 'Hablar con una persona')], 'BOTONES') as any; // título de 22: se recorta a 20
    expect(m.type).toBe('button');
    expect(m.action.buttons[0]).toEqual({ type: 'reply', reply: { id: 'persona', title: 'Hablar con una perso' } });
  });
  it('con más de 3 opciones, aunque pida botones, sale como lista (WhatsApp no deja más de 3 botones)', () => {
    expect((armarMenuInteractivo('x', OPCIONES_POR_DEFECTO, 'BOTONES') as any).type).toBe('list');
  });
  it('el saludo se recorta al máximo que acepta WhatsApp', () => {
    expect((armarMenuInteractivo('h'.repeat(700), tres, 'LISTA') as any).body.text).toHaveLength(LIMITES_MENU.bienvenida);
  });
});

describe('menú en texto (lo que se guarda en el chat y el respaldo si WhatsApp no deja el interactivo)', () => {
  const ops = [opcion('catalogo', 'Ver el catálogo'), opcion('pedidos', 'Mis pedidos')];
  it('numera las opciones y lleva la marca para entender un "2" suelto', () => {
    const t = armarMenuTexto('¡Hola!', ops);
    expect(t).toBe(`¡Hola!\n\n1. Ver el catálogo\n2. Mis pedidos\n\n${MARCA_MENU_TEXTO}.`);
    expect(armarMenuTexto('¡Hola!', ops, 'No te entendí')).toMatch(/^No te entendí\n\n¡Hola!/);
  });
  it('opcionDeNumero entiende "2", "2.", "opción 2" y nada más', () => {
    expect(opcionDeNumero('2', ops)?.id).toBe('pedidos');
    expect(opcionDeNumero(' 1. ', ops)?.id).toBe('catalogo');
    expect(opcionDeNumero('Opción 2', ops)?.id).toBe('pedidos');
    expect(opcionDeNumero('3', ops)).toBeNull();
    expect(opcionDeNumero('0', ops)).toBeNull();
    expect(opcionDeNumero('quiero 2 remeras', ops)).toBeNull();
    expect(opcionDeNumero('2 remeras', ops)).toBeNull();
  });
});

describe('esSaludoOPedidoDeMenu', () => {
  it('saludos y pedidos de menú sueltos, con o sin tildes y signos', () => {
    for (const t of ['hola', 'Holaaa', '¡Hola!', 'buenas', 'Buenas tardes', 'buen día', 'hola buenas', 'hola que tal', 'hola orbi', 'menú', 'MENU', 'opciones', 'ayuda', 'inicio']) {
      expect(esSaludoOPedidoDeMenu(t)).toBe(true);
    }
  });
  it('una consulta que arranca con un saludo NO es un saludo: la atiende la IA', () => {
    for (const t of ['hola tienen zapatillas', 'buenas, cuánto sale el envío', 'hola quiero comprar', 'tienen talle M?', 'estado de mi pedido', '']) {
      expect(esSaludoOPedidoDeMenu(t)).toBe(false);
    }
  });
});
