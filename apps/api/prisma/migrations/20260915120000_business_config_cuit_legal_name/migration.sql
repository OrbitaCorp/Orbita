-- Hallazgo MEDIA `legales-sin-cuit` (auditoría interna 10/09): los Términos y la
-- Política de privacidad de cada tienda no podían mostrar el CUIT ni la razón
-- social del Comercio porque el negocio no tenía dónde cargarlos. Dos columnas
-- nullable en business_config: una revisión vieja de la API sigue andando.

-- AlterTable
ALTER TABLE "business_config" ADD COLUMN "cuit" VARCHAR(11);

-- AlterTable
ALTER TABLE "business_config" ADD COLUMN "legal_name" VARCHAR(120);
