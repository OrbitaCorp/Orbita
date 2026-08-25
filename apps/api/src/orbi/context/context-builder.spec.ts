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

  it('includes wizard-specific instructions for wizard surface', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.WIZARD },
    } as any);

    expect(prompt).toContain('wizard de onboarding');
    expect(prompt).toContain('Todavía no tiene cuenta');
    expect(prompt).not.toContain('zona peligrosa');
  });

  it('includes module name when provided for panel surface', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, module: 'productos', section: 'listado', businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('módulo "productos"');
    expect(prompt).toContain('sección "listado"');
  });

  it('adds zone-prohibida warning for panel surface', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: { surface: OrbiSurface.PANEL, businessId: 'biz-1' },
    } as any);

    expect(prompt).toContain('zona peligrosa');
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
});
