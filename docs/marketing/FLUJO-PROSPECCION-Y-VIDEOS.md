# Prospección y videos automatizados: para qué, cómo y cuánto cuesta

_Redactado el 2026-10-14. Es el documento de referencia para el equipo y para su Claude: explica **qué se armó, para qué
sirve y cómo se usa**. Las cifras de costo son **estimaciones** (se aclara en cada caso): se verifican con la factura real._

> Órbita **ya no está en piloto cerrado**: el contexto comercial y las reglas de marca vigentes están en el repo de videos
> (`marketing/CONTEXTO.md` y `marketing/CLAUDE.md` de `Orbita-Videos`).

## En una frase

Órbita sumó dos herramientas dentro del superadmin que usan **el Claude que cada persona del equipo ya paga**, sin clave
de API y sin infraestructura nueva: una **encuentra y analiza negocios de Instagram a quienes contactar** (prospección) y
otra **genera videos de marketing en la computadora de quien los pide** y los deja en una **cola para que una persona los
apruebe** antes de que salga nada. El costo marginal es de centavos de dólar por video y por lista, y escala sumando
personas, no servidores.

## Para qué existe (el propósito)

Un equipo chico tiene dos cuellos de botella para crecer: **encontrar negocios a los que ofrecerles Órbita** (investigar
cuentas una por una, decidir a cuáles escribir y qué decirles) y **producir contenido con regularidad** (guion, voz, edición,
subida). Las dos tareas comen horas de personas que también tienen que programar, vender y atender.

La idea no es reemplazar a las personas sino **quitarles el trabajo repetitivo y dejarles la decisión**:

| Tarea | La máquina hace | La persona decide |
|---|---|---|
| Prospección | Consultar cuentas, puntuarlas con el criterio de cliente ideal, analizarlas y redactar un borrador de mensaje | A quién escribirle, si manda el mensaje o no, y lo manda ella, a mano |
| Videos | Escribir el guion, generar la voz, editar, renderizar, medir la calidad y subir | Si el video sirve (aprobar o rechazar) y si se pasa a TikTok o Instagram |

**Regla de oro: nada sale solo.** Ningún mensaje se envía, ningún video se publica y ningún dato se borra por decisión de
una máquina. Es una condición de diseño, no una configuración: el conector ni siquiera tiene herramientas para eso.

## Un solo conector, dos usos

Cada persona agrega **una vez** el conector de Órbita a su Claude (Configuración → Conectores → «Agregar conector
personalizado», dirección `https://api.orbita.site/api/v1/mcp`) y lo autoriza con su cuenta de la organización
en el panel (el mismo login con Google y segundo factor del superadmin). Con ese único conector, su Claude puede:

- **Prospección:** leer el criterio, consultar cuentas, leer lotes y guardar análisis.
- **Videos:** ver la cola, leer un video con sus comentarios (para mejorarlo), pedir dónde subir uno, registrarlo (también como mejora de otro) y avisar al equipo por correo cuando termina la tanda (el texto del correo es fijo).
- **Tutoriales:** ver la lista de lo que hay y lo que falta, y marcar el estado de cada uno.

Quién puede conectarlo: un **superadmin activo** con correo `@orbita-corp.com` o `@orbita.site`. Se vuelve a verificar
**en cada llamada**: si alguien deja de ser superadmin o se desactiva, su Claude pierde el acceso en el momento.
Cualquiera puede cortar sus propias conexiones desde Marketing → Prospección → «Desconectar Claude».
(Qué cuenta paga Claude no importa: se mira el correo con el que se entra al panel.)

## Cómo funciona la prospección

1. **Las cuentas llegan de tres maneras:** las pegás vos (por ejemplo, quienes te escribieron), Claude las busca con su
   búsqueda web en páginas públicas, o las dos: parte de las que pegaste y busca parecidas.
   **No se hace scraping de Instagram ni se sacan listas de seguidores.**
2. **Se consultan por la API oficial de Meta** (Business Discovery): solo se ven cuentas profesionales (de empresa o
   creador), con datos públicos. Hasta 20 cuentas por consulta.
3. **Se puntúan** con el criterio de cliente ideal (0–100): venta por mensaje (25), dolor operativo (25), tracción (20),
   encaje de rubro (15), contacto y zona (10) y catálogo amplio (5). Niveles: **A** (70+, contactar ya), **B** (50+, esta
   semana), **C** (30+, más adelante), **D** (descartar o revisar). Acopla con los **28 subrubros** de tienda del alta de Órbita.
4. **Claude analiza** cada cuenta (rubro, si vende productos, por dónde vende, señales de dolor, nivel final) y redacta un
   **borrador de mensaje** corto, con la guía de lo que se puede y no se puede decir.
5. **La persona revisa** en Marketing → Prospección, ajusta el estado (nuevo, contactado, respondió, demo, cliente,
   descartado, no contactar), anota, y manda el mensaje ella misma desde Instagram.

## Cómo funcionan los videos

1. **La persona le pide a su Claude** algo como «generame 3 videos» (skill `videos-cola`) o «hacé el tutorial de Atender un pedido».
   La cantidad la define quien lo pide, no el panel.
2. **Claude los produce en la computadora de esa persona:** guion con jueces de calidad, voz, edición con HyperFrames sobre la demo
   pública (nada de datos reales) y render. En una PC con placa de video, un reel de ~40 s tarda poco más de 1 minuto.
3. **Controles automáticos** del mp4: formato, duración, peso, volumen del audio, silencios, tramos en negro e imagen congelada.
   Los videos que fallan lo básico no se suben.
4. **Se sube directo a Cloudflare R2** con una dirección firmada de 10 minutos y se **registra en la cola** con su guion, su texto
   sugerido y el resultado de los controles.
5. **Le llega un correo a todo el equipo** (superadmins con correo `@orbita.site` u `@orbita-corp.com`, también a su correo
   personal): «Hay N videos nuevos para ver y comentar». Sale **uno por tanda**, no uno por video.
6. **El equipo los ve en Superadmin → Marketing → Videos**, en dos pestañas que no se mezclan: **Marketing** y **Tutoriales**.
   - **Cualquiera puede comentar** cualquier video en todas sus fases (para aprobar, aprobado, pasado a borrador).
   - **Cualquiera puede pedir una mejora:** «Mejorar con Claude» abre Claude con ese video y sus comentarios (si la persona tiene el
     conector; si no, le explica cómo conectarlo). La versión mejorada entra a la cola como un video nuevo; el original no se toca.
     Sirve también para videos ya aprobados.
7. **Aprobar:** cada video lo aprueba quien lo subió, para verificar lo que hizo su Claude (los socios no aprueban el video de otro
   socio). Lo que sube Milagros, de marketing, lo aprueba la dirección. El panel solo muestra «Aprobar» a quien corresponde.
   - **Rechazar** borra el archivo, el registro y sus comentarios. Un pendiente que **nadie aprueba se borra solo** (7 días los de
     marketing, 30 los tutoriales).
   - Un video de marketing **aprobado** queda como **registro** (con su archivo) y habilita **descargarlo** o **pasarlo como borrador**
     a TikTok (a los borradores de la cuenta) o a Instagram (como borrador en Publicaciones, donde se programa o se publica).
   - Los **tutoriales** son internos: no se pasan a redes.
8. Al terminarlo en TikTok, **marcar el contenido como generado con IA** (TikTok lo pide).

### La lista de tutoriales

Hay una lista de los tutoriales del panel y la tienda con **qué hay y qué falta** (39 en total, agrupados: Arrancar, Catálogo, Vender día
a día, Vender más, Que tu tienda se vea bien, Equipo y cuenta, Paquete Avanzado y los opcionales para mostrarle al cliente). La
actualiza el Claude de cada persona por el conector: marca «en proceso» al empezar uno, y al registrar su video queda «en revisión»
y, cuando se aprueba, «hecho». También se corrige a mano desde el panel (Marketing → Videos → Tutoriales).

## Controles y límites (lo que lo hace seguro)

- **No hay envío ni publicación automáticos.** Siempre hay una persona en el último paso.
- **Aprobación por quién lo subió:** los socios se aprueban a sí mismos y ninguno aprueba el video de otro; lo de marketing (Milagros) lo aprueba la dirección. El conector no puede aprobar ni decide quién aprueba.
- **Acceso acotado y revocable:** solo superadmins de la organización, verificado en cada llamada; cada persona puede desconectar.
- **Cola con tope:** 20 videos esperando revisión; con más, no se generan nuevos hasta revisar. Evita llenar el almacenamiento si algo se descontrola.
- **Todo queda registrado:** cada consulta, análisis, registro, aprobación, rechazo y envío a borradores queda en el registro de acciones del panel, con quién lo hizo.
- **Contenido de terceros = datos, no órdenes:** las biografías y publicaciones de las cuentas consultadas se tratan como texto a analizar; el conector no las ejecuta como instrucciones.
- **Reglas de marca en cada video:** sin competidores, sin funciones inexistentes, sin cifras ni clientes inventados, lo de pago marcado como tal (`marketing/CLAUDE.md` del repo de videos).
- **Claves fuera del repo:** el repo de videos es público; las claves y las direcciones de subida nunca se guardan ahí.

## Costos (bajos; son estimaciones)

El principio: **se aprovecha lo que ya se paga**. No hay clave de API de Anthropic ni cobro por uso a nombre de Órbita.

| Qué | Quién lo paga | Orden de magnitud | Notas |
|---|---|---|---|
| Claude (guiones, análisis, edición) | El plan de cada persona | Sin costo extra para Órbita | Cada tanda **consume parte del límite del plan** de quien la pide |
| API de Meta (consultar cuentas) | Nadie | Gratis | Con límites de la API: se consulta con pausa entre cuentas |
| Servidor (conector, cola, panel) | Cloud Run existente | Centavos al mes (estimado) | Escala a 0; el conector suma muy pocas llamadas. No hay servicio nuevo |
| Render del video | La PC de quien lo genera | Sin costo por render | Sin alquilar GPU en la nube |
| Voz | Motor elegido (Gemini TTS o ElevenLabs) | ~US$ 0,02–0,05 por reel con Gemini TTS (estimado: unas 8–10 frases a ~US$ 0,002 cada una); con ElevenLabs depende del plan y los créditos | Es el costo variable más grande: se confirma antes de cada tanda |
| Almacenamiento (Cloudflare R2) | Órbita | ~US$ 0,015 por GB al mes, **sin cobro por descargas**, con 10 GB gratis (precio público de Cloudflare; verificar) | 1 video ≈ 20–40 MB → ~US$ 0,0006 por video al mes |
| Base de datos | Supabase existente | Despreciable | Son filas de texto |
| **Tiempo de revisión** | El equipo | Minutos por video | **Es el costo real**: por eso la cola prioriza y avisa qué controles fallaron |

**Ejemplo de escala (hipotético, para dimensionar):** 10 videos por día, todos aprobados y conservados = 400 MB por día ≈
12 GB al mes ≈ **menos de US$ 0,20 al mes** de almacenamiento, más ~US$ 0,20–0,50 por día de voz con Gemini TTS. El
almacenamiento crece solo con los **aprobados** (los rechazados y vencidos se borran).

## Cómo se puede explotar (hacia dónde crece)

Son palancas posibles, no promesas de resultados:

1. **Más personas, más volumen, mismo costo fijo:** cada integrante genera con su Claude y su PC, y todos aprueban en una cola compartida. Se escala sumando personas, no infraestructura.
2. **Más variantes por video:** los 28 subrubros × los moldes de gancho del banco (`marketing/guiones/banco-de-ganchos.md` del repo de videos) × las funciones del producto dan cientos de combinaciones para probar qué convierte (A/B de ganchos).
3. **Prospección que alimenta el contenido:** los rubros y dolores que más responden en la prospección dicen sobre qué hacer los próximos videos.
4. **Foco por zona:** empezar por Iguazú y la región, y repetir el mismo método en otras localidades.
5. **Biblioteca de aprobados:** lo aprobado queda como registro reutilizable (remontar, cambiar el gancho, otros formatos).
6. **Cuando el volumen lo pida, mover el render a un servidor.** Hoy no hace falta: el diseño ya separa quién produce de la cola, así que cambiaría solo dónde se renderiza, no el panel ni las aprobaciones.
7. **Posible producto (idea a evaluar, no un compromiso):** ofrecer algo parecido a los negocios que usan Órbita, para que generen contenido de sus propias tiendas.

## Estado actual (2026-10-14)

- ✅ Prospección y conector único en producción (consulta de cuentas, criterio, análisis, panel).
- ✅ Cola de videos en producción: pestañas Marketing y Tutoriales, comentarios, «Mejorar con Claude», aprobación según quién subió el video, descarga y borradores en TikTok e Instagram.
- ✅ Lista de 39 tutoriales (2 hechos, 37 por hacer) que el Claude de cada persona lee y actualiza por el conector.
- ✅ Probado en producción: un Claude conectado subió y registró un video en la cola, y leyó la lista de tutoriales y el detalle del video.
- ✅ Herramientas de la skill `videos-cola` (preparar, medir calidad, subir; también para tutoriales) con tests. La rama está subida al repo de videos; falta abrir el pull request.
- ⏳ **Sin probar de punta a punta:** el correo al equipo con un video real, y un comentario y una mejora pedidos desde el panel con un Claude conectado.
- ⏳ Verificar que el token de Meta de producción (usuario del sistema) acepta las consultas.
- ⏳ Revisión de Meta (Instagram) y auditoría de TikTok: hasta entonces, los permisos de publicación son limitados.
- ⏳ Elegir la voz y las pistas de música aprobadas para los reels automáticos.
- ⚠️ **Los repos de Órbita y de videos son públicos:** nada de claves, direcciones de subida, datos de clientes ni cifras reservadas en documentos ni en los videos de este flujo.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Pantallas | Superadmin → Marketing → **Prospección** y **Videos** |
| Código de la API | `apps/api/src/marketing/prospeccion/` (prospección y conector) y `apps/api/src/marketing/videos/` (cola) — este repo |
| Panel (web) | `apps/web/src/modules/superadmin/Prospeccion.tsx`, `Videos.tsx` y `pages/superadmin/conectar-claude.tsx` — este repo |
| Conector y autorización | `apps/api/src/marketing/prospeccion/mcp/` — este repo |
| Cómo se despliega | `apps/api/DEPLOYMENT.md` (secciones «Prospección» y «Cola de videos») — este repo |
| Skill para generar videos | `.claude/skills/videos-cola/` — repo de videos (`Orbita-Videos`) |
| Contexto comercial y reglas de marca | `marketing/CONTEXTO.md` y `marketing/CLAUDE.md` — repo de videos |
