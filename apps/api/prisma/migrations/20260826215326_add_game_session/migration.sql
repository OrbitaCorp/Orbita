-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('PLAYING', 'WON', 'LOST', 'CLAIMED');

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'PLAYING',
    "hits" INTEGER NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(4,2),
    "discount_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_sessions_game_id_idx" ON "game_sessions"("game_id");

-- CreateIndex
CREATE INDEX "game_sessions_customer_id_idx" ON "game_sessions"("customer_id");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
