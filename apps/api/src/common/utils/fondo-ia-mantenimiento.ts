// "Quitar fondo" de fotos de producto y "Fondo con IA" están en mantenimiento
// (24/09/2026, se reconstruye el pipeline — ver el plan "Fondo con IA: pipeline
// 2D/3D"). En mantenimiento por default: solo se habilita con
// FONDO_IA_MANTENIMIENTO=false (apps/api/.env para probarlo en local; en Cloud
// Run queda sin definir hasta decidir el lanzamiento). Los sliders de
// Apariencia (uploadStorefrontImage) NO dependen de este flag.
export const fondoIaEnMantenimiento = (): boolean => process.env.FONDO_IA_MANTENIMIENTO !== 'false';

export const MENSAJE_FONDO_IA_MANTENIMIENTO = '"Fondo con IA" está en mantenimiento — vuelve pronto.';

// Motor de edición generativa para el modo premium de productos PLANOS y para
// "Mejorar recorte": 'gemini' (default, el que no bloquea indumentaria
// femenina) o 'workers' (Workers AI/Flux, gratis en el free tier pero con el
// filtro NSFW que da falsos positivos con ropa ajustada). Es un interruptor
// para probar Workers en todo sin borrar nada de Gemini: FONDO_IA_MOTOR=workers.
// Los productos con volumen van SIEMPRE por Workers, con cualquier valor.
export const fondoIaMotor = (): 'gemini' | 'workers' => (process.env.FONDO_IA_MOTOR === 'workers' ? 'workers' : 'gemini');
