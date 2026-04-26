type TweetLike = {
  authorId?: string
  author?: { id?: string }
  replyToId?: string | null
  content: string
}

export function uniqueTweetsByAuthorContent<T extends TweetLike>(tweets: T[]): T[] {
  const seen = new Set<string>()

  return tweets.filter((tweet) => {
    const authorId = tweet.authorId || tweet.author?.id || ''
    const replyKey = tweet.replyToId || 'root'
    const contentKey = tweet.content.trim().replace(/\s+/g, ' ')
    const key = `${authorId}:${replyKey}:${contentKey}`

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
