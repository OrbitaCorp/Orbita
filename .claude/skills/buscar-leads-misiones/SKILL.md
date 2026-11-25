---
name: buscar-leads-misiones
description: Automatiza la búsqueda incremental de leads en todo Misiones para los nuevos rubros (Turnos, Alquileres, Gimnasios, POS) sin repetir consultas ya hechas ni chocar con negocios existentes.
---

# Búsqueda incremental de leads en Misiones

Usá este flujo siempre que el usuario pida **buscar más leads en Misiones** o ampliar alguno de los rubros nuevos (`TURNOS`, `ALQUILERES`, `GIMNASIO`, `POS`).

## Reglas obligatorias (nunca saltearlas)

1. **Nunca empezar de cero.** Todo lo ya buscado y guardado vive en:
   - Registro persistente en el repo: `apps/api/data/leads-misiones-registro.json` (`busquedasRealizadas` + `leads`).
   - Base de datos compartida: tablas `marketing_leads` (con `clave` y `place_id` únicos) y `marketing_lead_busquedas` (con `clave_consulta` única).
2. **Nunca auto-asignar pilotos (`PILOTO`).** El cupo de `5/5` por rubro en Puerto Iguazú lo elige manualmente el equipo (Mateo, Alan, Mili, Ale). Todo negocio nuevo de Puerto Iguazú en rubros nuevos entra como `POTENCIAL_LOCAL` (`Posible piloto · Iguazú`) y fuera de Puerto Iguazú como `LEAD`.
3. **Solo Misiones (Argentina).** Rechazar resultados de Brasil (`Foz do Iguaçu`, `+55`), Paraguay (`Ciudad del Este`, `Encarnación`, `+595`), Corrientes u otras provincias. Fuera de Puerto Iguazú, exigir WhatsApp válido o Instagram.
4. **Deduplicar siempre por las 5 claves**: `clave`, `placeId`, `whatsappUrl` (por rubro), `instagram` (por rubro) y `(slug(negocio), slug(localidad))`.

## Dos formas de correr nuevas olas

### Opción A — Desde el código + migración + Excels (cuando trabajás en el repo)
```bash
node scripts/buscar-leads-misiones.mjs --rubro TODOS --max-queries 40 --emit-ts --emit-migration <YYYYMMDDHHMMSS>_marketing_leads_expansion_ola_x
python scripts/generar-excels-leads.py
```
Podés filtrar por un rubro puntual (`--rubro TURNOS`) o una localidad (`--localidad "Oberá"`). El script saltea automáticamente cualquier consulta presente en `apps/api/data/leads-misiones-registro.json` y cualquier lead existente.

### Opción B — Directo desde el panel web
En `Superadmin → Marketing → Leads`, el botón **Buscar más leads** llama a `POST /platform/marketing/leads/buscar` y muestra el avance en `GET /platform/marketing/leads/busquedas`, guardando nuevos leads y checkpoints directo en PostgreSQL sin duplicar nada.
