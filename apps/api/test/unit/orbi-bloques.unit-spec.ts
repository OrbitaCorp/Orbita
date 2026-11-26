import { partirEnBloques, pausaDeEscritura } from '../../src/orbi/atencion/bloques';

describe('mensajes en bloques (Orbi y el bot de ventas)', () => {
  it('parte por las líneas en blanco y deja junto lo que va con un salto simple', () => {
    expect(partirEnBloques('Hola!\n\nTenemos talle M.\nY también L.\n\n¿Te paso el link?')).toEqual(['Hola!', 'Tenemos talle M.\nY también L.', '¿Te paso el link?']);
    expect(partirEnBloques('Una sola parte')).toEqual(['Una sola parte']);
    expect(partirEnBloques('  \n\n  ')).toEqual([]);
  });

  it('nunca manda más de tres: lo que sobra va en el último', () => {
    expect(partirEnBloques('a\n\nb\n\nc\n\nd')).toEqual(['a', 'b', 'c\nd']);
  });

  it('la pausa crece con el largo, con tope, y se puede fijar (0 en los tests)', () => {
    const sin = { get: () => undefined };
    expect(pausaDeEscritura('corto', sin)).toBeLessThan(pausaDeEscritura('un mensaje bastante más largo que el otro', sin));
    expect(pausaDeEscritura('x'.repeat(5000), sin)).toBe(2200);
    expect(pausaDeEscritura('hola', { get: () => '0' })).toBe(0);
  });
});
