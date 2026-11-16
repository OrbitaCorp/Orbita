---
paths:
  - "apps/web/src/modules/turnos/**"
  - "apps/web/src/modules/alquileres/**"
  - "apps/web/src/modules/gimnasio/**"
  - "apps/web/src/modules/onboarding/alta/**"
  - "apps/web/src/modules/superadmin/modulos/**"
  - "apps/web/src/lib/reservas/**"
  - "apps/web/src/lib/reservasApi/**"
  - "apps/web/src/design-system/reservas/**"
  - "apps/api/src/reservas/**"
---

# Avanzar en un módulo nuevo (Turnos, Alquileres, Gimnasio): lo que no puede faltar

Pedido de Ale (04/11/2026): cada avance en un módulo deja todo esto hecho, no solo el código. Es
lo mismo que muestra Superadmin → Interno → Módulos en "Cómo se trabaja" (`reglas.ts`); acá está
el detalle para que lo lea el Claude de cada uno cuando toca su módulo.

## 1. Quién decide

- **Cada responsable decide todo lo de su módulo:** Mateo en Turnos, Alan en Alquileres, Ale en
  Gimnasio. Pantallas, flujo, datos, nombres, orden y qué entra al backend. En Alquileres, por
  ejemplo, los paquetes por salón, las temporadas, el alquiler por mes y el modo de cosas con
  stock los decide Alan, no Ale.
- **Ale decide lo transversal:** el cobro online de la seña con Mercado Pago, WhatsApp, los
  recordatorios, cuándo sale cada módulo de "Próximamente", y todo lo que toca plata, producción
  de Tienda o a los tres módulos a la vez.
- Una decisión abierta va en `decisiones.ts` (dice quién decide, su alcance y una propuesta);
  cuando se toma, queda como entrada tipo `decisión` en `entradas.ts`, con el porqué.

## 2. Superadmin → Módulos: el plan y la Auditoría

- Cada tarea hecha tiene su entrada en `apps/web/src/modules/superadmin/modulos/entradas.ts`,
  armada con `entrada()`: key `auditoria.<modulo>.<AAAA-MM-DD>-<slug>`, qué se hizo, quién,
  cuándo, archivos como `ruta:línea` desde la raíz y capturas.
- Capturas en `apps/web/public/auditoria/modulos/<modulo>/`, con el ancho (1280 o 390) en el
  nombre del archivo. En un cambio de diseño, antes y después por ancho; en una tarea, cómo quedó.
  Se sirven desde la web pública: nada con datos reales de clientes.
- La tarea del plan se envuelve con `documentada(t(...), '<key>')` en `plan.ts`. Si cambiás el
  plan (agregar, sacar, mover), dejalo en una entrada para que los demás lo sepan. Las tareas
  nuevas van al final de la lista: los ids son por posición.
- Lo transversal vive en el plan y la Auditoría de Gimnasio, con `transversal: true` y el prefijo
  "Transversal: ".
- `cd apps/web && pnpm exec vitest run src/modules/superadmin/modulos` tiene que pasar: mira las
  keys, las fechas, las capturas y que cada decisión abierta diga quién la decide.

## 3. El estilo del rubro nuevo

- Antes de diseñar: la skill `ui-ux-pro-max` (regla de todo el equipo) y el MCP de shadcn/React
  Bits antes de escribir un componente visual desde cero.
- El panel con el estándar de Tienda: LayoutPanel v2, todas las secciones en el sidebar,
  minimalista, con el kit `rv-` de `src/design-system/reservas/` (campos, calendario, modal,
  Kpi, barra de guardar) y siluetas de carga mientras llegan los datos.
- El sidebar cambia según el modo o el rubro (Turnos: por profesional o por sala; Alquileres:
  cancha, bloque o estadía): cada sección dice en qué modo aparece y ninguna queda vacía en
  ningún rubro.
- Las palabras del rubro (salas, boxes, quinchos, huéspedes, inquilinos) en el panel y el sitio.
- Claro y oscuro con tokens, sin colores fijos, y el fundido al cambiar de tema. El sitio claro
  por defecto, con el sol y la luna del kit (`modoSitio`).
- Probado a 390, 768 y 1280 sin scroll horizontal, con las clases de celular compartidas de
  `globals.css`.
- Ningún módulo importa a otro (eslint lo marca como error). Lo compartido va a `lib/reservas`,
  `design-system/reservas`, `lib/reservasApi` o `apps/api/src/reservas`, avisando a los otros
  dos antes y corriendo los tests de esa carpeta.

## 4. Orbi tiene que saberlo, sin usar Orbi

- **Todo cambio** de pantalla, botón, paso o sección del panel va al manual que lee Orbi: hoy
  `apps/web/src/modules/ventas/panel/manual/contenido.ts`, con los nombres exactos de los botones.
  Después `cd apps/web && pnpm manual:generar` y commitear
  `apps/api/src/orbi/manual/manual.generated.ts`. `pnpm test` de `apps/web` falla si un botón del
  manual no existe o si el artefacto quedó viejo (detalle en `.claude/rules/manual.md`).
- Cómo entra el manual de cada módulo sin importar a Tienda (un contenido por módulo que el
  generador junta) lo define Ale: tarea transversal del 12/11 en el plan de Gimnasio. Hasta
  entonces, el tema se escribe igual y queda listo para engancharse.
- **Los módulos no usan Orbi.** Solo conocimiento, en texto: no se le agregan tools, no se lo
  llama desde el panel ni el sitio, no se corren evals ni grabaciones contra el modelo. Así no
  pagamos IA por los módulos.

## 5. Los tutoriales, al terminar el módulo

- Como se hace con Tienda: la lista del módulo en Superadmin → Marketing → Videos → Tutoriales
  (tabla `marketing_tutoriales`: grupo, orden, título y las pantallas donde se ofrece el botón
  "Ver tutorial"), con qué hay y qué falta.
- Cada tutorial se produce con el conector MCP y la skill `videos-tutoriales` sobre la demo
  pública (nada de datos reales), se sube a YouTube como "No listado" y el Claude de la persona
  carga el link con `tutoriales_actualizar`: con el link queda hecho, sin cola, sin aprobación y
  sin correo.
- En el plan, cada módulo tiene las tareas "El manual de <módulo> en Orbi" (21/12) y "Tutoriales
  de <módulo>" (22/12). Flujo completo: `docs/marketing/FLUJO-PROSPECCION-Y-VIDEOS.md` § La lista
  de tutoriales.

## 6. Antes de dar por terminado un avance

- `tsc --noEmit` en `apps/web` (y en `apps/api` si se tocó), los tests de lo compartido que se
  tocó y los de Módulos en verde.
- Commit en la rama de trabajo; a producción solo por `main` (`CLAUDE.md` § Commit y push). El
  alta real sigue mostrando los tres módulos como "Próximamente" hasta que Ale lo decida.
