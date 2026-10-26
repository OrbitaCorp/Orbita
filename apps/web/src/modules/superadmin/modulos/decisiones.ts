// Decisiones abiertas que dejó el trabajo de Módulos (Turnos sin backend,
// Alquileres, Gimnasio, el alta única y la sección Módulos, 26/10/2026): cosas
// que no se destraban escribiendo código porque cambian algo de Tienda en
// producción, el color de marca o una cuenta. Las decide una persona (Ale o
// Mateo) y por eso no se "confirman": quedan abiertas hasta que se decidan, y
// entonces se pasan a entradas.ts como decisión tomada, con su porqué.
//
// Van en el módulo que tocan; lo que cruza módulos, en Gimnasio (el módulo de
// Ale), con el título "Transversal: …", como el resto de lo transversal.
//
// Formato del informe: el aviso de quién la decide, Propuesta, Por qué está
// abierta, De dónde sale y Archivos (`ruta:línea` desde la raíz del repo).

import type { ConPlan, Persona } from './plan'
import type { Entrada } from './entradas'

interface DatosDecision {
  modulo: ConPlan
  slug: string
  /** Quién la decide. */
  decide: Persona
  transversal?: boolean
  titulo: string
  /** Qué pasa, en una línea. */
  foco: string
  propuesta: string
  abierta: string
  origen: string
  archivos: string[]
}

export const avisoAbierta = (quien: Persona) => `> **Decisión abierta: la decide ${quien}.**`

function decisionAbierta(d: DatosDecision): Entrada {
  const informe = [
    avisoAbierta(d.decide),
    '## Propuesta', d.propuesta.trim(),
    '## Por qué está abierta', d.abierta.trim(),
    '## De dónde sale', d.origen.trim(),
    '## Archivos', d.archivos.map((a) => `- \`${a}\``).join('\n'),
  ].join('\n\n')
  return {
    key: `auditoria.${d.modulo}.2026-10-26-${d.slug}`,
    modulo: d.modulo,
    tipo: 'decisión',
    transversal: d.transversal ?? false,
    titulo: d.titulo,
    foco: d.foco,
    quien: d.decide,
    fecha: '2026-10-26',
    informe,
    abierta: true,
    origen: 'codigo',
    confirmada: null,
  }
}

export const DECISIONES: Entrada[] = [
  decisionAbierta({
    modulo: 'turnos', slug: 'turnos-depende-de-tienda', decide: 'Mateo',
    titulo: 'Turnos todavía usa piezas de Tienda y de la landing',
    foco: 'Desde antes de esta sesión, Turnos importa de Tienda el botón Volver, cargarFuentes y los campos del formulario de equipo (con los roles de Tienda), y su sección de rubros usa Reveal y Contacto de la landing. Ale pidió que cada módulo sea independiente.',
    propuesta: 'Mover Volver, cargarFuentes y los campos genéricos (Lbl, Err, Inp) al design system y que Tienda y Turnos los importen de ahí. Decidir aparte si Turnos usa los mismos roles que Tienda (RolRadios y el tipo Rol) o los suyos. La landing de Turnos puede seguir usando la landing: es marketing, no un módulo. Después, sumar `ventas` a la regla de eslint de Turnos (`apps/web/eslint.config.mjs`).',
    abierta: 'Mover esas piezas toca el panel de Tienda, que está en producción, y lo de los roles es una decisión de producto.',
    origen: 'Revisión de imports del 26/10/2026, al escribir la regla de eslint que separa los módulos.',
    archivos: [
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:14-15',
      'apps/web/src/modules/turnos/admin/InvitarPersona.tsx:16-17',
      'apps/web/src/modules/turnos/storefront/SitioNegocio.tsx:23',
      'apps/web/src/modules/turnos/landing/RubrosTurnos.tsx:18-19',
      'apps/web/eslint.config.mjs:32-46',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'alta-estados-planos', decide: 'Ale', transversal: true,
    titulo: 'Transversal: alta real, ¿se aplanan los estados elegidos de los pasos?',
    foco: 'Las tarjetas de módulo y el kit de reservas ya son planos, pero dentro de los pasos del alta lo elegido (rubro, días, estaciones del arco) sigue con degradado y brillo, también en el alta de Tienda que está en producción.',
    propuesta: 'Aplanarlos con el acento, igual que las tarjetas de módulo: borde y velo del color, ícono lleno, sin degradado ni brillo. Hacerlo en un cambio aparte del alta real, con su QA a 390, 768 y 1280.',
    abierta: 'Cambia cómo se ve el alta real de Tienda, que hoy cobra: es una decisión de diseño de producción, no un arreglo.',
    origen: 'QA del alta única (commit 88a99): los estados elegidos de los pasos.',
    archivos: [
      'apps/web/src/modules/onboarding/alta/estilo.ts:52',
      'apps/web/src/modules/onboarding/alta/estilo.ts:144',
      'apps/web/src/modules/onboarding/alta/estilo.ts:253',
      'apps/web/src/modules/onboarding/alta/estilo.ts:280',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'primario-contraste', decide: 'Ale', transversal: true,
    titulo: 'Transversal: azul primario, el texto blanco sobre él no llega a AA (3,68:1)',
    foco: 'El primario del modo claro (#3B82F6) con texto blanco da 3,68:1 y la norma pide 4,5:1. Lo usan todos los botones primarios del panel, Tienda incluida, y los de Módulos.',
    propuesta: 'Oscurecer el primario del modo claro a #2563EB (5,17:1 con blanco) y su hover a #1D4ED8, en `apps/web/src/styles/globals.css`, y revisar en la misma tanda el panel de Tienda, la landing y los módulos. El modo oscuro ya usa texto oscuro sobre el primario.',
    abierta: 'Es el color de marca y cambia el aspecto de toda la app: lo decide Ale.',
    origen: 'QA de Módulos, Alquileres y Gimnasio (26/10/2026).',
    archivos: [
      'apps/web/src/styles/globals.css:37',
      'apps/web/src/styles/globals.css:61',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'csp-mapa-osm', decide: 'Ale', transversal: true,
    titulo: 'Transversal: la CSP bloquearía el mapa de OpenStreetMap de los sitios de reservas',
    foco: 'La CSP tiene `frame-src \'self\'` en modo solo reporte, y los sitios de Alquileres y Gimnasio muestran la ubicación con un iframe de openstreetmap.org. Hoy solo avisa en la consola.',
    propuesta: 'Antes de pasar la CSP a bloqueante, sumar `https://www.openstreetmap.org` a `frame-src`, o cambiar el iframe por el mapa de Leaflet que ya usa el alta, que no necesita iframe. No apura: hoy las demos dan 404 en producción.',
    abierta: 'Depende de cuándo se pase la CSP a bloqueante y de si esos sitios salen a producción.',
    origen: 'QA de Alquileres, Gimnasio y el alta (26/10/2026).',
    archivos: [
      'apps/web/src/lib/csp.ts:158',
      'apps/web/src/modules/alquileres/storefront/Sitio.tsx:269',
      'apps/web/src/modules/gimnasio/storefront/Sitio.tsx:226',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'toques-44-compartidos', decide: 'Ale', transversal: true,
    titulo: 'Transversal: tira de chips y botón Volver de 38 y 42 px en celular (compartidos con Tienda)',
    foco: 'Las pautas de la QA piden 44 px para tocar. `.ds-tira-chip` mide 38 px y el botón Volver (`.ds-volver`) 42 px; los dos son del estándar de celular que comparten el panel de Tienda y Turnos. Los botones de zoom del mapa del alta (MapPicker, también de Tienda) miden 30 px.',
    propuesta: 'Subir los tres a 44 px en celular (en `apps/web/src/styles/globals.css` y en el MapPicker) y revisar el panel de Tienda a 390 en la misma tanda.',
    abierta: 'Cambia pantallas de Tienda que están en producción.',
    origen: 'QA de Turnos, Alquileres y el alta (26/10/2026).',
    archivos: [
      'apps/web/src/styles/globals.css:915-921',
      'apps/web/src/modules/ventas/panel/_shared/Volver.tsx:42',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'cuenta-superadmin-mateo', decide: 'Ale', transversal: true,
    titulo: 'Transversal: Mateo no tiene cuenta personal en el superadmin',
    foco: 'En la base de desarrollo están Alan Vega y las cuentas por cargo (CEO, CTO, CPO, RM), pero Mateo no tiene cuenta propia. Módulos ya no la necesita (los responsables van por nombre), pero para el resto del superadmin entra con la cuenta CEO.',
    propuesta: 'Crearle la cuenta desde Superadmin → Admins → "Nuevo admin" con su email de Google: entra con Google, le llega el código por mail y no hace falta contraseña.',
    abierta: 'Crear cuentas lo decide Ale; el pedido fue avisar y no crearlas. Producción no se revisó.',
    origen: 'Verificación de cuentas del 26/10/2026, solo lectura en la base de desarrollo.',
    archivos: [
      'apps/api/src/platform/platform.service.ts:825',
    ],
  }),
]
