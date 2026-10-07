# Planes: qué es del plan base y qué del paquete Avanzado

Un tutorial no puede presentar como "la forma normal" algo que una parte de los usuarios
no tiene: quien está en el plan base lo intenta, le aparece "activá Avanzado" y se siente
engañado. Antes de guionar, **verificá en el código** qué funciones del flujo son de pago
(buscar `@RequiresAddon('ADVANCED')`, `exigir…`, `avanzado &&` en la pantalla) — esto cambia.

## Estado al 2026-10-05

**Solo Avanzado (de pago)**
| Función | Dónde se ve | Bloqueo en el código |
|---|---|---|
| Escanear una foto con Orbi ("Completar nombre, categoría y descripción con esta foto") | Sección Fotos del alta; sin Avanzado se ve un aviso para activarlo | `POST /products/ai-scan` con `@RequiresAddon('ADVANCED')` (products.controller.ts) |
| Quitar fondo (en cada foto) | Miniaturas, al crear y al editar | `exigirQuitarFondo()` (products.service.ts) |
| Fondo con IA (estudio de fondos, estilos premium) | Botón arriba de Fotos y en fotos por variante | `POST /image-studio/background` y `/model` con `@RequiresAddon('ADVANCED')` |
| Fotos oficiales de la web | Debajo de las fotos, solo después de un escaneo | (en la práctica, Avanzado) |
| Quitar fondo en los sliders de Apariencia | Configuración → Apariencia | businesses.service.ts |

**Plan base (todos)**
- Redactar con Orbi (descripción, categoría y etiquetas desde el nombre) — tope diario por negocio, no bloqueo de plan.
- Completar con Orbi las especificaciones técnicas — mismo tope.
- Sugerir opciones de variante con Orbi según el nombre — mismo tope.
- Variantes y presets, stock, precios, categorías, etiquetas, video, rotar/reordenar/duplicar fotos, subir fotos.
- Orbi del panel (el chat): sus herramientas de productos no tienen límite de plan.
Criterio (products.controller.ts, decisión del 01/10): completar **por nombre** es de todos; completar **por foto** es de Avanzado.

Dónde se activa: **Configuración → Suscripción** ("Activar Avanzado").

## Cómo armar el video
1. **El tutorial enseña el plan base, completo**: alguien con el plan base lo sigue de punta a punta y publica, sin sentir que le falta algo. Ninguna función de Avanzado en ese tramo (si la toma la usó, cortala en edición).
2. **Avanzado va al final, como bonus bien marcado**: placa "PAQUETE AVANZADO · Orbi lo hace por vos", carteles ✦ con "Paquete Avanzado" en el subtítulo, y se muestra el valor en concreto (escaneo, fotos oficiales, quitar fondo). 20–35 s.
3. **Llamado a la acción suave**: placa "Activalo cuando quieras · Configuración → Suscripción" y frase "Activalo cuando quieras desde Configuración, en Suscripción." Nada de "lo difícil vs. lo fácil": "si querés ir todavía más rápido…".
4. Si sirve para marketing, **un corte corto aparte** (~45 s) solo con lo de Avanzado, desde las mismas tomas (`E.escribir({ nombre: 'avanzado' })`).
5. Si TODO el flujo es del mismo plan y hay dos caminos, mostrar primero el más rápido (placas "Opción 1 / Opción 2").
