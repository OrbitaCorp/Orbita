-- CreateEnum
CREATE TYPE "CountdownPlacement" AS ENUM ('HOME', 'ALL_PAGES');

-- CreateEnum
CREATE TYPE "ExitIntentFrequency" AS ENUM ('ONCE_EVER', 'ONCE_PER_DAY', 'ALWAYS');

-- CreateTable
CREATE TABLE "countdown_configs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "end_date" TIMESTAMP(3) NOT NULL,
    "finished_message" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "placement" "CountdownPlacement" NOT NULL DEFAULT 'HOME',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countdown_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_intent_configs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "badge" TEXT,
    "code" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "frequency" "ExitIntentFrequency" NOT NULL DEFAULT 'ONCE_PER_DAY',
    "min_seconds" INTEGER NOT NULL DEFAULT 15,
    "on_mobile" BOOLEAN NOT NULL DEFAULT true,
    "campaign_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_intent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countdown_configs_business_id_key" ON "countdown_configs"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "exit_intent_configs_business_id_key" ON "exit_intent_configs"("business_id");

-- AddForeignKey
ALTER TABLE "countdown_configs" ADD CONSTRAINT "countdown_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_intent_configs" ADD CONSTRAINT "exit_intent_configs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

