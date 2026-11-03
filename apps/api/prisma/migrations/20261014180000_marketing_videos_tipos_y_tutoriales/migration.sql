-- Cola de videos: tipo (marketing / tutorial), aprobaciones internas y vínculo con la lista de tutoriales.
-- Aditiva: columnas con valor por defecto y una tabla nueva. Los videos que ya existen quedan como MARKETING.

ALTER TABLE "marketing_videos" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'MARKETING';
ALTER TABLE "marketing_videos" ADD COLUMN "aprobaciones" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "marketing_videos" ADD COLUMN "tutorial_id" TEXT;
CREATE INDEX "marketing_videos_tipo_estado_idx" ON "marketing_videos"("tipo", "estado");

-- La lista de tutoriales: qué hay y qué falta. Se carga con lo que ya está definido (los hechos van como HECHO).
CREATE TABLE "marketing_tutoriales" (
    "id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "grupo_orden" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'FALTA',
    "opcional" BOOLEAN NOT NULL DEFAULT false,
    "prioridad_alta" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "actualizado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_tutoriales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_tutoriales_titulo_key" ON "marketing_tutoriales"("titulo");
CREATE INDEX "marketing_tutoriales_grupo_orden_orden_idx" ON "marketing_tutoriales"("grupo_orden", "orden");

-- Seguridad por filas (RLS): sin políticas, solo accede la API de Órbita (rol que saltea RLS), como el resto.
ALTER TABLE "marketing_tutoriales" ENABLE ROW LEVEL SECURITY;

INSERT INTO "marketing_tutoriales" ("id", "grupo", "grupo_orden", "orden", "titulo", "estado", "opcional", "prioridad_alta") VALUES
  (gen_random_uuid()::text, 'Arrancar', 1, 1, 'Conocé tu panel', 'HECHO', false, true),
  (gen_random_uuid()::text, 'Arrancar', 1, 2, 'Los 7 pasos para salir a vender', 'FALTA', false, true),
  (gen_random_uuid()::text, 'Arrancar', 1, 3, 'Datos del negocio', 'FALTA', false, true),
  (gen_random_uuid()::text, 'Arrancar', 1, 4, 'Configurar cómo cobrás', 'FALTA', false, true),
  (gen_random_uuid()::text, 'Arrancar', 1, 5, 'Configurar envíos', 'FALTA', false, true),
  (gen_random_uuid()::text, 'Arrancar', 1, 6, 'Publicar tu tienda', 'FALTA', false, true),
  (gen_random_uuid()::text, 'Catálogo', 2, 1, 'Cargar un producto', 'HECHO', false, false),
  (gen_random_uuid()::text, 'Catálogo', 2, 2, 'Importar productos desde Excel', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Catálogo', 2, 3, 'Variantes y stock a fondo', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Catálogo', 2, 4, 'Mantener el catálogo al día', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Catálogo', 2, 5, 'Organizar categorías', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 1, 'Atender un pedido', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 2, 'Cargar una venta a mano', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 3, 'Pedidos en lote', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 4, 'Cancelaciones y devoluciones', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 5, 'Responder mensajes', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender día a día', 3, 6, 'Tus clientes', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender más', 4, 1, 'Descuentos', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender más', 4, 2, 'Crear y compartir un cupón', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender más', 4, 3, '¿Qué promo funcionó?', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender más', 4, 4, 'Leer tus números', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Vender más', 4, 5, 'Reportes', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Que tu tienda se vea bien', 5, 1, 'Tu marca en la tienda', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Que tu tienda se vea bien', 5, 2, 'Armar la portada', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Que tu tienda se vea bien', 5, 3, 'Dominio propio', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Equipo y cuenta', 6, 1, 'Sumar a tu equipo', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Equipo y cuenta', 6, 2, 'Notificaciones y registro de actividad', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Equipo y cuenta', 6, 3, 'Tu perfil y tu cuenta', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Equipo y cuenta', 6, 4, 'Tu suscripción', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Equipo y cuenta', 6, 5, 'Si te trabás', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 1, 'Plantillas de Home', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 2, 'Juegos con premio', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 3, 'Modales de anuncios', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 4, '2x1 y 3x2', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 5, 'Oferta relámpago', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 6, 'Prueba social', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Paquete Avanzado', 7, 7, 'Orbi en el panel', 'FALTA', false, false),
  (gen_random_uuid()::text, 'Para mostrarle a tu cliente', 8, 1, 'Así compra tu cliente', 'FALTA', true, false),
  (gen_random_uuid()::text, 'Para mostrarle a tu cliente', 8, 2, 'Cómo pide una devolución', 'FALTA', true, false)
ON CONFLICT ("titulo") DO NOTHING;
