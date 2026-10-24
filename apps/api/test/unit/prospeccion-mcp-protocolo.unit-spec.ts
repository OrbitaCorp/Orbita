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
    listar: jest.fn().mockResolvedValue([{ id: 'v-1', tipo: 'MARKETING', titulo: 'Reel', formato: 'REEL_9_16', estado: 'PENDIENTE', duracionSeg: 30, tutorialId: null, createdAt: new Date('2026-10-14T00:00:00Z') }]),
    detalle: jest.fn().mockResolvedValue({ id: 'v-1', titulo: 'Reel', guion: 'hola', comentariosDelEquipo: [{ autor: 'Alan', texto: 'más corto', fecha: '2026-10-14' }] }),
    pedirSubida: jest.fn().mockResolvedValue({ videoId: 'v-2', uploadUrl: 'https://r2.example/put', tipo: 'video/mp4', venceEnMin: 10 }),
    registrar: jest.fn().mockResolvedValue({ id: 'v-2', estado: 'PENDIENTE' }),
    avisarTanda: jest.fn().mockResolvedValue({ enviados: 2, pendientes: 3 }),
  };
  const tutoriales = {
    listar: jest.fn().mockResolvedValue({ resumen: { total: 39, hechos: 2 }, tutoriales: [{ id: 't-1', titulo: 'Cargar un producto', estado: 'HECHO' }] }),
    actualizar: jest.fn().mockResolvedValue({ id: 't-2', titulo: 'Atender un pedido', estado: 'EN_PROCESO', notas: null }),
  };
  return { svc, videos, tutoriales, mcp: new McpProspeccion(svc as never, videos as never, tutoriales as never) };
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
    expect(r.result.instructions).toMatch(/ELEVEN_KEY/); // la voz es ElevenLabs
    expect(r.result.instructions).not.toMatch(/Gemini/);
    expect(r.result.instructions).toMatch(/ffmpeg -version/); // revisar los requisitos de la PC antes de producir
    expect(r.result.instructions).toMatch(/git pull/); // cómo bajar la skill de videos si no está
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
  it('son las 6 de la prospección, las de los videos y las de los tutoriales, y ninguna envía, contacta, publica ni borra', () => {
    expect(HERRAMIENTAS.map((h) => h.name)).toEqual([
      'prospeccion_criterio', 'prospeccion_listar_lotes', 'prospeccion_listar_prospectos',
      'prospeccion_consultar_cuentas', 'prospeccion_obtener_lote', 'prospeccion_guardar_analisis',
      'videos_listar', 'videos_obtener', 'videos_pedir_subida', 'videos_registrar', 'videos_avisar',
      'tutoriales_listar', 'tutoriales_actualizar',
    ]);
    for (const h of HERRAMIENTAS) {
      expect(h.name).not.toMatch(/enviar|mandar|borrar|eliminar|contactar|publicar/);
      expect(h.annotations.destructiveHint).not.toBe(true);
      expect(h.inputSchema.type).toBe('object');
    }
  });

  it('las de solo lectura lo declaran, así Claude no pide confirmación de más', () => {
    const lectura = HERRAMIENTAS.filter((h) => h.annotations.readOnlyHint === true).map((h) => h.name);
    expect(lectura).toEqual(['prospeccion_criterio', 'prospeccion_listar_lotes', 'prospeccion_listar_prospectos', 'prospeccion_obtener_lote', 'videos_listar', 'videos_obtener', 'tutoriales_listar']);
  });

  it('tools/list las devuelve', async () => {
    const { mcp } = armar();
    expect(((await mcp.manejar(rpc('tools/list'), CTX)) as any).result.tools).toHaveLength(13);
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
    expect(videos.pedirSubida).toHaveBeenCalledWith('admin-1', 1234, undefined);
    await mcp.manejar(rpc('tools/call', { name: 'videos_registrar', arguments: { video: 'v-2', titulo: 'Mi reel', caption: 'hola', duracionSeg: 30, controles: [{ nombre: 'audio', ok: true }], adminId: 'otro' } }), CTX);
    expect(videos.registrar).toHaveBeenCalledWith('admin-1', expect.objectContaining({ videoId: 'v-2', titulo: 'Mi reel', caption: 'hola', duracionSeg: 30, formato: undefined }));
    const lista = JSON.parse(texto(await mcp.manejar(rpc('tools/call', { name: 'videos_listar', arguments: {} }), CTX)));
    expect(lista).toEqual([{ id: 'v-1', tipo: 'MARKETING', titulo: 'Reel', formato: 'REEL_9_16', estado: 'PENDIENTE', duracionSeg: 30, tutorialId: null, creado: '2026-10-14T00:00:00.000Z' }]);
  });

  it('el tipo y los filtros llegan a la cola; un tutorial se sube con su tipo y se vincula a la lista', async () => {
    const { mcp, videos } = armar();
    await mcp.manejar(rpc('tools/call', { name: 'videos_listar', arguments: { tipo: 'TUTORIAL', estado: 'PENDIENTE' } }), CTX);
    expect(videos.listar).toHaveBeenCalledWith('PENDIENTE', 'TUTORIAL');
    await mcp.manejar(rpc('tools/call', { name: 'videos_pedir_subida', arguments: { bytes: 99, tipo: 'TUTORIAL' } }), CTX);
    expect(videos.pedirSubida).toHaveBeenCalledWith('admin-1', 99, 'TUTORIAL');
    await mcp.manejar(rpc('tools/call', { name: 'videos_registrar', arguments: { video: 'v-3', titulo: 'T', tutorial: 'Cargar un producto', mejora_de: 'v-1' } }), CTX);
    expect(videos.registrar).toHaveBeenCalledWith('admin-1', expect.objectContaining({ videoId: 'v-3', tutorial: 'Cargar un producto', mejoraDe: 'v-1' }));
    await mcp.manejar(rpc('tools/call', { name: 'videos_avisar', arguments: { tipo: 'TUTORIAL' } }), CTX);
    expect(videos.avisarTanda).toHaveBeenLastCalledWith('admin-1', 'TUTORIAL');
  });

  it('videos_obtener devuelve lo necesario para mejorar un video, con los comentarios del equipo', async () => {
    const { mcp, videos } = armar();
    const r = JSON.parse(texto(await mcp.manejar(rpc('tools/call', { name: 'videos_obtener', arguments: { video: 'v-1' } }), CTX)));
    expect(videos.detalle).toHaveBeenCalledWith('v-1');
    expect(r.comentariosDelEquipo).toEqual([{ autor: 'Alan', texto: 'más corto', fecha: '2026-10-14' }]);
  });

  it('la lista de tutoriales se lee y se actualiza como quien autorizó; el estado EN_REVISION no se puede poner a mano desde el esquema', async () => {
    const { mcp, tutoriales } = armar();
    const lista = JSON.parse(texto(await mcp.manejar(rpc('tools/call', { name: 'tutoriales_listar', arguments: { estado: 'FALTA' } }), CTX)));
    expect(tutoriales.listar).toHaveBeenCalledWith('FALTA');
    expect(lista.resumen.total).toBe(39);
    await mcp.manejar(rpc('tools/call', { name: 'tutoriales_actualizar', arguments: { tutorial: 'Atender un pedido', estado: 'EN_PROCESO', notas: 'arranco hoy', adminId: 'otro' } }), CTX);
    expect(tutoriales.actualizar).toHaveBeenCalledWith('admin-1', { tutorial: 'Atender un pedido', estado: 'EN_PROCESO', notas: 'arranco hoy' });
    const esquema = HERRAMIENTAS.find((h) => h.name === 'tutoriales_actualizar')!.inputSchema as { properties: { estado: { enum: string[] } } };
    expect(esquema.properties.estado.enum).toEqual(['FALTA', 'EN_PROCESO', 'HECHO']);
  });

  it('videos_avisar manda el aviso de fin de tanda como el superadmin que autorizó y no recibe texto libre', async () => {
    const { mcp, videos } = armar();
    const r = await mcp.manejar(rpc('tools/call', { name: 'videos_avisar', arguments: { adminId: 'otro', asunto: 'hola', texto: 'libre' } }), CTX)
    expect(videos.avisarTanda).toHaveBeenCalledWith('admin-1', undefined)
    expect(JSON.parse(texto(r))).toEqual({ enviados: 2, pendientes: 3 })
    const herramienta = HERRAMIENTAS.find((h) => h.name === 'videos_avisar')!
    expect(herramienta.inputSchema.properties).toEqual({ tipo: expect.objectContaining({ enum: ['MARKETING', 'TUTORIAL'] }) })
    expect(herramienta.inputSchema.additionalProperties).toBe(false)
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
