import { ConversacionesPlataformaController } from './conversaciones.controller';

describe('ConversacionesPlataformaController', () => {
  it('abrir pasa el id de la ruta, el admin del token y el cuerpo al servicio', async () => {
    const lectura = { abrir: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const ctrl = new ConversacionesPlataformaController(lectura as never);
    const dto = { motivo: 'soporte' as const, detalle: 'Detalle suficiente' };
    const r = await ctrl.abrir({ user: { adminId: 'ad1' } as never }, 'c1', dto);
    expect(lectura.abrir).toHaveBeenCalledWith('c1', 'ad1', dto);
    expect(r).toEqual({ id: 'c1' });
  });
});
