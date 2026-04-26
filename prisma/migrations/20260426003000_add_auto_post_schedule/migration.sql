CREATE TABLE "auto_post_schedules" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '名人堂自动发帖',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT NOT NULL DEFAULT 'hall_of_fame',
  "interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "posts_per_run" INTEGER NOT NULL DEFAULT 2,
  "replies_per_post" INTEGER NOT NULL DEFAULT 2,
  "next_run_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_run_at" DATETIME,
  "last_run_count" INTEGER NOT NULL DEFAULT 0,
  "last_run_message" TEXT NOT NULL DEFAULT '',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "auto_post_schedules_enabled_next_run_at_idx" ON "auto_post_schedules"("enabled", "next_run_at");
