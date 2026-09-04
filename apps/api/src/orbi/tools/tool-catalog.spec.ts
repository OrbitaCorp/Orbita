import { ToolRegistryService } from './tool-registry.service';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { NavigationTool } from './definitions/navigation.tool';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from './definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from './definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from './definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from './definitions/report.tools';
import { SuggestBusinessNameTool, SuggestDescriptionTool, SelectWizardOptionTool, FillWizardFieldTool } from './definitions/wizard.tools';
import { getWizardPrompt } from '../prompts/wizard';

// Solo se necesita que existan como objetos — ninguno de estos tests llama a
// execute(), así que no hace falta implementar los métodos reales de cada
// servicio.
const stub = {} as any;

describe('Orbi — catálogo completo de tools', () => {
  let registry: ToolRegistryService;

  beforeEach(() => {
    registry = new ToolRegistryService();
    registry.register(new NavigationTool());
    registry.register(new ListProductsTool(stub));
    registry.register(new CreateProductTool(stub));
    registry.register(new GenerateDescriptionTool(stub));
    registry.register(new ListDiscountsTool(stub));
    registry.register(new CreateDiscountTool(stub));
    registry.register(new CreateCouponTool(stub));
    registry.register(new ListOrdersTool(stub));
    registry.register(new GetOrderDetailTool(stub));
    registry.register(new UpdateOrderStatusTool(stub));
    registry.register(new ListCustomersTool(stub));
    registry.register(new GetCustomerDetailTool(stub));
    registry.register(new UpdateBusinessInfoTool(stub));
    registry.register(new UpdatePaymentMethodsTool(stub));
    registry.register(new UpdateShippingTool(stub));
    registry.register(new GetSalesReportTool(stub));
    registry.register(new GetProductReportTool(stub));
    registry.register(new GetCustomerReportTool(stub));
    registry.register(new SuggestBusinessNameTool(stub));
    registry.register(new SuggestDescriptionTool(stub));
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
  ];
  // Todas las tools del wizard están limitadas por paso (`steps`), así que
  // pedirlas sin stepName devuelve una lista vacía — no el catálogo. 'tu-negocio'
  // es el único paso donde están habilitadas las cuatro, por eso se usa como
  // paso de referencia para listar el catálogo completo.
  const PASO_CON_TODAS_LAS_WIZARD_TOOLS = 'tu-negocio';
  const WIZARD_TOOL_NAMES = ['suggestBusinessName', 'suggestDescription', 'selectWizardOption', 'fillWizardField'];

  // Zona prohibida (ver spec de diseño): estas acciones NUNCA deben existir
  // como tool, sin importar qué permisos tenga el usuario.
  const FORBIDDEN_TOOL_NAMES = ['deleteBusiness', 'changePlan', 'updateCredentials', 'removeMember'];

  it('registra las 22 tools del catálogo completo', () => {
    const allWithAllPerms = new Set([
      ...registry.getTools(OrbiSurface.PANEL, ['products:write', 'discounts:write', 'orders:write', 'config:write', 'reports.view']).map(t => t.name),
      ...registry.getTools(OrbiSurface.WIZARD, [], PASO_CON_TODAS_LAS_WIZARD_TOOLS).map(t => t.name),
    ]);
    expect(allWithAllPerms.size).toBe(PANEL_TOOL_NAMES.length + WIZARD_TOOL_NAMES.length);
  });

  it('panel surface devuelve todas las panel tools (con permisos de escritura)', () => {
    const names = registry.getTools(OrbiSurface.PANEL, ['products:write', 'discounts:write', 'orders:write', 'config:write', 'reports.view']).map(t => t.name);
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
      'tu-negocio': ['suggestBusinessName', 'suggestDescription', 'selectWizardOption', 'fillWizardField'],
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

    for (const tool of registry.getTools(OrbiSurface.PANEL, ['products:write', 'discounts:write', 'orders:write', 'config:write', 'reports.view'])) {
      const params = Object.keys((tool.parameters as { properties?: Record<string, unknown> })?.properties ?? {});
      for (const p of params) {
        expect({ tool: tool.name, parametro: p, prohibido: false })
          .toEqual({ tool: tool.name, parametro: p, prohibido: prohibidos.includes(p.toLowerCase()) });
      }
    }
  });

  it('un usuario sin permisos de escritura no ve las tools de escritura', () => {
    const names = registry.getTools(OrbiSurface.PANEL, []).map(t => t.name);
    expect(names).not.toContain('createProduct');
    expect(names).not.toContain('createDiscount');
    expect(names).not.toContain('createCoupon');
    expect(names).not.toContain('updateOrderStatus');
    expect(names).not.toContain('updateBusinessInfo');
    expect(names).not.toContain('updatePaymentMethods');
    expect(names).not.toContain('updateShipping');
    // Las de solo lectura siguen disponibles sin ningún permiso especial.
    expect(names).toContain('listProducts');
    expect(names).toContain('listOrders');
    expect(names).toContain('listCustomers');
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
    const todosLosPermisos = ['products:write', 'discounts:write', 'orders:write', 'config:write', 'reports.view', 'admin:write', 'owner'];
    const panelNames = registry.getTools(OrbiSurface.PANEL, todosLosPermisos).map(t => t.name);
    const wizardNames = registry.getTools(OrbiSurface.WIZARD, todosLosPermisos, PASO_CON_TODAS_LAS_WIZARD_TOOLS).map(t => t.name);
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(panelNames).not.toContain(forbidden);
      expect(wizardNames).not.toContain(forbidden);
    }
  });
});
