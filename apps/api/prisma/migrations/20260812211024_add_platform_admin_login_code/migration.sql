-- CreateTable
CREATE TABLE "platform_admin_login_codes" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_admin_login_codes_admin_id_idx" ON "platform_admin_login_codes"("admin_id");

-- AddForeignKey
ALTER TABLE "platform_admin_login_codes" ADD CONSTRAINT "platform_admin_login_codes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
