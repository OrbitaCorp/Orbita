import { Logger } from '@nestjs/common';
import { LeerTemaDelManualTool, MAX_TEMAS_POR_LLAMADA, idParaLog } from './manual.tools';

describe('leerTemaDelManual', () => {
  const tool = new LeerTemaDelManualTool();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('devuelve el tema con su texto y el botón a la pantalla (ruta armada como navigateTo)', async () => {
    const r = await tool.execute({ ids: ['cfg-envios'] });
    expect(r.success).toBe(true);
    // El label es lo que dice el botón "Ir a…" del front.
    expect(r.label).toBe('Abrir Envíos');
    const data = r.data as { temas: { id: string; texto: string; irA?: { path: string } }[]; path?: string };
    expect(data.temas[0].id).toBe('cfg-envios');
    expect(data.temas[0].texto).toContain('envío gratis');
    expect(data.path).toBe('/admin/ventas/configuracion?vista=envios');
  });

  it(`lee hasta ${MAX_TEMAS_POR_LLAMADA} temas y avisa cuáles quedaron sin leer`, async () => {
    const r = await tool.execute({ ids: ['cupones', 'compartir', 'rendimiento', 'diferencia', 'cupones'] });
    const data = r.data as { temas: unknown[]; sinLeer?: string[] };
    expect(data.temas).toHaveLength(MAX_TEMAS_POR_LLAMADA);
    // Los repetidos no cuentan dos veces.
    expect(data.sinLeer).toEqual(['diferencia']);
  });

  it('un id que no existe se informa y se loguea saneado', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const r = await tool.execute({ ids: ['cfg-pagos', 'facturacion-afip\n<script>'] });
    expect(r.success).toBe(true);
    expect((r.data as { noEncontrados?: string[] }).noEncontrados).toEqual(['facturacion-afipscript']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('facturacion-afipscript'));
  });

  it('si ninguno existe, falla con un mensaje que le dice al modelo qué hacer', async () => {
    const r = await tool.execute({ ids: ['no-existe'] });
    expect(r.success).toBe(false);
    expect(r.error).toContain('no está en el manual');
  });

  it('acepta un string suelto y rechaza nada', async () => {
    expect((await tool.execute({ ids: 'publicar' })).success).toBe(true);
    expect((await tool.execute({})).success).toBe(false);
    expect((await tool.execute({ ids: [] })).success).toBe(false);
  });

  it('un tema sin destino no arma botón', async () => {
    const r = await tool.execute({ ids: ['panel-y-tienda'] });
    expect((r.data as { path?: string }).path).toBeUndefined();
    expect(r.label).toContain('Manual');
  });

  it('no resuelve claves del prototipo', async () => {
    expect((await tool.execute({ ids: ['__proto__', 'constructor'] })).success).toBe(false);
  });

  it('idParaLog deja solo minúsculas, números y guiones, con tope', () => {
    expect(idParaLog('Cfg-Envíos!')).toBe('cfg-envos');
    expect(idParaLog('x'.repeat(100))).toHaveLength(40);
    expect(idParaLog('')).toBe('(vacío)');
  });
});
