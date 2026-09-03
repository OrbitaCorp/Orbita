import { redact } from '../../src/wizard-analytics/redact';

describe('redact', () => {
  it('tapa emails', () => {
    expect(redact('escribime a juan.perez+ofertas@gmail.com dale')).toBe('escribime a [email] dale');
  });

  it('tapa teléfonos en los formatos que usa la gente acá', () => {
    expect(redact('mi cel es 11 2345-6789')).toBe('mi cel es [tel]');
    expect(redact('llamame al +54 9 351 234 5678')).toBe('llamame al [tel]');
    expect(redact('tel: 3512345678')).toBe('tel: [tel]');
  });

  it('tapa URLs', () => {
    expect(redact('mirá https://instagram.com/mitienda ahí están')).toBe('mirá [url] ahí están');
    expect(redact('es mitienda.com.ar')).toBe('es [url]');
  });

  it('tapa números largos sueltos (DNI, CUIT, tarjetas)', () => {
    expect(redact('mi cuit es 20-12345678-9')).toBe('mi cuit es [num]');
  });

  it('NO toca números cortos, que son los que dan contexto útil', () => {
    expect(redact('vendo 20 productos y cobro 1500 pesos')).toBe('vendo 20 productos y cobro 1500 pesos');
  });

  it('deja intacta una pregunta normal', () => {
    const q = '¿qué pongo en subdominio? no entiendo qué es';
    expect(redact(q)).toBe(q);
  });

  it('corta textos gigantes para que una respuesta larga no infle la tabla', () => {
    const largo = 'a'.repeat(5000);
    const out = redact(largo);
    expect(out.length).toBeLessThanOrEqual(2001);
    expect(out.endsWith('…')).toBe(true);
  });

  it('tolera vacío y no explota', () => {
    expect(redact('')).toBe('');
    expect(redact(undefined as unknown as string)).toBe('');
  });
});
