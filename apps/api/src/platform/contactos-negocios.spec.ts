import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SELECT_CONTACTO_DE_NEGOCIO, aContactoDeNegocio, filtroContactos, type FilaContactoDeNegocio } from './contactos-negocios';

// El rol MARKETING (Milagros) ve de los negocios solo el contacto y la dirección de la tienda. Estas pruebas cuidan
// las dos mitades del corte: qué endpoints le abre el guard y qué datos salen de la lectura.

const guard = new PlatformAdminGuard(new Reflector());
const contexto = (rol: string, handler: keyof PlatformController) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: { type: 'platform_admin', adminId: 'a1', adminRole: rol } }) }),
    getHandler: () => PlatformController.prototype[handler],
    getClass: () => PlatformController,
  }) as unknown as ExecutionContext;

const fila = (extra: Partial<FilaContactoDeNegocio> = {}): FilaContactoDeNegocio => ({
  id: 'b1',
  name: 'Rama Indumentaria',
  industry: 'Indumentaria',
  subdomain: 'rama',
  members: [{ name: 'Lorena', email: 'lorena@rama.com' }],
  businessConfig: { email: 'hola@rama.com', whatsapp: '5493757000000', instagram: '@rama', tiktok: null, facebook: '  ' },
  customDomains: [{ domain: 'rama.com.ar' }],
  ...extra,
});

describe('Contactos de negocios (rol MARKETING)', () => {
  describe('guard', () => {
    it('MARKETING entra a la lista de contactos', () => {
      expect(guard.canActivate(contexto('MARKETING', 'listBusinessContacts'))).toBe(true);
    });

    it.each(['SUPERADMIN', 'OPERATOR'])('%s también entra', (rol) => {
      expect(guard.canActivate(contexto(rol, 'listBusinessContacts'))).toBe(true);
    });

    it.each([
      'listBusinesses',
      'getBusiness',
      'businessSeries',
      'businessProducts',
      'businessReviews',
      'listDomains',
      'listOwners',
      'listSubscriptions',
      'revenueSeries',
    ] as const)('a MARKETING le sigue cerrado %s', (handler) => {
      expect(PlatformController.prototype[handler]).toBeDefined();
      expect(() => guard.canActivate(contexto('MARKETING', handler))).toThrow(ForbiddenException);
    });
  });

  describe('lectura', () => {
    it('lee de la base solo contacto y dirección de la tienda', () => {
      expect(Object.keys(SELECT_CONTACTO_DE_NEGOCIO).sort()).toEqual(
        ['businessConfig', 'customDomains', 'id', 'industry', 'members', 'name', 'subdomain'].sort(),
      );
      expect(Object.keys(SELECT_CONTACTO_DE_NEGOCIO.businessConfig.select).sort()).toEqual(
        ['email', 'facebook', 'instagram', 'tiktok', 'whatsapp'],
      );
      expect(Object.keys(SELECT_CONTACTO_DE_NEGOCIO.members.select).sort()).toEqual(['email', 'name']);
      expect(SELECT_CONTACTO_DE_NEGOCIO.members.where).toEqual({ role: { name: 'owner' } });
      expect(SELECT_CONTACTO_DE_NEGOCIO.customDomains.where).toEqual({ status: 'ACTIVE' });
    });

    it('el servicio usa ese select (sin include) y devuelve solo esos campos', async () => {
      const findMany = jest.fn().mockResolvedValue([fila()]);
      const count = jest.fn().mockResolvedValue(1);
      const prisma = {
        business: { findMany, count },
        $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
      };
      const service = new PlatformService(prisma as never, {} as never, {} as never, {} as never);

      const r = await service.listBusinessContacts({ search: 'rama' });

      const args = findMany.mock.calls[0][0];
      expect(args.select).toBe(SELECT_CONTACTO_DE_NEGOCIO);
      expect(args.include).toBeUndefined();
      expect(args.where).toEqual(filtroContactos('rama'));
      expect(r).toEqual({
        data: [
          {
            id: 'b1',
            name: 'Rama Indumentaria',
            industry: 'Indumentaria',
            owner: { name: 'Lorena', email: 'lorena@rama.com' },
            contact: { email: 'hola@rama.com', whatsapp: '5493757000000', instagram: '@rama', tiktok: null, facebook: null },
            store: { subdomain: 'rama', customDomains: ['rama.com.ar'] },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      });
    });
  });

  describe('aContactoDeNegocio', () => {
    it('no deja pasar campos que no nombra, aunque vengan en la fila', () => {
      const conDeMas = { ...fila(), subscription: { amount: 9999 }, _count: { orders: 3 } } as unknown as FilaContactoDeNegocio;
      const r = aContactoDeNegocio(conDeMas) as unknown as Record<string, unknown>;
      expect(Object.keys(r).sort()).toEqual(['contact', 'id', 'industry', 'name', 'owner', 'store']);
    });

    it('sin dueño/a ni configuración quedan en null', () => {
      const r = aContactoDeNegocio(fila({ members: [], businessConfig: null, customDomains: [] }));
      expect(r.owner).toBeNull();
      expect(r.contact).toEqual({ email: null, whatsapp: null, instagram: null, tiktok: null, facebook: null });
      expect(r.store).toEqual({ subdomain: 'rama', customDomains: [] });
    });
  });

  describe('filtroContactos', () => {
    it('deja afuera los negocios borrados', () => {
      expect(filtroContactos()).toEqual({ deletedAt: null });
      expect(filtroContactos('  ')).toEqual({ deletedAt: null });
    });

    it('busca por nombre, subdominio, rubro, dominio propio y dueño/a', () => {
      const w = filtroContactos(' rama ');
      expect(w.deletedAt).toBeNull();
      expect(w.OR).toHaveLength(5);
      expect(JSON.stringify(w.OR)).toContain('"contains":"rama"');
    });
  });
});
