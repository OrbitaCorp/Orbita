import { ContextBuilderService } from './context-builder.service';
import { OrbiSurface, OrbiWizardFormStateDto } from '../dto/orbi-chat.dto';

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;
  let mockPrisma: any;
  let mockModuleData: any;

  beforeEach(() => {
    mockPrisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Rama', industry: 'Indumentaria', mode: 'FULL' }),
      },
    };
    mockModuleData = {
      getSnapshot: jest.fn().mockResolvedValue({}),
    };
    service = new ContextBuilderService(mockPrisma, mockModuleData);
  });

  it('includes core persona in all prompts', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD },
    } as any);

    expect(prompt).toContain('Sos Orbi');
    expect(prompt).toContain('rioplatense');
  });

  it('includes wizard-specific instructions for wizard surface', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD },
    } as any);

    expect(prompt).toContain('wizard de onboarding');
    expect(prompt).toContain('NO tiene cuenta');
    expect(prompt).not.toContain('Zona prohibida');
  });

  it('uses step-specific prompt for elegir-rubro', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: {
        surface: OrbiSurface.WIZARD,
        stepName: 'elegir-rubro',
        availableOptions: [{ key: 'tienda', label: 'Tienda Online' }],
      },
    } as any);

    expect(prompt).toContain('elegir su rubro');
    expect(prompt).toContain('"Tienda Online"');
    expect(prompt).toContain('solo hay UN rubro disponible');
    // No arrastra el prompt del paso siguiente. Antes esto se chequeaba con
    // not.toContain('nombre'), que dejó de significar nada el día que el CORE
    // sumó "nombres de funciones": pasaba a fallar sin que el prompt del paso
    // tuviera un solo problema. El discriminador real es el bloque de
    // herramientas, que existe únicamente en el prompt de 'tu-negocio'.
    expect(prompt).not.toContain('## Herramientas que tenés');
    expect(prompt).not.toContain('suggestBusinessName');
  });

  it('uses step-specific prompt for tu-negocio', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: {
        surface: OrbiSurface.WIZARD,
        stepName: 'tu-negocio',
        rubro: 'tienda',
      },
    } as any);

    expect(prompt).toContain('nombre, descripción, teléfono');
    expect(prompt).toContain('suggestBusinessName');
    expect(prompt).toContain('"tienda"');
  });

  it('le cuenta a Orbi qué campos ya están completos y cuáles no', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: {
        surface: OrbiSurface.WIZARD,
        stepName: 'tu-negocio',
        rubro: 'tienda',
        formState: { nombre: 'Rama', descripcion: '', telefonoCargado: true },
      },
    } as any);

    expect(prompt).toContain('NO se lo vuelvas a pedir');
    expect(prompt).toContain('Nombre: "Rama"');
    expect(prompt).toContain('Descripción: todavía vacío');
    expect(prompt).toContain('Teléfono: ya cargado');
  });

  it('sin formState el prompt no inventa un bloque de campos completos', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD, stepName: 'subrubros', rubro: 'tienda' },
    } as any);

    expect(prompt).not.toContain('NO se lo vuelvas a pedir');
  });

  // El paso 'cuenta' pide email y contraseña. Aunque el front nunca los mande,
  // el prompt de ese paso no recibe formState — que quede fijado por un test.
  // Este test antes exigía que a 'cuenta' no llegara NADA del formulario. Se
  // relajó cuando ese paso pasó a mostrar un resumen de lo elegido antes, que
  // es una decisión de producto razonable: el nombre del negocio y el rubro no
  // son secretos, la persona los acaba de escribir.
  //
  // La garantía que sí importa es más angosta y es la que se chequea ahora: al
  // modelo no le llegan credenciales. No dependen de la buena voluntad de este
  // prompt — WizardFormState directamente no tiene campos donde meterlas (ver
  // OrbiWizardFormStateDto, que es una lista cerrada), así que el email y la
  // contraseña no tienen por dónde entrar aunque el front los mandara.
  it('al paso "cuenta" no le llegan credenciales, aunque el cliente las mande', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: {
        surface: OrbiSurface.WIZARD,
        stepName: 'cuenta',
        formState: {
          nombre: 'Rama',
          // Campos que NO existen en el DTO: se descartan en la validación.
          email: 'alan@ejemplo.com',
          password: 'hunter2',
        },
      },
    } as any);

    expect(prompt).not.toContain('alan@ejemplo.com');
    expect(prompt).not.toContain('hunter2');
  });

  it('WizardFormState no tiene ningún campo donde puedan viajar credenciales', () => {
    const prohibidos = ['email', 'mail', 'password', 'contrasena', 'contraseña', 'clave', 'token'];
    const permitidos = Object.getOwnPropertyNames(new OrbiWizardFormStateDto());

    // La lista cerrada del DTO es la defensa real. Si alguien agrega un campo
    // con nombre de credencial, esto tiene que romper antes de que llegue a
    // producción.
    for (const campo of [...permitidos, 'nombre', 'descripcion', 'subdominio', 'modoVenta']) {
      expect({ campo, esCredencial: prohibidos.includes(campo.toLowerCase()) })
        .toEqual({ campo, esCredencial: false });
    }
  });

  // Guarda contra la única forma en que este archivo se pudre en silencio: el
  // alta cambia de pasos y los prompts se quedan atrás. Pasó con 'pagos' y
  // 'equipo', que siguieron teniendo prompt propio meses después de que el
  // wizard dejara de preguntar esas dos cosas (commit 1088f0a), y al revés es
  // peor: un paso nuevo sin prompt cae al fallback genérico sin romper nada.
  // La lista tiene que ser la misma que emite el front — 'elegir-rubro' desde
  // ElegirRubro.tsx y el resto desde STEP_NAMES en SetupUnificado.tsx.
  const PASOS_DEL_WIZARD = ['elegir-rubro', 'subrubros', 'tu-negocio', 'ubicacion', 'cuenta'];
  const TEXTO_DEL_FALLBACK = 'Ayudá al usuario con lo que necesite en este paso del wizard';

  it('cada paso real del wizard tiene prompt propio, ninguno cae al fallback', async () => {
    for (const stepName of PASOS_DEL_WIZARD) {
      const prompt = await service.buildSystemPrompt({
        message: 'hola',
        context: { surface: OrbiSurface.WIZARD, stepName },
      } as any);

      expect(prompt).not.toContain(TEXTO_DEL_FALLBACK);
    }
  });

  it('un paso desconocido sí cae al fallback', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD, stepName: 'pagos' },
    } as any);

    expect(prompt).toContain(TEXTO_DEL_FALLBACK);
  });

  it('uses module-specific prompt for panel catalogo', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'catalogo', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Catálogo');
    expect(prompt).toContain('listProducts');
    expect(prompt).toContain('createProduct');
  });

  it('uses module-specific prompt for panel pedidos', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'pedidos', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Pedidos');
    expect(prompt).toContain('PENDING');
    expect(prompt).toContain('updateOrderStatus');
  });

  it('adds zona-prohibida warning for panel surface', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Zona prohibida');
    expect(prompt).toContain('eliminar negocio');
  });

  it('includes business name and industry when businessId is provided', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('"Rama"');
    expect(prompt).toContain('"Indumentaria"');
    expect(prompt).toContain('venta online');
  });

  it('separates layers with dividers', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD, stepName: 'ubicacion' },
    } as any);

    expect(prompt).toContain('---');
    const parts = prompt.split('---');
    expect(parts.length).toBe(2);
  });

  it('passes moduleData to panel prompt when available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      salesThisMonth: { total: 50000, count: 10, avgTicket: 5000 },
      salesLastMonth: { total: 40000, count: 8 },
      pendingOrders: 3,
      cancelledThisMonth: 1,
      totalProducts: 20,
      outOfStockProducts: 2,
      totalCustomers: 30,
      newCustomersThisMonth: 5,
      unreadMessages: 4,
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(mockModuleData.getSnapshot).toHaveBeenCalledWith('biz-1', 'dashboard');
  });

  it('does not call moduleData for wizard surface', async () => {
    await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD, stepName: 'elegir-rubro' },
    } as any);

    expect(mockModuleData.getSnapshot).not.toHaveBeenCalled();
  });

  // Mismo patrón que el test de cobertura del wizard: cada módulo real del
  // panel tiene que tener prompt propio. Si alguien agrega un módulo al
  // sidebar y no lo suma a panel.ts, este test rompe.
  const MODULOS_DEL_PANEL = ['dashboard', 'catalogo', 'pedidos', 'clientes', 'descuentos', 'configuracion', 'mensajes'];
  const TEXTO_DEL_FALLBACK_PANEL = 'El usuario está viendo el módulo';

  it('cada módulo real del panel tiene prompt propio, ninguno cae al fallback', async () => {
    for (const mod of MODULOS_DEL_PANEL) {
      const prompt = await service.buildSystemPrompt({
        message: 'hola',
        context: { surface: OrbiSurface.PANEL, module: mod, businessId: 'biz-1' },
      } as any);

      expect(prompt).not.toContain(TEXTO_DEL_FALLBACK_PANEL);
    }
  });

  it('un módulo desconocido del panel sí cae al fallback', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'inventario', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain(TEXTO_DEL_FALLBACK_PANEL);
  });

  it('dashboard prompt includes domain knowledge about metrics', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre métricas');
    expect(prompt).toContain('Ticket promedio');
    expect(prompt).toContain('Tasa de cancelación');
  });

  it('dashboard prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      salesThisMonth: { total: 150000, count: 25, avgTicket: 6000 },
      salesLastMonth: { total: 120000, count: 20 },
      pendingOrders: 5,
      cancelledThisMonth: 2,
      totalProducts: 40,
      outOfStockProducts: 3,
      totalCustomers: 80,
      newCustomersThisMonth: 12,
      unreadMessages: 7,
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('$150.000');
    expect(prompt).toContain('25 pedidos');
    expect(prompt).toContain('5 pedidos pendientes');
    expect(prompt).toContain('3 productos sin stock');
    expect(prompt).toContain('7 mensajes sin leer');
    expect(prompt).toContain('12 nuevos este mes');
  });

  it('dashboard prompt works without dynamic data (graceful degradation)', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'dashboard', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre métricas');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });

  it('pedidos prompt includes domain knowledge about order flow', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'pedidos', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre pedidos');
    expect(prompt).toContain('PENDING');
    expect(prompt).toContain('CANCELLED');
    expect(prompt).toContain('irreversible');
  });

  it('pedidos prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      countByStatus: { PENDING: 5, COMPLETED: 20, CANCELLED: 3 },
      oldestPendingHours: 36,
      avgTicketThisMonth: 8500,
      lastOrderDate: '2026-09-07',
      topPaymentMethod: 'MERCADOPAGO',
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'pedidos', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('PENDING: 5');
    expect(prompt).toContain('36h sin confirmar');
    expect(prompt).toContain('$8.500');
    expect(prompt).toContain('2026-09-07');
    expect(prompt).toContain('MercadoPago');
  });

  it('pedidos prompt works without dynamic data (graceful degradation)', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'pedidos', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre pedidos');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });

  it('clientes prompt includes domain knowledge about segmentation', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'clientes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre clientes');
    expect(prompt).toContain('VIP');
    expect(prompt).toContain('Recurrente');
    expect(prompt).toContain('Inactivo');
  });

  it('clientes prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      totalCustomers: 120,
      newThisMonth: 15,
      segmentation: { vip: 12, recurrent: 40, new: 30, inactive: 18 },
      topCustomerName: 'María González',
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'clientes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('120 clientes');
    expect(prompt).toContain('Nuevos este mes: 15');
    expect(prompt).toContain('12 VIP');
    expect(prompt).toContain('18 inactivos');
    expect(prompt).toContain('María González');
  });

  it('clientes prompt works without dynamic data (graceful degradation)', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'clientes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre clientes');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });

  it('catalogo prompt includes domain knowledge about products', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'catalogo', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre productos');
    expect(prompt).toContain('PUBLISHED');
    expect(prompt).toContain('DRAFT');
    expect(prompt).toContain('Precio psicológico');
  });

  it('catalogo prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      totalProducts: 30,
      publishedProducts: 20,
      draftProducts: 5,
      outOfStock: 3,
      totalCategories: 6,
      emptyCategories: 2,
      avgPrice: 8500,
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'catalogo', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('30 productos');
    expect(prompt).toContain('20 publicados');
    expect(prompt).toContain('3 productos sin stock');
    expect(prompt).toContain('2 categorías vacías');
    expect(prompt).toContain('$8.500');
  });

  it('catalogo prompt works without dynamic data (graceful degradation)', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'catalogo', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre productos');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });

  it('mensajes prompt includes domain knowledge about messaging', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'mensajes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre mensajería');
    expect(prompt).toContain('Tiempo de respuesta');
    expect(prompt).toContain('Plantillas de mensaje');
  });

  it('mensajes prompt interpolates dynamic data when snapshot is available', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({
      unreadCount: 5,
      totalConversations: 30,
      avgResponseTimeHours: null,
    });

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'mensajes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Conversaciones totales: 30');
    expect(prompt).toContain('Sin leer: 5');
    expect(prompt).toContain('5 conversaciones sin leer');
  });

  it('mensajes prompt works without dynamic data (graceful degradation)', async () => {
    mockModuleData.getSnapshot.mockResolvedValue({});

    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'mensajes', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('Lo que sabés sobre mensajería');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });
});
