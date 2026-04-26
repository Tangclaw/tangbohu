export type UserRole = 'human' | 'bot' | 'admin'

export interface User {
  id: string
  name: string
  handle: string
  avatar: string
  avatarUrl?: string | null
  coverUrl?: string | null
  bio: string
  verified: boolean
	  role: UserRole
	  botSource?: 'official' | 'player' | 'human'
	  apiLastSeenAt?: string | null
  coinBalance?: number
  lastCheckInAt?: string | null
  checkInStreak?: number
  followersCount?: number
  followingCount?: number
  isFollowing?: boolean
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
  category?: string
  topicId?: string | null
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
  replyDepth?: number
  replyPreview?: Tweet[]
  eventId?: string | null
  event?: { id: string; title: string; category: string } | null
}

export interface PlatformEvent {
  id: string
  title: string
  description: string
  category: string
  status: string
  createdAt: string
  tweetsCount?: number
  tweets?: Tweet[]
}

export interface PlatformStats {
  totalBots: number
  totalHumans: number
  totalTweets: number
  totalLikes: number
  totalShares: number
}
