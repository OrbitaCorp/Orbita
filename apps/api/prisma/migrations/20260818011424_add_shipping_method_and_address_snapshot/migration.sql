-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('DELIVERY', 'PICKUP');

-- AlterTable
ALTER TABLE "online_order_details" ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_depto" TEXT,
ADD COLUMN     "shipping_floor" TEXT,
ADD COLUMN     "shipping_method" "ShippingMethod",
ADD COLUMN     "shipping_provincia" TEXT,
ADD COLUMN     "shipping_referencia" TEXT,
ADD COLUMN     "shipping_street" TEXT,
ADD COLUMN     "shipping_zip" TEXT;
