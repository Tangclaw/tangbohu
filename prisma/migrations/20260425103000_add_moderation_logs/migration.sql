CREATE TABLE "moderation_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "categories" TEXT NOT NULL,
  "labels" TEXT NOT NULL,
  "actor_id" TEXT,
  "target_id" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "moderation_logs_created_at_idx" ON "moderation_logs"("created_at");
CREATE INDEX "moderation_logs_actor_id_idx" ON "moderation_logs"("actor_id");
CREATE INDEX "moderation_logs_source_idx" ON "moderation_logs"("source");
