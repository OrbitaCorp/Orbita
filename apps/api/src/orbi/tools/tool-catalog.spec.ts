import { ToolRegistryService } from './tool-registry.service';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import { NavigationTool } from './definitions/navigation.tool';
import { ListProductsTool, CreateProductTool, GenerateDescriptionTool } from './definitions/product.tools';
import { ListDiscountsTool, CreateDiscountTool, CreateCouponTool } from './definitions/discount.tools';
import { ListOrdersTool, GetOrderDetailTool, UpdateOrderStatusTool } from './definitions/order.tools';
import { ListCustomersTool, GetCustomerDetailTool } from './definitions/customer.tools';
import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './definitions/config.tools';
import { GetSalesReportTool, GetProductReportTool, GetCustomerReportTool } from './definitions/report.tools';
import { SuggestBusinessNameTool, SuggestDescriptionTool, FillWizardFieldTool } from './definitions/wizard.tools';

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
  const WIZARD_TOOL_NAMES = ['suggestBusinessName', 'suggestDescription', 'fillWizardField'];

  // Zona prohibida (ver spec de diseño): estas acciones NUNCA deben existir
  // como tool, sin importar qué permisos tenga el usuario.
  const FORBIDDEN_TOOL_NAMES = ['deleteBusiness', 'changePlan', 'updateCredentials', 'removeMember'];

  it('registra las 21 tools del catálogo completo', () => {
    const allWithAllPerms = new Set([
      ...registry.getTools(OrbiSurface.PANEL, ['products:write', 'discounts:write', 'orders:write', 'config:write', 'reports.view']).map(t => t.name),
      ...registry.getTools(OrbiSurface.WIZARD, []).map(t => t.name),
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
    const names = registry.getTools(OrbiSurface.WIZARD, []).map(t => t.name);
    expect(names.sort()).toEqual([...WIZARD_TOOL_NAMES].sort());
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
    const wizardNames = registry.getTools(OrbiSurface.WIZARD, todosLosPermisos).map(t => t.name);
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(panelNames).not.toContain(forbidden);
      expect(wizardNames).not.toContain(forbidden);
    }
  });
});
