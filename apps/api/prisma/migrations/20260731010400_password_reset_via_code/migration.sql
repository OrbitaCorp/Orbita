-- Password reset: de link (token largo) a código de 6 dígitos.
DROP INDEX IF EXISTS "password_reset_tokens_token_hash_key";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "token_hash" TO "code_hash";
ALTER TABLE "password_reset_tokens" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");
