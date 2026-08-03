# Header del Storefront Conectado al Auth Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans o superpowers:subagent-driven-development. Steps usan checkbox (`- [ ]`).

**Goal:** Que `StorefrontHeader` refleje la sesión real del cliente (`useAuth()`) en TODAS las páginas del storefront, con botón de login real, menú de cuenta con dropdown y cerrar sesión.

**Architecture:** `StorefrontHeader` deja de recibir el prop `logged` y consume `useAuth()` internamente (el `AuthProvider` ya envuelve toda la app en `_app.tsx`). Se elimina el prop de todos los call sites y el nombre/inicial hardcodeado. `Perfil.tsx` lee `?tab=` para el deep-link del dropdown.

**Tech Stack:** Next.js (Pages Router) + React, `useAuth()` (`@/hooks/useAuth` → `@/lib/auth/AuthContext`), estilos inline + `<style>` existentes. Sin librerías nuevas.

## Global Constraints

- **Fuente de verdad única:** el estado de sesión sale SIEMPRE de `useAuth()`, nunca de un prop ni de un mock. Se elimina el prop `logged` de `StorefrontHeader` y de todos sus call sites.
- **Solo customer:** el menú de cuenta se muestra únicamente si `user?.type === 'customer'`. Cualquier otro caso (loading, anonymous, u otro type) → botón "Ingresar" (o placeholder en loading).
- **Sin fetch extra en el header:** el avatar usa las INICIALES de `firstName`/`lastName` (el `AuthUser` de customer no trae `avatarUrl` — vive solo en `/me`). Desvío consciente del spec para no pegarle a `/me` en cada página; si más adelante se quiere la foto en el header, es un follow-up (extender el shape de auth).
- **Cerrar sesión → home de la tienda:** `await logout()` + `router.push(\`${base}/\`)`.
- **Tokens/UX de código:** tokens `var(--color-*)`, nunca hex nuevos (se respetan los hex ya presentes en el archivo); named exports; el JSX/estilos existentes no se rediseñan, solo se reconecta el bloque de sesión.
- **Commits** en `main`, en español, minúscula, con trailer `Co-Authored-By`.

---

## File Structure

- `apps/web/src/components/storefront/StorefrontHeader.tsx` — usa `useAuth()`; reemplaza el bloque `logged ? … : …` (L234-248) por los 3 estados + dropdown; agrega sección de cuenta al drawer mobile (L258-266); saca el prop `logged` de `Props`.
- `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx` — quita `logged` del `<StorefrontHeader>`; inicializa la pestaña desde `router.query.tab`.
- `apps/web/src/modules/ventas/cliente/pedido/Cancelar.tsx`, `Devolucion.tsx`, `Seguimiento.tsx` — quitan `logged` del `<StorefrontHeader>`.
- (Las páginas que hoy NO pasan `logged` — catálogo, inicio, producto, carrito, cupones — no requieren cambios: ya no hay prop que pasar.)

---

## Task 1: Header consume `useAuth()` (3 estados + dropdown + mobile) y se elimina el prop `logged`

**Files:**
- Modify: `apps/web/src/components/storefront/StorefrontHeader.tsx`
- Modify: `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx` (solo sacar `logged` del header)
- Modify: `apps/web/src/modules/ventas/cliente/pedido/Cancelar.tsx`, `Devolucion.tsx`, `Seguimiento.tsx` (sacar `logged`)

**Interfaces:**
- Consumes: `useAuth()` → `{ status: 'loading'|'authenticated'|'anonymous', user, logout }`. `user` cuando es customer: `{ type: 'customer', customer: { id, firstName, lastName, email }, business }`.
- Produces: `StorefrontHeader` sin prop `logged` en `Props`.

- [ ] **Step 1: Imports + helper de iniciales**

En `StorefrontHeader.tsx`, agregar el import y un helper arriba del componente:

```typescript
import { useAuth } from '@/hooks/useAuth'
// ... (dejar los imports de lucide; agregar los íconos nuevos: Package, MapPin, LogOut)
import { ShoppingBag, Search, User, Menu, X, ArrowRight, ShoppingCart, Minus, Plus, Trash2, Package, MapPin, LogOut } from 'lucide-react'

function inicialesDe(firstName?: string, lastName?: string | null): string {
  const a = (firstName ?? '').trim()[0] ?? ''
  const b = (lastName ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase() || 'U'
}
```

- [ ] **Step 2: Sacar `logged` de `Props` y leer el auth**

Quitar `logged?: boolean` de `Props` (L11) y de la desestructuración (L26). Dentro del componente, agregar:

```typescript
const { status, user, logout } = useAuth()
const cliente = user?.type === 'customer' ? user.customer : null
const [accountOpen, setAccountOpen] = useState(false)
const accountRef = useRef<HTMLDivElement>(null)

// Cerrar el dropdown al clickear afuera.
useEffect(() => {
  if (!accountOpen) return
  function onDown(e: MouseEvent) {
    if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
  }
  document.addEventListener('mousedown', onDown)
  return () => document.removeEventListener('mousedown', onDown)
}, [accountOpen])

async function handleLogout() {
  setAccountOpen(false)
  setMenuOpen(false)
  await logout()
  router.push(`${base}/`)
}

// Items del menú de cuenta (dropdown desktop + drawer mobile).
const accountLinks = [
  { label: 'Mi perfil',      Icon: User,    href: `${base}/perfil` },
  { label: 'Mis pedidos',    Icon: Package, href: `${base}/perfil?tab=pedidos` },
  { label: 'Mis direcciones', Icon: MapPin, href: `${base}/perfil?tab=direcciones` },
]
```

- [ ] **Step 3: Reemplazar el bloque desktop `logged ? … : …` (L234-248)**

```tsx
{status === 'loading' ? (
  // Placeholder neutro: evita el parpadeo "Ingresar → avatar" en páginas públicas.
  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface)' }} />
) : cliente ? (
  <div ref={accountRef} style={{ position: 'relative' }}>
    <button
      onClick={() => setAccountOpen(o => !o)}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 6px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer' }}
    >
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #F472B6, #FB923C)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {inicialesDe(cliente.firstName, cliente.lastName)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{cliente.firstName}</span>
    </button>
    {accountOpen && (
      <div style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 200,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 60,
      }}>
        {accountLinks.map(l => (
          <button key={l.label} onClick={() => { setAccountOpen(false); router.push(l.href) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 13, color: 'var(--color-text)', textAlign: 'left' }}>
            <l.Icon size={15} strokeWidth={1.5} color="var(--color-muted)" /> {l.label}
          </button>
        ))}
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-error)', fontWeight: 600, textAlign: 'left' }}>
          <LogOut size={15} strokeWidth={1.5} /> Cerrar sesión
        </button>
      </div>
    )}
  </div>
) : (
  <button
    onClick={() => router.push(`${base}/login`)}
    style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms', flexShrink: 0 }}
    onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
    onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
  >
    <User size={14} strokeWidth={2} /> Ingresar
  </button>
)}
```

- [ ] **Step 4: Agregar la sección de cuenta al drawer mobile (después de los `navLinks`, L258-266)**

```tsx
{menuOpen && (
  <nav className="sf-drawer">
    {navLinks.map(s => (
      <a key={s.label} href={`${base}${s.path}`} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
        {s.label}
      </a>
    ))}
    {status !== 'loading' && (cliente ? (
      <>
        {accountLinks.map(l => (
          <a key={l.label} href={l.href} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
            <l.Icon size={16} strokeWidth={1.5} /> {l.label}
          </a>
        ))}
        <button onClick={handleLogout} className="sf-drawer-link" style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', color: 'var(--color-error)', fontWeight: 600 }}>
          <LogOut size={16} strokeWidth={1.5} /> Cerrar sesión
        </button>
      </>
    ) : (
      <a href={`${base}/login`} className="sf-drawer-link" onClick={() => setMenuOpen(false)}>
        <User size={16} strokeWidth={1.5} /> Ingresar
      </a>
    ))}
  </nav>
)}
```

- [ ] **Step 5: Sacar `logged` de los call sites**

En `Perfil.tsx`, `pedido/Cancelar.tsx`, `pedido/Devolucion.tsx`, `pedido/Seguimiento.tsx`: cambiar
`<StorefrontHeader tienda={TIENDA} carrito={CARRITO_INICIAL} logged />`
por
`<StorefrontHeader tienda={TIENDA} carrito={CARRITO_INICIAL} />`.

- [ ] **Step 6: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores (si queda algún call site pasando `logged`, tsc lo marca — corregirlo).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/storefront/StorefrontHeader.tsx apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx apps/web/src/modules/ventas/cliente/pedido
git commit -m "feat(storefront): header conectado al auth real con menu de cuenta (RBT-627)"
```

---

## Task 2: Deep-link a las pestañas de `/perfil` vía `?tab=`

**Files:**
- Modify: `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx`

**Interfaces:**
- Consumes: `router.query.tab` (string).
- Produces: la pestaña inicial de `Perfil` sale de `?tab=` si es válida.

- [ ] **Step 1: Inicializar la pestaña desde el query**

En `Perfil.tsx`, hoy `const [tab, setTab] = useState<Tab>('pedidos')`. Reemplazar por una inicialización que valide el query (las claves válidas son las de `TABS`):

```typescript
const TAB_IDS: Tab[] = ['pedidos', 'mensajes', 'direcciones', 'datos', 'seguridad']
const tabQuery = router.query.tab
const tabInicial: Tab = typeof tabQuery === 'string' && (TAB_IDS as string[]).includes(tabQuery) ? (tabQuery as Tab) : 'pedidos'
const [tab, setTab] = useState<Tab>(tabInicial)

// Si el query cambia (navegación entre items del dropdown sin desmontar la página),
// sincronizar la pestaña.
useEffect(() => {
  if (typeof tabQuery === 'string' && (TAB_IDS as string[]).includes(tabQuery)) setTab(tabQuery as Tab)
}, [tabQuery])
```

> Nota: `router.query` puede llegar vacío en el primer render (hidratación de Next). El `useEffect` cubre ese caso — cuando el query se puebla, sincroniza. `pedidos` es el default seguro mientras tanto.

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx
git commit -m "feat(storefront): deep-link a las tabs de /perfil via ?tab= (RBT-627)"
```

---

## Verificación final (manual, si el storefront se puede levantar)

Seguir el workflow de preview (dev server del storefront). Con la limitación de subdominios, si no se puede levantar end-to-end, documentar la verificación visual como pendiente en `PENDIENTES.md` (mismo criterio que las tareas de cuenta cliente). Checklist:
1. Invitado (sin sesión): el header muestra **"Ingresar"** en todas las páginas (catálogo, inicio, producto, perfil-redirect).
2. Logueado como customer: el header muestra las iniciales + primer nombre reales; el dropdown abre con Mi perfil / Mis pedidos / Mis direcciones / Cerrar sesión.
3. "Mis pedidos" / "Mis direcciones" abren `/perfil` en la pestaña correcta.
4. "Cerrar sesión" vuelve al home de la tienda y el header pasa a "Ingresar".
5. Mobile: el hamburguesa muestra las mismas opciones según el estado.
6. Sin parpadeo notorio "Ingresar → avatar" al cargar una página pública con sesión activa.

---

## Self-Review

**Spec coverage:**
- ✅ Header usa `useAuth()`, se elimina el prop `logged` → Task 1.
- ✅ 3 estados (loading/anonymous/authenticated-customer) → Task 1 Step 3.
- ✅ Dropdown con Mi perfil/Mis pedidos/Mis direcciones/Cerrar sesión → Task 1 Step 3.
- ✅ Deep-link a tabs → Task 2.
- ✅ Cerrar sesión → `logout()` + home de la tienda → Task 1 Step 2 (`handleLogout`).
- ✅ Mobile → Task 1 Step 4.
- ✅ Solo customer / borde de aislamiento → `cliente = user?.type === 'customer' ? … : null`.
- ⚠️ **Desvío del spec:** avatar por iniciales (no imagen), porque `AuthUser` de customer no trae `avatarUrl`. Documentado en Global Constraints. Follow-up opcional si se quiere la foto en el header.

**Placeholder scan:** sin TODO/TBD; todos los pasos con código concreto.

**Type consistency:** `Tab` y `TABS` ya existen en `Perfil.tsx`; `accountLinks`/`inicialesDe`/`cliente` definidos en Task 1 y usados coherentemente en desktop y mobile. `useAuth()` shape confirmado contra `AuthContext.tsx`.
