import 'reflect-metadata';
import { REQUIRES_ADDON_KEY } from '../../src/common/decorators/requires-addon.decorator';
import { ProductsController } from '../../src/products/products.controller';

// Decisión del 01/10: escanear una foto para cargar un producto es exclusivo
// del paquete Avanzado. Completar por NOMBRE (ai-assist, ai-variants) sigue
// abierto a todos los planes. Fija las dos cosas para que ninguna se mueva sin querer.
const addonDe = (metodo: keyof ProductsController) =>
  Reflect.getMetadata(REQUIRES_ADDON_KEY, ProductsController.prototype[metodo] as object);

describe('ProductsController — qué IA de productos exige el Avanzado', () => {
  it('el escaneo por foto (ai-scan) exige ADVANCED', () => {
    expect(addonDe('aiScan')).toBe('ADVANCED');
  });

  it('completar por nombre (ai-assist y ai-variants) NO lo exige', () => {
    expect(addonDe('aiAssist')).toBeUndefined();
    expect(addonDe('aiVariants')).toBeUndefined();
  });
});
