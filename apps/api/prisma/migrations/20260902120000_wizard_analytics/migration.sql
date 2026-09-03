-- CreateTable
CREATE TABLE "wizard_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "anon_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "step" INTEGER,
    "step_name" TEXT,
    "field" TEXT,
    "rubro" TEXT,
    "duration_ms" INTEGER,
    "meta" JSONB,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wizard_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_ai_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "anon_id" TEXT,
    "step" INTEGER,
    "step_name" TEXT,
    "rubro" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "tools_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errored" BOOLEAN NOT NULL DEFAULT false,
    "topic" TEXT,
    "answered_well" BOOLEAN,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wizard_ai_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wizard_events_session_id_idx" ON "wizard_events"("session_id");

-- CreateIndex
CREATE INDEX "wizard_events_created_at_idx" ON "wizard_events"("created_at");

-- CreateIndex
CREATE INDEX "wizard_events_type_created_at_idx" ON "wizard_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "wizard_ai_turns_created_at_idx" ON "wizard_ai_turns"("created_at");

-- CreateIndex
CREATE INDEX "wizard_ai_turns_topic_idx" ON "wizard_ai_turns"("topic");
