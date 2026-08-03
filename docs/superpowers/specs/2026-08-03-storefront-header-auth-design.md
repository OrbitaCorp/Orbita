# Header del storefront conectado al auth real — Design

**Fecha:** 2026-08-03
**Tickets relacionados:** RBT-627 (Registro y login del cliente) — cierre de la parte visual/entrada de sesión en el storefront.

## Problema

Las pantallas de login, registro y recuperación de contraseña del cliente ya existen y funcionan
contra el backend real (`cliente/auth/Login.tsx`, `Registro.tsx`, `ForgotPassword.tsx`, vía
`useAuth()`). Lo que falta es que **el resto del storefront refleje la sesión real**:

- `StorefrontHeader` recibe un prop `logged?: boolean` que cada página pasa a mano — y varias
  páginas (catálogo, inicio, producto, carrito, cupones) **nunca lo pasan**, así que un cliente
  logueado igual ve el botón "Ingresar".
- Cuando `logged` es true, el header muestra **"María" / "MF" hardcodeado** (no el cliente real).
- No hay forma de **cerrar sesión desde el header**.
- El header **no usa `useAuth()`** en ningún lado.

`AuthProvider` ya envuelve toda la app en `_app.tsx` (todas las páginas del storefront, no solo las
de `RequireAuth`) y hace bootstrap de la sesión en cada carga, así que el header puede consumir
`useAuth()` en cualquier página.

## Objetivo

Que el header y la navegación del storefront reflejen la sesión real del cliente en TODAS las
páginas, con un punto de entrada de login coherente y la posibilidad de cerrar sesión. Las
pantallas de login/registro/recuperación **no se tocan** (ya funcionan).

## Fuera de alcance

- Cupones del cliente (`CuponesPublicos.tsx`, `DescuentoExclusivo.tsx`) — siguen mock.
- El checkout (`Carrito.tsx`, `CheckoutDatos`, `CheckoutPago`) — es de otra persona (RBT-617–621),
  sigue mock; el cupón hardcodeado ahí no es parte de este trabajo.
- Rediseño visual de login/registro.

## Arquitectura

`StorefrontHeader` deja de recibir `logged` y usa `useAuth()` internamente. Toda página que
renderice el header refleja la sesión real automáticamente, sin depender de que cada página pase
el prop. Se elimina el prop `logged` de la interfaz del componente y de todos sus call sites, y se
elimina el nombre/inicial hardcodeado.

**Componentes/archivos afectados:**
- `apps/web/src/components/storefront/StorefrontHeader.tsx` — usa `useAuth()`; nuevo dropdown de
  cuenta; maneja los 3 estados; ajusta el menú mobile.
- Call sites que hoy pasan `logged`: `cliente/perfil/Perfil.tsx`, `cliente/pedido/Cancelar.tsx`,
  `Devolucion.tsx`, `Seguimiento.tsx` — se les saca el prop.
- `cliente/perfil/Perfil.tsx` — lee `?tab=` del query para abrir la pestaña correcta.
- (El footer ya tiene links de "Mi cuenta"; no requiere cambios funcionales.)

## Estados del header (esquina derecha, donde hoy está el botón)

1. **`loading`** (sesión resolviéndose): placeholder neutro (círculo tenue), para evitar el
   parpadeo "Ingresar → avatar" en las páginas públicas.
2. **`anonymous`**: botón **"Ingresar"** → `${base}/login` (mismo estilo actual, pero real).
3. **`authenticated` con `type === 'customer'`**: avatar real (imagen si `avatarUrl`, si no las
   iniciales de `firstName`/`lastName`) + primer nombre real → abre un **dropdown**:
   - Mi perfil → `${base}/perfil`
   - Mis pedidos → `${base}/perfil?tab=pedidos`
   - Mis direcciones → `${base}/perfil?tab=direcciones`
   - Cerrar sesión → `useAuth().logout()` + redirect al home de la tienda.

Cualquier otro caso (sin sesión, o una sesión cuyo `type` no es `customer` — no debería pasar por
el aislamiento por tienda) se trata como **anónimo** (muestra "Ingresar"). El header nunca asume
que hay cliente sin confirmarlo.

## Deep-link a tabs de `/perfil`

Hoy `Perfil.tsx` arranca siempre en la pestaña `pedidos` (estado local `useState('pedidos')`). Se
cambia para inicializar la pestaña desde `router.query.tab` si es una de las válidas
(`pedidos | mensajes | direcciones | datos | seguridad`), con `pedidos` como default. Así los
links del dropdown abren la pestaña correcta. `RequireAuth type="customer"` sigue protegiendo la
página igual.

## Cerrar sesión

El item "Cerrar sesión" del dropdown (y su equivalente en el menú mobile) llama a
`await useAuth().logout()` — que ya invalida la sesión real (revoca refresh token + limpia el
token en memoria) — y luego `router.push(${base}/)` (home de la tienda). Se elige el home, no el
login, para que el cliente pueda seguir navegando como invitado. El botón "Cerrar sesión" que ya
existe dentro de `/perfil` (sidebar y tab seguridad, ya cableado a `logout()` en la tarea previa)
queda como está.

## Mobile

El menú hamburguesa del header incluye las mismas opciones según el estado: "Ingresar" si es
invitado; "Mi perfil / Mis pedidos / Mis direcciones / Cerrar sesión" si hay cliente logueado.
Se reutiliza la misma lógica de estado (`useAuth()`), sin duplicar la fuente de verdad.

## Manejo de errores / bordes

- **Flicker de carga:** mientras `status === 'loading'`, no se muestra ni "Ingresar" ni el avatar,
  sino el placeholder neutro; se resuelve solo cuando el bootstrap de `AuthProvider` termina.
- **Logout que falla:** `useAuth().logout()` ya hace `.catch(() => {})` del lado de red y limpia
  el estado local igual; el redirect ocurre siempre.
- **Sesión de otro tenant:** el bootstrap de `AuthProvider` ya resuelve a `anonymous` si el token
  no es válido para esta tienda; el header no necesita lógica extra.

## Testing / verificación

Es UI con estado, no agrega endpoints ni lógica de backend, así que no lleva e2e nuevo. La
verificación es:
1. `cd apps/web && npx tsc --noEmit -p tsconfig.json` — sin errores.
2. Chequeo manual en navegador (con la limitación conocida de subdominios): como invitado se ve
   "Ingresar"; logueado se ve el nombre real + dropdown; cerrar sesión vuelve al home como
   invitado; el deep-link a tabs abre la pestaña correcta.

Si el storefront no se puede levantar end-to-end en la sesión de trabajo, se documenta la
verificación visual como pendiente (mismo criterio que las tareas previas de cuenta cliente).
