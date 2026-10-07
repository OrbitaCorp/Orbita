import { UpdateBusinessInfoTool, UpdatePaymentMethodsTool, UpdateShippingTool } from './config.tools';
import { ToolRegistryService } from '../tool-registry.service';
import { OrbiSurface } from '../../dto/orbi-chat.dto';
import type { ToolExecutionContext } from '../tool.interface';

const ctx: ToolExecutionContext = {
  businessId: 'biz-1',
  userId: 'user-1',
  surface: OrbiSurface.PANEL,
  permissions: ['config.edit'],
};

const registry = new ToolRegistryService();
registry.register(new UpdateBusinessInfoTool({} as any));
registry.register(new UpdatePaymentMethodsTool({} as any));
registry.register(new UpdateShippingTool({} as any));

describe('UpdateBusinessInfoTool — la tarjeta', () => {
  const tool = new UpdateBusinessInfoTool({} as any);

  it('muestra cada valor nuevo entre comillas', async () => {
    const r = await tool.describirAccion({ name: 'La Tiendita', industry: 'Indumentaria', description: 'Ropa linda' });
    expect(r).toContain('"La Tiendita"');
    expect(r).toContain('"Indumentaria"');
    expect(r).toContain('"Ropa linda"');
  });

  it('la descripción larga sale truncada a 80 y sin saltos de línea', async () => {
    const r = await tool.describirAccion({ description: `Linea 1\nLinea 2 ${'d'.repeat(300)}` });
    expect(r).not.toMatch(/[\r\n]/);
    const citado = r.match(/"([^"]*)"/)?.[1] ?? '';
    expect(citado.startsWith('Linea 1 Linea 2')).toBe(true);
    expect(Array.from(citado).length).toBeLessThanOrEqual(80);
  });
});

describe('UpdatePaymentMethodsTool — la tarjeta', () => {
  const tool = new UpdatePaymentMethodsTool({} as any);

  it('muestra qué se activa, qué se desactiva y el alias de transferencia', async () => {
    const r = await tool.describirAccion({
      acceptsMercadopago: true, acceptsCash: false, acceptsCoordinateLater: true, transferAlias: 'la.tiendita.mp',
    });
    expect(r).toContain('Mercado Pago');
    expect(r).toContain('efectivo');
    expect(r).toContain('pagar más tarde');
    expect(r).toContain('"la.tiendita.mp"');
  });
});

describe('UpdateShippingTool — la tarjeta', () => {
  const tool = new UpdateShippingTool({} as any);

  it('muestra envío gratis, transportistas y política de envío', async () => {
    const r = await tool.describirAccion({
      freeShippingFrom: 25000, enabledCarriers: ['CORREO_ARGENTINO', 'OCA'], shippingPolicy: 'Despachamos en 48 hs',
    });
    expect(r).toContain('$25000');
    expect(r).toContain('Correo Argentino');
    expect(r).toContain('OCA');
    expect(r).toContain('"Despachamos en 48 hs"');
  });

  it('una lista vacía de transportistas es "todos" (así lo interpreta la tienda)', async () => {
    const r = await tool.describirAccion({ enabledCarriers: [] });
    expect(r).toContain('todos');
  });
});

describe('config — validan con UpdateBusinessDto / UpdateBusinessConfigDto', () => {
  it('con argumentos válidos se propone', async () => {
    expect(await registry.proponer('updateBusinessInfo', { name: 'La Tiendita' }, ctx)).toEqual({ resumen: expect.any(String) });
    expect(await registry.proponer('updatePaymentMethods', { acceptsCash: true, transferAlias: 'ok.mp' }, ctx)).toEqual({ resumen: expect.any(String) });
    expect(await registry.proponer('updateShipping', { freeShippingFrom: 1000, enabledCarriers: ['OCA'] }, ctx)).toEqual({ resumen: expect.any(String) });
  });

  it('transferAlias de más de 60: error, sin tarjeta', async () => {
    expect(await registry.proponer('updatePaymentMethods', { transferAlias: 'a'.repeat(61) }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
  });

  it('nombre del negocio de más de 80: error', async () => {
    expect(await registry.proponer('updateBusinessInfo', { name: 'n'.repeat(81) }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
  });

  it('transportista fuera de la lista cerrada, o monto negativo: error', async () => {
    expect(await registry.proponer('updateShipping', { enabledCarriers: ['DHL'] }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
    expect(await registry.proponer('updateShipping', { freeShippingFrom: -1 }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
  });

  it('un booleano que no es booleano: error', async () => {
    expect(await registry.proponer('updatePaymentMethods', { acceptsCash: 'sí' }, ctx)).toEqual(expect.objectContaining({ error: expect.any(String), invalidos: expect.any(Array) }));
  });

  it('sin nada que cambiar no hay tarjeta "sin cambios": se pide qué cambiar', async () => {
    expect(await registry.proponer('updateShipping', {}, ctx)).toEqual(expect.objectContaining({ faltan: ['qué cambiar de los envíos'] }));
    expect(await registry.proponer('updateBusinessInfo', { name: null }, ctx)).toEqual(expect.objectContaining({ faltan: [expect.stringContaining('nombre, rubro o descripción')] }));
    expect(await registry.proponer('updatePaymentMethods', {}, ctx)).toEqual(expect.objectContaining({ faltan: expect.any(Array) }));
  });

  it('un parámetro que la tool no declara (ej. subdomain): error', async () => {
    expect(await registry.proponer('updateBusinessInfo', { subdomain: 'otra' }, ctx)).toEqual({ error: expect.stringContaining('subdomain') });
  });
});
