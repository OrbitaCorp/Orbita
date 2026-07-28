-- CreateTable
CREATE TABLE "pending_signups" (
    "id" TEXT NOT NULL,
    "preapproval_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_signups_preapproval_id_key" ON "pending_signups"("preapproval_id");
