import { ToolRegistryService } from './tool-registry.service';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { NavigationTool } from './definitions/navigation.tool';
import { LeerTemaDelManualTool } from './definitions/manual.tools';
import { EstadoPrimerosPasosTool, AccesoDelEquipoTool } from './definitions/estado.tools';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from './definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from './definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from './definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from './definitions/report.tools';
import { SuggestBusinessNameTool, SuggestDescriptionTool, SuggestSubdomainTool, SelectWizardOptionTool, FillWizardFieldTool } from './definitions/wizard.tools';
import { getWizardPrompt } from '../prompts/wizard';
import { CODIGOS_DEL_CATALOGO } from '../../common/permisos/catalogo';

// Solo se necesita que existan como objetos — ninguno de estos tests llama a
// execute(), así que no hace falta implementar los métodos reales de cada
// servicio.
const stub = {} as any;

// Las tools que resuelven datos para la tarjeta (el pedido, la categoría) leen
// la base. Este falso devuelve nombres que LLEVAN el id buscado: así, en la
// invariante 4, el centinela de un id aparece en el resumen si y solo si la
// tool buscó ese id (y no otro).
const prismaFalso = {
  order: {
    findFirst: jest.fn(async ({ where }: { where: { id: string } }) => ({
      orderNumber: 9101,
      status: 'PENDING',
      channel: 'ONLINE',
      customer: null,
      onlineOrderDetails: { buyerName: `cliente-${where.id}`, buyerEmail: 'c@example.com' },
    })),
  },
  category: {
    findFirst: jest.fn(async ({ where }: { where: { id: string } }) => ({ name: `categoria-${where.id}` })),
  },
} as any;

describe('Orbi — catálogo completo de tools', () => {
  let registry: ToolRegistryService;

  beforeEach(() => {
    registry = new ToolRegistryService();
    registry.register(new NavigationTool());
    registry.register(new LeerTemaDelManualTool());
    registry.register(new ListProductsTool(stub));
    registry.register(new CreateProductTool(stub, prismaFalso));
    registry.register(new GenerateDescriptionTool(stub, stub));
    registry.register(new ListDiscountsTool(stub));
    registry.register(new CreateDiscountTool(stub));
    registry.register(new CreateCouponTool(stub));
    registry.register(new ListOrdersTool(stub));
    registry.register(new GetOrderDetailTool(stub));
    registry.register(new UpdateOrderStatusTool(stub, prismaFalso));
    registry.register(new ListCustomersTool(stub));
    registry.register(new GetCustomerDetailTool(stub));
    registry.register(new UpdateBusinessInfoTool(stub));
    registry.register(new UpdatePaymentMethodsTool(stub));
    registry.register(new UpdateShippingTool(stub));
    registry.register(new GetSalesReportTool(stub));
    registry.register(new GetProductReportTool(stub));
    registry.register(new GetCustomerReportTool(stub));
    registry.register(new EstadoPrimerosPasosTool(stub, stub));
    registry.register(new AccesoDelEquipoTool(stub));
    registry.register(new SuggestBusinessNameTool(stub, stub));
    registry.register(new SuggestDescriptionTool(stub));
    registry.register(new SuggestSubdomainTool(stub));
    registry.register(new SelectWizardOptionTool());
    registry.register(new FillWizardFieldTool());
  });

  const PANEL_TOOL_NAMES = [
    'navigateTo',
    'listProducts', 'createProduct', 'generateDescription',
    'listDiscounts', 'createDiscount', 'createCoupon',
    'listOrders', 'getOrderDetail', 'updateOrderStatus',
    'listCustomers', 'getCustomerDetail',
    'updateBusinessInfo', 'updatePaymentMethods', 'updateShipping',
    'getSalesReport', 'getProductReport', 'getCustomerReport',
    'leerTemaDelManual', 'estadoPrimerosPasos', 'accesoDelEquipo',
  ];
  // Todas las tools del wizard están limitadas por paso (`steps`), así que
  // pedirlas sin stepName devuelve una lista vacía — no el catálogo. 'tu-negocio'
  // es el único paso donde están habilitadas las cuatro, por eso se usa como
  // paso de referencia para listar el catálogo completo.
  const PASO_CON_TODAS_LAS_WIZARD_TOOLS = 'tu-negocio';
  const WIZARD_TOOL_NAMES = ['suggestBusinessName', 'suggestDescription', 'suggestSubdomain', 'selectWizardOption', 'fillWizardField'];

  // Zona prohibida (ver spec de diseño): estas acciones NUNCA deben existir
  // como tool, sin importar qué permisos tenga el usuario.
  const FORBIDDEN_TOOL_NAMES = ['deleteBusiness', 'changePlan', 'updateCredentials', 'removeMember'];

  it('registra las 26 tools del catálogo completo', () => {
    const allWithAllPerms = new Set([
      ...registry.getTools(OrbiSurface.PANEL, CODIGOS_DEL_CATALOGO).map(t => t.name),
      ...registry.getTools(OrbiSurface.WIZARD, [], PASO_CON_TODAS_LAS_WIZARD_TOOLS).map(t => t.name),
    ]);
    expect(allWithAllPerms.size).toBe(PANEL_TOOL_NAMES.length + WIZARD_TOOL_NAMES.length);
  });

  it('panel surface devuelve todas las panel tools (con permisos de escritura)', () => {
    const names = registry.getTools(OrbiSurface.PANEL, CODIGOS_DEL_CATALOGO).map(t => t.name);
    for (const expected of PANEL_TOOL_NAMES) {
      expect(names).toContain(expected);
    }
    for (const forbidden of WIZARD_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('wizard surface devuelve SOLO las wizard tools', () => {
    const names = registry.getTools(OrbiSurface.WIZARD, [], PASO_CON_TODAS_LAS_WIZARD_TOOLS).map(t => t.name);
    expect(names.sort()).toEqual([...WIZARD_TOOL_NAMES].sort());
  });

  // El gate por paso no es cosmético: si una tool aparece en un paso que no la
  // sabe manejar, el usuario recibe un botón que no hace nada. El caso que ya
  // pasó es selectWizardOption en 'cuenta', donde no hay ninguna opción que
  // elegir y el handler de 'orbi:select-option' del front ni siquiera escucha.
  it('en "cuenta" no hay ninguna tool disponible', () => {
    const names = registry.getTools(OrbiSurface.WIZARD, [], 'cuenta').map(t => t.name);
    expect(names).toEqual([]);
  });

  it('cada paso del wizard expone solo las tools que ese paso sabe manejar', () => {
    const porPaso: Record<string, string[]> = {
      'elegir-rubro': ['selectWizardOption'],
      'subrubros': ['selectWizardOption'],
      'ubicacion': ['selectWizardOption'],
      'tu-negocio': ['suggestBusinessName', 'suggestDescription', 'suggestSubdomain', 'selectWizardOption', 'fillWizardField'],
    };

    for (const [paso, esperadas] of Object.entries(porPaso)) {
      const names = registry.getTools(OrbiSurface.WIZARD, [], paso).map(t => t.name);
      expect(names.sort()).toEqual([...esperadas].sort());
    }
  });

  it('sin stepName no se habilita ninguna tool del wizard', () => {
    // El endpoint público arma las tools con dto.context.stepName: si el front
    // no lo manda (o manda un paso que ya no existe), el modelo se queda sin
    // herramientas en vez de recibir un set arbitrario.
    expect(registry.getTools(OrbiSurface.WIZARD, []).map(t => t.name)).toEqual([]);
    expect(registry.getTools(OrbiSurface.WIZARD, [], 'pagos').map(t => t.name)).toEqual([]);
  });

  // El prompt de cada paso le nombra herramientas al modelo. Si nombra una que
  // ese paso no habilita, el modelo la va a intentar llamar y el registry se la
  // va a rechazar en execute() — con lo cual el usuario ve a Orbi "intentar"
  // algo y fallar, sin ninguna explicación. Es la contracara del bug que tenía
  // selectWizardOption: ahí sobraba la tool, acá sobraría la mención.
  it('ningún prompt de paso nombra una tool que ese paso no habilita', () => {
    const TODAS = [...PANEL_TOOL_NAMES, ...WIZARD_TOOL_NAMES];

    for (const paso of ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta']) {
      const prompt = getWizardPrompt(paso, 'tienda', [{ key: 'k', label: 'L' }]);
      const habilitadas = registry.getTools(OrbiSurface.WIZARD, [], paso).map(t => t.name);

      for (const tool of TODAS) {
        if (prompt.includes(tool)) {
          expect({ paso, tool, habilitadas }).toEqual({ paso, tool, habilitadas: expect.arrayContaining([tool]) });
        }
      }
    }
  });

  // El aislamiento entre negocios no depende de que el modelo se porte bien:
  // depende de que no exista forma de expresar "el otro negocio". Ninguna tool
  // acepta un businessId por parámetro — todas usan ctx.businessId, que sale
  // del JWT. Si alguien agrega uno, este test tiene que doler.
  it('ninguna tool acepta un businessId (ni nada que huela a tenant) por parámetro', () => {
    const prohibidos = ['businessid', 'business_id', 'tenantid', 'tenant_id', 'negocioid', 'slug', 'subdomain'];

    for (const tool of registry.getTools(OrbiSurface.PANEL, CODIGOS_DEL_CATALOGO)) {
      const params = Object.keys((tool.parameters as { properties?: Record<string, unknown> })?.properties ?? {});
      for (const p of params) {
        expect({ tool: tool.name, parametro: p, prohibido: false })
          .toEqual({ tool: tool.name, parametro: p, prohibido: prohibidos.includes(p.toLowerCase()) });
      }
    }
  });

  // Invariantes de permisos y confirmación (spec de la fase 1, §3.2). Antes
  // "escribe" se deducía de un permiso que terminara en ":write", y esos
  // códigos no existían en el catálogo real: ninguna tool de escritura se
  // habilitaba nunca para un rol que no fuera owner. Ahora se ata al catálogo.
  const todasLasTools = () => Array.from(((registry as any).tools as Map<string, any>).values());
  const toolsDelPanel = () => todasLasTools().filter(t => t.surfaces.includes(OrbiSurface.PANEL));

  // Lista EXPLÍCITA de las tools que no piden confirmación. Una tool nueva que
  // escribe y se olvida de requiresConfirmation no está acá, y el test rompe.
  // generateDescription no persiste (genera texto), pero gasta IA paga: por eso
  // pide catalog.manage y consume la cuota diaria.
  const SOLO_LECTURA = [
    'navigateTo',
    'listProducts', 'generateDescription',
    'listDiscounts',
    'listOrders', 'getOrderDetail',
    'listCustomers', 'getCustomerDetail',
    'getSalesReport', 'getProductReport', 'getCustomerReport',
    'leerTemaDelManual', 'estadoPrimerosPasos', 'accesoDelEquipo',
  ];
  const ESCRIBEN = [
    'createProduct', 'createDiscount', 'createCoupon', 'updateOrderStatus',
    'updateBusinessInfo', 'updatePaymentMethods', 'updateShipping',
  ];

  it('invariante 1: todo permiso que pide una tool existe en el catálogo real', () => {
    for (const tool of todasLasTools()) {
      for (const permiso of tool.requiredPermissions as string[]) {
        expect({ tool: tool.name, permiso, existe: CODIGOS_DEL_CATALOGO.includes(permiso) })
          .toEqual({ tool: tool.name, permiso, existe: true });
      }
    }
  });

  it('invariante 2: toda tool sin requiresConfirmation está en la lista explícita de solo lectura', () => {
    for (const tool of toolsDelPanel()) {
      if (tool.requiresConfirmation) continue;
      expect({ tool: tool.name, enLista: SOLO_LECTURA.includes(tool.name) })
        .toEqual({ tool: tool.name, enLista: true });
    }
    // Y al revés: lo que escribe de verdad tiene que confirmar.
    for (const nombre of ESCRIBEN) {
      const tool = (registry as any).tools.get(nombre);
      expect({ nombre, confirma: Boolean(tool?.requiresConfirmation) }).toEqual({ nombre, confirma: true });
    }
  });

  // Las únicas tools sin permiso son las que no pueden leer datos del negocio:
  // su execute() NO recibe el contexto (ni businessId, ni userId). navigateTo
  // arma una ruta; leerTemaDelManual lee el manual, que es igual para todos.
  const SIN_DATOS_DEL_NEGOCIO = ['navigateTo', 'leerTemaDelManual'];

  it('invariante 3: toda tool del panel pide al menos un permiso, salvo las que no reciben el contexto del negocio', () => {
    for (const tool of toolsDelPanel()) {
      if (SIN_DATOS_DEL_NEGOCIO.includes(tool.name)) continue;
      expect({ tool: tool.name, pidePermiso: tool.requiredPermissions.length > 0 })
        .toEqual({ tool: tool.name, pidePermiso: true });
    }
    // La excepción se verifica, no se declara: si una de estas tools empieza
    // a recibir el ctx (y podría leer el negocio), tiene que pedir un permiso.
    for (const nombre of SIN_DATOS_DEL_NEGOCIO) {
      const tool = (registry as any).tools.get(nombre);
      expect({ nombre, parametrosDeExecute: tool.execute.length, permisos: tool.requiredPermissions })
        .toEqual({ nombre, parametrosDeExecute: 1, permisos: [] });
    }
  });

  it('el mapeo de permisos por tool es el del spec (§3.1)', () => {
    const esperado: Record<string, string[]> = {
      createProduct: ['catalog.manage'],
      generateDescription: ['catalog.manage'],
      createDiscount: ['discounts.manage'],
      createCoupon: ['discounts.manage'],
      updateOrderStatus: ['orders.manage'],
      updateBusinessInfo: ['config.edit'],
      updatePaymentMethods: ['config.edit'],
      updateShipping: ['config.edit'],
      listOrders: ['orders.view'],
      getOrderDetail: ['orders.view'],
      listCustomers: ['customers.view'],
      getCustomerDetail: ['customers.view'],
      listProducts: ['catalog.view'],
      listDiscounts: ['discounts.view'],
      getSalesReport: ['reports.view'],
      getProductReport: ['reports.view'],
      getCustomerReport: ['reports.view'],
      navigateTo: [],
      leerTemaDelManual: [],
      estadoPrimerosPasos: ['reports.dashboard'],
      accesoDelEquipo: ['config.team.view'],
    };
    for (const [nombre, permisos] of Object.entries(esperado)) {
      const tool = (registry as any).tools.get(nombre);
      expect({ nombre, permisos: tool.requiredPermissions }).toEqual({ nombre, permisos });
    }
  });

  it('las tools que exigen confirmación saben explicar qué van a hacer', () => {
    // Sin describirAccion el botón diría el nombre de la función, que es
    // exactamente lo que la persona no puede evaluar. Tiene que poder leer los
    // valores concretos y decidir si el modelo entendió bien.
    for (const nombre of ['createProduct', 'createDiscount', 'createCoupon', 'updateOrderStatus', 'updateBusinessInfo', 'updatePaymentMethods', 'updateShipping']) {
      const tool = (registry as any).tools.get(nombre);
      expect({ nombre, describe: typeof tool?.describirAccion === 'function' })
        .toEqual({ nombre, describe: true });
    }
  });

  it('proponer() no propone nada si faltan los permisos', async () => {
    const ctx = { businessId: 'b', userId: 'u', surface: OrbiSurface.PANEL, permissions: [] as string[] };
    const cupon = { code: 'XYZ', name: 'Cupón', type: 'PERCENT_TICKET', value: 20, scope: 'TICKET' };

    // Sin discounts.manage no hay propuesta: no tiene sentido ofrecerle a alguien
    // un botón para algo que execute() le va a rechazar igual.
    expect(await registry.proponer('createCoupon', cupon, ctx)).toBeNull();

    const conPermiso = { ...ctx, permissions: ['discounts.manage'] };
    expect(await registry.proponer('createCoupon', cupon, conPermiso))
      .toEqual({ resumen: expect.stringContaining('XYZ') });
  });

  it('una tool de lectura nunca se propone: se ejecuta y listo', async () => {
    const ctx = { businessId: 'b', userId: 'u', surface: OrbiSurface.PANEL, permissions: ['catalog.manage'] };
    expect(await registry.proponer('listProducts', {}, ctx)).toBeNull();
    expect(await registry.proponer('listOrders', {}, ctx)).toBeNull();
  });

  it('en la demo (soloLectura) ninguna escritura se propone, con todos los permisos', async () => {
    const ctx = { businessId: 'b', userId: 'u', surface: OrbiSurface.PANEL, permissions: CODIGOS_DEL_CATALOGO };
    for (const nombre of ESCRIBEN) {
      expect({ nombre, propuesta: await registry.proponer(nombre, {}, ctx, undefined, { soloLectura: true }) })
        .toEqual({ nombre, propuesta: null });
    }
  });

  // Invariante 4 (spec §3.2): la tarjeta de confirmación muestra CADA valor que
  // se va a escribir. Un texto de terceros (el nombre de un cliente, una
  // reseña) puede convencer al modelo de meter un valor de más — un alias de
  // transferencia, una política de envío — y si la tarjeta no lo muestra, la
  // persona confirma sin verlo.
  //
  // Dos chequeos por propiedad de `parameters`, con todas cargadas a la vez:
  // - Textos y números: el valor centinela aparece LITERAL en el resumen.
  // - Todas (también enums, booleanos y listas, que se muestran traducidos o
  //   contados): cambiar solo esa propiedad cambia el resumen. Si una propiedad
  //   no mueve la tarjeta, la tarjeta no la está mostrando.
  describe('invariante 4: describirAccion muestra cada parámetro', () => {
    type Prop = { type?: string; enum?: unknown[]; items?: { type?: string; enum?: unknown[] } };
    const ctx = { businessId: 'biz-cat', userId: 'u', surface: OrbiSurface.PANEL, permissions: CODIGOS_DEL_CATALOGO };

    function centinelas(props: Record<string, Prop>) {
      const base: Record<string, unknown> = {};
      const otro: Record<string, unknown> = {};
      const literal: Record<string, string> = {};
      Object.entries(props).forEach(([nombre, p], i) => {
        if (p.enum) {
          base[nombre] = p.enum[0];
          otro[nombre] = p.enum[1];
        } else if (p.type === 'string') {
          base[nombre] = `centinela-${nombre}`;
          otro[nombre] = `otro-${nombre}`;
          literal[nombre] = String(base[nombre]);
        } else if (p.type === 'number') {
          // Tres cifras: no dependen del separador de miles.
          base[nombre] = 311 + i;
          otro[nombre] = 611 + i;
          literal[nombre] = String(base[nombre]);
        } else if (p.type === 'boolean') {
          base[nombre] = true;
          otro[nombre] = false;
        } else if (p.type === 'array') {
          const valores = p.items?.enum ?? ['a1', 'a2', 'a3'];
          base[nombre] = valores.slice(0, 1);
          otro[nombre] = valores.slice(0, 2);
        } else {
          throw new Error(`Tipo sin centinela en ${nombre}: agregalo a este test`);
        }
      });
      return { base, otro, literal };
    }

    it.each([
      'createProduct', 'createDiscount', 'createCoupon', 'updateOrderStatus',
      'updateBusinessInfo', 'updatePaymentMethods', 'updateShipping',
    ])('%s', async (nombre) => {
      const tool = (registry as any).tools.get(nombre);
      expect(tool.requiresConfirmation).toBe(true);
      const props = (tool.parameters as { properties: Record<string, Prop> }).properties;
      const { base, otro, literal } = centinelas(props);

      const resumen: string = await tool.describirAccion(base, ctx);
      for (const [prop, valor] of Object.entries(literal)) {
        expect({ tool: nombre, prop, aparece: resumen.includes(valor) }).toEqual({ tool: nombre, prop, aparece: true });
      }
      for (const prop of Object.keys(props)) {
        const cambiado: string = await tool.describirAccion({ ...base, [prop]: otro[prop] }, ctx);
        expect({ tool: nombre, prop, cambia: cambiado !== resumen }).toEqual({ tool: nombre, prop, cambia: true });
      }
    });

    it('toda tool que confirma está cubierta por la invariante', () => {
      const confirman = todasLasTools().filter(t => t.requiresConfirmation).map(t => t.name).sort();
      expect(confirman).toEqual([...ESCRIBEN].sort());
    });

    it('lo que se lee de la base para la tarjeta sale acotado al negocio del token', async () => {
      prismaFalso.order.findFirst.mockClear();
      prismaFalso.category.findFirst.mockClear();
      const orderTool = (registry as any).tools.get('updateOrderStatus');
      const productTool = (registry as any).tools.get('createProduct');
      await orderTool.describirAccion({ orderId: 'o-1', status: 'CONFIRMED' }, ctx);
      await productTool.describirAccion({ name: 'R', basePrice: 1, categoryId: 'c-1' }, ctx);
      expect(prismaFalso.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'o-1', businessId: 'biz-cat' }) }));
      expect(prismaFalso.category.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'c-1', businessId: 'biz-cat' }) }));
    });
  });

  it('un usuario sin permisos no ve ninguna tool de datos del negocio', () => {
    const names = registry.getTools(OrbiSurface.PANEL, []).map(t => t.name);
    // Sin ningún permiso solo queda navegar y leer el manual: ni escrituras ni
    // lecturas del negocio.
    expect(names).toEqual(['navigateTo', 'leerTemaDelManual']);
  });

  it('un empleado con solo lectura ve las lecturas de sus permisos y ninguna escritura', () => {
    const names = registry.getTools(OrbiSurface.PANEL, ['orders.view', 'customers.view', 'catalog.view']).map(t => t.name);
    for (const lectura of ['listOrders', 'getOrderDetail', 'listCustomers', 'getCustomerDetail', 'listProducts']) {
      expect(names).toContain(lectura);
    }
    for (const escritura of ESCRIBEN) expect(names).not.toContain(escritura);
    // Ni descuentos ni reportes ni la IA paga: no tiene esos permisos.
    for (const n of ['listDiscounts', 'getSalesReport', 'generateDescription']) expect(names).not.toContain(n);
  });

  it('las reports tools exigen reports.view', () => {
    const sinPermiso = registry.getTools(OrbiSurface.PANEL, []).map(t => t.name);
    expect(sinPermiso).not.toContain('getSalesReport');
    expect(sinPermiso).not.toContain('getProductReport');
    expect(sinPermiso).not.toContain('getCustomerReport');

    const conPermiso = registry.getTools(OrbiSurface.PANEL, ['reports.view']).map(t => t.name);
    expect(conPermiso).toContain('getSalesReport');
    expect(conPermiso).toContain('getProductReport');
    expect(conPermiso).toContain('getCustomerReport');
  });

  it('zona prohibida: ninguna tool destructiva existe en el registro, con ningún permiso', () => {
    const todosLosPermisos = [...CODIGOS_DEL_CATALOGO, 'admin:write', 'owner'];
    const panelNames = registry.getTools(OrbiSurface.PANEL, todosLosPermisos).map(t => t.name);
    const wizardNames = registry.getTools(OrbiSurface.WIZARD, todosLosPermisos, PASO_CON_TODAS_LAS_WIZARD_TOOLS).map(t => t.name);
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(panelNames).not.toContain(forbidden);
      expect(wizardNames).not.toContain(forbidden);
    }
  });
});
