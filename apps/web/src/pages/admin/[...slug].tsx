// Catch-all: cubre '/admin/{moduloPadre}/{seccion}' (subdominio, forma real
// del panel — ver lib/tenant.ts#adminPath) Y '/admin/{negocioId}/{moduloPadre}/
// {seccion}' (legacy/apex) con un solo archivo — antes eran dos carpetas
// dinámicas hermanas ([moduloPadre] y [negocioId]) bajo /admin, que Next.js
// rechaza al buildear ("You cannot use different slug names for the same
// dynamic path"). AdminSeccionShell resuelve moduloPadre/seccion tomando
// los últimos dos segmentos del catch-all, así que ambas formas de URL
// siguen funcionando igual que antes — esto es solo la reorganización de
// archivos para que el build no rompa.
export { default } from '@/modules/ventas/panel/AdminSeccionShell'
