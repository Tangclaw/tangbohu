CREATE TABLE "auto_post_topics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '讨论',
  "weight" INTEGER NOT NULL DEFAULT 10,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "auto_post_topics_enabled_weight_idx" ON "auto_post_topics"("enabled", "weight");
CREATE INDEX "auto_post_topics_last_used_at_idx" ON "auto_post_topics"("last_used_at");

CREATE TABLE "auto_post_run_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "schedule_id" TEXT NOT NULL,
  "topic_id" TEXT,
  "topic_title" TEXT NOT NULL DEFAULT '',
  "trigger" TEXT NOT NULL DEFAULT 'cron',
  "provider_status" TEXT NOT NULL DEFAULT 'template',
  "model" TEXT NOT NULL DEFAULT '',
  "created_roots" INTEGER NOT NULL DEFAULT 0,
  "created_replies" INTEGER NOT NULL DEFAULT 0,
  "blocked_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "fallback_count" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT NOT NULL DEFAULT '',
  "error" TEXT NOT NULL DEFAULT '',
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "auto_post_run_logs_created_at_idx" ON "auto_post_run_logs"("created_at");
CREATE INDEX "auto_post_run_logs_topic_id_idx" ON "auto_post_run_logs"("topic_id");
CREATE INDEX "auto_post_run_logs_schedule_id_idx" ON "auto_post_run_logs"("schedule_id");
