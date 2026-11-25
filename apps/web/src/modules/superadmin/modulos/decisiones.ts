// Decisiones abiertas que dejó el trabajo de Módulos (Turnos sin backend,
// Alquileres, Gimnasio, el alta única y la sección Módulos, 26/10/2026): cosas
// que no se destraban escribiendo código porque cambian algo de Tienda en
// producción, el color de marca, una cuenta o el alcance de un módulo. No se
// "confirman": quedan abiertas hasta que se decidan, y entonces se pasan a
// entradas.ts como decisión tomada, con su porqué.
//
// Quién decide (pedido de Ale, 04/11/2026: "cada uno decide su módulo como
// piense"): el responsable del módulo (Mateo en Turnos, Alan en Alquileres, Ale
// en Gimnasio); lo que toca plata, producción de Tienda o a los tres módulos a
// la vez, Ale. El responsable escribe su respuesta en la tarjeta de Auditoría
// (queda en su navegador) y la copia para Claude, que la registra acá como
// decisión tomada.
//
// Van en el módulo que tocan; lo que cruza módulos, en Gimnasio (el módulo de
// Ale), con el título "Transversal: …", como el resto de lo transversal.
//
// Formato del informe: el aviso de quién la decide, Qué hay que decidir (en
// simple), Alcance (hasta dónde llega), Propuesta, Por qué está abierta, De
// dónde sale y Archivos (`ruta:línea` desde la raíz del repo).

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
  /** Qué hay que decidir, en dos o tres frases simples. */
  simple: string
  /** Hasta dónde llega lo que se decide: qué toca y qué queda afuera, y quién lo decide. */
  alcance: string
  propuesta: string
  abierta: string
  origen: string
  archivos: string[]
}

export const avisoAbierta = (quien: Persona) => `> **Decisión abierta: la decide ${quien}.** Escribí tu respuesta en la tarjeta y copiala para Claude: queda registrada en Auditoría como decisión tomada.`

function decisionAbierta(d: DatosDecision): Entrada {
  const fecha = d.fecha ?? '2026-10-26'
  const informe = [
    avisoAbierta(d.decide),
    '## Qué hay que decidir', d.simple.trim(),
    '## Alcance', d.alcance.trim(),
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
    simple: 'Turnos todavía usa `cargarFuentes` de Tienda en su sitio público y piezas de la landing en su sección de marketing. Hay que decidir si `cargarFuentes` se mueve al design system (y Tienda lo importa de ahí) o se deja como está, y si la landing de Turnos puede seguir usando la landing.',
    alcance: 'Solo Turnos y una función de Tienda (`cargarFuentes`, las fuentes de las plantillas). Moverla toca las plantillas de Tienda en producción: se coordina con Ale. No toca Alquileres ni Gimnasio. La decide Mateo.',
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
    simple: 'Dentro de los pasos del alta, lo elegido (rubro, días, estaciones del arco) tiene degradado y brillo; el resto del alta ya es plano. ¿Se aplana todo o se deja como está?',
    alcance: 'El alta real de los cuatro módulos, incluida la de Tienda que hoy cobra: es diseño de producción. Un cambio aparte, con QA a 390, 768 y 1280. La decide Ale.',
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
    simple: 'El azul de marca del modo claro (#3B82F6) con texto blanco no llega a AA. ¿Se oscurece a #2563EB en toda la app o se deja como está?',
    alcance: 'Todos los botones primarios del panel (Tienda incluida), la landing y los módulos: es el color de marca. La decide Ale.',
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
    simple: 'Cuando la CSP pase a bloquear, el mapa de OpenStreetMap (un iframe) de los sitios de Alquileres y Gimnasio dejaría de verse. ¿Se autoriza el iframe o se cambia por el mapa de Leaflet que ya usa el alta?',
    alcance: 'Los sitios de Alquileres y Gimnasio (Cómo llegar) y la política de seguridad de toda la web. La decide Ale cuando la CSP se vuelva bloqueante; Alan y Ale pueden adelantar el cambio a Leaflet en sus sitios cuando quieran.',
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
    simple: 'Dos piezas compartidas con Tienda miden menos de 44 px para tocar en celular (la tira de chips, 38; el botón Volver, 42). ¿Se suben a 44 en globals.css?',
    alcance: 'Pantallas del panel de Tienda en producción, además de los paneles de reservas. La decide Ale; mientras tanto cada módulo puede usar sus propias clases de 44 px (como hace Gimnasio).',
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
    simple: 'Mateo entra al superadmin con la cuenta del cargo (CEO) porque no tiene cuenta propia. ¿Se le crea?',
    alcance: 'Solo cuentas del superadmin (Admins). No afecta a Módulos, que va por nombre. La decide Ale.',
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
    simple: 'Quedan cinco pedidos de los módulos al kit compartido: el toque de 44 de la llave, la tira de chips de 38 px, la vista previa de mensajes (WhatsApp o chat neutro), el gris sobre primary-bg y un celular de vista previa común. Para cada uno: ¿va al kit, se resuelve en cada módulo o se descarta?',
    alcance: 'El kit `design-system/reservas` (les cambia a los tres) y, en dos puntos, globals.css de Tienda. La decide Ale; cada responsable dice en su respuesta qué prefiere para su módulo.',
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
    simple: 'El motor de reservas ya está en producción. Quedan cinco cosas por decidir: cobrar la seña online con Mercado Pago, devolverla sola al cancelar, avisar por WhatsApp, cuándo mandar el recordatorio y cuándo habilitar cada módulo en el alta real.',
    alcance: 'El backend compartido (`apps/api/src/reservas`) y los tres módulos a la vez; las dos primeras mueven plata de los clientes. La decide Ale; cada responsable dice en su respuesta qué necesita su módulo y cuándo.',
    foco: 'El motor de reservas está hecho y probado, pero cinco cosas tocan plata o el alta real y las decide Ale: cobrar la seña online, devolverla sola, avisar por WhatsApp, cuándo mandar el recordatorio y habilitar los módulos en el alta real. La sexta, desplegar, se decidió el 04/11.',
    propuesta: `1. **Cobro online de la seña con Mercado Pago.** Hoy el panel registra pagos a mano (\`POST /reservas/:id/pago\`). Propuesta: al confirmar desde el sitio, si el negocio tiene MP conectado y \`senaPorcentaje > 0\`, crear una preferencia por la seña y dejar la reserva PENDIENTE hasta el webhook, como hace el checkout de Tienda; sin MP conectado, como hoy.
2. **Devolución automática al cancelar a tiempo.** Hoy "DEVUELTA" es un aviso al negocio (lo devuelve a mano). Propuesta: reembolso por la API de MP como hace Cancelaciones de Tienda, solo para lo cobrado por MP.
3. **WhatsApp.** Solo email. Propuesta: cuando los negocios de reservas tengan WhatsApp conectado (el de Orbi), mandar confirmación y cancelación por ahí con plantillas; mientras tanto, el panel arma el texto y abre wa.me.
4. **El recordatorio del día anterior.** Propuesta: colgarlo del cron de las 22 h (sale entre 2 y 26 horas antes). La opción "a las X horas exactas" necesita un job más de Cloud Scheduler (US$0,10/mes).
5. **Habilitar Turnos, Alquileres y Gimnasio en el alta real.** Siguen como "Próximamente" (\`MODULOS_PROXIMAMENTE\`). Hace falta que el alta cree la config del módulo (\`PUT /reservas/config\`) y sus recursos, y que cada módulo esté conectado al backend. Propuesta: después de que los tres planes cierren sus tareas de conexión. Ale lo confirmó el 04/11: siguen en "Próximamente" mientras los módulos no estén conectados.
6. ~~**Desplegar.**~~ **Decidido el 04/11:** Ale mandó la rama entera a producción (entrada "todo a producción con los módulos en Próximamente…"): \`main\` en Vercel, la migración \`20261103120000_reservas\` con \`prisma-prod.sh migrate deploy\` y la API con \`deploy.sh\`. Las rutas nuevas no afectan a Tienda: son tablas y endpoints que nadie llama hasta que un módulo se conecte.`,
    abierta: 'Las dos primeras mueven plata de los clientes; la tercera y la cuarta cuestan (WhatsApp, un job de Cloud Scheduler); la quinta abre un cobro nuevo en el alta real. Ninguna se destraba escribiendo código. La sexta, desplegar, se tomó el 04/11.',
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
    simple: 'El fondo claro de los paneles ya está (el planeta de la landing). Quedan cinco ajustes de gusto: los cometas detrás del texto, la altura del horizonte, qué tan presentes van las estrellas, las bandas del resplandor y la franja de 40 px de la demo de Turnos.',
    alcance: 'El armazón compartido de los tres paneles (`LayoutPanel` y `EscenaEspacial`): un ajuste se ve en los tres. La decide Ale mirándolos en vivo.',
    foco: 'El planeta como la landing ya está en los tres paneles en claro (entrada "el fondo claro de los paneles es el planeta…"); cinco detalles de gusto quedan para mirarlos en vivo: los cometas detrás del texto, la altura del horizonte, qué tan presentes van las estrellas, las bandas del resplandor y la franja de 40 px de la demo de Turnos. El sexto, el fundido al cambiar de tema, se decidió el 04/11: va en todo Órbita.',
    propuesta: `1. **Cometas detrás del texto suelto.** Cruzan un instante por detrás del encabezado (como ya pasa en oscuro). Si molesta: apagarlos cerca del encabezado o acotarlos al tercio superior del cielo.
2. **Altura del horizonte.** Quedó como en la landing: el ápice al 72 % de la caja de \`<main>\` (86 % en celular). Alternativa: más abajo (~80 %) para ver más cielo y menos planeta.
3. **Estrellas.** Blancas y muy sutiles sobre el celeste, a propósito. Más presentes = un toque azul, con el riesgo del "polvo" que ya se descartó.
4. **Resplandor del horizonte.** Va en las seis bandas de la landing; en claro los escalones se notan un poco. Alternativa: más bandas (más suave) a costa de un par de trazos más por cuadro.
5. **La franja de 40 px de la demo de Turnos.** El armazón reserva \`--rv-tope\` para la tira de la demo, pero la demo de Turnos no la muestra: a 1280 queda una franja blanca abajo (ya pasaba antes del fondo nuevo). Alternativa: que Turnos muestre su BarraDemo como Alquileres y Gimnasio, o que el armazón reciba el tope como prop.
6. ~~**El fundido al cambiar de tema.**~~ **Decidido el 04/11:** Ale lo quiere en todo Órbita ("modo oscuro y claro para todo, tanto home y demás, con ese efecto"): lo toman el Header y Mi Perfil del panel de Tienda, el home (que recupera el modo claro), la tienda pública y la vista previa de Apariencia, con la dirección y los 640 ms tal como estaban (entrada "todo a producción con los módulos en Próximamente…").`,
    abierta: 'Son de gusto y se deciden mirando los paneles en vivo (localhost, los tres en claro): ninguna tiene una respuesta técnica mejor que otra. El sexto punto se tomó el 04/11.',
    origen: 'QA del fondo claro del 03/11/2026 (capturas y contraste en el scratchpad de la sesión; las finales en la entrada).',
    archivos: [
      'apps/web/src/design-system/EscenaEspacial.tsx:234',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:529',
      'apps/web/src/design-system/reservas/LayoutPanel.tsx:63',
      'apps/web/src/styles/globals.css:287',
      'apps/web/src/hooks/useDarkMode.ts:71',
    ],
  }),

  decisionAbierta({
    modulo: 'alquileres', slug: 'cosas-con-stock', decide: 'Alan', fecha: '2026-11-03',
    titulo: 'Alquileres: ¿un cuarto modo para alquilar cosas con stock (vehículos, equipos, mobiliario, disfraces)?',
    simple: 'Alquileres alquila lugares (canchas, salones, alojamiento). ¿Suma un cuarto modo para alquilar cosas con cantidad (kayaks, sillas, disfraces, vehículos), con stock y fechas de retiro y devolución, o queda para otro ciclo?',
    alcance: 'Solo Alquileres: datos, lib, panel, sitio y alta del módulo. El motor compartido ya tiene cupo por recurso, así que no hace falta tocar lo compartido. La decide Alan dentro de su ciclo.',
    foco: 'Hoy el módulo alquila lugares: por hora, por bloque (uno o varios salones) y por período (por noche o por mes). Lo que se alquila por unidad y con cantidad (10 kayaks, 50 sillas, 3 inflables, un vestido) no entra: necesita un artículo con stock, una reserva con cantidad y fechas de retiro y devolución.',
    propuesta: `**Modo "cosas":** un artículo con stock (cuántos hay), precio por día o por evento, depósito y retiro en el lugar o entrega; la reserva pide fecha de retiro, fecha de devolución y cantidad, y la disponibilidad es "cuántos quedan ese día" (stock menos lo reservado), no "libre u ocupado". El backend compartido ya tiene cupo por recurso (las clases de Gimnasio lo usan) y una reserva ocupa lugares del cupo: un artículo es un recurso con cupo igual al stock y la reserva de 3 kayaks ocupa 3, así que el motor no cambia; faltan la tarifa por día o por evento (como la mensual) y las pantallas: Artículos, Entregas y devoluciones del día, y el sitio con cantidad. Rubros que entrarían: autos, motos y bicis; kayaks y tablas; inflables, mobiliario y vajilla para eventos; sonido y luces; vestidos y disfraces; herramientas y máquinas; equipos de fotografía.

Alternativas: dejarlo para después del ciclo (los 19 rubros ya cubren lugares y alojamiento), o entrar solo con "por día y con stock", sin entrega a domicilio.`,
    abierta: 'Es alcance: un modo nuevo cruza datos, lib, panel, sitio, alta y backend (unos cuatro o cinco días de trabajo), y Alan tiene el ciclo lleno con los tres modos.',
    origen: 'Pedido de Ale del 03/11/2026 ("un montón de cosas") al revisar las demos; la sesión resolvió salones múltiples, por mes y Qué hay libre (entrada "varios salones por negocio, alojamiento por mes…") y dejó esto abierto.',
    archivos: [
      'apps/web/src/modules/alquileres/datos/index.ts:40',
      'apps/web/src/lib/reservas/estadia.ts:161',
      'apps/api/prisma/schema.prisma:3901',
    ],
  }),

  // ─── De la revisión de Gimnasio sobre la API (16/11/2026): las reglas del ciclo ──
  decisionAbierta({
    modulo: 'gimnasio', slug: 'como-entra-un-cambio-a-lo-compartido', decide: 'Ale', transversal: true, fecha: '2026-11-16',
    titulo: 'Transversal: cómo entra un cambio a lo compartido (hoy se avisa de palabra)',
    foco: 'Entre el 16 y el 24/11 el motor compartido cambió por dos lados sin que el otro lo supiera: Alan le sumó el precio de la estadía, el campo datos y un permiso, y los arreglos de Gimnasio esperaban sin subir. No chocaron de casualidad.',
    simple: 'La regla dice "antes de tocar lo compartido, avisá a los otros dos". No dice cómo, y no deja rastro. ¿Alcanza con eso, o un cambio a las carpetas compartidas tiene que pasar por un pull request que mire uno de los otros dos antes de llegar a main?',
    alcance: 'Las cinco carpetas de "Lo compartido" (el motor, su cliente, las cuentas, el kit y el vocabulario del manual). No cambia cómo trabaja cada uno adentro de su módulo ni cómo se despliega la API. La decide Ale.',
    propuesta: `1. **Un pull request por cambio compartido.** Lo que toque una de las cinco carpetas va en una rama propia y en un pull request a \`main\`, con lo que cambia del contrato y lo que tienen que mirar los otros módulos (lo mismo que hoy se escribe después, en la entrada transversal).
2. **Lo mira uno de los otros dos.** Alcanza con un "visto": la idea es que se entere antes, no frenar el trabajo. Un archivo \`CODEOWNERS\` con las cinco carpetas hace que GitHub lo pida solo.
3. **Se junta con "Squash and merge".** Vercel construye cada commit una sola vez: si la rama se sube y después \`main\` avanza al mismo commit, producción queda vieja (es la regla de "se pushea solo main"). Con squash, \`main\` recibe un commit nuevo y ese problema no aparece.
4. **Lo que es de un solo módulo sigue como hoy:** directo a \`main\`, sin pull request.

**Alternativas:** seguir como hoy (avisar de palabra y la entrada transversal después); o un canal fijo donde se avisa antes de tocar, sin pull request.`,
    abierta: 'Cambia cómo trabajan los tres y suma un paso antes de cada cambio compartido: es una regla del equipo.',
    origen: 'La revisión del 16/11 (Ale pidió mirar también las reglas) y lo que pasó al traer main el 24/11: seis archivos con conflicto, dos de ellos del motor y de su cliente.',
    archivos: [
      'apps/web/src/modules/superadmin/modulos/compartido.ts:29',
      'apps/web/src/modules/superadmin/modulos/reglas.ts:35',
      'apps/api/src/reservas/README.md:1',
    ],
  }),
  decisionAbierta({
    modulo: 'gimnasio', slug: 'el-manual-como-ayuda-en-el-panel', decide: 'Ale', transversal: true, fecha: '2026-11-16',
    titulo: 'Transversal: el manual de cada módulo, ¿también como Ayuda dentro de su panel?',
    foco: 'Cada módulo escribe su manual para Orbi, pero los módulos no usan Orbi: hoy ese texto no lo lee nadie. Gimnasio ya tiene nueve temas escritos y probados contra sus pantallas.',
    simple: 'El manual de cada módulo se mantiene al día (un test falla si nombra un botón que no existe), pero se guarda para "cuando se decida usar Orbi". ¿Se muestra mientras tanto como una sección Ayuda del panel? Es solo texto: no usa inteligencia artificial y no cuesta nada.',
    alcance: 'Los paneles de los tres módulos y el kit (una pieza que dibuje los bloques del manual). No toca Orbi ni el panel de Tienda, que ya tiene su Manual. Cada responsable decide si la suma a su panel; la pieza compartida la decide Ale.',
    propuesta: `1. **Una pieza del kit** que dibuja el manual de un módulo (capítulos, temas, pasos, notas), con un buscador.
2. **Cada panel suma "Ayuda"** al final de su barra lateral, cuando su responsable quiera.
3. **Sin inteligencia artificial:** es el mismo texto que ya se escribe para Orbi, mostrado tal cual.

**Alternativa:** dejarlo solo para Orbi hasta que se decida si los módulos lo usan.`,
    abierta: 'Suma una sección a los tres paneles y una pieza al kit: es producto, no un arreglo.',
    origen: 'La revisión del 16/11: el manual de Gimnasio se corrige con cada cambio de pantalla y hoy no tiene lector.',
    archivos: [
      'apps/web/src/lib/manual/modulos.ts:1',
      'apps/web/src/modules/gimnasio/manual.ts:16',
      'apps/web/src/modules/orbi/manual/artefacto.ts:23',
    ],
  }),
  decisionAbierta({
    modulo: 'gimnasio', slug: 'las-demos-en-produccion', decide: 'Ale', transversal: true, fecha: '2026-11-16',
    titulo: 'Transversal: las demos de los módulos en producción, cada una a su manera',
    foco: 'Desde el 23/11 la demo de Alquileres se ve en orbita.site con sesión de superadmin; las de Gimnasio y Turnos siguen dando 404 en producción. Para mostrar Gimnasio hoy hace falta una computadora con el proyecto levantado.',
    simple: '¿La demo de Gimnasio (y la de Turnos) se abre en producción igual que la de Alquileres, solo para el equipo, o siguen cerradas hasta que el módulo salga de "Próximamente"?',
    alcance: 'Las páginas de /gimnasio-demo (Ale) y de /turnos-demo (Mateo). No abre nada al público: piden sesión de superadmin y no aparecen en buscadores. No cambia el alta, donde los tres módulos siguen en "Próximamente".',
    propuesta: `1. **La compuerta que hizo Alan** (en producción pide sesión de superadmin; en desarrollo, nada) pasa a lo compartido, para no escribirla tres veces.
2. **Gimnasio la usa en sus seis páginas,** con un test que falla si una página nueva no pasa por la compuerta, como el de Alquileres.
3. **Turnos,** cuando Mateo lo decida.

**Alternativas:** dejarlas en 404 hasta la salida de "Próximamente"; o abrirlas solo en staging.`,
    abierta: 'Es mostrar en producción pantallas de un módulo que todavía no salió, aunque sea solo para el equipo, y la pieza compartida toca a los tres.',
    origen: 'Al traer main el 24/11: Alan abrió su demo el 23/11 (entrada "La demo de Alquileres se puede ver en producción, solo como superadmin") y las otras dos quedaron distintas.',
    archivos: [
      'apps/web/src/modules/alquileres/demo/SoloEquipo.tsx:14',
      'apps/web/src/pages/gimnasio-demo/panel.tsx:18',
    ],
  }),
  decisionAbierta({
    modulo: 'gimnasio', slug: 'los-ids-de-las-tareas-del-plan', decide: 'Ale', transversal: true, fecha: '2026-11-16',
    titulo: 'Transversal: las tareas del plan se identifican por su posición',
    foco: 'Lo que cada uno tilda en su navegador se guarda con el número de orden de la tarea (t1, t2…). Si una tarea se suma o se saca en el medio, todo lo tildado después queda apuntando a otra tarea, sin aviso.',
    simple: '¿Las tareas pasan a tener un id propio, que no cambie aunque se muevan, o se mantiene la regla de "sumar siempre al final"?',
    alcance: 'El plan de Módulos (plan.ts) y lo que guarda cada navegador (estado.ts). No cambia las tareas ni las fechas. La decide Ale.',
    propuesta: `1. **Cada tarea lleva un id escrito a mano,** corto, en vez de su número de orden.
2. **Lo tildado hasta hoy se pasa una vez** al id nuevo, en cada navegador, al abrir Módulos.
3. **El test** que hoy exige t1, t2… pasa a exigir ids únicos.

**Alternativa:** dejarlo como está. La regla de sumar al final ya está escrita y los dos merges de noviembre la respetaron.`,
    abierta: 'Toca el plan de los tres y lo que cada uno ya tildó en su navegador; no es urgente y tiene un costo de migración.',
    origen: 'La revisión del 16/11 y los merges del 16 y del 24/11, donde hubo que cuidar a mano el orden de las tareas que sumó cada rama.',
    archivos: [
      'apps/web/src/modules/superadmin/modulos/plan.ts:42',
      'apps/web/src/modules/superadmin/modulos/estado.ts:39',
    ],
  }),

  // ─── Del arranque de Alquileres sobre el backend (18/11/2026) ───────────────
  decisionAbierta({
    modulo: 'gimnasio', slug: 'lo-que-alquileres-pide-al-backend', decide: 'Ale', transversal: true, fecha: '2026-11-18',
    titulo: 'Transversal: lo que Alquileres le pide al backend compartido, y cómo se reordena su plan',
    simple: 'Para llevar Alquileres al motor de reservas hacen falta cambios en lo compartido (el precio en el servidor, un campo libre en la reserva y en la config, calendarios externos, permisos), y la estadía suma cosas que no están en el plan (Airbnb, Google Maps, seña online, estadísticas). Además, el plan de Alquileres va casi dos semanas atrasado.',
    alcance: 'El backend compartido (`apps/api/src/reservas`, el schema y `lib/reservasApi`) y el plan de Alquileres en Módulos. Varias piezas las necesita también Turnos (campo libre en la config, clientes, Mis reservas). La decide Ale; Alan dice qué necesita y cuándo.',
    foco: 'Alquileres terminó su arranque el 18/11 (mapa, capa de datos, negocios de prueba). Para seguir con canchas, salones y estadía necesita decisiones sobre el motor compartido y sobre el plan.',
    propuesta: `En orden de importancia (el detalle de cada una está en \`docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md\`, § 6 y § 9):

1. **Reordenar el plan:** comprimir canchas (23 al 27/11), salones (30/11 al 04/12) y estadía (07 al 11/12, con la sincronización de Airbnb real), el sitio (14 al 18/12) y lo demás del 21 al 23/12. Quedan afuera del ciclo la QA completa, el alquiler por mes, la seña online, el CSV de Airbnb, Google Maps y las estadísticas por canal.
2. **Sumar lo nuevo de la estadía** (entrada de Alquileres del 18/11) en un ciclo 3, salvo la sincronización de Airbnb, que reemplaza la pantalla simulada de Calendarios.
3. **El precio en el servidor:** precios por horario, temporadas, fin de semana, limpieza y por mes, en \`dominio/precio.ts\`, con los mismos tests que \`lib/reservas\`.
4. **Un \`datos\` JSON en \`Reserva\` y en \`ReservaConfig\`:** dos migraciones chicas (el evento, los huéspedes, el canal y el depósito; los mensajes y las formas de pago). Turnos pide lo mismo para la config.
5. **Calendarios externos:** una tabla nueva, \`origen\` y \`calendario_id\` en los bloqueos, una ruta pública con token para exportar y la sincronización colgada del job de cada 5 minutos.
6. **Seña online:** el diseño propone dejar la reserva retenida (y no pendiente, como dice la decisión del 03/11) hasta el pago, porque una pendiente no vence; y una tabla de pagos de reservas para devolver y no cobrar dos veces.
7. **Los bloqueos con el permiso \`reservas.manage\`** y no \`config\`, para que un encargado pueda cerrar un día.
8. **Google Business Profile como pieza común de Órbita** y pedir ya el acceso a Google (tarda unas dos semanas). Hay que saber si Órbita tiene una ficha verificada con 60 días o más y desde qué cuenta se pide.
9. **Las rutas de producción** de los tres módulos de reservas, con responsable y fecha: sin ellas el sitio no reserva de verdad. Tienen que estar antes del 14/12.`,
    abierta: 'Casi todas tocan el motor que comparten los tres módulos o mueven plata, y la primera cambia el plan del ciclo, que armó Ale. Ninguna se destraba escribiendo código.',
    origen: 'Sesión del 18/11/2026: el arranque de Alquileres (entradas "el mapa de Alquileres sobre el backend…" y "la estadía apunta al dueño chico…").',
    archivos: [
      'apps/api/src/reservas/dominio/precio.ts:1',
      'apps/api/prisma/schema.prisma:3784',
      'apps/api/src/reservas/reservas-panel.controller.ts:22',
      'apps/web/src/modules/superadmin/modulos/plan.ts:187',
    ],
  }),
  // ─── De la revisión de los planes y del sitio de Gimnasio (25/11/2026) ──────
  decisionAbierta({
    modulo: 'gimnasio', slug: 'el-rubro-que-decide-el-sitio-se-escribe-a-mano', decide: 'Ale', transversal: true, fecha: '2026-11-25',
    titulo: 'Transversal: el rubro que decide qué sitio y qué panel ve un negocio se puede escribir a mano',
    simple: 'El rubro principal del negocio (`industry`) decide dos cosas: qué muestra `<slug>.orbita.site` (su tienda o su sitio de reservas) y a dónde lleva `/panel`. En Tienda, Configuración → Información del negocio tiene "Rubro (opcional)", un texto libre que guarda en ese mismo campo. Hay que decidir cómo se evita que una tienda cambie de sitio y de panel por escribir una palabra.',
    alcance: 'La Configuración de Tienda en producción (el campo "Rubro (opcional)"), la API que lo guarda y `lib/reservas/destinoPanel.ts`, que comparten los módulos. Toca a Tienda y a los tres módulos: la decide Ale. A Alan le cambia cómo se reconoce un negocio de Alquileres.',
    foco: 'Un negocio ve su tienda o su sitio de reservas según su rubro principal. Ese mismo dato lo puede cambiar el dueño de una tienda desde su Configuración, en un campo de texto libre: si escribe "alquileres", deja de ver su tienda y su panel.',
    propuesta: `Lo que ya está hecho: **Gimnasio pide dos cosas** para mostrar su sitio, el rubro "gimnasio" y un subrubro de Gimnasio (\`esDeGimnasio\`). Una tienda que escriba "gimnasio" en ese campo sigue viendo su tienda, porque sus subrubros son los de Tienda. Tiene su test.

Lo que falta decidir, en orden de preferencia:

1. **Que el campo de Tienda no guarde en \`industry\`.** "Rubro (opcional)" pasa a ser un texto propio de la tienda, o se saca: el rubro ya se elige en el alta, con sus subrubros. Corta el problema de raíz, para los tres módulos y para los que vengan.
2. **Mientras tanto, que Alquileres pida también su subrubro**, como Gimnasio. Es un cambio chico en \`destinoPanel.ts\`, con su test. Lo hace Alan, o Ale avisándole.
3. **En la API, no aceptar como rubro de una tienda las claves de los módulos** ("turnos", "alquileres", "gimnasio") al guardar la configuración.

No se sabe de ninguna tienda en producción con ese valor: es un riesgo, no algo que haya pasado. Se puede mirar en Superadmin → Negocios, que muestra el rubro de cada uno.`,
    abierta: 'Cambia una pantalla de Tienda en producción y cómo se reconoce a los negocios de los tres módulos. No se destraba con código de Gimnasio solo.',
    origen: 'Sesión del 25/11/2026: al sumar el sitio de Gimnasio a las rutas del sitio de un negocio (entrada "cómo viene cada plan…").',
    archivos: [
      'apps/web/src/lib/reservas/destinoPanel.ts:33',
      'apps/web/src/modules/ventas/panel/configuracion/components/general/SeccionNegocio.tsx:90',
      'apps/web/src/pages/tienda/[slug]/index.tsx:19',
      'apps/web/src/pages/panel/index.tsx:38',
      'apps/web/src/lib/storefront/forceSSR.ts:347',
    ],
  }),
]
