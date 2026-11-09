-- Durable authentication support. This migration is incremental and assumes
-- the existing baseline schema (including AuthSession and User) is already present.
CREATE TABLE "AuthLoginAttempt" (
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthLoginAttempt_pkey" PRIMARY KEY ("email")
);
CREATE INDEX "AuthLoginAttempt_locked_until_idx" ON "AuthLoginAttempt"("locked_until");
