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
  /** AAAA-MM-DD en que se abrió (va en la key). Las de la sesión del 26/10 no lo dicen. */
  fecha?: string
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
  const fecha = d.fecha ?? '2026-10-26'
  const informe = [
    avisoAbierta(d.decide),
    '## Propuesta', d.propuesta.trim(),
    '## Por qué está abierta', d.abierta.trim(),
    '## De dónde sale', d.origen.trim(),
    '## Archivos', d.archivos.map((a) => `- \`${a}\``).join('\n'),
  ].join('\n\n')
  return {
    key: `auditoria.${d.modulo}.${fecha}-${d.slug}`,
    modulo: d.modulo,
    tipo: 'decisión',
    transversal: d.transversal ?? false,
    titulo: d.titulo,
    foco: d.foco,
    quien: d.decide,
    fecha,
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
    foco: 'Al 26/10 Turnos importaba de Tienda el botón Volver, cargarFuentes y los campos del formulario de equipo (con los roles de Tienda), y su sección de rubros usa Reveal y Contacto de la landing. El rediseño del 27/10 sacó del panel los imports de Tienda (Avanzado e Invitar usan el kit y los roles propios de Turnos); queda cargarFuentes en el sitio público y la landing. Ale pidió que cada módulo sea independiente.',
    propuesta: 'Lo que queda: mover cargarFuentes (las fuentes de las plantillas) al design system y que Tienda y el sitio de Turnos lo importen de ahí. La landing de Turnos puede seguir usando la landing: es marketing, no un módulo. Después, sumar `ventas` a la regla de eslint de Turnos (`apps/web/eslint.config.mjs`), como ya tienen Alquileres y Gimnasio.',
    abierta: 'Mover cargarFuentes toca las plantillas de Tienda, que están en producción.',
    origen: 'Revisión de imports del 26/10/2026, al escribir la regla de eslint que separa los módulos; actualizada el 27/10 con el rediseño del panel de Turnos (commit 6d526), que dejó el panel sin imports de Tienda.',
    archivos: [
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

  // ─── Del rediseño de los paneles (27/10/2026) ───────────────────────────────
  decisionAbierta({
    modulo: 'gimnasio', slug: 'pedidos-del-kit-sin-tomar', decide: 'Ale', transversal: true, fecha: '2026-10-27',
    titulo: 'Transversal: pedidos del kit que quedaron sin tomar',
    foco: 'Lo que Alquileres, Gimnasio y Turnos le pidieron al kit design-system/reservas y el 27/10 no se tomó. El 03/11 se tomaron el Kpi, la barra de guardar y la cabecera del Modal (puntos 1, 2 y 6, ver la entrada "el kit toma el Kpi…"); quedan el toque de 44 de la llave en el medidor común, la tira de chips de 38 px de globals.css, la vista previa de mensajes (WhatsApp o chat neutro), el gris sobre primary-bg y el celular de vista previa.',
    propuesta: `1. ~~**\`Kpi\` con ícono y variación** en el kit~~ **Hecho el 03/11** (entrada "Transversal: el kit toma el Kpi con variación…"): \`Kpi\` con \`Icon?\`, \`tono?\` y \`delta?\` en \`piezas.tsx\`; se borraron \`Kpi\` de Alquileres, \`KpiGym\` de Gimnasio e \`Indicador\` de Turnos.
2. ~~**Barra de guardar y borrador** en el kit~~ **Hecho el 03/11:** \`useBorrador\` y \`BarraGuardar\` con \`motivo\` (la versión de Gimnasio) en el kit; Alquileres y Turnos migraron.
3. **El toque de 44 de la llave \`rv-switch\`:** no tocar el kit (el \`::before\` con \`inset: -10px -6px\` ya da 54×44, verificado el 27/10) y que el medidor común de la QA (\`pw/superadmin/visual.cjs\`, en el scratchpad) cuente el pseudo-elemento, como ya hace el de Gimnasio; si se prefiere una caja real de 44, es un \`min-height: 44px\` con el visual adentro.
4. **\`.ds-tira-chip\` de 38 px en celular:** es global de Tienda (\`globals.css\`) y no se toca en esta rama; mientras tanto los filtros de Alumnos usan \`.gso-chip\` de 44 px con el mismo aspecto. Entra en la decisión abierta "Tira de chips y botón Volver de 38 y 42 px".
5. **Vista previa de mensajes:** Gimnasio la muestra como WhatsApp (verde) y Alquileres y Turnos como un chat neutro con los colores del panel. Unificar en una pieza del kit (Alan y Mateo proponen la neutra; Ale decide cuál) o dejar las dos.
6. ~~**La cabecera del \`Modal\` del kit estira su primer \`div\`**~~ **Hecho el 03/11:** estira solo \`.rv-modal-cab-txt\`; Turnos borró su Modal propio y usa el del kit (que sumó \`onEnviar\`, \`encima\` y \`foco\`).
7. **\`--color-muted\` sobre \`--color-primary-bg\` da 4,37:1:** Turnos pasa esos textos a \`--color-body\` y el kit ya dejó escrito en \`estilo.tsx\` qué tokens sirven para texto (da07e). La alternativa es subir un punto \`--color-muted\` en claro (#5B6B82 da 4,6:1 sobre #EFF6FF), pero eso es \`globals.css\`, de Tienda.
8. **Un celular de vista previa compartido:** el \`VistaCliente\` de Avanzado de Turnos (marco plano, pantalla con las variables \`--color-*\` del tema) no sabe de turnos; Apariencia tiene otro con iframe. Si el kit quiere un "celular", ese es el candidato.`,
    abierta: 'Quedan el tercero y el cuarto, que tocan la herramienta de QA y globals.css de Tienda, que está en producción; el quinto, una decisión de diseño entre dos criterios defendibles; el séptimo, que cambia un token de toda la app; y el octavo, API del kit que conviene decidir una vez. El primero, el segundo y el sexto se tomaron el 03/11.',
    origen: 'pedidos-kit-alquileres.md, pedidos-kit-gimnasio.md y pedidos-kit-turnos.md (26 y 27/10/2026, en el scratchpad de la sesión); el kit tomó el resto el 27/10 (entrada "El kit toma lo que pidieron los módulos", commits f1623 y da07e).',
    archivos: [
      'apps/web/src/design-system/reservas/piezas.tsx:313',
      'apps/web/src/design-system/reservas/piezas.tsx:283',
      'apps/web/src/design-system/reservas/piezas.tsx:185',
      'apps/web/src/design-system/reservas/estilo.tsx:278',
      'apps/web/src/styles/globals.css:915',
      'apps/web/src/modules/gimnasio/admin/Socios.tsx:51',
      'apps/web/src/modules/gimnasio/admin/configuracion/Mensajes.tsx:37',
      'apps/web/src/modules/alquileres/admin/configuracion/comun.tsx:58',
      'apps/web/src/modules/turnos/admin/configuracion/Mensajes.tsx:53',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:56-57',
      'apps/web/src/modules/turnos/admin/avanzado/ui.tsx:80-81',
    ],
  }),

  // ─── Del backend compartido de reservas (03/11/2026) ─────────────────────────
  decisionAbierta({
    modulo: 'gimnasio', slug: 'backend-compartido-pendientes', decide: 'Ale', transversal: true, fecha: '2026-11-03',
    titulo: 'Transversal: lo que el backend compartido de reservas deja para decidir',
    foco: 'El motor de reservas está hecho y probado, pero seis cosas tocan plata, producción o el alta real y las decide Ale: cobrar la seña online, devolverla sola, avisar por WhatsApp, cuándo mandar el recordatorio, habilitar los módulos en el alta real y desplegar.',
    propuesta: `1. **Cobro online de la seña con Mercado Pago.** Hoy el panel registra pagos a mano (\`POST /reservas/:id/pago\`). Propuesta: al confirmar desde el sitio, si el negocio tiene MP conectado y \`senaPorcentaje > 0\`, crear una preferencia por la seña y dejar la reserva PENDIENTE hasta el webhook, como hace el checkout de Tienda; sin MP conectado, como hoy.
2. **Devolución automática al cancelar a tiempo.** Hoy "DEVUELTA" es un aviso al negocio (lo devuelve a mano). Propuesta: reembolso por la API de MP como hace Cancelaciones de Tienda, solo para lo cobrado por MP.
3. **WhatsApp.** Solo email. Propuesta: cuando los negocios de reservas tengan WhatsApp conectado (el de Orbi), mandar confirmación y cancelación por ahí con plantillas; mientras tanto, el panel arma el texto y abre wa.me.
4. **El recordatorio del día anterior.** Propuesta: colgarlo del cron de las 22 h (sale entre 2 y 26 horas antes). La opción "a las X horas exactas" necesita un job más de Cloud Scheduler (US$0,10/mes).
5. **Habilitar Turnos, Alquileres y Gimnasio en el alta real.** Siguen como "Próximamente" (\`MODULOS_PROXIMAMENTE\`). Hace falta que el alta cree la config del módulo (\`PUT /reservas/config\`) y sus recursos, y que cada módulo esté conectado al backend. Propuesta: después de que los tres planes cierren sus tareas de conexión.
6. **Desplegar.** La migración \`20261103120000_reservas\` está aplicada en dev; en producción no. Propuesta: cuando Ale diga, \`prisma-prod.sh migrate deploy\` y \`deploy.sh\` desde \`main\` con CI verde (o \`staging.sh\` antes para probarlo en caudaliguazu.com.ar). Las rutas nuevas no afectan a Tienda: son tablas y endpoints que nadie llama hasta que un módulo se conecte.`,
    abierta: 'Las dos primeras mueven plata de los clientes; la tercera y la cuarta cuestan (WhatsApp, un job de Cloud Scheduler); la quinta abre un cobro nuevo en el alta real; la sexta es un deploy a producción. Ninguna se destraba escribiendo código.',
    origen: 'Sesión del 03/11/2026, al terminar el backend compartido (entrada "Transversal: el backend compartido de reservas").',
    archivos: [
      'apps/api/src/reservas/README.md:129',
      'apps/api/src/reservas/reservas.service.ts:465',
      'apps/api/src/reservas/reservas-avisos.service.ts:18',
      'apps/web/src/modules/onboarding/alta/modelo.ts:67',
      'apps/api/prisma/migrations/20261103120000_reservas/migration.sql:1',
    ],
  }),

  decisionAbierta({
    modulo: 'gimnasio', slug: 'fondo-claro-ajustes', decide: 'Ale', transversal: true, fecha: '2026-11-03',
    titulo: 'Transversal: fondo claro de los paneles, ajustes que quedan a gusto de Ale',
    foco: 'El planeta como la landing ya está en los tres paneles en claro (entrada "el fondo claro de los paneles es el planeta…"); cinco detalles de gusto quedan para mirarlos en vivo: los cometas detrás del texto, la altura del horizonte, qué tan presentes van las estrellas, las bandas del resplandor y la franja de 40 px de la demo de Turnos.',
    propuesta: `1. **Cometas detrás del texto suelto.** Cruzan un instante por detrás del encabezado (como ya pasa en oscuro). Si molesta: apagarlos cerca del encabezado o acotarlos al tercio superior del cielo.
2. **Altura del horizonte.** Quedó como en la landing: el ápice al 72 % de la caja de \`<main>\` (86 % en celular). Alternativa: más abajo (~80 %) para ver más cielo y menos planeta.
3. **Estrellas.** Blancas y muy sutiles sobre el celeste, a propósito. Más presentes = un toque azul, con el riesgo del "polvo" que ya se descartó.
4. **Resplandor del horizonte.** Va en las seis bandas de la landing; en claro los escalones se notan un poco. Alternativa: más bandas (más suave) a costa de un par de trazos más por cuadro.
5. **La franja de 40 px de la demo de Turnos.** El armazón reserva \`--rv-tope\` para la tira de la demo, pero la demo de Turnos no la muestra: a 1280 queda una franja blanca abajo (ya pasaba antes del fondo nuevo). Alternativa: que Turnos muestre su BarraDemo como Alquileres y Gimnasio, o que el armazón reciba el tope como prop.`,
    abierta: 'Son de gusto y se deciden mirando los paneles en vivo (localhost, los tres en claro): ninguna tiene una respuesta técnica mejor que otra.',
    origen: 'QA del fondo claro del 03/11/2026 (capturas y contraste en el scratchpad de la sesión; las finales en la entrada).',
    archivos: [
      'apps/web/src/design-system/EscenaEspacial.tsx:234',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:529',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:63',
    ],
  }),
]
