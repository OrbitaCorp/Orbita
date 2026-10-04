import { PLATFORM_ROLE_KEY } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { ConversacionesPlataformaController } from './conversaciones.controller';

describe('ConversacionesPlataformaController', () => {
  it('solo entra un admin de plataforma SUPERADMIN (la lectura de chats es sensible)', () => {
    expect(Reflect.getMetadata(PLATFORM_ROLE_KEY, ConversacionesPlataformaController)).toEqual(['SUPERADMIN']);
    expect(Reflect.getMetadata('__guards__', ConversacionesPlataformaController)).toContain(PlatformAdminGuard);
  });

  it('abrir pasa el id de la ruta, el admin del token y el cuerpo al servicio', async () => {
    const lectura = { abrir: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const ctrl = new ConversacionesPlataformaController(lectura as never);
    const dto = { motivo: 'soporte' as const, detalle: 'Detalle suficiente' };
    const r = await ctrl.abrir({ user: { adminId: 'ad1' } as never }, 'c1', dto);
    expect(lectura.abrir).toHaveBeenCalledWith('c1', 'ad1', dto);
    expect(r).toEqual({ id: 'c1' });
  });
});
