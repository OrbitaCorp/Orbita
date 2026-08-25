-- CreateTable
CREATE TABLE "orbi_conversations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orbi_conversations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "orbi_conversations" ADD CONSTRAINT "orbi_conversations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
