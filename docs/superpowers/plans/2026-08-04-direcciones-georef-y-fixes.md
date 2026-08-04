# Direcciones: Autocompletado Georef + Fixes de UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`) para trackear.

**Goal:** Conectar la API pública Georef (gobierno argentino) a "Mis direcciones" para autocompletar provincia/ciudad al tipear la calle, arreglar el bug de duplicados al crear una dirección, y rediseñar el modal (piso/depto claramente opcionales, "Entre calles" reemplazado por un campo libre de "Referencia" al estilo Mercado Libre).

**Architecture:** Georef (`apis.datos.gob.ar/georef`) es pública, sin API key, con CORS abierto (`Access-Control-Allow-Origin: *`, confirmado por request real) — se llama **directo desde el frontend**, sin proxy de backend. El bug de "dos ítems" es un doble-submit clásico (el botón no se deshabilita mientras guarda) — el refresco de la lista después de crear ya funciona bien, no hace falta tocar esa parte. Se extrae la tab de "Direcciones" de `Perfil.tsx` (ya ronda las 650 líneas haciendo pedidos+direcciones+datos+seguridad) a su propio componente, porque el autocompletado le suma estado y lógica que no tiene sentido seguir apilando en el archivo gigante.

**Tech Stack:** NestJS + Prisma (backend, solo para el rename de campo) en `apps/api`; Next.js + React en `apps/web`, fetch directo a Georef sin librería nueva.

## Global Constraints

- **Georef se llama directo desde el navegador**, sin pasar por nuestro backend (confirmado CORS abierto). No inventar un endpoint proxy que no hace falta.
- **Nunca bloquear el submit por Georef**: es un asistente de autocompletado, no una validación. Si Georef no encuentra nada o falla, el usuario igual puede tipear todo a mano y guardar.
- **`referencia` (ex `entreCalles`) sigue siendo opcional**, igual que `floor`/`depto`/`provincia`/`zip`. Solo `street` y `city` son obligatorios — eso ya está bien en el backend, no se toca.
- **Un solo negocio, un solo cliente:** todo sigue pasando por `assertCustomerContext` — este plan no toca aislamiento, ya está resuelto.
- **Reglas de código heredadas:** archivos chicos y con una responsabilidad, tokens `var(--color-*)` (nunca hex nuevos, salvo los que ya existen en el archivo), sin librerías de estado nuevas (segue con `useState`/`useEffect` simple, como el resto del módulo).
- **`code` en el commit final:** commits en español, minúscula, con trailer `Co-Authored-By`. El equipo trabaja directo sobre `main`.

---

## File Structure

**Backend — rename `entreCalles` → `referencia`:**
- `apps/api/prisma/schema.prisma` — campo `Address.referencia` (modificar).
- `apps/api/prisma/migrations/` — nueva migración que **renombra** la columna (no drop+add, para no perder datos si ya hay direcciones cargadas).
- `apps/api/src/customers/dto/upsert-address.dto.ts` — `entreCalles?` → `referencia?` (modificar).
- `apps/api/test/me-addresses.e2e-spec.ts` — actualizar el campo en el test existente (modificar).

**Frontend — cliente Georef (nuevo, aislado):**
- `apps/web/src/lib/georef.ts` — función `buscarDireccion()` que le pega a la API pública (crear).

**Frontend — extracción de la tab de Direcciones (nuevo componente):**
- `apps/web/src/modules/ventas/cliente/perfil/components/DireccionesTab.tsx` — toda la lógica de direcciones que hoy vive inline en `Perfil.tsx` (listado, modal, autocompletado, fix del doble-submit) (crear).
- `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx` — se le saca todo el bloque de direcciones (estado, handlers, JSX) y se reemplaza por `<DireccionesTab />` (modificar).
- `apps/web/src/lib/api.ts` — `MeAddress`/`MeAddressInput`: `entreCalles` → `referencia` (modificar).

---

## Task 1: Backend — renombrar `entreCalles` a `referencia`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_rename_entre_calles_to_referencia/migration.sql`
- Modify: `apps/api/src/customers/dto/upsert-address.dto.ts`
- Modify: `apps/api/test/me-addresses.e2e-spec.ts`

**Interfaces:**
- Produces: `Address.referencia: string | null` (antes `entreCalles`), mismo nombre en columna y campo Prisma (sin `@map`, a diferencia del `entre_calles` viejo que sí lo necesitaba).

> **Antes de escribir código:** `AddressesService` (`apps/api/src/customers/addresses.service.ts`) hace `data: { customerId, ...dto }` — no menciona `entreCalles` explícitamente en ningún lado, así que renombrar el DTO alcanza, no hay que tocar el service.

- [ ] **Step 1: Editar el schema**

En `apps/api/prisma/schema.prisma`, dentro de `model Address`, cambiar:

```prisma
  entreCalles String?  @map("entre_calles")
```

por:

```prisma
  referencia  String?
```

- [ ] **Step 2: Generar la migración SIN aplicar, para escribir el RENAME a mano**

Run: `cd apps/api && npx prisma migrate dev --create-only --name rename_entre_calles_to_referencia`
Expected: crea la carpeta de migración con un `migration.sql` que por default va a tener un `DROP COLUMN` + `ADD COLUMN` (Prisma no detecta renames solo). **No lo apliques todavía.**

- [ ] **Step 3: Reemplazar el contenido de esa migración por un RENAME real**

Abrir el `migration.sql` generado y reemplazar TODO su contenido por:

```sql
ALTER TABLE "addresses" RENAME COLUMN "entre_calles" TO "referencia";
```

(Esto preserva cualquier dato que ya exista en esa columna, a diferencia de drop+add.)

- [ ] **Step 4: Aplicar la migración**

Run: `cd apps/api && npx prisma migrate dev`
Expected: aplica la migración pendiente contra la base compartida, corre `prisma generate` solo, sin errores.

- [ ] **Step 5: Actualizar el DTO**

En `apps/api/src/customers/dto/upsert-address.dto.ts`, cambiar:

```typescript
@IsOptional() @IsString() entreCalles?: string;
```

por:

```typescript
@IsOptional() @IsString() referencia?: string;
```

- [ ] **Step 6: Actualizar el test existente**

En `apps/api/test/me-addresses.e2e-spec.ts` línea ~55 y ~61, cambiar `entreCalles: 'Corrientes y Callao'` por `referencia: 'Portón azul, timbre 3B'` (dato más representativo del nuevo uso) y `expect(alta.body.entreCalles)` por `expect(alta.body.referencia)`.

- [ ] **Step 7: Typecheck + test**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json && npx prisma db seed > /dev/null && npx jest --config test/jest-e2e.json me-addresses.e2e-spec.ts --runInBand --forceExit`
Expected: tsc sin errores; 5/5 tests verdes.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma apps/api/src/customers/dto/upsert-address.dto.ts apps/api/test/me-addresses.e2e-spec.ts
git commit -m "refactor(direcciones): renombrar entreCalles a referencia (campo libre, no cruce de calles)"
```

---

## Task 2: Cliente de Georef (`lib/georef.ts`)

**Files:**
- Create: `apps/web/src/lib/georef.ts`

**Interfaces:**
- Produces: `buscarDireccion(texto: string, opts?: { max?: number; signal?: AbortSignal }): Promise<GeorefDireccion[]>`, tipo `GeorefDireccion = { nomenclatura: string; calle: string; altura: number | null; provincia: string; ciudad: string }`.

> **Contrato real de la API** (verificado con un request contra `https://apis.datos.gob.ar/georef/api/direcciones?direccion=Av%20Corrientes%201234&provincia=caba&max=1`, `Access-Control-Allow-Origin: *` confirmado):
> ```json
> {
>   "direcciones": [{
>     "altura": { "valor": 1234 },
>     "calle": { "nombre": "AV CORRIENTES" },
>     "departamento": { "nombre": "Comuna 1" },
>     "localidad_censal": { "nombre": "Ciudad Autónoma de Buenos Aires" },
>     "nomenclatura": "AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires",
>     "provincia": { "nombre": "Ciudad Autónoma de Buenos Aires" }
>   }]
> }
> ```
> Mapeo a nuestros campos: `city` ← `localidad_censal.nombre` (es la ciudad/localidad real, ej. "La Plata"; para CABA es "Ciudad Autónoma de Buenos Aires"). `provincia` ← `provincia.nombre`. **No trae código postal** — confirmado, no hay ningún campo CP en la respuesta; el campo CP del form sigue siendo 100% manual.

- [ ] **Step 1: Escribir el cliente**

```typescript
// apps/web/src/lib/georef.ts
//
// Cliente de la API pública Georef (Ministerio del Interior — apis.datos.gob.ar/georef):
// normaliza direcciones argentinas y devuelve provincia/localidad. Gratuita, sin API key,
// CORS abierto (Access-Control-Allow-Origin: *) — se llama directo desde el browser, sin
// pasar por nuestro backend. NO devuelve código postal (ver docs de la API): ese campo del
// form de direcciones sigue siendo manual.
//
// Es un asistente de autocompletado, no una validación: si no encuentra nada o falla, el
// usuario sigue pudiendo cargar la dirección a mano sin que nada lo bloquee.

const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api'

export type GeorefDireccion = {
  nomenclatura: string
  calle: string
  altura: number | null
  provincia: string
  ciudad: string
}

type GeorefApiResponse = {
  direcciones: Array<{
    nomenclatura: string
    calle: { nombre: string | null }
    altura: { valor: number | null } | null
    provincia: { nombre: string | null }
    localidad_censal: { nombre: string | null }
  }>
}

export async function buscarDireccion(
  texto: string,
  opts: { max?: number; signal?: AbortSignal } = {},
): Promise<GeorefDireccion[]> {
  const query = texto.trim()
  if (query.length < 5) return [] // muy corto, no vale la pena pegarle a la API

  const qs = new URLSearchParams({ direccion: query, max: String(opts.max ?? 5) })
  const res = await fetch(`${GEOREF_BASE}/direcciones?${qs.toString()}`, { signal: opts.signal })
  if (!res.ok) return [] // fallo silencioso: es autocompletado, no bloquea el form

  const data = (await res.json().catch(() => null)) as GeorefApiResponse | null
  if (!data?.direcciones) return []

  return data.direcciones.map((d) => ({
    nomenclatura: d.nomenclatura,
    calle: d.calle.nombre ?? '',
    altura: d.altura?.valor ?? null,
    provincia: d.provincia.nombre ?? '',
    ciudad: d.localidad_censal.nombre ?? '',
  }))
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Verificación manual rápida (sin test automatizado — es un fetch a una API externa)**

Desde una consola de navegador o Node con fetch: `buscarDireccion('Av Corrientes 1234')` debería devolver al menos un resultado con `ciudad: 'Ciudad Autónoma de Buenos Aires'`. No hace falta un test e2e para esto (dependería de la disponibilidad de un servicio externo de terceros) — la Task 4 sí testea que el componente maneja bien la respuesta, mockeada.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/georef.ts
git commit -m "feat(direcciones): cliente de la API publica Georef para autocompletar provincia/ciudad"
```

---

## Task 3: `lib/api.ts` — renombrar `entreCalles` a `referencia`

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `MeAddress.referencia: string | null`, `MeAddressInput.referencia?: string` (antes `entreCalles`).

- [ ] **Step 1: Renombrar en los dos tipos**

En `apps/web/src/lib/api.ts`, buscar:

```typescript
export type MeAddress = {
  id: string; alias: string | null; street: string; floor: string | null
  depto: string | null; entreCalles: string | null; provincia: string | null
  city: string; zip: string | null; isDefault: boolean
}
export type MeAddressInput = {
  alias?: string; street: string; floor?: string; depto?: string; entreCalles?: string
  provincia?: string; city: string; zip?: string; isDefault?: boolean
}
```

y cambiar `entreCalles` por `referencia` en ambos tipos (mismo lugar, mismo orden).

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: **falla** — `Perfil.tsx` todavía usa `entreCalles` en varios lugares. Es esperado, se arregla en la Task 4 cuando se extrae `DireccionesTab.tsx`. No hace falta commitear esta Task sola; queda agrupada con la Task 4 porque un `tsc` roto a mitad de camino no es un commit válido.

---

## Task 4: Extraer `DireccionesTab.tsx` con el fix de doble-submit y el autocompletado Georef

**Files:**
- Create: `apps/web/src/modules/ventas/cliente/perfil/components/DireccionesTab.tsx`
- Modify: `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx`

**Interfaces:**
- Consumes: `meListAddresses/meCreateAddress/meUpdateAddress/meDeleteAddress` (`lib/api.ts`, ya existen), `buscarDireccion` (Task 2), tipos `MeAddress`/`MeAddressInput` (Task 3, ya renombrados).
- Produces: `export function DireccionesTab(): JSX.Element` — componente autocontenido (carga su propia lista al montar, sin props). `Perfil.tsx` lo renderiza sin pasarle nada.

> **Causa real del bug de "dos ítems":** en el código actual, el botón `<button type="submit">Guardar dirección</button>` no tiene ningún estado de `disabled` mientras la request está en vuelo — un doble click (típico si la red tarda) dispara `handleGuardarDir` dos veces, y como cada vez llama a `meCreateAddress`, se crean DOS direcciones reales en el backend. El refresco de la lista después (`recargarDirecciones()`) ya funciona bien — por eso lo que se ve es "aparecen dos direcciones", no que falte actualizar. La solución es un flag `guardando` que deshabilita el botón, mismo patrón que `guardandoDatos`/`cambiandoPass` que ya existen en `Perfil.tsx`.

- [ ] **Step 1: Escribir el componente completo**

```tsx
// apps/web/src/modules/ventas/cliente/perfil/components/DireccionesTab.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { ApiError, meListAddresses, meCreateAddress, meUpdateAddress, meDeleteAddress } from '@/lib/api'
import type { MeAddress, MeAddressInput } from '@/lib/api'
import { buscarDireccion, type GeorefDireccion } from '@/lib/georef'

const DIR_VACIA: MeAddressInput = { alias: '', street: '', floor: '', depto: '', referencia: '', provincia: '', city: '', zip: '', isDefault: false }

export function DireccionesTab() {
  const [direcciones, setDirecciones] = useState<MeAddress[]>([])
  const recargar = useCallback(() => { meListAddresses().then(setDirecciones).catch(() => {}) }, [])
  useEffect(() => { recargar() }, [recargar])

  const [dirForm, setDirForm] = useState<MeAddressInput>(DIR_VACIA)
  const [editId, setEditId] = useState<string | null>(null)
  const [showDirForm, setShowDirForm] = useState(false)
  const [guardadoDir, setGuardadoDir] = useState(false)
  const [errorDir, setErrorDir] = useState('')
  // Fix del bug de "dos ítems": mientras esto es true, el botón de submit está
  // deshabilitado — un doble click ya no dispara dos POST.
  const [guardando, setGuardando] = useState(false)

  function abrirNuevaDir() { setDirForm(DIR_VACIA); setEditId(null); setErrorDir(''); setShowDirForm(true) }
  function abrirEditarDir(d: MeAddress) {
    setDirForm({
      alias: d.alias ?? '', street: d.street, floor: d.floor ?? '', depto: d.depto ?? '',
      referencia: d.referencia ?? '', provincia: d.provincia ?? '', city: d.city, zip: d.zip ?? '', isDefault: d.isDefault,
    })
    setEditId(d.id); setErrorDir(''); setShowDirForm(true)
  }
  const setDF = (k: keyof MeAddressInput) => (v: string | boolean) => setDirForm((f) => ({ ...f, [k]: v }))

  async function handleGuardarDir(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // segunda barrera: ignora un submit mientras ya hay uno en vuelo
    setErrorDir('')
    if (!dirForm.street.trim() || !dirForm.city.trim()) { setErrorDir('La calle y la ciudad son obligatorias.'); return }
    setGuardando(true)
    try {
      const input: MeAddressInput = {
        alias: dirForm.alias || undefined, street: dirForm.street, floor: dirForm.floor || undefined,
        depto: dirForm.depto || undefined, referencia: dirForm.referencia || undefined,
        provincia: dirForm.provincia || undefined, city: dirForm.city, zip: dirForm.zip || undefined,
        isDefault: dirForm.isDefault,
      }
      if (editId) await meUpdateAddress(editId, input)
      else await meCreateAddress(input)
      setShowDirForm(false)
      recargar()
      setGuardadoDir(true)
      setTimeout(() => setGuardadoDir(false), 2500)
    } catch (err) {
      setErrorDir(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleBorrarDir(id: string) {
    try { await meDeleteAddress(id); recargar() } catch { /* noop */ }
  }

  // ── Autocompletado Georef (calle y número → provincia/ciudad) ────────────
  const [sugerencias, setSugerencias] = useState<GeorefDireccion[]>([])
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function handleStreetChange(v: string) {
    setDF('street')(v)
    setSugerencias([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    if (v.trim().length < 5) return
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setBuscandoDireccion(true)
      try {
        const resultados = await buscarDireccion(v, { signal: controller.signal })
        setSugerencias(resultados)
      } catch {
        // Georef es un asistente, no bloquea: un fallo de red simplemente no ofrece sugerencias.
      } finally {
        setBuscandoDireccion(false)
      }
    }, 500)
  }

  function elegirSugerencia(s: GeorefDireccion) {
    setDirForm((f) => ({
      ...f,
      street: s.altura ? `${s.calle} ${s.altura}` : s.calle,
      provincia: s.provincia,
      city: s.ciudad,
    }))
    setSugerencias([])
  }

  return (
    <div>
      {guardadoDir && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
          <CheckCircle2 size={15} /> Dirección guardada correctamente
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {direcciones.length === 0 && !showDirForm && (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--color-muted)', border: '1px dashed var(--color-border)', borderRadius: 12 }}>
            Todavía no cargaste ninguna dirección.
          </div>
        )}
        {direcciones.map(d => (
          <div key={d.id} style={{
            background: 'var(--color-bg)', border: `2px solid ${d.isDefault ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: d.isDefault ? 'var(--color-primary-bg)' : 'var(--color-surface)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MapPin size={16} strokeWidth={1.5} color={d.isDefault ? 'var(--color-primary)' : 'var(--color-muted)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{d.alias || 'Dirección'}</span>
                {d.isDefault && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>
                    Predeterminada
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
                {d.street}{d.floor ? ` · Piso ${d.floor}` : ''}{d.depto ? ` · Depto ${d.depto}` : ''}<br />
                {d.city}{d.provincia ? `, ${d.provincia}` : ''}{d.zip ? ` · CP ${d.zip}` : ''}
                {d.referencia && <><br /><span style={{ color: 'var(--color-muted)' }}>Ref: {d.referencia}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirEditarDir(d)} style={{ height: 32, padding: '0 12px', borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={12} strokeWidth={1.5} /> Editar
              </button>
              <button onClick={() => handleBorrarDir(d.id)} aria-label="Eliminar dirección" style={{ height: 32, width: 32, borderRadius: 7, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-error)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showDirForm ? (
        <button onClick={abrirNuevaDir} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 10, background: 'var(--color-bg)', border: '1px dashed var(--color-border)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 150ms' }}>
          <Plus size={15} strokeWidth={2} /> Agregar nueva dirección
        </button>
      ) : (
        <form onSubmit={handleGuardarDir} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>{editId ? 'Editar dirección' : 'Nueva dirección'}</div>
          {errorDir && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--color-error)', marginBottom: 14 }}>{errorDir}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FI label="Alias (ej: Casa, Trabajo)"><input value={dirForm.alias} onChange={e => setDF('alias')(e.target.value)} placeholder="Mi casa" style={inputStyle} /></FI>

            <div style={{ position: 'relative' }}>
              <FI label="Calle y número">
                <input
                  value={dirForm.street}
                  onChange={e => handleStreetChange(e.target.value)}
                  onBlur={() => setTimeout(() => setSugerencias([]), 150)} // delay para permitir el click en una sugerencia
                  placeholder="Av. Corrientes 1234"
                  style={inputStyle}
                  autoComplete="off"
                />
              </FI>
              {buscandoDireccion && (
                <div style={{ position: 'absolute', right: 12, top: 34, fontSize: 11, color: 'var(--color-muted)' }}>Buscando…</div>
              )}
              {sugerencias.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {sugerencias.map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onMouseDown={() => elegirSugerencia(s)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: 13, color: 'var(--color-text)', background: 'transparent', border: 'none', borderBottom: i < sugerencias.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}
                    >
                      {s.nomenclatura}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FI label="Piso (opcional)"><input value={dirForm.floor} onChange={e => setDF('floor')(e.target.value)} placeholder="3" style={inputStyle} /></FI>
              <FI label="Depto (opcional)"><input value={dirForm.depto} onChange={e => setDF('depto')(e.target.value)} placeholder="A" style={inputStyle} /></FI>
            </div>
            <FI label="Referencia (opcional)">
              <input value={dirForm.referencia} onChange={e => setDF('referencia')(e.target.value)} placeholder="Ej: portón azul, al lado de la farmacia" style={inputStyle} />
            </FI>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
              <FI label="Ciudad"><input value={dirForm.city} onChange={e => setDF('city')(e.target.value)} placeholder="CABA" style={inputStyle} /></FI>
              <FI label="Provincia (opcional)"><input value={dirForm.provincia} onChange={e => setDF('provincia')(e.target.value)} placeholder="Buenos Aires" style={inputStyle} /></FI>
              <FI label="CP (opcional)"><input value={dirForm.zip} onChange={e => setDF('zip')(e.target.value)} placeholder="C1043" style={inputStyle} /></FI>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!dirForm.isDefault} onChange={e => setDF('isDefault')(e.target.checked)} />
              Usar como dirección predeterminada
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={guardando} style={{ height: 40, padding: '0 20px', borderRadius: 8, background: guardando ? 'var(--color-surface-alt)' : 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: guardando ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar dirección'}
            </button>
            <button type="button" disabled={guardando} onClick={() => setShowDirForm(false)} style={{ height: 40, padding: '0 16px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-body)', fontSize: 13, fontWeight: 500, border: '1px solid var(--color-border)', cursor: guardando ? 'default' : 'pointer' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px',
  borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

function FI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</label>
      {children}
    </div>
  )
}
```

> Nota sobre `onBlur`+`onMouseDown`: es el mismo patrón que usa cualquier combobox — `onBlur` del input se dispara ANTES que el `onClick` de una sugerencia, así que si se cerrara la lista en el `onBlur` inmediatamente, el click en la sugerencia nunca llegaría a registrarse. Por eso el `onBlur` tiene un delay de 150ms (le da tiempo al click) y el picker de sugerencia usa `onMouseDown` (dispara antes que `onBlur` en la secuencia de eventos del navegador) en vez de `onClick`.

- [ ] **Step 2: Reemplazar el bloque de direcciones en `Perfil.tsx`**

En `apps/web/src/modules/ventas/cliente/perfil/Perfil.tsx`:

1. Agregar el import: `import { DireccionesTab } from './components/DireccionesTab'`
2. Sacar del import de `lib/api.ts` lo que ya no se usa ahí (`meListAddresses, meCreateAddress, meUpdateAddress, meDeleteAddress` y los tipos `MeAddress, MeAddressInput` — quedan usados únicamente dentro de `DireccionesTab.tsx`).
3. Sacar la constante `DIR_VACIA` (se movió al nuevo componente).
4. Sacar del estado: `direcciones`, `dirForm`, `editId`, `showDirForm`, `guardadoDir`, `errorDir`, y la función `recargarDirecciones` (ojo: `recargarDirecciones` se sigue llamando en el `useEffect` de arranque para `meListOrders`/`meGetProfile` — revisar que no quede una llamada colgada a una función que ya no existe; si el `useEffect` de arranque llamaba a `recargarDirecciones()` junto con el resto, sacar esa línea también, ya que ahora `DireccionesTab` carga sus propias direcciones al montarse).
5. Sacar las funciones `abrirNuevaDir`, `abrirEditarDir`, `setDF`, `handleGuardarDir`, `handleBorrarDir`.
6. En el JSX, reemplazar todo el bloque `{tab === 'direcciones' && (<div>...todo el contenido...</div>)}` por:

```tsx
{tab === 'direcciones' && <DireccionesTab />}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si queda algo sin usar (import muerto), sacarlo.

- [ ] **Step 4: Verificación en navegador**

Seguir el workflow de preview: levantar frontend+backend, loguearse como cliente de storefront, ir a `/perfil?tab=direcciones`, y probar:
1. Tipear "Av Corrientes 1234" en "Calle y número" → aparece un dropdown de sugerencias en <1seg tras dejar de tipear; clickear una → se completan Provincia y Ciudad solos.
2. Dejar Piso/Depto/Referencia vacíos y guardar → guarda sin error (ya eran opcionales, ahora además lo dice la etiqueta).
3. Click rápido doble en "Guardar dirección" → se crea UNA sola dirección (el botón queda deshabilitado con "Guardando…" en el segundo click).
4. La lista se actualiza sola apenas se guarda, sin recargar la página.
5. Editar una dirección existente precarga bien el campo "Referencia" (antes "Entre calles").

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/ventas/cliente/perfil
git commit -m "feat(direcciones): autocompletado Georef, fix doble-submit y campo Referencia (RBT-629)"
```

---

## Verificación final

Run: `cd apps/api && npx prisma db seed > /dev/null && npm run test:e2e` (ya corre serial por el fix de RBT-616/627)
Expected: toda la suite verde, sin regresiones en `me-addresses.e2e-spec.ts` ni en el resto.

---

## Self-Review

**Spec coverage:**
- ✅ Georef conectado a "Mis direcciones", autocompleta provincia/ciudad al tipear calle → Task 2 + Task 4.
- ✅ Bug de "dos ítems" al crear → identificado como doble-submit (Task 4), no un problema de refresco (que ya andaba bien).
- ✅ "Debe actualizarse la lista sola al aceptar" → ya funcionaba (`recargar()` tras crear/editar); confirmado explícitamente en el checklist de verificación de la Task 4.
- ✅ Piso/Depto claramente opcionales → etiquetas actualizadas a "(opcional)" en Task 4 (ya eran opcionales en el backend, esto es un tema de claridad visual).
- ✅ "Entre calles" reemplazado por "Referencia" (texto libre, estilo Mercado Libre) → Task 1 (backend) + Task 3 (tipos) + Task 4 (UI, con placeholder de ejemplo "portón azul").

**Placeholder scan:** sin TODO/TBD; el componente de la Task 4 está completo, no es un esqueleto.

**Type consistency:** `MeAddress`/`MeAddressInput.referencia` (Task 3) se usa igual en `DireccionesTab.tsx` (Task 4). `GeorefDireccion` (Task 2) se consume con los mismos campos (`nomenclatura`, `calle`, `altura`, `provincia`, `ciudad`) en `elegirSugerencia()` (Task 4).

**Riesgos / decisiones para revisar:**
1. **La migración de Task 1 debe ser un RENAME, no drop+add** — si se aplica el `migration.sql` que Prisma genera por default sin editarlo a mano, se pierde cualquier dato ya cargado en `entre_calles`. El Step 3 de la Task 1 es crítico, no se puede saltear.
2. **Georef puede estar caído o lento** — el diseño ya lo contempla (fallo silencioso, nunca bloquea el submit), pero vale la pena confirmarlo en la verificación manual apagando el wifi un segundo mientras se tipea, para ver que no rompe nada.
3. **Orden de ejecución sugerido:** Task 1 y Task 2 son independientes entre sí (pueden ir en paralelo si hay dos personas). Task 3 depende de Task 1 (mismo nombre de campo). Task 4 depende de Task 2 y Task 3.
