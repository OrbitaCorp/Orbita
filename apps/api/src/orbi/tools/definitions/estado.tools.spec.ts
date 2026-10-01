import { OrbiSurface } from '../../dto/orbi-chat.dto';
import { CODIGOS_DEL_CATALOGO } from '../../../common/permisos/catalogo';
import { AccesoDelEquipoTool, EstadoPrimerosPasosTool, accesoPorModulo } from './estado.tools';
import type { ToolExecutionContext } from '../tool.interface';

const ctx = (permisos: string[] = CODIGOS_DEL_CATALOGO): ToolExecutionContext => ({
  businessId: 'biz-1',
  userId: 'mem-1',
  surface: OrbiSurface.PANEL,
  permissions: permisos,
});

describe('estadoPrimerosPasos', () => {
  function armar(o: { cumplidas?: string[]; suscripcion?: boolean; isActive?: boolean; isPaused?: boolean; emailVerified?: boolean } = {}) {
    const businesses = { getTutorial: jest.fn().mockResolvedValue({ tutorial: null, cumplidas: o.cumplidas ?? [] }) };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(o.suscripcion ? { id: 's' } : null) },
      business: { findUnique: jest.fn().mockResolvedValue({ isActive: o.isActive ?? false, isPaused: o.isPaused ?? false }) },
      member: { findFirst: jest.fn().mockResolvedValue({ emailVerified: o.emailVerified ?? false }) },
    };
    return { tool: new EstadoPrimerosPasosTool(businesses as never, prisma as never), businesses, prisma };
  }

  it('sin suscripción, el bloqueante real es la suscripción (lo demás recomienda)', async () => {
    const { tool } = armar({ cumplidas: ['negocio', 'categorias', 'producto'] });
    const r = await tool.execute({}, ctx());
    const data = r.data as { publicada: boolean; bloqueante?: string; pendientes: { titulo: string; etapa: number }[]; path?: string };
    expect(data.publicada).toBe(false);
    expect(data.bloqueante).toContain('suscripción');
    expect(data.path).toBe('/admin/ventas/configuracion?vista=suscripcion');
    expect(data.pendientes.map((p) => p.titulo)).toContain('Publicá la tienda');
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Creá tu primer producto');
    // Etapa 1 primero.
    expect(data.pendientes[0].etapa).toBe(1);
  });

  it('con suscripción y sin publicar no hay bloqueante: falta tocar el botón', async () => {
    const { tool } = armar({ suscripcion: true });
    const data = (await tool.execute({}, ctx())).data as { bloqueante?: string; pendientes: { titulo: string }[] };
    expect(data.bloqueante).toBeUndefined();
    expect(data.pendientes.map((p) => p.titulo)).toContain('Publicá la tienda');
  });

  it('una tienda pausada por mora lo dice', async () => {
    const { tool } = armar({ suscripcion: true, isActive: true, isPaused: true });
    const data = (await tool.execute({}, ctx())).data as { publicada: boolean; bloqueante?: string };
    expect(data.publicada).toBe(false);
    expect(data.bloqueante).toContain('pausada');
  });

  it('el email verificado es de quien pregunta, acotado a su negocio', async () => {
    const { tool, prisma } = armar({ emailVerified: true });
    const data = (await tool.execute({}, ctx())).data as { pendientes: { titulo: string }[] };
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Confirmá tu email');
    expect(prisma.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mem-1', businessId: 'biz-1' } }));
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' } }));
  });

  it('los pasos que no dejan rastro se informan aparte, no como pendientes', async () => {
    const { tool } = armar();
    const data = (await tool.execute({}, ctx())).data as { pendientes: { titulo: string }[]; noSePuedenVerificar: string[] };
    expect(data.noSePuedenVerificar).toEqual(expect.arrayContaining(['Mirá tus reportes', 'Conocé tu plan']));
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Mirá tus reportes');
  });

  it('si la base falla, no tumba el chat', async () => {
    const { tool, businesses } = armar();
    businesses.getTutorial.mockRejectedValue(new Error('db'));
    const r = await tool.execute({}, ctx());
    expect(r.success).toBe(false);
  });
});

describe('accesoDelEquipo', () => {
  function armar(miembros: unknown[]) {
    const prisma = { member: { findMany: jest.fn().mockResolvedValue(miembros) } };
    return { tool: new AccesoDelEquipoTool(prisma as never), prisma };
  }
  const miembro = (name: string, rol: string, codigos: string[], status = 'ACTIVE') => ({
    name,
    status,
    role: { name: rol, rolePermissions: codigos.map((code) => ({ permission: { code } })) },
  });

  it('sin persona, habla de quien pregunta con sus permisos efectivos', async () => {
    const { tool, prisma } = armar([]);
    const r = await tool.execute({}, ctx(['orders.view', 'config.team.view']));
    const data = r.data as { persona: string; ve: string[]; noVe: { modulo: string; leFalta: string[] }[] };
    expect(data.persona).toBe('vos');
    expect(data.ve).toEqual(expect.arrayContaining(['Pedidos', 'Configuración', 'Manual']));
    expect(data.noVe).toContainEqual({ modulo: 'Descuentos', leFalta: ['Ver descuentos', 'Gestionar descuentos'] });
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it('el rol REAL de la persona (editado) se refleja, y la búsqueda va acotada al negocio', async () => {
    const { tool, prisma } = armar([miembro('Carlos Empleado', 'empleado', ['orders.view', 'discounts.view'])]);
    const r = await tool.execute({ persona: 'Carlos' }, ctx());
    const data = r.data as { persona: string; rol: string; ve: string[]; path: string };
    expect(data).toMatchObject({ persona: 'Carlos Empleado', rol: 'Empleado', path: '/admin/ventas/configuracion?vista=equipo' });
    expect(data.ve).toContain('Descuentos');
    expect(r.label).toBe('Abrir Equipo');
    expect(prisma.member.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: 'biz-1' }) }));
  });

  it('el propietario ve todo aunque su rol no tenga filas de permisos', async () => {
    const { tool } = armar([miembro('Ana Dueña', 'owner', [])]);
    const data = (await tool.execute({ persona: 'Ana' }, ctx())).data as { rol: string; noVe: unknown[] };
    expect(data.rol).toBe('Propietario');
    expect(data.noVe).toEqual([]);
  });

  it('ambiguo: devuelve los nombres para que la persona elija, sin adivinar', async () => {
    const { tool } = armar([miembro('Carlos A', 'empleado', []), miembro('Carlos B', 'empleado', [])]);
    const data = (await tool.execute({ persona: 'Carlos' }, ctx())).data as { ambiguo: boolean; coincidencias: string[] };
    expect(data).toEqual({ ambiguo: true, coincidencias: ['Carlos A', 'Carlos B'] });
  });

  it('nadie con ese nombre, o un nombre demasiado corto', async () => {
    expect((await armar([]).tool.execute({ persona: 'Zoe' }, ctx())).success).toBe(false);
    expect((await armar([]).tool.execute({ persona: 'Z' }, ctx())).success).toBe(false);
  });

  it('una invitación sin aceptar se marca', async () => {
    const { tool } = armar([miembro('Pía', 'empleado', [], 'PENDING')]);
    const data = (await tool.execute({ persona: 'Pía' }, ctx())).data as { invitacionPendiente?: boolean };
    expect(data.invitacionPendiente).toBe(true);
  });

  it('accesoPorModulo usa el criterio del menú: alcanza con uno de los permisos', () => {
    expect(accesoPorModulo(['inventory.view'], false).ve).toContain('Productos');
    expect(accesoPorModulo([], false).ve).toEqual(['Manual']);
    expect(accesoPorModulo([], true).noVe).toEqual([]);
  });
});
