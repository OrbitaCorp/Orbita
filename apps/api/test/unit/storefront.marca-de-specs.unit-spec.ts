import { marcaDeSpecs } from '../../src/storefront/storefront.service';

// El filtro "Marca" del catálogo sale de la característica "Marca" del producto
// (Product.specs), no de un campo aparte.
describe('marcaDeSpecs', () => {
  it('toma el valor de la característica "Marca", sin importar mayúsculas ni espacios', () => {
    expect(marcaDeSpecs([{ label: 'Concentración', value: 'EDP' }, { label: ' marca ', value: ' Creed ' }])).toBe('Creed');
  });

  it('sin la característica, o con valor vacío, no hay marca', () => {
    expect(marcaDeSpecs([{ label: 'Material', value: 'Algodón' }])).toBeNull();
    expect(marcaDeSpecs([{ label: 'Marca', value: '   ' }])).toBeNull();
    expect(marcaDeSpecs(null)).toBeNull();
    expect(marcaDeSpecs({ label: 'Marca', value: 'Creed' })).toBeNull();
  });
});
