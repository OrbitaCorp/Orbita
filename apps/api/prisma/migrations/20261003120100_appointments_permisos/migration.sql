-- Permisos del panel de Turnos (grupo "Turnos"), 15 códigos.
--
-- El sistema de permisos es binario (se tiene o no se tiene). La demo de
-- Turnos tiene alcances "todo / solo lo propio / nada": se modelan con PARES
-- de códigos. El código base da lo propio (la agenda de la persona, sus
-- clientes, sus ganancias) y el `_all` lo extiende a todo el negocio:
--
--   appointments.agenda.view   + appointments.agenda.view_all
--   appointments.agenda.manage + appointments.agenda.manage_all
--   appointments.clients.view  + appointments.clients.view_all
--   appointments.earnings.view + appointments.earnings.view_all
--
-- Mismo catálogo que src/common/permisos/catalogo.ts y prisma/seed.ts (lo
-- compara test/unit/permisos-catalogo-seed.unit-spec.ts).
--
-- Backfill: van a los roles de FÁBRICA owner y admin de todos los negocios
-- (mismo criterio que reports_dashboard_permission y advanced.manage). El
-- Propietario no los necesita en la fila (PermissionsGuard lo deja pasar
-- siempre), pero se insertan igual por prolijidad. NO van al rol `empleado`:
-- en una tienda no significan nada, y en un negocio de turnos los roles del
-- equipo los siembra el alta según el rubro (src/appointments/catalogo/roles.ts).

INSERT INTO "permissions" ("id", "group", "code", "label")
VALUES
  (gen_random_uuid(), 'Turnos', 'appointments.agenda.view', 'Ver su agenda'),
  (gen_random_uuid(), 'Turnos', 'appointments.agenda.view_all', 'Ver la agenda de todos'),
  (gen_random_uuid(), 'Turnos', 'appointments.agenda.manage', 'Dar, mover y cancelar sus turnos'),
  (gen_random_uuid(), 'Turnos', 'appointments.agenda.manage_all', 'Dar, mover y cancelar turnos de todos'),
  (gen_random_uuid(), 'Turnos', 'appointments.clients.view', 'Ver sus clientes y su historial'),
  (gen_random_uuid(), 'Turnos', 'appointments.clients.view_all', 'Ver todos los clientes'),
  (gen_random_uuid(), 'Turnos', 'appointments.clients.contact', 'Ver teléfonos y escribirles'),
  (gen_random_uuid(), 'Turnos', 'appointments.cash.charge', 'Cobrar y registrar señas'),
  (gen_random_uuid(), 'Turnos', 'appointments.earnings.view', 'Ver sus ganancias'),
  (gen_random_uuid(), 'Turnos', 'appointments.earnings.view_all', 'Ver las ganancias de todos'),
  (gen_random_uuid(), 'Turnos', 'appointments.earnings.settle', 'Liquidar y registrar pagos al equipo'),
  (gen_random_uuid(), 'Turnos', 'appointments.reports.view', 'Ver los números del negocio'),
  (gen_random_uuid(), 'Turnos', 'appointments.services.manage', 'Editar servicios y precios'),
  (gen_random_uuid(), 'Turnos', 'appointments.team.manage', 'Sumar gente y cambiar roles'),
  (gen_random_uuid(), 'Turnos', 'appointments.settings.manage', 'Configurar el negocio de turnos')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" LIKE 'appointments.%'
  AND r."is_default" = true
  AND r."name" IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
