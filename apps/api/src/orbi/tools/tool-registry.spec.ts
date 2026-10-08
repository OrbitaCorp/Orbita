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

  // Las tools son parte del prefijo que reusa la caché implícita de Gemini:
  // tienen que salir siempre en el mismo orden, y lo que ve todo el mundo
  // primero, para que un empleado o la demo compartan el comienzo con el dueño.
  it('orden fijo para la caché: sin permiso, lecturas con permiso, escrituras; cada grupo por nombre', () => {
    const tool = (name: string, requiredPermissions: string[], requiresConfirmation = false): OrbiTool => ({
      name, description: 'Test', parameters: {}, surfaces: [OrbiSurface.PANEL], requiredPermissions,
      ...(requiresConfirmation ? { requiresConfirmation: true } : {}),
      async execute() { return { success: true, label: 'ok' }; },
      toLlmDefinition() { return { name: this.name, description: this.description, parameters: this.parameters }; },
    });
    const todas = [
      tool('zCrear', ['x.manage'], true), tool('bListar', ['x.view']), tool('aCrear', ['x.manage'], true),
      tool('leerManual', []), tool('aListar', ['x.view']),
    ];
    const nombres = (orden: OrbiTool[], permisos: string[], soloLectura = false) => {
      const r = new ToolRegistryService();
      (r as unknown as { logger: { log: () => void } }).logger.log = () => undefined;
      r.register(new NavigationTool());
      for (const t of orden) r.register(t);
      return r.getTools(OrbiSurface.PANEL, permisos, undefined, { soloLectura }).map((t) => t.name);
    };

    const dueno = nombres(todas, ['x.view', 'x.manage']);
    expect(dueno).toEqual(['leerManual', 'navigateTo', 'aListar', 'bListar', 'aCrear', 'zCrear']);
    // El orden de registro no cambia nada.
    expect(nombres([...todas].reverse(), ['x.view', 'x.manage'])).toEqual(dueno);
    // La demo (sin escrituras) y quien solo lee ven un comienzo de la lista del dueño.
    const demo = nombres(todas, ['x.view', 'x.manage'], true);
    expect(dueno.slice(0, demo.length)).toEqual(demo);
    const lector = nombres(todas, ['x.view']);
    expect(dueno.slice(0, lector.length)).toEqual(lector);
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
    const result = await registry.execute('navigateTo', { seccion: 'configuracion', vista: 'envios' }, {
      businessId: 'biz-1',
      userId: 'user-1',
      surface: OrbiSurface.PANEL,
      permissions: [],
    });

    expect(result.success).toBe(true);
    expect((result.data as any).path).toBe('/admin/ventas/configuracion?vista=envios');
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

    it('requiereConfirmacion distingue escrituras de lecturas (y una tool que no existe no escribe)', () => {
      registry.register(escritura());
      expect(registry.requiereConfirmacion('escribirAlgo')).toBe(true);
      expect(registry.requiereConfirmacion('navigateTo')).toBe(false);
      expect(registry.requiereConfirmacion('noExiste')).toBe(false);
    });

    // La tarjeta se arma al proponer, con el estado de la base de ESE momento
    // (el pedido estaba pendiente, así que "se descuenta el stock"). Si al
    // confirmar ya no dice lo mismo, lo que la persona aprobó no es lo que va a
    // pasar.
    describe('sigueVigente (tarjeta desactualizada al confirmar)', () => {
      it('true si el resumen recalculado es el mismo', async () => {
        const tool = escritura();
        registry.register(tool);
        expect(await registry.sigueVigente('escribirAlgo', { nombre: 'A' }, ctx, 'Escribir A')).toBe(true);
        expect(tool.describirAccion).toHaveBeenCalledWith({ nombre: 'A' }, ctx);
      });

      it('false si cambió', async () => {
        registry.register(escritura());
        expect(await registry.sigueVigente('escribirAlgo', { nombre: 'A' }, ctx, 'Escribir B')).toBe(false);
      });

      it('false si el dato ya no existe (AccionInvalida)', async () => {
        registry.register(escritura({ describirAccion: async () => { throw new AccionInvalida('Pedido no encontrado'); } }));
        expect(await registry.sigueVigente('escribirAlgo', { nombre: 'A' }, ctx, 'Escribir A')).toBe(false);
      });

      it('un error inesperado se propaga (lo resuelve el confirm como interno)', async () => {
        registry.register(escritura({ describirAccion: async () => { throw new Error('la base no respondió'); } }));
        await expect(registry.sigueVigente('escribirAlgo', { nombre: 'A' }, ctx, 'Escribir A')).rejects.toThrow('la base no respondió');
      });

      it('sin describirAccion no hay nada que comparar', async () => {
        registry.register(escritura({ describirAccion: undefined }));
        expect(await registry.sigueVigente('escribirAlgo', { nombre: 'A' }, ctx, 'Ejecutar: escribirAlgo')).toBe(true);
      });
    });
  });

  it('NavigationTool returns path without section', async () => {
    const result = await registry.execute('navigateTo', { seccion: 'dashboard' }, {
      businessId: 'biz-1',
      userId: 'user-1',
      surface: OrbiSurface.PANEL,
      permissions: [],
    });

    expect(result.success).toBe(true);
    expect((result.data as any).path).toBe('/admin/ventas/dashboard');
  });
});
