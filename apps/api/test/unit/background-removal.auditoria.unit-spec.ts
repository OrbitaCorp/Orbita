import { BadRequestException, HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { BackgroundRemovalService } from '../../src/background-removal/background-removal.service';

// Auditoría interna 2026-09-10, ítem `api.background-removal`.
//
// - No había tope por negocio: cada foto corre un modelo en la CPU de la API.
// - La imagen se decodificaba entera, sin tope de píxeles: un PNG de 10 MB
//   puede declarar cientos de megapíxeles y tirar la memoria de la instancia.
//
// El tope real es de 60 MP; para no fabricar una imagen de ese tamaño en el
// test (tarda y consume memoria), se lo baja a 100 píxeles: alcanza para ver
// que el servicio le pasa el tope a sharp y convierte el rechazo en un 400.
jest.mock('../../src/common/utils/subida-imagen', () => ({
  ...jest.requireActual('../../src/common/utils/subida-imagen'),
  ENTRADA_IMAGEN: { limitInputPixels: 100 },
}));

describe('Quitar el fondo', () => {
  it('tope por negocio: pasado el máximo de la ventana, 429 sin correr el modelo', async () => {
    const svc = new BackgroundRemovalService();
    const procesar = jest.spyOn(svc as any, 'procesar').mockResolvedValue(Buffer.from('ok'));
    for (let i = 0; i < 30; i++) await svc.removeBackground(Buffer.from('x'), 'biz-1');
    const err = await svc.removeBackground(Buffer.from('x'), 'biz-1').catch((e) => e);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(procesar).toHaveBeenCalledTimes(30);
    // Otro negocio no se ve afectado.
    await expect(svc.removeBackground(Buffer.from('x'), 'biz-2')).resolves.toEqual(Buffer.from('ok'));
  });

  it('no corre más de dos a la vez: el tercero espera a que termine uno', async () => {
    const svc = new BackgroundRemovalService();
    let enCurso = 0;
    let maximo = 0;
    jest.spyOn(svc as any, 'procesar').mockImplementation(async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 20));
      enCurso--;
      return Buffer.from('ok');
    });
    await Promise.all([1, 2, 3, 4, 5].map((i) => svc.removeBackground(Buffer.from('x'), `biz-${i}`)));
    expect(maximo).toBe(2);
  });

  it('una imagen que no se puede procesar da un 400 claro, no un 500', async () => {
    const svc = new BackgroundRemovalService();
    await expect(svc.removeBackground(Buffer.from('esto no es una imagen'), 'biz-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una imagen con más píxeles que el tope se rechaza con 400 (sharp corta antes de decodificarla)', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
    const svc = new BackgroundRemovalService();
    await expect(svc.removeBackground(png, 'biz-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
