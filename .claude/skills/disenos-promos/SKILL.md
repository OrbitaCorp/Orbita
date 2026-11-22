---
name: disenos-promos
description: "Diseños de las promos del paquete Avanzado de Órbita: temáticas de los juegos con premio, formatos y colores de los anuncios y de la oferta relámpago. Usar cuando el pedido sea sumar o cambiar una temática (de temporada o de estilo), un formato de anuncio, un formato de oferta, o la vista previa jugable. Palabras clave: temática, tematica, piel, skin, temporada, navidad, san valentín, halloween, juego con premio, ruleta, anuncio, modal de anuncio, barra flotante, cupón, oferta relámpago, cuenta regresiva, vista previa."
---

# Diseños de promos

Un mismo catálogo para tres cosas del paquete Avanzado: **juegos con premio**,
**anuncios** y **oferta relámpago**. Sigue el modelo de `plantillas-home`.

## El modelo

1. **La mecánica no cambia con el diseño.** Una temática es el mismo juego con
   otra piel: mismo timing, misma zona de acierto, mismas reglas. La escena
   temática implementa `EscenaConfig`, la interfaz de las escenas originales.
2. **`null` es "como se veía antes".** Ninguna tienda cambia de aspecto hasta
   que su dueño elija un diseño. No se migran datos ni se pone default en la base.
3. **La vista previa es la pieza real.** `JuegoInline`, `MarcoJuego`,
   `AnuncioPromo` y `OfertaDisenada` son los mismos en la tienda y en el panel.
4. **Jugar la vista previa no deja rastro.** `JuegoInline` con `prueba` no llama
   a la API, no crea sesión ni descuento, no escribe `localStorage`.
5. **Nada inventado.** Un anuncio es texto del dueño. Una oferta toma nombre, %,
   fecha y precios del descuento real. No sumar contadores de stock o de "gente
   mirando" que no salgan de un dato real.
6. **Sin marcas de terceros** en nombres ni dibujos: por eso es "Semana de
   ofertas". Tampoco personajes ni logos de otros.

## Dónde vive

```
apps/web/src/modules/ventas/promos/
  catalogo.ts          TEMATICAS, formatos, colores resueltos, fuentes
  dibujos.ts           Figuras SVG (corazón, pino, calabaza…), funciones puras
  escenasTematicas.tsx Arma la EscenaConfig de cada juego × temática; MiniEscena
  MarcoJuego.tsx       La ventana del juego: centro, costado u hoja
  AnuncioPromo.tsx     Los nueve formatos de anuncio
  OfertaDisenada.tsx   Los formatos de oferta (la cartelera real sigue en CountdownOfertaSection)
  PanelPromos.tsx      Galería, grilla de formatos y vistas previas del panel
  catalogo.test.ts     El check
apps/api/src/common/disenos-promos.ts   Los ids que acepta la API
```

Columnas (todas opcionales): `games.theme`, `games.presentation`,
`promo_modals.format/design/image_url`, `countdown_configs.format/design`.

## Sumar una temática

1. Agregar la entrada en `TEMATICAS` (`catalogo.ts`):
   - `grupo: 'temporada'` lleva `meses` (ordenan la galería desde la próxima fecha).
   - `p`: colores de la escena. `ui`: colores de la tarjeta. `pieza`: lo que se
     lanza. `decor`: lo que va en el cielo, armado con `dibujos.ts`.
   - La fuente va con su `fuenteGoogle`; se carga solo cuando se usa.
2. Sumar el id a `TEMATICAS_PROMO` en `apps/api/src/common/disenos-promos.ts`.
   **Tocar ese archivo obliga a desplegar la API** antes de que el panel la ofrezca.
3. `pnpm --dir apps/web test catalogo`.
4. Mirarla en los seis juegos: Avanzado → Juegos con premio, y jugarla.

Que no sea solo otro color: cambiar a la vez paleta, tipografía, radio, pieza y
decorado. El `decor` se dibuja en el cielo (y de 0 a 170 de alto): en Pesca el
agua arranca en 96, así que lo importante va arriba.

## Sumar un formato

**De anuncio:** id en `FORMATOS_ANUNCIO` (catálogo y API), su `case` en
`AnuncioPromo.tsx` y su CSS. Si tapa la página, va en `CON_VELO`. Tiene que
funcionar sin foto, sin mensaje y sin código, y en `@container (max-width: 560px)`.

**De oferta:** id en `FORMATOS_OFERTA` (catálogo y API) y su rama en
`OfertaDisenada.tsx`. El reloj siempre sale de `restanteMs`; los precios, de los
productos ya rebajados.

## Sumar un juego

Además de lo que pide `JuegoInline.tsx` (`TEMAS`, `ESCENAS`, `MECANICAS`), su
entrada en `JUEGOS` de `escenasTematicas.tsx`. Recordar que `destinoY` es el
borde inferior del proyectil y que este se achica a 0.72 alrededor de su centro.

## Antes de decir que está listo

1. `pnpm --dir apps/web test` y `tsc --noEmit` en `apps/web` y `apps/api`.
2. Si se tocó una pantalla del panel: `contenido.ts` y `pnpm manual:generar`.
3. Si se tocó `apps/api/`: hace falta `deploy.sh`. Si hay columna nueva, migración
   en dev y en producción (ver CLAUDE.md).
4. Decirle al dueño qué mirar: el check no ve si un dibujo queda lindo.
