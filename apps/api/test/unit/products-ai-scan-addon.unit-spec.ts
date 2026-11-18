import 'reflect-metadata';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { ProductsController } from '../../src/products/products.controller';

// Decisión del 01/10: escanear una foto para cargar un producto es exclusivo
// del paquete Avanzado. Completar por NOMBRE (ai-assist, ai-variants) sigue
// abierto a todos los planes. Las sugerencias de imágenes de la web (alta e
// importación Excel) también exigen ADVANCED. Fija todo para que nada se mueva
// sin querer.
const addonDe = (metodo: keyof ProductsController) =>
  Reflect.getMetadata(REQUIRES_ADDON_KEY, ProductsController.prototype[metodo] as object);

describe('ProductsController — qué IA e imágenes de productos exige el Avanzado', () => {
  it('el escaneo por foto (ai-scan) exige ADVANCED', () => {
    expect(addonDe('aiScan')).toBe('ADVANCED');
  });

  it('las imágenes sugeridas de la web exigen ADVANCED', () => {
    expect(addonDe('suggestedImages')).toBe('ADVANCED');
    expect(addonDe('proxyImage')).toBe('ADVANCED');
    expect(addonDe('webImageSuggestions')).toBe('ADVANCED');
    expect(addonDe('addImageFromWeb')).toBe('ADVANCED');
  });

  it('completar por nombre (ai-assist y ai-variants) NO lo exige', () => {
    expect(addonDe('aiAssist')).toBeUndefined();
    expect(addonDe('aiVariants')).toBeUndefined();
  });
});
