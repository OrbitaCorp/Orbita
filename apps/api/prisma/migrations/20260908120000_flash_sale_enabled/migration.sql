-- "Oferta relámpago" (paquete Avanzado, RBT-675): interruptor por negocio que
-- habilita el tipo "Oferta relámpago" en Descuentos. Lo prende el dueño desde
-- la tarjeta de Avanzado; la configuración de la oferta (porcentaje,
-- productos, hasta cuándo) se hace en Descuentos como cualquier otro tipo.
--
-- Default false: es una función que se elige usar. Quien ya tenía una cuenta
-- regresiva prendida (fila en countdown_configs) la ve reaparecer en la
-- portada apenas prende el interruptor, sin volver a configurar nada.
--
-- Escrita a mano y NO con `prisma migrate diff`, por el drift preexistente de
-- wizard_ai_turns (ver 20260906120000_countdown_home_section).

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "flash_sale_enabled" BOOLEAN NOT NULL DEFAULT false;
