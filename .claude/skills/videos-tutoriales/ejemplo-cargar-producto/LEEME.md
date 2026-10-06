# Ejemplo: "Cómo cargar un producto" (v3: plan base + bonus de Avanzado)

El video de referencia (2:11 sin voz, 2:27 con voz) y su corte corto de marketing
(~45 s). Las tomas reales están en `~/orbita-videos/cargar-producto/` (si existe en esta
máquina): sirve para volver a editarlo o para comparar.

**Tutorial** (`editar.mjs`): intro → categoría rápida → paso a paso del **plan base**
(fotos, nombre/precio/costo, categoría, talles y stock, Redactar con Orbi, Más detalles,
Publicar, ficha en la tienda) → placa **"PAQUETE AVANZADO · Orbi lo hace por vos"** →
escaneo con foto (Orbi completa todo + fotos oficiales) → quitar fondo → placa **"Activalo
cuando quieras · Configuración → Suscripción"** → cierre. Criterio en `../referencia/planes.md`.

**Corte corto** (`editar-avanzado.mjs`, `nombre: 'avanzado'`): solo el escaneo + quitar
fondo + llamado a la acción, para landing y redes.

| Archivo | Qué hace |
|---|---|
| `grabar.mjs` | Toma manual (`toma1`, REAL: crea la categoría y publica). Incluye "Quitar fondo" (que en la edición se usa en el bonus, no en el tramo base). `ENSAYO=1` bloquea escrituras y no publica. |
| `grabar-lista.mjs` | Toma corta (`toma1b`) de la lista con el producto ya publicado, al mismo scroll, para el fundido. |
| `grabar-orbi.mjs` | Toma del escaneo con foto (`toma-orbi`), SIEMPRE en ensayo: solo deja pasar el escaneo y las fotos sugeridas; corta al llegar a Publicar. |
| `editar.mjs` | Tutorial v3: clips de las tres tomas, dos diálogos "Abrir" (3 fotos y 1 foto), dos placas, cámara, carteles (1–9, ✓, ✦…), resaltados, sonidos propios. `--voz voz.json` para la narrada. |
| `editar-avanzado.mjs` | El corte corto. `--voz voz-avanzado.json` para la narrada (`tts.mjs guion-avanzado.json` escribe `voz-avanzado.json`; `mezclar-voz.mjs avanzado`). |
| `guion.json` / `guion-avanzado.json` | Narración anclada a marcas (incluye `cap:N` y `toma-orbi:…`). |

## Marcas que usa (para copiar el patrón)
- Por paso: `sA`…`sI` al empezar y `*-fin` al terminar; en la toma de Orbi `oA`…`oD`, `scan-inicio`, `scan-fin`, `scan-visto`, `fin`.
- Momentos: `modal`, `form`, `dialogo-abre`, `fotos-subidas`, `quitar-fondo-fin`, `orbi-fin`, `publicado`, `tarjeta`, `tienda`, `tienda-caracteristicas`, `tienda-fin`.
- `foco(loc, nombre)` donde mira la cámara; `hl(nombre, caja)` en cada bloque que se explica; `esperar(label, fn)` en toda espera a la app (el editor la comprime según `esperas`).

## Al adaptarlo a otra operación
1. Reemplazá los pasos de `grabar.mjs` manteniendo la estructura: preparación sin grabar → `g.iniciar()` → pasos con marcas → (si crea algo) bloque `ENSAYO` vs toma real → `g.terminar()`.
2. Selectores: por rol y texto visible, confirmados con `recon.mjs`; campos sin rótulo accesible con `inputPorLabel('Precio')`.
3. En `editar.mjs`: un `E.clip` por tramo usado (sin solapar rangos de la misma toma); `E.capitulo` para placas; `E.camara` por cosa que se mira; `E.general` al cambiar de pantalla; `E.cartel` por paso; `E.resaltar` por bloque; `E.sonido` para momentos (IA → `sparkle`, algo creado → `success`).
4. Revisá en `../referencia/planes.md` qué funciones del flujo son de un paquete pago antes de decidir el orden.
