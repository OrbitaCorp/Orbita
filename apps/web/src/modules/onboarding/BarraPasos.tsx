// ─── Barra de pasos ÚNICA de todo el onboarding ──────────────────────────────
//
// Antes había DOS wizards visuales para un solo camino: la página de rubro
// mostraba "Rubro · Negocio · Listo" (3 pasos) y el setup, adentro, otra barra
// de 5 — y el dueño no entendía dónde estaba parado ni cuántos pasos faltaban
// de verdad. Pedido explícito: un solo recorrido, mostrado igual en todas las
// pantallas (rubro → setup → pago), con lo ya hecho tildado.
//
// El dibujo es el arco de ArcoPasos.tsx (una órbita con una estación por paso
// y, en celular, un anillo compacto): reemplazó a la franja plana de bolitas
// numeradas. Acá queda lo que define el recorrido —qué pasos son y cómo se
// llaman—; cómo se ve vive en ArcoPasos y en las reglas .ob-arco* de
// globals.css.

import { ArcoPasos } from './ArcoPasos'

/** El recorrido completo, de punta a punta. El paso 2 varía su label según
 *  en qué pantalla se muestra la barra (ver PASO_2_GENERICO abajo). */
export function pasosOnboarding(segundoPaso: string): string[] {
  return ['Rubro', segundoPaso, 'Tu negocio', 'Ubicación', 'Tu cuenta', 'Pago']
}

// Label FIJO del paso 2 en las pantallas donde el rubro puede no estar
// decidido todavía (elegir rubro, y la de pago al final del todo). Antes
// dependía del rubro elegido ("Tipo de producto" / "Tus servicios") y
// cambiaba en vivo apenas tocabas una opción — se veía como que la barra de
// pasos se rompía, no como personalización (reportado, con captura).
//
// Dentro de cada setup específico (tienda/Setup.tsx, turnos/Setup.tsx) el
// label SÍ es concreto ("Tipo de producto", "Tus servicios") porque ahí ya
// no hay ambigüedad — estás efectivamente parado en ese paso. Acá afuera,
// mejor un nombre que sirva para cualquier rubro.
export const PASO_2_GENERICO = 'Qué ofrecés'

export function BarraPasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return <ArcoPasos pasos={pasos} actual={actual} />
}
