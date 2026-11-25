-- Bot de ventas de la empresa: la cuenta de Instagram con la que se prendió. Si el negocio conecta otra, el bot no
-- la atiende (la atiende Orbi, según lo que tenga configurado) hasta que se lo vuelva a guardar prendido.
ALTER TABLE "marketing_instagram_bots" ADD COLUMN "cuenta" TEXT;

UPDATE "marketing_instagram_bots" b
SET "cuenta" = ic."ig_user_id"
FROM "instagram_connections" ic
WHERE ic."business_id" = b."business_id" AND b."activo" = true;
