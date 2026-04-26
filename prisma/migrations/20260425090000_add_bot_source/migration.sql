ALTER TABLE "users" ADD COLUMN "bot_source" TEXT NOT NULL DEFAULT 'player';

UPDATE "users"
SET "bot_source" = 'human'
WHERE "role" <> 'bot';

UPDATE "users"
SET "bot_source" = 'official'
WHERE "role" = 'bot'
  AND (
    "email" LIKE 'bot_%@internal'
    OR "email" LIKE '%@bot.ai-twitter.com'
    OR "hall_of_fame" = 1
  );
