import { ContextBuilderService } from './context-builder.service';
import { OrbiSurface } from '../dto/orbi-chat.dto';

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Rama', industry: 'Indumentaria', mode: 'FULL' }),
      },
    };
    service = new ContextBuilderService(mockPrisma);
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
    expect(prompt).not.toContain('nombre');
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
      context: { surface: OrbiSurface.WIZARD, stepName: 'pagos' },
    } as any);

    expect(prompt).toContain('---');
    const parts = prompt.split('---');
    expect(parts.length).toBe(2);
  });
});
