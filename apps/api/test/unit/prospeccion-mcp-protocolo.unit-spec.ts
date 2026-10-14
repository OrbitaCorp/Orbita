import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HERRAMIENTAS, McpProspeccion } from '../../src/marketing/prospeccion/mcp/mcp-prospeccion';

// El protocolo del conector MCP (JSON-RPC sobre HTTP) con el servicio de prospección simulado.

const CTX = { adminId: 'admin-1' };

function armar() {
  const svc = {
    criterio: jest.fn().mockReturnValue({ version: 'v' }),
    listarLotes: jest.fn().mockResolvedValue([{ id: 'l-1' }]),
    listarProspectos: jest.fn().mockResolvedValue([
      { usuario: 'tienda_a', estado: 'NUEVO', evaluacion: { nivel: 'A', puntaje: 80, subrubro: 'Calzado' }, analizadoAt: null, ultimaConsultaAt: new Date('2026-10-14T00:00:00Z') },
    ]),
    consultar: jest.fn().mockResolvedValue({ conDatos: 1 }),
    obtenerLoteParaClaude: jest.fn().mockResolvedValue({ lote: 'l-1' }),
    guardarAnalisis: jest.fn().mockResolvedValue({ guardadas: 1 }),
  };
  const videos = {
    listar: jest.fn().mockResolvedValue([{ id: 'v-1', titulo: 'Reel', formato: 'REEL_9_16', estado: 'PENDIENTE', duracionSeg: 30, createdAt: new Date('2026-10-14T00:00:00Z') }]),
    pedirSubida: jest.fn().mockResolvedValue({ videoId: 'v-2', uploadUrl: 'https://r2.example/put', tipo: 'video/mp4', venceEnMin: 10 }),
    registrar: jest.fn().mockResolvedValue({ id: 'v-2', estado: 'PENDIENTE' }),
  };
  return { svc, videos, mcp: new McpProspeccion(svc as never, videos as never) };
}

const rpc = (method: string, params?: unknown, id: number | null = 1) => ({ jsonrpc: '2.0', id, method, params });
const texto = (r: any) => r.result.content[0].text as string;

describe('protocolo', () => {
  it('initialize devuelve el protocolo pedido, las capacidades y las instrucciones', async () => {
    const { mcp } = armar();
    const r: any = await mcp.manejar(rpc('initialize', { protocolVersion: '2025-03-26' }), CTX);
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.result.instructions).toMatch(/Nunca envíes mensajes/);
    expect(((await mcp.manejar(rpc('initialize', { protocolVersion: '1999-01-01' }), CTX)) as any).result.protocolVersion).toBe('2025-06-18');
  });

  it('las notificaciones no se responden y ping responde vacío', async () => {
    const { mcp } = armar();
    expect(await mcp.manejar({ jsonrpc: '2.0', method: 'notifications/initialized' }, CTX)).toBeNull();
    expect(await mcp.manejar(rpc('ping'), CTX)).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  });

  it('un mensaje mal formado o un método desconocido devuelven error de protocolo', async () => {
    const { mcp } = armar();
    expect(((await mcp.manejar({ id: 1 }, CTX)) as any).error.code).toBe(-32600);
    expect(((await mcp.manejar('hola', CTX)) as any).error.code).toBe(-32600);
    expect(((await mcp.manejar(rpc('foo/bar'), CTX)) as any).error.code).toBe(-32601);
    expect(((await mcp.manejar(rpc('tools/call', {}), CTX)) as any).error.code).toBe(-32602);
  });
});

describe('herramientas', () => {
  it('son las 6 de la prospección y las 3 de los videos, y ninguna envía, contacta, publica ni borra', () => {
    expect(HERRAMIENTAS.map((h) => h.name)).toEqual([
      'prospeccion_criterio', 'prospeccion_listar_lotes', 'prospeccion_listar_prospectos',
      'prospeccion_consultar_cuentas', 'prospeccion_obtener_lote', 'prospeccion_guardar_analisis',
      'videos_listar', 'videos_pedir_subida', 'videos_registrar',
    ]);
    for (const h of HERRAMIENTAS) {
      expect(h.name).not.toMatch(/enviar|mandar|borrar|eliminar|contactar|publicar/);
      expect(h.annotations.destructiveHint).not.toBe(true);
      expect(h.inputSchema.type).toBe('object');
    }
  });

  it('las de solo lectura lo declaran, así Claude no pide confirmación de más', () => {
    const lectura = HERRAMIENTAS.filter((h) => h.annotations.readOnlyHint === true).map((h) => h.name);
    expect(lectura).toEqual(['prospeccion_criterio', 'prospeccion_listar_lotes', 'prospeccion_listar_prospectos', 'prospeccion_obtener_lote', 'videos_listar']);
  });

  it('tools/list las devuelve', async () => {
    const { mcp } = armar();
    expect(((await mcp.manejar(rpc('tools/list'), CTX)) as any).result.tools).toHaveLength(9);
  });

  it('consultar y guardar usan al superadmin que autorizó, no un dato que mande Claude', async () => {
    const { mcp, svc } = armar();
    await mcp.manejar(rpc('tools/call', { name: 'prospeccion_consultar_cuentas', arguments: { usuarios: ['a', 'b'], adminId: 'otro' } }), CTX);
    expect(svc.consultar).toHaveBeenCalledWith('admin-1', ['a', 'b']);
    await mcp.manejar(rpc('tools/call', { name: 'prospeccion_guardar_analisis', arguments: { lote: 'l-1', analisis: [{ usuario: 'a' }], adminId: 'otro' } }), CTX);
    expect(svc.guardarAnalisis).toHaveBeenCalledWith('admin-1', 'l-1', [{ usuario: 'a' }]);
  });

  it('los videos se piden y se registran como el superadmin que autorizó, y el listado no trae la dirección interna', async () => {
    const { mcp, videos } = armar();
    await mcp.manejar(rpc('tools/call', { name: 'videos_pedir_subida', arguments: { bytes: 1234, adminId: 'otro' } }), CTX);
    expect(videos.pedirSubida).toHaveBeenCalledWith('admin-1', 1234);
    await mcp.manejar(rpc('tools/call', { name: 'videos_registrar', arguments: { video: 'v-2', titulo: 'Mi reel', caption: 'hola', duracionSeg: 30, controles: [{ nombre: 'audio', ok: true }], adminId: 'otro' } }), CTX);
    expect(videos.registrar).toHaveBeenCalledWith('admin-1', expect.objectContaining({ videoId: 'v-2', titulo: 'Mi reel', caption: 'hola', duracionSeg: 30, formato: undefined }));
    const lista = JSON.parse(texto(await mcp.manejar(rpc('tools/call', { name: 'videos_listar', arguments: {} }), CTX)));
    expect(lista).toEqual([{ id: 'v-1', titulo: 'Reel', formato: 'REEL_9_16', estado: 'PENDIENTE', duracionSeg: 30, creado: '2026-10-14T00:00:00.000Z' }]);
  });

  it('obtener lote pasa los filtros y listar prospectos resume lo que devuelve', async () => {
    const { mcp, svc } = armar();
    await mcp.manejar(rpc('tools/call', { name: 'prospeccion_obtener_lote', arguments: { lote: 'l-1', niveles: ['A'], limite: 3 } }), CTX);
    expect(svc.obtenerLoteParaClaude).toHaveBeenCalledWith('l-1', { niveles: ['A'], usuarios: undefined, limite: 3 });
    const r = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_listar_prospectos', arguments: { nivel: 'A' } }), CTX);
    expect(JSON.parse(texto(r))).toEqual([{ usuario: 'tienda_a', estado: 'NUEVO', nivel: 'A', puntaje: 80, subrubro: 'Calzado', analizado: false, ultimaConsulta: '2026-10-14T00:00:00.000Z' }]);
  });

  it('un error del servicio vuelve como resultado con isError y su mensaje, sin tirar el protocolo', async () => {
    const { mcp, svc } = armar();
    svc.obtenerLoteParaClaude.mockRejectedValueOnce(new NotFoundException('No existe ese lote'));
    const r: any = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_obtener_lote', arguments: { lote: 'x' } }), CTX);
    expect(r.result.isError).toBe(true);
    expect(texto(r)).toBe('No existe ese lote');
    svc.guardarAnalisis.mockRejectedValueOnce(new BadRequestException(['uno', 'dos']));
    expect(texto(await mcp.manejar(rpc('tools/call', { name: 'prospeccion_guardar_analisis', arguments: { lote: 'x', analisis: [] } }), CTX))).toBe('uno. dos');
  });

  it('un error inesperado no filtra detalles internos', async () => {
    const { mcp, svc } = armar();
    svc.listarLotes.mockRejectedValueOnce(new Error('password authentication failed for user postgres'));
    const r: any = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_listar_lotes' }), CTX);
    expect(r.result.isError).toBe(true);
    expect(texto(r)).not.toMatch(/postgres|password/);
  });

  it('parámetros de tipo equivocado se rechazan sin llegar al servicio', async () => {
    const { mcp, svc } = armar();
    const a: any = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_consultar_cuentas', arguments: { usuarios: 'tienda_a' } }), CTX);
    expect(a.result.isError).toBe(true);
    const b: any = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_guardar_analisis', arguments: { lote: 'l', analisis: 'x' } }), CTX);
    expect(b.result.isError).toBe(true);
    expect(svc.consultar).not.toHaveBeenCalled();
    expect(svc.guardarAnalisis).not.toHaveBeenCalled();
    const c: any = await mcp.manejar(rpc('tools/call', { name: 'prospeccion_inventada' }), CTX);
    expect(c.result.isError).toBe(true);
  });
});
