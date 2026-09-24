-- CreateEnum
CREATE TYPE "CostApiType" AS ENUM ('AUTO', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "CostSource" AS ENUM ('API', 'MANUAL', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "CostLimitType" AS ENUM ('SPEND', 'USAGE');

-- CreateEnum
CREATE TYPE "CostLimitPeriod" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "cost_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "api_type" "CostApiType" NOT NULL DEFAULT 'MANUAL',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshots" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount_usd" DECIMAL(12,4) NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "source" "CostSource" NOT NULL DEFAULT 'MANUAL',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "business_id" TEXT,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "estimated_cost_usd" DECIMAL(12,6),
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_limits" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "type" "CostLimitType" NOT NULL,
    "category" TEXT,
    "threshold" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "alert_at_percent" INTEGER[],
    "period" "CostLimitPeriod" NOT NULL DEFAULT 'MONTHLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_alerts" (
    "id" TEXT NOT NULL,
    "limit_id" TEXT NOT NULL,
    "percent_reached" INTEGER NOT NULL,
    "current_value" DECIMAL(12,4) NOT NULL,
    "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "cost_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_providers_slug_key" ON "cost_providers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cost_snapshots_provider_id_month_key" ON "cost_snapshots"("provider_id", "month");

-- CreateIndex
CREATE INDEX "usage_events_provider_id_timestamp_idx" ON "usage_events"("provider_id", "timestamp");

-- CreateIndex
CREATE INDEX "usage_events_business_id_timestamp_idx" ON "usage_events"("business_id", "timestamp");

-- AddForeignKey
ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "cost_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "cost_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_limits" ADD CONSTRAINT "cost_limits_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "cost_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_alerts" ADD CONSTRAINT "cost_alerts_limit_id_fkey" FOREIGN KEY ("limit_id") REFERENCES "cost_limits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
