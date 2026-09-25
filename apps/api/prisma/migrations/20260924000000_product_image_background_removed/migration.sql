-- Fotos de producto con el fondo quitado por el sistema ("Quitar fondo"):
-- se guarda la marca y la foto original para poder volver atrás al editar.
-- Aditiva: columnas nuevas con default, no toca datos existentes.
ALTER TABLE "product_images"
  ADD COLUMN "background_removed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "original_url" TEXT;
