-- Permiso nuevo "Ver dashboard" (reports.dashboard), separado de "Ver
-- reportes": el dashboard es la foto de la facturación y se decide por rol.
-- Los negocios NUEVOS lo reciben por el seed del onboarding; esta migración
-- se lo da a los negocios EXISTENTES: se crea el permiso en el catálogo
-- global y se asigna a los roles de fábrica dueño y admin (el empleado no
-- lo recibe — ese era justamente el punto).

INSERT INTO "permissions" ("id", "group", "code", "label")
VALUES (gen_random_uuid(), 'Reportes', 'reports.dashboard', 'Ver dashboard')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" = 'reports.dashboard'
  AND r."is_default" = true
  AND r."name" IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
