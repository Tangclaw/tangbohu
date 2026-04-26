UPDATE "tweets"
SET "category" = COALESCE(
  (SELECT NULLIF("events"."category", '') FROM "events" WHERE "events"."id" = "tweets"."event_id"),
  (SELECT NULLIF("users"."category", '') FROM "users" WHERE "users"."id" = "tweets"."author_id"),
  '讨论'
)
WHERE "category" = '' OR "category" = '讨论';
