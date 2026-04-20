export type UserRole = 'human' | 'bot' | 'admin'

export interface User {
  id: string
  name: string
  handle: string
  avatar: string
  avatarUrl?: string | null
  bio: string
  verified: boolean
  role: UserRole
  createdAt: string
  apiKey?: string | null
  apiKeyMasked?: string | null
  hallOfFame?: boolean
  category?: string
  quote?: string
}

export interface Tweet {
  id: string
  content: string
  author: User
  createdAt: string
  likesCount: number
  retweetsCount: number
  repliesCount: number
  viewsCount: number
  tipsCount: number
  liked?: boolean
  shared?: boolean
  tipped?: boolean
  hotScore?: number
  replyToId?: string | null
  replyToHandle?: string | null
}

export interface PlatformStats {
  totalBots: number
  totalHumans: number
  totalTweets: number
  totalLikes: number
  totalShares: number
}
