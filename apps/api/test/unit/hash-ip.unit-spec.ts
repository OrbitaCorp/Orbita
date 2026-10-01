import { createHmac } from 'crypto';
import { hmacIp } from '../../src/common/utils/hash-ip';

// Extraído de DemoIaService.claveDe para que Orbi (cuota del wizard por IP) y
// la demo compartan el mismo HMAC. La IP nunca se guarda en claro.

const SECRETO = 'un-secreto-de-prueba-de-al-menos-32-caracteres';

// La fórmula VIEJA de DemoIaService.claveDe, copiada tal cual: si hmacIp
// deja de dar exactamente esto, las claves de demo_ai_usage cambian y todos
// los visitantes recuperan su cupo semanal de golpe.
const claveDeAntes = (ip: string | undefined) =>
  createHmac('sha256', SECRETO).update(`demo-ia:${ip ?? 'sin-ip'}`).digest('hex');

describe('hmacIp', () => {
  const previo = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = SECRETO;
  });
  afterAll(() => {
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  });

  it('es determinístico', () => {
    expect(hmacIp('demo-ia', '1.2.3.4')).toBe(hmacIp('demo-ia', '1.2.3.4'));
  });

  it('cambia según el contexto y según la IP', () => {
    expect(hmacIp('demo-ia', '1.2.3.4')).not.toBe(hmacIp('orbi-wizard', '1.2.3.4'));
    expect(hmacIp('demo-ia', '1.2.3.4')).not.toBe(hmacIp('demo-ia', '1.2.3.5'));
  });

  it('no contiene la IP en claro', () => {
    expect(hmacIp('demo-ia', '1.2.3.4')).not.toContain('1.2.3.4');
    expect(hmacIp('demo-ia', '1.2.3.4')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('con la IP indefinida no rompe y da un valor estable', () => {
    expect(hmacIp('demo-ia', undefined)).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacIp('demo-ia', undefined)).toBe(hmacIp('demo-ia', undefined));
  });

  it('para demo-ia da exactamente lo mismo que el claveDe de antes (las claves no cambian)', () => {
    for (const ip of ['1.2.3.4', '203.0.113.7', '::1', '2001:db8::ff00:42:8329', undefined]) {
      expect(hmacIp('demo-ia', ip)).toBe(claveDeAntes(ip));
    }
  });

  it('acepta el secreto explícito (DemoIaService usa el de su ConfigService)', () => {
    expect(hmacIp('demo-ia', '1.2.3.4', 'otro-secreto')).toBe(
      createHmac('sha256', 'otro-secreto').update('demo-ia:1.2.3.4').digest('hex'),
    );
  });

  it('sin JWT_SECRET falla fuerte: un HMAC con clave vacía sería predecible', () => {
    const guardado = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => hmacIp('demo-ia', '1.2.3.4')).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = guardado;
    }
  });
});
