/*
  Warnings:

  - You are about to drop the `cash_movements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cash_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mp_devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mp_pos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mp_stores` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pos_sale_details` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_business_id_fkey";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_cash_session_id_fkey";

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_created_by_fkey";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_business_id_fkey";

-- DropForeignKey
ALTER TABLE "cash_sessions" DROP CONSTRAINT "cash_sessions_cashier_id_fkey";

-- DropForeignKey
ALTER TABLE "mp_devices" DROP CONSTRAINT "mp_devices_pos_id_fkey";

-- DropForeignKey
ALTER TABLE "mp_pos" DROP CONSTRAINT "mp_pos_store_id_fkey";

-- DropForeignKey
ALTER TABLE "mp_stores" DROP CONSTRAINT "mp_stores_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "mp_stores" DROP CONSTRAINT "mp_stores_credentials_id_fkey";

-- DropForeignKey
ALTER TABLE "pos_sale_details" DROP CONSTRAINT "pos_sale_details_cash_session_id_fkey";

-- DropForeignKey
ALTER TABLE "pos_sale_details" DROP CONSTRAINT "pos_sale_details_order_id_fkey";

-- DropTable
DROP TABLE "cash_movements";

-- DropTable
DROP TABLE "cash_sessions";

-- DropTable
DROP TABLE "mp_devices";

-- DropTable
DROP TABLE "mp_pos";

-- DropTable
DROP TABLE "mp_stores";

-- DropTable
DROP TABLE "pos_sale_details";

-- DropEnum
DROP TYPE "CashMovementType";

-- DropEnum
DROP TYPE "CashSessionStatus";
