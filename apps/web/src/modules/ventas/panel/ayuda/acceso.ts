// ─── Quién ve la ayuda nueva y quién puede probarla ──────────────────────────
//
// La ayuda nueva (tutorial por módulo, sugerencias y primeros pasos) la ve TODA
// tienda. A las que ya tienen productos o categorías no les sale el modal del
// primer producto (decidirPrimerosPasos solo lo pide a quien no tiene nada), pero
// sí el tutorial de cada módulo y las sugerencias de lo que todavía no hicieron.
//
// El MODO PRUEBA, en cambio, es solo de la tienda "negocio": simula una tienda
// recién creada (solo en ese navegador y sin tocar datos) para poder ver el flujo
// del primer producto en una tienda que ya tiene todo. ARRANCA SOLO la primera vez
// que se entra a esa tienda desde un navegador, y se maneja con la dirección:
//   ?ayuda=probar     arranca la prueba desde cero (tienda "nueva")
//   ?ayuda=reiniciar  vuelve a mostrar avisos y sugerencias (sin cambiar la prueba)
//   ?ayuda=salir      sale de la prueba y vuelve a lo real

export const TIENDAS_CON_MODO_PRUEBA: readonly string[] = ['negocio']

export function puedeUsarModoPrueba(subdominio: string | null | undefined): boolean {
    return !!subdominio && TIENDAS_CON_MODO_PRUEBA.includes(subdominio.toLowerCase())
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
