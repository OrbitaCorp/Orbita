import { RESPUESTA_FUERA_DE_ALCANCE, capaDeAlcance, esFueraDeAlcance } from './alcance';

describe('alcance del Orbi del panel', () => {
  it('la frase fija se reconoce tal cual, sola o con la línea de lo que sí puede hacer', () => {
    expect(esFueraDeAlcance(RESPUESTA_FUERA_DE_ALCANCE)).toBe(true);
    expect(esFueraDeAlcance(`${RESPUESTA_FUERA_DE_ALCANCE}\n\nSi querés, te ayudo a escribir la descripción de tus pizzas.`)).toBe(true);
  });

  it('sin importar mayúsculas, tildes, espacios, ni un "**" o una comilla adelante', () => {
    expect(esFueraDeAlcance('eso queda FUERA de mi alcance: estoy para ayudarte con tu negocio y con Orbita.')).toBe(true);
    expect(esFueraDeAlcance('  Eso  queda fuera\nde mi alcance.')).toBe(true);
    expect(esFueraDeAlcance('**Eso queda fuera de mi alcance:** estoy para ayudarte con tu negocio.')).toBe(true);
    expect(esFueraDeAlcance('"Eso queda fuera de mi alcance"')).toBe(true);
    // Alcanza la primera parte: el modelo a veces cambia la segunda.
    expect(esFueraDeAlcance('Eso queda fuera de mi alcance: estoy para darte una mano con tu tienda.')).toBe(true);
  });

  it('no marca respuestas de adentro, ni la frase en el medio del texto', () => {
    expect(esFueraDeAlcance('')).toBe(false);
    expect(esFueraDeAlcance('Este mes vendiste $391.500 en 23 pedidos.')).toBe(false);
    expect(esFueraDeAlcance('No puedo pausar descuentos desde acá: andá a Descuentos.')).toBe(false);
    expect(esFueraDeAlcance('Ojo: eso queda fuera de mi alcance, pero te explico cómo hacerlo desde el panel.')).toBe(false);
    expect(esFueraDeAlcance('Eso queda fuera del horario de atención.')).toBe(false);
  });

  it('el prompt nombra la frase exacta y la regla del borde', () => {
    const capa = capaDeAlcance();
    expect(capa).toContain(`"${RESPUESTA_FUERA_DE_ALCANCE}"`);
    expect(capa).toContain('ayudás a venderlos');
    expect(capa).toContain('no uses herramientas');
    // Compacta: es parte de cada mensaje del panel.
    expect(capa.length).toBeLessThan(2000);
  });

  it('la frase es solo para temas de afuera: lo del negocio que no puede hacer va sin la frase', () => {
    // Una corrida real contestó "Borrá el Kit Matero Regalo" con la frase de
    // afuera y después "no puedo eliminar productos".
    const capa = capaDeAlcance();
    expect(capa).toContain('La frase es solo para temas de afuera');
    expect(capa).toMatch(/no podés hacer desde el chat[^\n]*es de adentro/);
    expect(capa).toMatch(/dónde del panel se hace/);
    expect(capa).toContain('"Borrá la fugazzeta" → adentro');
  });
});
