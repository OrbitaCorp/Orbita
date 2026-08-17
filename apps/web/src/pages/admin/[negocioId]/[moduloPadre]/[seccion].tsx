// Forma legacy/apex de la ruta del panel admin (con negocioId explícito en
// el path). El panel real vive en el subdominio, sin ese segmento — ver
// '/admin/[moduloPadre]/[seccion].tsx' y lib/tenant.ts#adminPath. Esta forma
// queda para acceso desde el apex/dev (pendiente de limpieza más amplia,
// ver PENDIENTES.md "[2026-07-27] El /admin/[negocioId]/* en el apex...").
export { default } from '@/modules/ventas/panel/AdminSeccionShell'
