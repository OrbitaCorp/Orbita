# Fotos de las plantillas

Viven en `apps/web/public/plantillas/` y son **locales a propósito**: la
presentación se muestra en reuniones y con URLs remotas se cae sin internet.
Están fuera de git (`.git/info/exclude`), así que en una máquina nueva hay que
volver a bajarlas.

## De dónde salen

Lo único que funcionó, probado:

| Fuente | Resultado |
|---|---|
| `images.unsplash.com/photo-{id}` | anda |
| `picsum.photos` | bloqueado, timeout |
| `source.unsplash.com` | 503 |

```bash
curl -sL "https://images.unsplash.com/photo-{ID}?w=1200&q=80" \
  -o apps/web/public/plantillas/{rubro}-{que-es}.jpg
```

## Nombres

`{rubro}-{qué-es}.jpg`, en minúscula y sin acentos: `joya-collar.jpg`,
`tech-teclado.jpg`, `moda-mujer-invierno.jpg`.

Prefijos en uso: `vidriera- casa- tech- moda- belleza- comida- joya- local- editorial- relato-`

## Verificar ANTES de asignarlas

Bajar a ciegas termina en una foto que no tiene nada que ver con lo que dice el
nombre. Dos pasos, los dos obligatorios:

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

## Criterio para elegir

- **Que no desentonen con la paleta de la plantilla.** Una hoja verde tropical
  adentro de una joyería carbón y dorado arruina la fila entera.
- **Sin repetir la misma foto dos veces en la misma pantalla.** Que la tarjeta
  de categoría y la de producto usen la misma imagen se nota.
- **Fondos coherentes entre sí en una misma fila.** Gris / dorado oscuro / crema
  conviven; gris / dorado / rosa chicle no.
- Para la segunda foto del hover (`img2`), otra toma **del mismo producto** o
  algo del mismo mundo — no un producto distinto.
