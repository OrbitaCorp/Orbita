// La ruta de una pantalla del panel. La usan navigateTo y el manual
// (leerTemaDelManual): los botones "Ir a…" de Orbi se arman en un solo lugar.
//
// El panel resuelve /admin/ventas/<seccion> tomando los DOS ÚLTIMOS segmentos
// como módulo y sección (AdminSeccionShell), y las sub-vistas van por
// ?vista=, nunca como un tercer segmento: /admin/ventas/configuracion/envios
// terminaba en "Página no encontrada". El front le antepone el negocio.
//
// No valida: cada llamador valida contra lo suyo (navigateTo contra
// SECCIONES_DEL_PANEL y VISTAS_DE_CONFIGURACION; el manual llega validado por
// su contrato en apps/web).
export function rutaDelPanel(seccion: string, vista?: string): string {
  return vista ? `/admin/ventas/${seccion}?vista=${vista}` : `/admin/ventas/${seccion}`;
}
