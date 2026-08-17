// Forma "limpia" de la ruta del panel admin: sin negocioId en el path porque
// el negocio ya está identificado por el subdominio ({slug}.orbita.site).
// Es la ruta real del panel del dueño — ver lib/tenant.ts#adminPath y el
// comentario en '/admin/[negocioId]/[moduloPadre]/[seccion].tsx'.
export { default } from '@/modules/ventas/panel/AdminSeccionShell'
