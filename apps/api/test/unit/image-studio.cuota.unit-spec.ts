import { ForbiddenException } from '@nestjs/common';
import { ImageStudioController, IMAGE_STUDIO_DIA_NEGOCIO } from '../../src/image-studio/image-studio.controller';

// El tope diario del estudio de imágenes ahora vive en CuotaService (Postgres):
// acá, que el controller lo consulte con su clave y corte igual que antes.

describe('ImageStudioController: cuota diaria por negocio', () => {
  const negocio = { type: 'member', businessId: 'b-a' } as any;
  const archivo = {} as Express.Multer.File;

  function controlador(hayCupo: boolean) {
    const estudio = { generateBackground: jest.fn().mockResolvedValue({}), generateModelWearing: jest.fn().mockResolvedValue({}) };
    const cuota = { consumir: jest.fn().mockResolvedValue(hayCupo) };
    return { c: new ImageStudioController(estudio as any, {} as any, cuota as any), estudio, cuota };
  }

  it('con cupo, consulta la clave image-studio:<negocio> y genera', async () => {
    const { c, estudio, cuota } = controlador(true);
    await c.generateBackground(negocio, { estilo: 'x' } as any, archivo);
    await c.generateModel(negocio, {} as any, archivo);
    expect(cuota.consumir).toHaveBeenCalledTimes(2);
    for (const llamada of cuota.consumir.mock.calls) expect(llamada).toEqual(['image-studio:b-a', IMAGE_STUDIO_DIA_NEGOCIO]);
    expect(estudio.generateBackground).toHaveBeenCalledTimes(1);
    expect(estudio.generateModelWearing).toHaveBeenCalledTimes(1);
  });

  it('pasado el tope, 403 con el mensaje de siempre y sin llamar al generador', async () => {
    const { c, estudio } = controlador(false);
    const err = await c.generateBackground(negocio, { estilo: 'x' } as any, archivo).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toBe(`Límite diario de generación de imágenes alcanzado (${IMAGE_STUDIO_DIA_NEGOCIO}/día). Probá de nuevo mañana.`);
    await expect(c.generateModel(negocio, {} as any, archivo)).rejects.toBeInstanceOf(ForbiddenException);
    expect(estudio.generateBackground).not.toHaveBeenCalled();
    expect(estudio.generateModelWearing).not.toHaveBeenCalled();
  });
});
