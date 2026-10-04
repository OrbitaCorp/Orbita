-- CreateTable
CREATE TABLE "orbi_pending_actions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "tool" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orbi_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quota" (
    "key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_quota_pkey" PRIMARY KEY ("key","day")
);

-- CreateTable
CREATE TABLE "orbi_turns" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "module" TEXT,
    "model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL,
    "tools_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actions_proposed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orbi_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orbi_pending_actions_business_id_member_id_status_idx" ON "orbi_pending_actions"("business_id", "member_id", "status");

-- CreateIndex
CREATE INDEX "orbi_pending_actions_created_at_idx" ON "orbi_pending_actions"("created_at");

-- CreateIndex
CREATE INDEX "orbi_turns_business_id_created_at_idx" ON "orbi_turns"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "orbi_turns_member_id_created_at_idx" ON "orbi_turns"("member_id", "created_at");

-- AddForeignKey
ALTER TABLE "orbi_pending_actions" ADD CONSTRAINT "orbi_pending_actions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orbi_turns" ADD CONSTRAINT "orbi_turns_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

