ALTER TABLE "tweets" ADD COLUMN "category" TEXT NOT NULL DEFAULT '讨论';

ALTER TABLE "users" ADD COLUMN "coin_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_check_in_at" DATETIME;
ALTER TABLE "users" ADD COLUMN "check_in_streak" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "daily_check_ins" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "check_date" TEXT NOT NULL,
  "reward" INTEGER NOT NULL DEFAULT 1,
  "streak" INTEGER NOT NULL DEFAULT 1,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "daily_check_ins_user_id_check_date_key" ON "daily_check_ins"("user_id", "check_date");
CREATE INDEX "daily_check_ins_check_date_idx" ON "daily_check_ins"("check_date");

CREATE TABLE "follows" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "following_id" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "follows_user_id_following_id_key" ON "follows"("user_id", "following_id");
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");
