// Lo que Turnos, Alquileres y Gimnasio comparten, y las reglas para tocarlo.
//
// Pedido de Ale (04/11/2026): que en Módulos quede claro que lo de reservas es
// compartido, en qué carpetas se guardan las reglas y que si alguien actualiza
// algo ahí lo actualiza para los tres, para que cada responsable lo sepa antes
// de tocar. Los tres módulos siguen siendo independientes (ninguno importa de
// otro; eslint lo marca); lo que comparten vive en estas cuatro carpetas y en
// ningún otro lado.
//
// Es contenido escrito a mano, como el plan: la pantalla lo muestra en la lista
// de módulos y dentro de cada módulo (Modulos.tsx, <Compartido>). El test de
// datos (datos.test.ts) verifica que cada ruta y cada archivo de reglas existan
// en el repo, así una carpeta que se mueva no queda apuntada acá.

export interface CarpetaCompartida {
  /** Ruta desde la raíz del repo, con la barra final. */
  ruta: string
  nombre: string
  /** Qué vive ahí, en un párrafo. */
  que: string
  /** Quiénes lo usan hoy. */
  usan: string
  /** Dónde están escritas sus reglas (ruta desde la raíz del repo). */
  reglas: string
  /** Cómo se prueba un cambio, el comando tal cual se escribe. */
  probar: string
}

export const CARPETAS_COMPARTIDAS: CarpetaCompartida[] = [
  {
    ruta: 'apps/api/src/reservas/',
    nombre: 'El motor de reservas (la API)',
    que: 'Qué se reserva, cuándo, con qué cupo, en qué estado está y las reglas que lo mantienen íntegro aunque dos personas toquen el botón a la vez: candado por recurso, retenciones que vencen solas, lista de espera que toma el lugar al cancelar, avisos por email, las rutas del panel (/reservas) y del sitio (/storefront/:slug/reservas). Las tablas reservas_* de la base son las mismas para los tres módulos.',
    usan: 'Turnos, Alquileres y Gimnasio, cuando cada uno se conecte (hoy las demos corren con datos del navegador).',
    reglas: 'apps/api/src/reservas/README.md',
    probar: 'cd apps/api && pnpm test',
  },
  {
    ruta: 'apps/web/src/lib/reservasApi/',
    nombre: 'El cliente de esa API',
    que: 'Cómo la web le habla al motor: panel (con la sesión del panel) y sitio(slug) para el sitio público, con los tipos de lo que devuelve cada ruta. Un cambio en una ruta de la API se refleja acá, una sola vez, y lo ven los tres.',
    usan: 'Los tres paneles y los tres sitios, cada uno con su módulo.',
    reglas: 'apps/api/src/reservas/README.md',
    probar: 'cd apps/web && pnpm exec vitest run src/lib/reservasApi',
  },
  {
    ruta: 'apps/web/src/lib/reservas/',
    nombre: 'Las cuentas de calendario y de plata',
    que: 'Funciones puras, sin React ni pantallas: fechas y horas, si dos reservas se pisan, horarios libres, franjas, extras, seña, saldo y redondeo, noches, temporadas y meses, el archivo .ics. Una cuenta escrita tres veces da tres resultados: por eso vive acá, una sola vez.',
    usan: 'Turnos, Alquileres, Gimnasio, el kit y el alta.',
    reglas: 'apps/web/src/lib/reservas/README.md',
    probar: 'cd apps/web && pnpm exec vitest run src/lib/reservas',
  },
  {
    ruta: 'apps/web/src/design-system/reservas/',
    nombre: 'El kit visual (prefijo rv-)',
    que: 'El armazón de los tres paneles (LayoutPanel: barra lateral, cabecera, tema con fundido, cajón en celular, siluetas de carga), el calendario, los campos, el modal, los indicadores y la hoja de estilos. Pinta con los tokens --color-* del design system: un cambio de color o de tamaño acá se ve en los tres paneles.',
    usan: 'Los paneles y los sitios de Turnos, Alquileres y Gimnasio, y el alta.',
    reglas: 'apps/web/src/design-system/reservas/estilo.tsx',
    probar: 'cd apps/web && pnpm typecheck && pnpm test, y mirar los tres paneles (/turnos-demo, /alquileres-demo, /gimnasio-demo)',
  },
]

export const REGLAS_COMPARTIDO: string[] = [
  'Lo que se cambia en estas carpetas cambia para Turnos, Alquileres y Gimnasio a la vez. No hay una copia por módulo: si arreglás una cuenta o un estado queda arreglado para los tres, y si lo rompés se rompe para los tres.',
  'Antes de tocar, avisá a los otros dos responsables (Mateo, Alan y Ale). Al terminar, corré los tests de la carpeta y mirá las pantallas de los módulos que la usan, no solo la tuya.',
  'Lo que es de un solo módulo va en su carpeta (apps/web/src/modules/<módulo>/), nunca acá. Ningún módulo importa de otro: eslint lo marca como error.',
  'Un cambio que altere el comportamiento (un estado nuevo, una regla de solapamiento, una ruta de la API) se registra en la Auditoría del módulo que lo pidió, marcado como transversal, para que los otros dos lo vean.',
  'Tienda no depende de ninguna de estas carpetas: tocar lo compartido no toca Tienda ni lo que ya está en producción de Tienda.',
]
