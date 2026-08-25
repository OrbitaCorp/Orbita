import { ToolRegistryService } from './tool-registry.service';
import { NavigationTool } from './definitions/navigation.tool';
import { OrbiSurface } from '../dto/orbi-chat.dto';
import type { OrbiTool } from './tool.interface';

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
