-- Soporte con historial y adjuntos (Ale, 21/09). Hasta acá Configuración →
-- Soporte solo mandaba un mail: si no salía, la consulta se perdía, y el
-- negocio no tenía dónde ver qué preguntó ni qué le contestaron. Tres tablas
-- nuevas (consultas, mensajes del hilo, opinión sobre el Manual) y sus enums.
-- Solo aditiva: ninguna tabla existente cambia.
-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('DOMINIO', 'FACTURACION', 'TECNICO', 'CUENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportMessageAuthor" AS ENUM ('MEMBER', 'ADMIN');

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "contact_phone" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "answered_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "author" "SupportMessageAuthor" NOT NULL,
    "member_id" TEXT,
    "admin_id" TEXT,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_feedback" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_number_key" ON "support_requests"("number");

-- CreateIndex
CREATE INDEX "support_requests_business_id_created_at_idx" ON "support_requests"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "support_requests_status_last_message_at_idx" ON "support_requests"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "support_messages_request_id_created_at_idx" ON "support_messages"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "manual_feedback_member_id_chapter_id_key" ON "manual_feedback"("member_id", "chapter_id");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_feedback" ADD CONSTRAINT "manual_feedback_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_feedback" ADD CONSTRAINT "manual_feedback_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS como el resto de public (hallazgo `api.supabase`, migración
-- 20260910110000): sin esto la API REST de Supabase con la clave anon podría
-- leer las consultas de soporte de todos los negocios. Los grants ya los
-- revocan los default privileges; acá solo falta prender RLS.
ALTER TABLE "support_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manual_feedback" ENABLE ROW LEVEL SECURITY;
