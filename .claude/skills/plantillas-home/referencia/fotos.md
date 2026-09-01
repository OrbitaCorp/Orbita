# Fotos de las plantillas

Viven en `apps/web/public/plantillas/` y son **locales a propósito**: con URLs
remotas la pantalla se ve rota sin internet y depende de un tercero. Desde que
esto es una pantalla del panel (y no una demo para reuniones) **sí van a git**.

## De dónde salen

Lo único que funcionó, probado:

| Fuente | Resultado |
|---|---|
| `images.unsplash.com/photo-{id}` | anda |
| `plus.unsplash.com/...` (Unsplash+) | 404 en `images.` — descartar el id |
| `unsplash.com/s/photos/...` por curl | bloqueado |
| `picsum.photos` | bloqueado, timeout |
| `source.unsplash.com` | 503 |

**Conseguir los ids**: abrir `https://unsplash.com/s/photos/{búsqueda}` en el
navegador del Browser pane y leerlos del DOM. El `alt` viene traducido y dice
qué es cada foto, así que se elige antes de bajar en vez de después:

```js
[...document.querySelectorAll('figure img')]
  .filter(i => i.src.includes('images.unsplash.com'))   // sin esto entran las de pago
  .map(i => ({ id: (i.src.match(/photo-([0-9a-f-]+)/) || [])[1], alt: i.alt }))
```

Bajarlas en lote, verificando el tipo en el mismo paso:

```bash
while read -r nombre id; do
  curl -sL --max-time 40 "https://images.unsplash.com/photo-${id}?w=1400&q=80" -o "${nombre}.jpg"
  printf "%s %s %s\n" "$nombre" "$(file -b --mime-type "${nombre}.jpg")" "$(du -h "${nombre}.jpg" | cut -f1)"
done < lista.txt
```

Lo que salga `text/html` es un id que no existe o es de pago: borrarlo y buscar
reemplazo. Sale barato — pasó con 7 de 48 en la última tanda.

## Nombres

`{rubro}-{qué-es}.jpg`, en minúscula y sin acentos: `joya-collar.jpg`,
`tech-teclado.jpg`, `moda-mujer-invierno.jpg`.

Prefijos en uso: `vidriera- casa- tech- moda- belleza- comida- joya- local-
editorial- relato- libre- ferre- dep- masc- vino- bebe- diet- boutique- cafe-
auto-`

## Verificar ANTES de asignarlas

Bajar a ciegas termina en una foto que no tiene nada que ver con lo que dice el
nombre — y el `alt` tampoco alcanza: el de `diet-paprika.jpg` decía "frasco de
vidrio con líquido marrón" y era un frasco con la etiqueta SWEET PAPRIKA bien
legible, que se iba a vender como miel. Dos pasos, los dos obligatorios:

**1. Que el archivo sea una imagen de verdad** (un id inválido baja un HTML de
error con extensión `.jpg`):

```bash
for f in apps/web/public/plantillas/joya-*.jpg; do
  echo "$(file -b --mime-type "$f") $(du -h "$f" | cut -f1) $f"
done
```

**2. Mirarlas todas juntas.** Hoja de contactos temporal:

```bash
cd apps/web/public/plantillas && mkdir -p tmp
{ echo '<body style="background:#111;color:#fff;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:6px">'
  for f in joya-*.jpg; do
    echo "<div style=\"width:200px\"><img src=\"/plantillas/$f\" style=\"width:200px;height:150px;object-fit:cover\"><div>$f</div></div>"
  done
} > tmp/index.html
# abrir localhost:3001/plantillas/tmp/index.html — y borrar tmp/ al terminar
```

Tiene que ser por **HTTP**: abierta como `file://` las imágenes no cargan y la
hoja sale toda en negro. Con miniaturas de 150 px entran unas 24 por captura;
con 200 px hay que scrollear tres veces para ver 45. Si una queda en duda,
mirarla sola a tamaño completo antes de asignarla.

## Criterio para elegir

- **Que no desentonen con la paleta de la plantilla.** Una hoja verde tropical
  adentro de una joyería carbón y dorado arruina la fila entera.
- **Sin repetir la misma foto dos veces en la misma pantalla.** Que la tarjeta
  de categoría y la de producto usen la misma imagen se nota.
- **Fondos coherentes entre sí en una misma fila.** Gris / dorado oscuro / crema
  conviven; gris / dorado / rosa chicle no.
- Para la segunda foto del hover (`img2`), otra toma **del mismo producto** o
  algo del mismo mundo — no un producto distinto.
