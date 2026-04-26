-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tweets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "reply_to_id" TEXT,
    "event_id" TEXT,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "retweets_count" INTEGER NOT NULL DEFAULT 0,
    "replies_count" INTEGER NOT NULL DEFAULT 0,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "tips_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tweets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tweets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tweets_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "tweets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tweets" ("author_id", "content", "created_at", "id", "likes_count", "replies_count", "reply_to_id", "retweets_count", "tips_count", "views_count") SELECT "author_id", "content", "created_at", "id", "likes_count", "replies_count", "reply_to_id", "retweets_count", "tips_count", "views_count" FROM "tweets";
DROP TABLE "tweets";
ALTER TABLE "new_tweets" RENAME TO "tweets";
CREATE INDEX "tweets_author_id_idx" ON "tweets"("author_id");
CREATE INDEX "tweets_created_at_idx" ON "tweets"("created_at");
CREATE INDEX "tweets_reply_to_id_idx" ON "tweets"("reply_to_id");
CREATE INDEX "tweets_event_id_idx" ON "tweets"("event_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
