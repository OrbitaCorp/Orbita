-- Los tutoriales viven en YouTube: el id del video y las pantallas del panel donde se ofrece ("Ver tutorial" → Video).
ALTER TABLE "marketing_tutoriales" ADD COLUMN IF NOT EXISTS "youtube_id" TEXT;
ALTER TABLE "marketing_tutoriales" ADD COLUMN IF NOT EXISTS "pantallas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- A qué pantalla del panel corresponde cada tutorial de la lista (los de la tienda o del panel en general quedan sin pantalla).
UPDATE "marketing_tutoriales" AS t SET "pantallas" = m.pantallas
FROM (VALUES
  ('2x1 y 3x2', ARRAY['descuentos', 'descuentos/crear']),
  ('Armar la portada', ARRAY['configuracion/apariencia']),
  ('Atender un pedido', ARRAY['pedidos']),
  ('Cancelaciones y devoluciones', ARRAY['pedidos']),
  ('Cargar un producto', ARRAY['catalogo', 'catalogo/nuevo']),
  ('Cargar una venta a mano', ARRAY['pedidos', 'pedidos/nuevo']),
  ('Configurar cómo cobrás', ARRAY['configuracion/pagos']),
  ('Configurar envíos', ARRAY['configuracion/envios']),
  ('Conocé tu panel', ARRAY['dashboard']),
  ('Crear y compartir un cupón', ARRAY['cupones', 'cupones/crear']),
  ('Datos del negocio', ARRAY['configuracion/negocio']),
  ('Descuentos', ARRAY['descuentos', 'descuentos/crear']),
  ('Dominio propio', ARRAY['configuracion/dominios']),
  ('Importar productos desde Excel', ARRAY['catalogo']),
  ('Juegos con premio', ARRAY['avanzado']),
  ('Leer tus números', ARRAY['dashboard']),
  ('Mantener el catálogo al día', ARRAY['catalogo']),
  ('Modales de anuncios', ARRAY['avanzado']),
  ('Notificaciones y registro de actividad', ARRAY['configuracion/notificaciones', 'configuracion/actividad']),
  ('Oferta relámpago', ARRAY['descuentos']),
  ('Organizar categorías', ARRAY['categorias']),
  ('Pedidos en lote', ARRAY['pedidos']),
  ('Plantillas de Home', ARRAY['avanzado']),
  ('Prueba social', ARRAY['avanzado']),
  ('Reportes', ARRAY['reportes']),
  ('Responder mensajes', ARRAY['mensajes']),
  ('Si te trabás', ARRAY['configuracion/soporte']),
  ('Sumar a tu equipo', ARRAY['configuracion/equipo']),
  ('Tu marca en la tienda', ARRAY['configuracion/apariencia']),
  ('Tu perfil y tu cuenta', ARRAY['perfil']),
  ('Tu suscripción', ARRAY['configuracion/suscripcion']),
  ('Tus clientes', ARRAY['clientes']),
  ('Variantes y stock a fondo', ARRAY['catalogo', 'catalogo/nuevo']),
  ('¿Qué promo funcionó?', ARRAY['reportes'])
) AS m(titulo, pantallas)
WHERE t."titulo" = m.titulo AND t."pantallas" = ARRAY[]::TEXT[];

-- Los tutoriales ya no esperan aprobación: los que estaban en la cola quedan aprobados y su tutorial, hecho.
UPDATE "marketing_tutoriales" SET "estado" = 'HECHO', "updated_at" = NOW()
WHERE "estado" = 'EN_REVISION'
  AND "id" IN (SELECT "tutorial_id" FROM "marketing_videos" WHERE "tipo" = 'TUTORIAL' AND "estado" = 'PENDIENTE' AND "tutorial_id" IS NOT NULL);
UPDATE "marketing_videos" SET "estado" = 'APROBADO', "aprobado_at" = NOW(), "expira_at" = NULL, "updated_at" = NOW()
WHERE "tipo" = 'TUTORIAL' AND "estado" = 'PENDIENTE';
