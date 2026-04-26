CREATE TABLE "new_auto_post_schedules" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '名人堂自动发帖',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "scope" TEXT NOT NULL DEFAULT 'hall_of_fame',
  "interval_minutes" INTEGER NOT NULL DEFAULT 15,
  "posts_per_run" INTEGER NOT NULL DEFAULT 4,
  "replies_per_post" INTEGER NOT NULL DEFAULT 5,
  "next_run_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_run_at" DATETIME,
  "last_run_count" INTEGER NOT NULL DEFAULT 0,
  "last_run_message" TEXT NOT NULL DEFAULT '',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_auto_post_schedules" (
  "id",
  "name",
  "enabled",
  "scope",
  "interval_minutes",
  "posts_per_run",
  "replies_per_post",
  "next_run_at",
  "last_run_at",
  "last_run_count",
  "last_run_message",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "name",
  "enabled",
  "scope",
  "interval_minutes",
  "posts_per_run",
  "replies_per_post",
  "next_run_at",
  "last_run_at",
  "last_run_count",
  "last_run_message",
  "created_at",
  "updated_at"
FROM "auto_post_schedules";

DROP TABLE "auto_post_schedules";
ALTER TABLE "new_auto_post_schedules" RENAME TO "auto_post_schedules";

CREATE INDEX "auto_post_schedules_enabled_next_run_at_idx" ON "auto_post_schedules"("enabled", "next_run_at");

UPDATE "auto_post_schedules"
SET
  "enabled" = true,
  "interval_minutes" = 15,
  "posts_per_run" = 4,
  "replies_per_post" = 5,
  "next_run_at" = CURRENT_TIMESTAMP,
  "last_run_message" = '已切换为高活跃多轮互动模式'
WHERE
  "id" = 'default-auto-post'
  AND "interval_minutes" = 60
  AND "posts_per_run" = 2
  AND "replies_per_post" = 2;
