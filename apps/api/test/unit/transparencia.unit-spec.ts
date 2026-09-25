import sharp from 'sharp';
import { yaEsRecorteConAlfa } from '../../src/background-removal/transparencia';

// 24/09/2026: un PNG que ya era un recorte (iPhone, celular pegado a los
// bordes) se volvía a pasar por el modelo y salía perforado.
const rgba = (w: number, h: number, alfa: (x: number, y: number) => number) => {
  const d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    d[i] = 30; d[i + 1] = 30; d[i + 2] = 30; d[i + 3] = alfa(x, y);
  }
  return sharp(d, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
};

describe('yaEsRecorteConAlfa', () => {
  it('un recorte (objeto opaco sobre fondo transparente) se reconoce', async () => {
    expect(await yaEsRecorteConAlfa(await rgba(100, 100, (x, y) => (x > 20 && x < 80 && y > 20 && y < 80 ? 255 : 0)))).toBe(true);
  });

  it('un recorte muy ajustado (solo las esquinas transparentes) también', async () => {
    const esquina = (x: number, y: number) => (x < 12 || x > 87) && (y < 12 || y > 87);
    expect(await yaEsRecorteConAlfa(await rgba(100, 100, (x, y) => (esquina(x, y) ? 0 : 255)))).toBe(true);
  });

  it('una foto sin alfa no', async () => {
    const jpg = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    expect(await yaEsRecorteConAlfa(jpg)).toBe(false);
  });

  it('un PNG con alfa pero todo opaco no', async () => {
    expect(await yaEsRecorteConAlfa(await rgba(50, 50, () => 255))).toBe(false);
  });

  it('una marca de agua semitransparente (sin zonas transparentes de verdad) no', async () => {
    expect(await yaEsRecorteConAlfa(await rgba(50, 50, () => 128))).toBe(false);
  });
});
