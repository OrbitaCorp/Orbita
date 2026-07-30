# Incidencia de seguridad: Falta de aislamiento multi-tenant en Auth

**Proyecto:** Orbita  
**Fecha de detección:** 17 de julio de 2026  
**Severidad:** Crítica  
**Estado:** Identificada — corrección pendiente  
**Tareas Jira afectadas:** RBT-284, RBT-285, RBT-286, RBT-290

---

## Resumen ejecutivo

Se detectó una falla en la lógica de autenticación que compromete el aislamiento entre negocios (tenants). El sistema permite que un usuario autenticado como member de un negocio sea reconocido con ese rol desde el subdominio de otro negocio, lo que podría dar acceso no autorizado al panel de administración de un negocio ajeno.

Además, el flujo de registro impide que un usuario que ya existe en Supabase Auth pueda registrarse como cliente en otra tienda, bloqueando un caso de uso legítimo en un sistema multi-tenant.

---

## Contexto técnico

Orbita es una plataforma multi-tenant donde cada negocio opera bajo su propio subdominio (`tienda.orbita.com`). La autenticación se delega a Supabase Auth, que mantiene un registro global de usuarios (un email = un usuario). Sobre esa capa, el backend maneja dos tablas de relación:

- **members**: usuarios del panel admin, con un `business_id` que los vincula a un negocio específico.
- **customers**: clientes del storefront, también con un `business_id`.

Una misma persona puede ser member de un negocio y customer de otro, compartiendo el mismo `auth_user_id` de Supabase.

El frontend envía el header `X-Business-Slug` para indicar desde qué negocio (subdominio) viene cada request.

---

## Problema 1: Login sin filtro por negocio

### Comportamiento actual

Cuando un usuario hace login, el backend:

1. Valida credenciales con Supabase → obtiene `auth_user_id`
2. Busca en `members` por `auth_user_id` **sin filtrar por `business_id`**
3. Si encuentra un member (de cualquier negocio) → devuelve `type: 'member'`
4. Solo si no encuentra member → busca en `customers` con el `business_id` del slug

### Riesgo

Si Lorena es dueña de `lorena.orbita.com` y hace login desde `otratienda.orbita.com`, el backend la encuentra como member de "lorena" (no de "otratienda") y devuelve `type: 'member'`. Dependiendo de cómo el frontend maneje ese response, Lorena podría acceder al panel de administración de un negocio que no es suyo.

### Comportamiento esperado

El login desde un subdominio (`X-Business-Slug` presente) debe buscar member y customer **filtrados por el `business_id` de ese negocio**. Ser member de otro negocio no tiene ninguna relevancia en el contexto de "otratienda".

---

## Problema 2: Registro bloqueado por email existente

### Comportamiento actual

`POST /auth/register` llama a `admin.createUser()` en Supabase. Si el email ya existe (porque el usuario es dueño de otro negocio), Supabase devuelve un error de duplicado y el registro falla.

### Riesgo

Bloquea un caso de uso legítimo: un dueño de negocio no puede ser cliente en otra tienda de la plataforma.

### Comportamiento esperado

Si el email ya existe en Supabase, el registro no debe fallar. Debe reutilizar el `auth_user_id` existente y crear un nuevo registro en `customers` para el negocio correspondiente. Un usuario de Supabase puede tener múltiples relaciones con múltiples negocios.

---

## Problema 3: AuthGuard sin scope de negocio

### Comportamiento actual

El `AuthGuard` que protege las rutas del API hace la misma búsqueda global en `members`: dado un JWT válido, busca si el `auth_user_id` tiene un member **en cualquier negocio**.

### Riesgo

Un request con JWT válido y `X-Business-Slug` de un negocio ajeno podría pasar la validación del guard porque el usuario es member en otro negocio. Esto expone datos de un tenant a usuarios de otro tenant.

### Comportamiento esperado

El `AuthGuard` debe resolver el `business_id` desde el contexto (slug) y filtrar la búsqueda de member/customer por ese `business_id`. Si el usuario no tiene relación con ese negocio específico, el request debe rechazarse con 401.

---

## Impacto

| Escenario | Resultado actual | Resultado correcto |
|---|---|---|
| Lorena (dueña de tienda A) hace login en tienda B | Identificada como member (de tienda A) | Error: "No tenés cuenta en esta tienda" |
| Lorena intenta registrarse como cliente en tienda B | Error por email duplicado en Supabase | Registro exitoso reutilizando su usuario |
| Lorena con JWT válido hace request a API de tienda B | AuthGuard la deja pasar como member | 401 Unauthorized |
| Cliente de tienda A hace login en tienda B donde no tiene cuenta | Posible confusión de identidad | Error claro indicando que debe registrarse |

---

## Plan de corrección

1. **Login (`POST /auth/login`):** cuando hay `X-Business-Slug`, buscar member y customer filtrando por el `business_id` de ese negocio. Sin slug, buscar members para redirección al panel.

2. **Registro (`POST /auth/register`):** implementar lógica de `getOrCreate` para el usuario de Supabase. Si el email ya existe, obtener el `auth_user_id` existente y crear solo el registro en `customers`.

3. **AuthGuard:** resolver `business_id` desde el contexto del request y filtrar siempre por ese `business_id` al buscar member/customer.

4. **Auditoría de queries:** revisar todo el codebase buscando consultas a `members` o `customers` que no filtren por `business_id`.

---

## Relación con tareas existentes

- **RBT-284 (Modelo de usuarios):** la estructura de datos es correcta (las tablas tienen `business_id`), pero la lógica de negocio no usa ese campo para aislar.
- **RBT-285 (Registro):** el endpoint funciona para el caso simple pero falla en el caso cruzado.
- **RBT-286 (Login y JWT):** la lógica de prioridad "member > customer" sin scope de negocio es la raíz del problema.
- **RBT-290 (Middleware de seguridad y multi-tenant):** el AuthGuard, que debería ser la última barrera de aislamiento, tiene el mismo problema.

Estas tareas estaban marcadas como implementadas, pero requieren corrección antes de considerarse completas.

---

## Conclusión

El modelo de datos soporta correctamente el multi-tenant (las tablas tienen `business_id`). El problema está en la capa de lógica que no aprovecha ese campo para aislar. La corrección no requiere cambios en la base de datos, solo en los services y guards que resuelven la identidad del usuario.

Es una corrección que debe priorizarse antes de cualquier otro desarrollo, porque todos los endpoints protegidos dependen del AuthGuard para el aislamiento de datos entre negocios.