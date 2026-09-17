-- Dos permisos nuevos, pedido explícito de Ale (17/09): poder darle Mensajes
-- o el paquete Avanzado a un rol personalizado, sin tener que ascender a esa
-- persona a Propietario.
--
-- Mensajes (messages.view, messages.manage) NO tenía ningún gate hasta hoy
-- (ConversationsController: "cualquier miembro puede leer/contestar"). Para
-- no sacarle Mensajes a nadie que ya lo usa, se lo da a TODOS los roles
-- existentes, sin filtrar por nombre — es lo más parecido a "no tenía
-- restricción" que se puede expresar con un permiso.
--
-- Avanzado (advanced.manage) SÍ tenía gate — @Roles('owner','admin') fijo en
-- games/promo-modal/social-proof/two-for-one .controller.ts — así que acá se
-- sigue el mismo criterio que reports_dashboard_permission: se lo da a los
-- roles de FÁBRICA owner/admin nada más (is_default = true). El Propietario
-- no lo necesita en la fila (PermissionsGuard lo deja pasar siempre), pero
-- se inserta igual por prolijidad — mismo criterio que esa migración.

INSERT INTO "permissions" ("id", "group", "code", "label")
VALUES
  (gen_random_uuid(), 'Mensajes', 'messages.view', 'Ver mensajes'),
  (gen_random_uuid(), 'Mensajes', 'messages.manage', 'Responder mensajes'),
  (gen_random_uuid(), 'Avanzado', 'advanced.manage', 'Gestionar Avanzado')
ON CONFLICT ("code") DO NOTHING;

-- Mensajes: a todos los roles existentes, de cualquier negocio.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" IN ('messages.view', 'messages.manage')
ON CONFLICT DO NOTHING;

-- Avanzado: solo a los roles de fábrica owner/admin (mismo alcance que ya
-- tenían por @Roles('owner','admin') antes de este cambio).
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."code" = 'advanced.manage'
  AND r."is_default" = true
  AND r."name" IN ('owner', 'admin')
ON CONFLICT DO NOTHING;
