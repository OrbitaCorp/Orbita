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
  it('el paso "cuenta" no filtra nada del formulario al prompt', async () => {
    const prompt = await service.buildSystemPrompt({
      message: 'hola',
      context: {
        surface: OrbiSurface.WIZARD,
        stepName: 'cuenta',
        formState: { nombre: 'Rama', subdominio: 'rama' },
      },
    } as any);

    expect(prompt).not.toContain('Rama');
    expect(prompt).not.toContain('NO se lo vuelvas a pedir');
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
});
