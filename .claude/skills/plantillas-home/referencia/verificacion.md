# Mirar la vitrina en el navegador

El modo check (`pnpm test plantillas`) no mide tamaños ni carga fotos. Esto es
para cuando hace falta medir desborde, fotos rotas o secciones sin revelar en
la vitrina del panel, con `verificacion.js`.

Pegar `referencia/verificacion.js` en la consola del panel, en
`/admin/{negocioId}/ventas/avanzado?vista=plantillas`. Va de a una plantilla
(`__chequear(0..15)`) porque varias juntas pasan el timeout de CDP (45 s): de a
tres entra, de a cinco+ se corta o da falsos positivos (ver más abajo).

Tiene que dar, en **escritorio y celular**: `rotas: 0`, `desborda: false`,
`ocultas: 0`. Cualquier otra cosa es un bug, no un detalle.

**La pestaña tiene que estar ADELANTE mientras corre.** En una pestaña de fondo
Chrome congela los timers y el IntersectionObserver: el reveal no dispara nunca
y `ocultas` da distinto de cero aunque no haya nada roto. El script avisa —
chequear `document.visibilityState === 'visible'` antes de creerle al número.

**Ni siquiera con la pestaña adelante, de a cinco o más seguidas da confiable**:
un `__chequear` puede devolver "sin marco" o `ocultas` de más por una
condición de carrera entre clicks — antes de reportar un bug real, repetir esa
plantilla SOLA.

**Sin backend a mano**, la pantalla corre sola: una página temporal en
`apps/web/src/pages/` que devuelva `<PlantillasConfig onVolver={() => {}} />`
alcanza — no llama a la API con éxito, y `useAuth`/`panelGetAppearance` fallan
en silencio (la vitrina sigue andando, solo no hay ninguna enganchada). Borrarla
antes de commitear.

**Con el Browser pane oculto la página no hace layout**: el primer `.click()`
programático no hace nada y `getBoundingClientRect()` da todo en cero. Frontear
la pestaña y sacar un screenshot una vez destraba el layout; después el resto
del chequeo corre igual con el pane escondido.

**Para sacar capturas**, apagar el movimiento primero, si no el screenshot se
corta por timeout y el carrusel aparece a mitad del fade:

```js
const s = document.createElement('style')
s.textContent = '.pl-slide{animation:none!important;opacity:1!important}.pl-marquee-track{animation-play-state:paused!important}.pl-reveal{opacity:1!important;transform:none!important;transition:none!important}'
document.head.appendChild(s)
```

Y para que entre la página entera en una captura, `document.documentElement.style.zoom = '0.62'`.

