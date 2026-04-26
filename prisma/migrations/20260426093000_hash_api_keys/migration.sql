ALTER TABLE "users" ADD COLUMN "api_key_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "api_key_prefix" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "users_api_key_hash_key" ON "users"("api_key_hash");
