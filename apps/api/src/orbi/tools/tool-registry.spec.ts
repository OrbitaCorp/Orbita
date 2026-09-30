import { ToolRegistryService } from './tool-registry.service';
import { NavigationTool } from './definitions/navigation.tool';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import type { OrbiTool } from './tool.interface';
import { AccionInvalida } from './acciones/validar-args';

describe('ToolRegistryService', () => {
  let registry: ToolRegistryService;

  beforeEach(() => {
    registry = new ToolRegistryService();
    registry.register(new NavigationTool());
  });

  it('filters tools by surface — navigation only in panel', () => {
    const panelTools = registry.getTools(OrbiSurface.PANEL, []);
    expect(panelTools.length).toBe(1);
    expect(panelTools[0].name).toBe('navigateTo');

    const wizardTools = registry.getTools(OrbiSurface.WIZARD, []);
    expect(wizardTools.length).toBe(0);
  });

  it('filters tools by permissions', () => {
    const protectedTool: OrbiTool = {
      name: 'deleteSomething',
      description: 'Test',
      parameters: {},
      surfaces: [OrbiSurface.PANEL],
      requiredPermissions: ['admin:write'],
      async execute() { return { success: true, label: 'done' }; },
      toLlmDefinition() { return { name: this.name, description: this.description, parameters: this.parameters }; },
    };
    registry.register(protectedTool);

    const withoutPerm = registry.getTools(OrbiSurface.PANEL, []);
    expect(withoutPerm.find(t => t.name === 'deleteSomething')).toBeUndefined();

    const withPerm = registry.getTools(OrbiSurface.PANEL, ['admin:write']);
    expect(withPerm.find(t => t.name === 'deleteSomething')).toBeDefined();
  });

  it('execute returns error for non-existent tool', async () => {
    const result = await registry.execute('noExiste', {}, {
      businessId: 'biz-1',
      userId: 'user-1',
      surface: OrbiSurface.PANEL,
      permissions: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no existe');
  });

  it('NavigationTool returns correct path', async () => {
    const result = await registry.execute('navigateTo', { module: 'productos', section: 'listado' }, {
      businessId: 'biz-1',
      userId: 'user-1',
      surface: OrbiSurface.PANEL,
      permissions: [],
    });

    expect(result.success).toBe(true);
    expect((result.data as any).path).toBe('/admin/ventas/productos/listado');
  });

  describe('proponer (escrituras seguras, spec §3.2)', () => {
    const ctx = { businessId: 'biz-1', userId: 'user-1', surface: OrbiSurface.PANEL, permissions: ['x.manage'] };

    function escritura(extra: Partial<OrbiTool> = {}): OrbiTool {
      return {
        name: 'escribirAlgo',
        description: 'Test',
        parameters: { type: 'object', properties: { nombre: { type: 'string' } } },
        surfaces: [OrbiSurface.PANEL],
        requiredPermissions: ['x.manage'],
        requiresConfirmation: true,
        describirAccion: jest.fn(async (args: Record<string, unknown>) => `Escribir ${String(args.nombre)}`),
        execute: jest.fn(async () => ({ success: true, label: 'hecho' })),
        toLlmDefinition() { return { name: this.name, description: this.description, parameters: this.parameters }; },
        ...extra,
      };
    }

    it('con todo en orden devuelve el resumen', async () => {
      registry.register(escritura());
      expect(await registry.proponer('escribirAlgo', { nombre: 'A' }, ctx)).toEqual({ resumen: 'Escribir A' });
    });

    it('en la demo (soloLectura) no se propone nada, aunque haya permiso', async () => {
      const tool = escritura();
      registry.register(tool);
      expect(await registry.proponer('escribirAlgo', { nombre: 'A' }, ctx, undefined, { soloLectura: true })).toBeNull();
      expect(tool.describirAccion).not.toHaveBeenCalled();
    });

    it('si los argumentos no pasan la validación devuelve { error } y no arma la tarjeta', async () => {
      const tool = escritura({ validarArgs: jest.fn(async () => ({ ok: false as const, error: 'nombre: muy largo' })) });
      registry.register(tool);
      expect(await registry.proponer('escribirAlgo', { nombre: 'A' }, ctx)).toEqual({ error: 'nombre: muy largo' });
      expect(tool.describirAccion).not.toHaveBeenCalled();
    });

    it('un parámetro que la tool no declara es un error', async () => {
      registry.register(escritura());
      expect(await registry.proponer('escribirAlgo', { nombre: 'A', businessId: 'otro' }, ctx))
        .toEqual({ error: expect.stringContaining('businessId') });
    });

    it('describirAccion puede cortar con AccionInvalida (ej. pedido inexistente) y eso vuelve como { error }', async () => {
      registry.register(escritura({ describirAccion: async () => { throw new AccionInvalida('Pedido no encontrado'); } }));
      expect(await registry.proponer('escribirAlgo', { nombre: 'A' }, ctx)).toEqual({ error: 'Pedido no encontrado' });
    });

    it('describirAccion recibe el ctx (para resolver datos acotados al negocio)', async () => {
      const tool = escritura();
      registry.register(tool);
      await registry.proponer('escribirAlgo', { nombre: 'A' }, ctx);
      expect(tool.describirAccion).toHaveBeenCalledWith({ nombre: 'A' }, ctx);
    });

    it('execute en soloLectura nunca corre una tool que escribe', async () => {
      const tool = escritura();
      registry.register(tool);
      const r = await registry.execute('escribirAlgo', { nombre: 'A' }, ctx, undefined, { soloLectura: true });
      expect(r.success).toBe(false);
      expect(tool.execute).not.toHaveBeenCalled();
    });
  });

  it('NavigationTool returns path without section', async () => {
    const result = await registry.execute('navigateTo', { module: 'dashboard' }, {
      businessId: 'biz-1',
      userId: 'user-1',
      surface: OrbiSurface.PANEL,
      permissions: [],
    });

    expect(result.success).toBe(true);
    expect((result.data as any).path).toBe('/admin/ventas/dashboard');
  });
});
