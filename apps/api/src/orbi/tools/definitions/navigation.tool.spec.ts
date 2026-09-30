import { NavigationTool } from './navigation.tool';
import { SECCIONES_DEL_PANEL, VISTAS_DE_CONFIGURACION } from '../../navegacion/secciones';

/**
 * Réplica fiel de cómo el front resuelve una URL del panel, para que el test
 * falle si la tool arma un link que termina en "Página no encontrada".
 *
 * AdminSeccionShell.tsx (apps/web/src/modules/ventas/panel):
 *  - la página es un catch-all `/admin/[...slug]`: slug = segmentos después de /admin;
 *  - moduloPadre = PENÚLTIMO segmento, seccion = ÚLTIMO (con o sin negocioId adelante);
 *  - componentMap[moduloPadre][seccion] tiene que existir. Solo existe el módulo
 *    `ventas`, con las claves de SECCIONES_DEL_PANEL.
 * ConfigGeneral.tsx: la sub-vista de Configuración sale de `?vista=` (sin él, 'negocio').
 * Si el front cambia este algoritmo, hay que cambiarlo acá.
 */
function resolverComoElShell(url: string): { seccion: string; vista?: string } | null {
  const [ruta, query = ''] = url.split('?');
  const partes = ruta.split('/').filter(Boolean);
  if (partes[0] !== 'admin') return null;
  const slug = partes.slice(1);
  const seccion = slug[slug.length - 1];
  const moduloPadre = slug[slug.length - 2];
  const componentMap: Record<string, readonly string[]> = { ventas: SECCIONES_DEL_PANEL };
  if (!componentMap[moduloPadre]?.includes(seccion)) return null;

  const vista = new URLSearchParams(query).get('vista') ?? undefined;
  if (seccion === 'configuracion') {
    if (!(VISTAS_DE_CONFIGURACION as readonly string[]).includes(vista ?? 'negocio')) return null;
  }
  return { seccion, vista };
}

describe('resolverComoElShell (la réplica del test)', () => {
  it('reproduce el bug viejo: módulo/sección de a tres niveles no resuelve', () => {
    expect(resolverComoElShell('/admin/ventas/configuracion/envios')).toBeNull();
  });
  it('resuelve la forma de subdominio y la legacy con negocioId', () => {
    expect(resolverComoElShell('/admin/ventas/pedidos')).toEqual({ seccion: 'pedidos', vista: undefined });
    expect(resolverComoElShell('/admin/abc-123/ventas/pedidos')).toEqual({ seccion: 'pedidos', vista: undefined });
  });
});

describe('NavigationTool (spec §3.13)', () => {
  const tool = new NavigationTool();

  it('cada sección de la lista produce un link que el panel resuelve', async () => {
    for (const seccion of SECCIONES_DEL_PANEL) {
      const r = await tool.execute({ seccion });
      expect(r.success).toBe(true);
      const path = (r.data as { path: string }).path;
      expect(path).toBe(`/admin/ventas/${seccion}`);
      expect(resolverComoElShell(path)).toEqual({ seccion, vista: undefined });
    }
  });

  it('configuracion + cada vista produce /admin/ventas/configuracion?vista=<vista> que resuelve', async () => {
    for (const vista of VISTAS_DE_CONFIGURACION) {
      const r = await tool.execute({ seccion: 'configuracion', vista });
      expect(r.success).toBe(true);
      const path = (r.data as { path: string }).path;
      expect(path).toBe(`/admin/ventas/configuracion?vista=${vista}`);
      expect(resolverComoElShell(path)).toEqual({ seccion: 'configuracion', vista });
    }
  });

  it('el caso del bug: configuracion + envios ya no termina en Página no encontrada', async () => {
    const r = await tool.execute({ seccion: 'configuracion', vista: 'envios' });
    expect(resolverComoElShell((r.data as { path: string }).path)).not.toBeNull();
  });

  it('una sección fuera de la lista se rechaza con un error que dice cuáles hay', async () => {
    const r = await tool.execute({ seccion: 'productos' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('productos');
    expect(r.error).toContain('catalogo');
  });

  it('sin sección (o con el formato viejo module/section) se rechaza', async () => {
    expect((await tool.execute({})).success).toBe(false);
    expect((await tool.execute({ module: 'configuracion', section: 'envios' })).success).toBe(false);
  });

  it('una vista que no existe se rechaza', async () => {
    const r = await tool.execute({ seccion: 'configuracion', vista: 'inventada' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('inventada');
  });

  // Decisión: `vista` con otra sección que no sea configuracion se RECHAZA, no se
  // ignora. Ignorarla llevaría al usuario a la pantalla equivocada sin avisarle
  // (pidió "pedidos > notas" y aterriza en la lista de pedidos), y el error le
  // devuelve al modelo el motivo para que corrija la llamada.
  it('vista con una sección que no es configuracion se rechaza', async () => {
    const r = await tool.execute({ seccion: 'pedidos', vista: 'envios' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('configuracion');
    expect(r.data).toBeUndefined();
  });

  it('no deja pasar tipos raros ni caracteres de ruta', async () => {
    for (const seccion of [123, null, ['pedidos'], '../pedidos', 'pedidos?x=1', 'pedidos/']) {
      expect((await tool.execute({ seccion })).success).toBe(false);
    }
  });

  it('el schema de la tool ofrece exactamente las listas reales', () => {
    const def = tool.toLlmDefinition();
    const props = (def.parameters as any).properties;
    expect(props.seccion.enum).toEqual([...SECCIONES_DEL_PANEL]);
    expect(props.vista.enum).toEqual([...VISTAS_DE_CONFIGURACION]);
    expect((def.parameters as any).required).toEqual(['seccion']);
    for (const s of ['cupones', 'categorias', 'reportes', 'avanzado', 'manual']) {
      expect(def.description + JSON.stringify(def.parameters)).toContain(s);
    }
  });
});
