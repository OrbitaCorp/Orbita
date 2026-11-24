// Las plantillas de Home que se pueden activar SIN el paquete Avanzado: tres de
// "cualquier rubro" y bien distintas entre sí (neutra clara, oscura y de color
// fuerte), para que el plan Base tenga una portada distinta a la clásica.
// Las de diseño propio de un rubro siguen siendo del Avanzado.
//
// Espejo de HOME_TEMPLATES_LIBRES en la API (dto/set-home-template.dto.ts), que
// es la que de verdad deja o no activarlas. libres.test.ts falla si se separan.
export const PLANTILLAS_LIBRES: readonly string[] = ['base', 'carbon', 'bloque']

export const esPlantillaLibre = (id: string) => PLANTILLAS_LIBRES.includes(id)
