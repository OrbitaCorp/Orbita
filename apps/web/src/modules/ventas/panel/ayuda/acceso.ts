// ─── Quién ve la ayuda nueva ─────────────────────────────────────────────────
//
// Por ahora, SOLO la tienda "negocio": las tiendas que ya estaban en producción
// pasaron por el tutorial anterior y no tienen que ver nada de esto. Mientras
// tanto el resto del panel queda sin tutoriales ni sugerencias. Para abrirlo a
// todas (o solo a las altas nuevas) alcanza con cambiar `ayudaNuevaHabilitada`.
//
// Como "negocio" ya tiene productos y categorías, para ver el flujo del primer
// producto hay un MODO PRUEBA: simula una tienda recién creada, solo en ese
// navegador y sin tocar datos. Se maneja con la dirección:
//   ?ayuda=probar     arranca la prueba desde cero (tienda "nueva")
//   ?ayuda=reiniciar  vuelve a mostrar avisos y sugerencias (sin cambiar la prueba)
//   ?ayuda=salir      sale de la prueba y vuelve a lo real

export const TIENDAS_CON_AYUDA_NUEVA: readonly string[] = ['negocio']

export function ayudaNuevaHabilitada(subdominio: string | null | undefined): boolean {
    return !!subdominio && TIENDAS_CON_AYUDA_NUEVA.includes(subdominio.toLowerCase())
}

export type PasoDePrueba = 'categoria' | 'producto' | 'listo'
export type ComandoAyuda = 'probar' | 'reiniciar' | 'salir'

export function comandoDeQuery(valor: unknown): ComandoAyuda | null {
    return valor === 'probar' || valor === 'reiniciar' || valor === 'salir' ? valor : null
}

/** Lo que la API diría de una tienda que recién va por ese paso (en la prueba no se mira la base). */
export function cumplidasSimuladas(paso: PasoDePrueba): string[] {
    if (paso === 'categoria') return []
    return paso === 'producto' ? ['categorias'] : ['categorias', 'producto']
}

export function siguientePasoDePrueba(paso: PasoDePrueba): PasoDePrueba {
    return paso === 'categoria' ? 'producto' : 'listo'
}
