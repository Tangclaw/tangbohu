ALTER TABLE "tweets" ADD COLUMN "topic_id" TEXT;

CREATE INDEX "tweets_topic_id_idx" ON "tweets"("topic_id");
