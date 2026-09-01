# Demo: 5 propuestas de tutorial de bienvenida para el Panel Admin

> Estado: **prototipo para decidir** — cambios SIN commitear en el working tree (a pedido de Ale, es solo para presentar). Si el equipo elige una, ahí se commitea.
> Código: `apps/web/src/modules/ventas/panel/tutoriales/` (+ montaje en `layouts/AdminLayout.tsx`).
> Nada de esto se activa para usuarios reales: sin `?tutorial=<variante>` en la URL el panel queda exactamente igual que antes.

## Cómo dar la demo (de a una, en orden)

Requisitos ya corriendo: front en `localhost:3001`, API en `localhost:3000`. Las cinco
pestañas quedaron abiertas en Chrome **en este orden**, todas sobre la sesión de panel ya
logueada (dueño de `negocio`):

| # | Propuesta | URL de la pestaña |
|---|-----------|-------------------|
| 1 | Recorrido guiado con spotlight | `http://localhost:3001/admin/952a841c-e0ee-4229-9a3f-94e602f7a28e/ventas/dashboard?tutorial=recorrido` |
| 2 | Checklist de primeros pasos | `…/ventas/dashboard?tutorial=checklist` |
| 3 | Tooltips progresivos por sección | `…/ventas/dashboard?tutorial=tooltips` |
| 4 | Hotspots (puntos de ayuda) | `…/ventas/dashboard?tutorial=bienvenida` |
| 5 | Asistente lateral «hacelo vos» | `…/ventas/dashboard?tutorial=asistente` |

**Reinicio inmediato** (las dos vías, sin terminal y sin recrear nada):

- **Recargar la pestaña** (F5): la URL lleva `?tutorial=<variante>` y eso SIEMPRE arranca
  esa variante desde cero. Es la forma recomendada de repetir una variante o rehacer la
  demo completa frente a otra persona. (Por lo mismo, «Volver» del navegador hasta la URL
  de entrada también reinicia — es el contrato de la URL, no un bug.)
- El link **«Reiniciar tutorial»** visible dentro de cada variante.
- `?tutorial=off` apaga y limpia el tutorial de esa pestaña.

**Aislamiento:** el estado vive en `sessionStorage` (por pestaña, a propósito): recorrer o
reiniciar una pestaña no toca a las otras cuatro, aunque compartan sesión y origen. El
tutorial sobrevive a la navegación interna del panel (probado: checklist y asistente
navegan de verdad entre secciones sin perderse).

## Las cinco cuentas de prueba

Creadas por API en el negocio seed **Zapatos Lorena** (`zapatoslorena` — negocio de prueba
del repo, `apps/api/prisma/seed.ts`), con el rol nuevo **«Demo Tutorial»** (los 19
permisos → ven todas las secciones del panel). Una por variante:

| Variante | Email | Contraseña | memberId |
|----------|-------|-----------|----------|
| recorrido | `demo-tutorial-recorrido@orbita.test` | `OrbitaDemo2026!` | `052a64a2-e8be-48ef-b86c-704ec572995e` |
| checklist | `demo-tutorial-checklist@orbita.test` | `OrbitaDemo2026!` | `db31c4c8-64c2-4e6f-add6-061261751274` |
| tooltips | `demo-tutorial-tooltips@orbita.test` | `OrbitaDemo2026!` | `accd2220-306c-4b09-b77a-45d6f2fa3eae` |
| bienvenida | `demo-tutorial-bienvenida@orbita.test` | `OrbitaDemo2026!` | `a6ce1263-8336-4afb-9564-276f6fc06464` |
| asistente | `demo-tutorial-asistente@orbita.test` | `OrbitaDemo2026!` | `7f8f3f96-45a1-4bd6-9afa-67842a6db9fe` |

Para la experiencia «cuenta nueva de verdad», cada uno del equipo puede loguearse con una
de estas cuentas (el login lo tipean ustedes — Claude no tipea contraseñas, es política).
Si quieren **cinco sesiones distintas a la vez en el mismo Chrome**, usen un origen por
cuenta — la cookie de sesión es por host y estos cinco hosts son loopback sin tenant:

```
http://127.0.0.1:3001/login   → cuenta recorrido
http://127.0.0.2:3001/login   → cuenta checklist
http://127.0.0.3:3001/login   → cuenta tooltips
http://127.0.0.4:3001/login   → cuenta bienvenida
http://127.0.0.5:3001/login   → cuenta asistente
```

Tras el login agregar `?tutorial=<variante>` a la URL del panel. OJO: `tutN.localhost` NO
sirve — con `NEXT_PUBLIC_ROOT_DOMAIN=localhost` cualquier `*.localhost` se interpreta como
subdominio de tienda y la sesión muere con `WRONG_TENANT`.

**Reversión completa** (cuando la demo muera): con sesión de owner de Zapatos Lorena
(`dueno@zapatoslorena.test` / `Test1234!`, credencial del seed del repo):
`DELETE /api/v1/members/<memberId>` por cada cuenta, y borrar el rol «Demo Tutorial»
(id `509104ee-5e8c-4862-8850-39daba146364`). Sobras identificables que el DELETE no toca
(sin FK cascade): filas de `refresh_tokens` con esos `user_id` y filas SIMULATED de
`email_logs` con `to LIKE 'demo-tutorial-%@orbita.test'` — inservibles pero borrables a
mano. La base local es la de producción: no correr seeds ni migraciones para esto.

## Relevamiento que sustenta el contenido

- El tutorial cubre el **panel de ventas** completo: Dashboard, Pedidos (lista/historial/
  devoluciones/nuevo), Clientes, Productos (lista/crear/categorías), Mensajes
  (bandeja/plantillas), Descuentos (descuentos/cupones/rendimiento), Configuración
  (negocio/contacto/pagos/envíos/redes/dominios/cancelaciones/apariencia/equipo/
  notificaciones/suscripción), Avanzado, más las herramientas del header (búsqueda global,
  notificaciones, modo oscuro, Orbi, menú de usuario). Todo el copy sale de
  `tutoriales/copy.ts`, escrito contra los labels reales de cada pantalla.
- **Condicionadas:** «Avanzado» se muestra siempre pero su contenido depende del add-on
  pago (`GET /business/addons`); el resto del gating es por permisos de rol (owner ve
  todo; el rol «empleado» solo Pedidos/Clientes/Productos/Mensajes/Config-lectura).
  Mensajes opera solo en negocios modo FULL. No hay gating por rubro en el nav.
- **Rubro turnos:** hoy NO tiene panel admin — `apps/web/src/modules/turnos/admin/*` son
  seis archivos de 0 bytes sin imports, y el `componentMap` del shell solo tiene `ventas`.
  Cuando exista, el sistema de tutoriales lo cubre agregando sus secciones a `copy.ts`.
- **No existe** hoy ningún flag de «primer login» que llegue al frontend (ni
  `lastAccessAt` ni `createdAt` viajan en `/auth/me`) — por eso la demo se activa por URL.

## Las cinco propuestas

### 1 · Recorrido guiado con spotlight (`?tutorial=recorrido`)

Tour clásico bloqueante: oscurece el panel y va iluminando cada item real del sidebar y
del header con una tarjeta al lado (15 paradas: bienvenida + 8 secciones + 5 herramientas
+ cierre). Flechas del teclado avanzan; Escape saltea. Si un ancla no está visible
(sidebar colapsado, mobile con drawer cerrado) cae solo a tarjeta centrada con pista de
ubicación.

- **Mejor para:** que una cuenta nueva tenga el mapa completo del panel en dos minutos.
- **A favor:** cobertura total garantizada; señala la interfaz de verdad (no dibujos); se
  siente producto grande; no depende de backend.
- **En contra:** es bloqueante — fricción alta para quien quiere operar ya; mucha
  información junta → retención media; **mantenimiento:** cada sección nueva = un paso
  más, y las anclas van por texto/clases porque el layout no tiene `data-tour` (renombrar
  un item del sidebar rompe el ancla hasta actualizar `copy.ts`).
- **Esfuerzo de implementación real:** medio.

### 2 · Checklist de primeros pasos (`?tutorial=checklist`)

Tarjeta flotante persistente («Primeros pasos · N de 6») con las 6 tareas que dejan la
tienda operativa, numeradas 1-6 (el orden es parte del contenido — categorías ANTES que
el primer producto): datos del negocio, Mercado Pago, categorías, primer producto (con el
tip violeta de «✨ Generar con Orbi»), envíos, publicar. Cada tarea se expande con
explicación + botón que navega al lugar exacto (deep-link a `?vista=pagos`,
`?vista=nuevo`, etc.), y **al llegar a la pantalla, un recuadro azul pulsante marca el
elemento exacto a tocar** (p. ej. «Conectar cuenta» de MP, «Nueva categoría», «Publicar
tienda»). Minimizable a píldora; acompaña al usuario por todo el panel; no bloquea nada.

- **Mejor para:** activación — que el negocio quede VENDIENDO, no solo informado.
- **A favor:** fricción bajísima; persiste días (no es un evento de una vez); cada ítem es
  accionable; empuja el camino del dinero (MP + producto + publicar); mantenimiento bajo
  (tareas, no anclas por pantalla).
- **En contra:** no explica todas las secciones (enseña 6 caminos, no el mapa); en esta
  demo el tilde es manual — la versión real necesita enganchar eventos (producto creado,
  MP conectado, tienda publicada) para auto-marcar, y eso es trabajo backend extra; riesgo
  de quedar minimizada e ignorada.
- **Esfuerzo:** bajo para la tarjeta; medio-alto si se quiere auto-check real.

### 3 · Tooltips progresivos por sección (`?tutorial=tooltips`)

Nada global: la primera vez que entrás a cada sección aparecen 1-3 tips anclados a los
elementos reales de ESA pantalla (con anillo pulsante, sin bloquear — podés seguir
operando). Una píldora («Consejos · N/10 secciones») muestra el progreso global y lista
qué falta. Lo que no visitás, no te interrumpe.

- **Mejor para:** aprender haciendo, dosificado, sin ceremonia inicial.
- **A favor:** el contexto perfecto — la explicación llega exactamente donde y cuando se
  usa → retención alta; fricción mínima por sesión; cero bloqueo.
- **En contra:** cobertura depende de que el usuario visite las secciones; **el
  mantenimiento más alto de los cinco** (tips + anclas por cada pantalla, y varias
  pantallas no tienen selectores estables — habría que agregar `data-tour`); mal dosificado
  puede sentirse «el producto que te persigue».
- **Esfuerzo:** medio-alto.

### 4 · Hotspots — puntos de ayuda (`?tutorial=bienvenida`)

> v3 — tercer concepto para esta ranura (los slides y el mapa no convencieron); elegido
> por Ale entre cuatro opciones propuestas.

Patrón estilo Figma/Linear: 9 puntos azules pulsantes sobre la UI REAL — uno al lado de
cada ítem del sidebar, uno en el buscador del header — todos a la vez, sin orden y sin
bloquear nada. Tocás el que te da curiosidad → mini-tarjeta con qué es, para qué sirve y
el "Primer paso"; «Entendido» apaga ese punto para siempre. Una píldora discreta lleva la
cuenta («Quedan N puntos», con Reiniciar/Saltar); al apagar los 9, cierre breve. La
primera vez aparece una línea abajo explicando qué son los puntos. Escape cierra la
tarjeta abierta.

- **Mejor para:** aprender sin que nadie te maneje — la curiosidad como motor, cero
  interrupciones.
- **A favor:** la fricción más baja posible (nada bloquea, nada se mueve solo); los puntos
  viven sobre la UI real y en el lugar real (la asociación queda); persiste hasta
  completarse; anclas solo al sidebar/header (estables) → mantenimiento bajo.
- **En contra:** sin orden no hay narrativa: nadie te dice por dónde empezar; quien
  ignora los puntos no aprende nada; 9 puntos a la vez pueden sentirse "ruido" el primer
  minuto (mitigado: se apagan rápido).
- **Esfuerzo:** bajo-medio.

### 5 · Asistente lateral «hacelo vos» (`?tutorial=asistente`)

Panel acoplado estilo guía (hermano visual de Orbi): te pide ACCIONES reales («Abrí
**Pedidos** en el menú»), resalta el item con un anillo pulsante sin bloquear, detecta
que llegaste y recién ahí te explica la sección; 9 misiones que terminan de vuelta en el
Dashboard. Historia de misiones cumplidas visible; cada paso se puede saltear.

- **Mejor para:** que el usuario TOQUE el panel desde el minuto uno; memoria de acción.
- **A favor:** la retención más alta (lo que hacés no se olvida); no bloquea; conversa con
  la identidad de Orbi que ya existe; la detección va por rutas (robusta), no por anclas.
- **En contra:** el recorrido más largo de completar; exige ganas — si el usuario no
  navega, la guía espera (mitigado con «Saltar este paso»); combina mal con usuarios
  apurados.
- **Esfuerzo:** medio.

## Recomendación

**Checklist de primeros pasos (2) como base**, y en una segunda iteración sumarle los
tooltips de primera visita (3) en las 3-4 pantallas clave. Razones:

1. El objetivo de negocio del onboarding de Órbita no es «que conozca el panel», es **que
   la tienda quede configurada y vendiendo** — exactamente lo que la checklist empuja
   (datos → MP → producto → publicar). Las otras cuatro enseñan; esta activa.
2. Es la única propuesta que **persiste más allá del primer día** sin molestar: los
   tutoriales de una sola vez (1 y 4) se saltean y no vuelven.
3. Mantenimiento y riesgo mínimos: no depende de anclas del DOM, así que el equipo puede
   seguir refactorizando pantallas sin romper el onboarding.
4. El híbrido checklist + tooltips cubre la única debilidad real (no explica el mapa):
   el tip de primera visita explica cada pantalla cuando el usuario efectivamente llega.

Si el equipo prioriza «wow de primera impresión» por encima de activación, la alternativa
es el Recorrido (1) — pero pediría agregar `data-tour` al layout antes de llevarlo a serio.

## Nota de implementación de la elegida (cualquiera sea)

- **Primer login real:** hoy no llega al frontend. Camino mínimo: exponer un flag en
  `GET /auth/me` (p. ej. derivado de `Member.lastAccessAt === null` chequeado ANTES del
  update en `login()`, o un campo dedicado `onboardingVisto`).
- **Persistencia por cuenta** (no por navegador): campo JSON en `members` o tabla chica;
  el `sessionStorage` de la demo es solo para poder correr 5 variantes en paralelo.
- **Checklist con auto-check:** enganchar eventos existentes (producto creado, MP
  conectado vía el callback OAuth, `POST /business/publish`, config guardada).
- **Si la elegida usa anclas** (1 o 3): agregar `data-tour="..."` a sidebar/header y a los
  elementos señalados — hoy se ancla por clases/texto y es frágil ante renombres.
- El copy de `tutoriales/copy.ts` sirve tal cual para cualquiera de las cinco.
