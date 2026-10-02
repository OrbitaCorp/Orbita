import { readFileSync } from 'fs';
import { join } from 'path';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import { MANUAL } from '../../manual/manual';
import { CODIGOS_DEL_CATALOGO } from '../../../common/permisos/catalogo';
import { AccesoDelEquipoTool, EstadoPrimerosPasosTool, PASOS_SIN_RASTRO, accesoPorModulo } from './estado.tools';
import type { ToolExecutionContext } from '../tool.interface';

const ctx = (permisos: string[] = CODIGOS_DEL_CATALOGO, roleName = 'owner'): ToolExecutionContext => ({
  businessId: 'biz-1',
  userId: 'mem-1',
  surface: OrbiSurface.PANEL,
  permissions: permisos,
  roleName,
});

type Datos = {
  publicada: boolean;
  bloqueante?: string;
  pendientes: { titulo: string; etapa: number; irA: { label: string; path: string } }[];
  cumplidos: number;
  total: number;
  noSePuedenVerificar?: string[];
  path?: string;
};

describe('estadoPrimerosPasos', () => {
  function armar(
    o: {
      cumplidas?: string[];
      hechas?: string[];
      suscripcion?: boolean;
      isActive?: boolean;
      isPaused?: boolean;
      emailVerified?: boolean;
      suspension?: 'PLATAFORMA' | 'MORA' | null;
      cancelledAt?: Date;
    } = {},
  ) {
    const businesses = {
      getTutorial: jest.fn().mockResolvedValue({ tutorial: o.hechas ? { hechas: o.hechas } : null, cumplidas: o.cumplidas ?? [] }),
      suspensionVigente: jest.fn().mockResolvedValue(o.suspension ?? null),
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(o.suscripcion ? { id: 's' } : null) },
      business: { findUnique: jest.fn().mockResolvedValue({ isActive: o.isActive ?? false, isPaused: o.isPaused ?? false, cancelledAt: o.cancelledAt ?? null }) },
      member: { findFirst: jest.fn().mockResolvedValue({ emailVerified: o.emailVerified ?? false }) },
    };
    return { tool: new EstadoPrimerosPasosTool(businesses as never, prisma as never), businesses, prisma };
  }
  const datos = async (tool: EstadoPrimerosPasosTool, c = ctx()) => (await tool.execute({}, c)).data as Datos;

  it('sin suscripción, el bloqueante real es la suscripción (lo demás recomienda)', async () => {
    const { tool } = armar({ cumplidas: ['negocio', 'categorias', 'producto'] });
    const data = await datos(tool);
    expect(data.publicada).toBe(false);
    expect(data.bloqueante).toContain('suscripción');
    expect(data.path).toBe('/admin/ventas/configuracion?vista=suscripcion');
    expect(data.pendientes.map((p) => p.titulo)).toContain('Publicá la tienda');
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Creá tu primer producto');
    // Etapa 1 primero.
    expect(data.pendientes[0].etapa).toBe(1);
  });

  it('con suscripción y sin publicar no hay bloqueante: falta tocar el botón', async () => {
    const { tool, businesses } = armar({ suscripcion: true });
    const data = await datos(tool);
    expect(data.bloqueante).toBeUndefined();
    expect(data.pendientes.map((p) => p.titulo)).toContain('Publicá la tienda');
    // Sin pausa no se pregunta la causa.
    expect(businesses.suspensionVigente).not.toHaveBeenCalled();
  });

  // isPaused lo usan tres causas: cada una se resuelve en otro lado.
  it.each([
    ['MORA', 'pago pendiente', '/admin/ventas/configuracion?vista=suscripcion'],
    ['PLATAFORMA', 'Soporte', '/admin/ventas/configuracion?vista=soporte'],
    [null, 'pausada desde el panel', '/admin/ventas/configuracion?vista=peligro'],
  ] as const)('pausada con causa %s: lo dice y manda a donde se resuelve', async (suspension, texto, path) => {
    const { tool, businesses } = armar({ suscripcion: true, isActive: true, isPaused: true, suspension });
    const data = await datos(tool);
    expect(data.publicada).toBe(false);
    expect(data.bloqueante).toContain(texto);
    expect(data.path).toBe(path);
    expect(businesses.suspensionVigente).toHaveBeenCalledWith('biz-1');
  });

  it('un espacio dado de baja no se confunde con mora (la baja deja la suscripción en CANCELLED)', async () => {
    const { tool } = armar({ suscripcion: true, isActive: true, isPaused: true, suspension: 'MORA', cancelledAt: new Date() });
    const data = await datos(tool);
    expect(data.bloqueante).toContain('dado de baja');
    expect(data.bloqueante).not.toContain('pago');
    expect(data.path).toBe('/admin/ventas/configuracion?vista=peligro');
  });

  it('al admin, lo que solo hace el propietario se le dice sin botón (el endpoint es solo owner)', async () => {
    for (const o of [{ suspension: null }, { suspension: 'MORA' as const, cancelledAt: new Date() }]) {
      const { tool } = armar({ suscripcion: true, isActive: true, isPaused: true, ...o });
      const data = await datos(tool, ctx(CODIGOS_DEL_CATALOGO, 'admin'));
      expect(data.bloqueante).toContain('propietario');
      expect(data.path ?? '').not.toContain('peligro');
    }
  });

  it('a quien no es propietario no se le cuenta el detalle de la cuenta', async () => {
    const { tool } = armar({ isActive: true, isPaused: true, suspension: 'MORA' });
    const data = await datos(tool, ctx(['reports.dashboard'], 'empleado'));
    expect(data.bloqueante).toBe('Hay algo de la cuenta de la tienda que tiene que resolver el propietario.');
    expect(data.bloqueante).not.toContain('pago');
    // Sin botón a Suscripción: no la puede abrir.
    expect(data.path).not.toContain('suscripcion');
  });

  it('el admin de los negocios viejos ve el detalle, como por HTTP', async () => {
    const { tool } = armar({ isActive: true, isPaused: true, suspension: 'MORA' });
    expect((await datos(tool, ctx(CODIGOS_DEL_CATALOGO, 'admin'))).bloqueante).toContain('pago pendiente');
  });

  it('el email verificado es de quien pregunta, acotado a su negocio', async () => {
    const { tool, prisma } = armar({ emailVerified: true });
    const data = await datos(tool);
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Confirmá tu email');
    expect(prisma.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mem-1', businessId: 'biz-1' } }));
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-1' } }));
  });

  it('los pasos que no dejan rastro se informan aparte, no como pendientes', async () => {
    const { tool } = armar();
    const data = await datos(tool);
    expect(data.noSePuedenVerificar).toEqual(expect.arrayContaining(['Mirá tus reportes', 'Conocé tu plan']));
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Mirá tus reportes');
  });

  it('lo que la persona tildó a mano cuenta como hecho (y deja de ser "no verificable")', async () => {
    const { tool } = armar({ hechas: ['reportes', 'plan', 'herramientas', 'contacto'] });
    const data = await datos(tool);
    expect(data.noSePuedenVerificar).toBeUndefined();
    expect(data.pendientes.map((p) => p.titulo)).not.toContain('Cargá tus datos de contacto');
    expect(data.cumplidos).toBe(4);
  });

  it('el botón va al primer paso que hace falta para vender, no a Mercado Pago ni al email', async () => {
    // Faltan email, MP y lo demás; sin suscripción no, para que no haya bloqueante.
    const { tool } = armar({ suscripcion: true, cumplidas: ['negocio'] });
    const data = await datos(tool);
    expect(data.pendientes.map((p) => p.titulo)).toEqual(expect.arrayContaining(['Confirmá tu email', 'Conectá Mercado Pago (opcional)']));
    expect(data.path).toBe(data.pendientes.find((p) => p.titulo === 'Creá tus primeras categorías')!.irA.path);
  });

  it('cuenta cumplidos sobre el total del checklist', async () => {
    const { tool } = armar({ cumplidas: ['negocio', 'categorias'], emailVerified: true });
    const data = await datos(tool);
    expect(data.cumplidos).toBe(3);
    expect(data.total).toBe(data.cumplidos + data.pendientes.length + (data.noSePuedenVerificar?.length ?? 0));
  });

  it('todo paso del checklist se puede cumplir: lo detecta la base, el email o la persona lo tilda', () => {
    // Un paso nuevo en el manual que getTutorial no detecta quedaría pendiente
    // para siempre y Orbi lo repetiría a cada rato.
    const servicio = readFileSync(join(__dirname, '../../../businesses/businesses.service.ts'), 'utf8');
    const detectados = new Set([...servicio.matchAll(/cumplidas\.push\('([a-z-]+)'\)/g)].map((m) => m[1]));
    expect(detectados.size).toBeGreaterThan(10);
    const sinCamino = MANUAL.primerosPasos
      .map((p) => p.id)
      .filter((id) => !detectados.has(id) && !PASOS_SIN_RASTRO.has(id) && id !== 'verificar-email');
    expect(sinCamino).toEqual([]);
  });

  it('si la base falla, no tumba el chat', async () => {
    const { tool, businesses } = armar();
    businesses.getTutorial.mockRejectedValue(new Error('db'));
    const r = await tool.execute({}, ctx());
    expect(r.success).toBe(false);
  });
});

describe('accesoDelEquipo', () => {
  type Miembro = { name: string; email: string };
  type Cond = { equals?: string; contains?: string };
  /** Filtra como Postgres (equals/contains sin mayúsculas, orden por nombre, take). */
  function armar(miembros: Miembro[]) {
    const cumple = (valor: string, c: Cond) =>
      c.equals !== undefined ? valor.toLowerCase() === c.equals.toLowerCase() : valor.toLowerCase().includes(c.contains!.toLowerCase());
    const findMany = jest.fn(async (a: { where: { OR: [{ name: Cond }, { email: Cond }] }; take: number }) =>
      miembros
        .filter((m) => cumple(m.name, a.where.OR[0].name) || cumple(m.email, a.where.OR[1].email))
        .sort((x, y) => x.name.localeCompare(y.name))
        .slice(0, a.take),
    );
    const prisma = { member: { findMany } };
    return { tool: new AccesoDelEquipoTool(prisma as never), prisma };
  }
  const miembro = (name: string, rol: string, codigos: string[], status = 'ACTIVE', email = `${name.split(' ')[0].toLowerCase()}@x.com`) => ({
    name,
    email,
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
    expect(data).toEqual({ ambiguo: true, coincidencias: ['Carlos A (Empleado)', 'Carlos B (Empleado)'] });
  });

  it('una coincidencia exacta gana sobre las parciales ("Ana" no es "Juliana")', async () => {
    const { tool } = armar([miembro('Juliana Pérez', 'empleado', []), miembro('Ana', 'empleado', ['orders.view'])]);
    const data = (await tool.execute({ persona: 'ana' }, ctx())).data as { persona: string; ve: string[] };
    expect(data.persona).toBe('Ana');
    expect(data.ve).toContain('Pedidos');
  });

  it('la coincidencia exacta no se pierde detrás de muchas parciales', async () => {
    const parciales = ['Adriana', 'Daiana', 'Juliana', 'Luciana', 'Mariana', 'Susana', 'Tatiana'].map((n) => miembro(n, 'empleado', []));
    const { tool } = armar([...parciales, miembro('Ana', 'empleado', ['orders.view'])]);
    const data = (await tool.execute({ persona: 'Ana' }, ctx())).data as { persona: string };
    expect(data.persona).toBe('Ana');
  });

  it('dos con el mismo nombre: ambiguo, con el rol para distinguirlos', async () => {
    const { tool } = armar([miembro('Ana', 'empleado', [], 'ACTIVE', 'ana1@x.com'), miembro('Ana', 'owner', [], 'ACTIVE', 'ana2@x.com')]);
    const data = (await tool.execute({ persona: 'ana' }, ctx())).data as { ambiguo: boolean; coincidencias: string[] };
    expect(data.ambiguo).toBe(true);
    expect(data.coincidencias).toEqual(expect.arrayContaining(['Ana (Empleado)', 'Ana (Propietario)']));
  });

  it('también por email exacto', async () => {
    const { tool } = armar([miembro('Carlos A', 'empleado', [], 'ACTIVE', 'carlos@x.com'), miembro('Carlos B', 'empleado', [], 'ACTIVE', 'cb@x.com')]);
    const data = (await tool.execute({ persona: 'CARLOS@x.com' }, ctx())).data as { persona: string };
    expect(data.persona).toBe('Carlos A');
  });

  it('el email se usa para buscar pero no se devuelve', async () => {
    const { tool } = armar([miembro('Carlos Empleado', 'empleado', [])]);
    const r = await tool.execute({ persona: 'Carlos' }, ctx());
    expect(JSON.stringify(r.data)).not.toContain('@');
  });

  it('el admin de los negocios viejos se muestra como Propietario, como en Equipo', async () => {
    const { tool } = armar([miembro('Beto', 'admin', ['orders.view'])]);
    expect(((await tool.execute({ persona: 'Beto' }, ctx())).data as { rol: string }).rol).toBe('Propietario');
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
