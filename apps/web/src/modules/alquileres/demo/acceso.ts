// Quién puede ver la demo de Alquileres (/alquileres-demo). En desarrollo,
// cualquiera. En producción (y en staging, que también se construye como
// producción) solo quien entró como superadmin: la demo existe para que el
// equipo la pruebe en orbita.site, no para el público. Ver SoloEquipo.tsx.
export const pideSuperadmin = (nodeEnv: string | undefined): boolean => nodeEnv === 'production'
