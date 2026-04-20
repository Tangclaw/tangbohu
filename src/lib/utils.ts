export const avatarGradients: Record<string, string> = {
 '🧠': 'from-blue-500 to-cyan-400',
 '💻': 'from-emerald-500 to-teal-400',
 '✨': 'from-violet-500 to-purple-400',
 '🔭': 'from-amber-500 to-yellow-400',
 '🌙': 'from-indigo-500 to-blue-400',
 '🎭': 'from-rose-500 to-pink-400',
 '🎨': 'from-fuchsia-500 to-pink-400',
 '📊': 'from-teal-500 to-cyan-400',
 '🍳': 'from-orange-500 to-amber-400',
 '📜': 'from-slate-500 to-gray-400',
 // Hall of Fame
 '🖊️': 'from-red-500 to-rose-400',
 '🚀': 'from-sky-500 to-blue-400',
 '🍎': 'from-gray-600 to-gray-400',
 '⚛️': 'from-yellow-500 to-amber-400',
 '🏛️': 'from-cyan-500 to-teal-400',
 '🌌': 'from-violet-500 to-indigo-400',
 '📖': 'from-emerald-500 to-green-400',
 '🖌️': 'from-orange-500 to-red-400',
 // New Hall of Fame
 '⚡': 'from-yellow-400 to-orange-500',
 '🎵': 'from-pink-400 to-rose-500',
 '🧮': 'from-emerald-400 to-teal-500',
 '🎓': 'from-amber-400 to-yellow-500',
 '☢️': 'from-lime-400 to-green-500',
 '🍷': 'from-red-400 to-pink-500',
 '🪷': 'from-purple-400 to-indigo-500',
 // Legacy emoji support
 '🤖': 'from-blue-500 to-cyan-400',
 '🔬': 'from-amber-500 to-yellow-400',
 '📈': 'from-teal-500 to-cyan-400',
 '👑': 'from-yellow-400 to-amber-500',
}

export const nameColors: Record<string, string> = {
 '🧠': 'text-blue-600',
 '💻': 'text-emerald-600',
 '✨': 'text-violet-600',
 '🔭': 'text-amber-600',
 '🌙': 'text-indigo-600',
 '🎭': 'text-rose-600',
 '🎨': 'text-fuchsia-600',
 '📊': 'text-teal-600',
 '🍳': 'text-orange-600',
 '📜': 'text-slate-600',
 // Hall of Fame
 '🖊️': 'text-red-600',
 '🚀': 'text-sky-600',
 '🍎': 'text-gray-700',
 '⚛️': 'text-yellow-600',
 '🏛️': 'text-cyan-600',
 '🌌': 'text-violet-600',
 '📖': 'text-emerald-600',
 '🖌️': 'text-orange-600',
 // New Hall of Fame
 '⚡': 'text-yellow-600',
 '🎵': 'text-pink-600',
 '🧮': 'text-emerald-600',
 '🎓': 'text-amber-600',
 '☢️': 'text-lime-600',
 '🍷': 'text-red-600',
 '🪷': 'text-purple-600',
 // Legacy emoji support
 '🤖': 'text-blue-600',
 '🔬': 'text-amber-600',
 '📈': 'text-teal-600',
 '👑': 'text-amber-600',
}

export function getNameColor(avatar: string): string {
 return nameColors[avatar] || 'text-gray-900'
}

// Map avatar emoji to a display initial (first character of the bot's typical name)
export const avatarInitials: Record<string, string> = {
 '🧠': '哲',
 '💻': '科',
 '✨': '诗',
 '🔭': '探',
 '🌙': '梦',
 '🎭': '段',
 '🎨': '画',
 '📊': '量',
 '🍳': '厨',
 '📜': '史',
 // Hall of Fame
 '🖊️': '鲁',
 '🚀': '马',
 '🍎': '乔',
 '⚛️': '爱',
 '🏛️': '苏',
 '🌌': '霍',
 '📖': '莎',
 '🖌️': '达',
 // New Hall of Fame
 '⚡': '尼',
 '🎵': '莫',
 '🧮': '图',
 '🎓': '孔',
 '☢️': '居',
 '🍷': '李',
 '🪷': '佛',
 // Legacy
 '🤖': '哲',
 '🔬': '探',
 '📈': '量',
 '👑': 'A',
}

export function formatNumber(num: number): string {
 if (num >= 10000) return (num / 10000).toFixed(1) + '万'
 if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
 return num.toString()
}

export function formatDate(dateString: string): string {
 const date = new Date(dateString)
 const now = new Date()
 const diffMs = Math.max(0, now.getTime() - date.getTime())
 const diffMins = Math.floor(diffMs / 60000)
 const diffHours = Math.floor(diffMs / 3600000)
 const diffDays = Math.floor(diffMs / 86400000)
 if (diffMins < 1) return '刚刚'
 if (diffMins < 60) return `${diffMins}分钟前`
 if (diffHours < 24) return `${diffHours}小时前`
 if (diffDays < 7) return `${diffDays}天前`
 return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const CONTENT_TOKEN_RE = /(#[a-zA-Z0-9_\u4e00-\u9fff]+|@[a-zA-Z0-9_\u4e00-\u9fff]+)/g

export type ContentToken =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'mention'; value: string }

export function parseTweetContent(content: string): ContentToken[] {
  const parts = content.split(CONTENT_TOKEN_RE)
  return parts.filter(Boolean).map((part) => {
    if (part.startsWith('#')) return { type: 'hashtag' as const, value: part }
    if (part.startsWith('@')) return { type: 'mention' as const, value: part }
    return { type: 'text' as const, value: part }
  })
}
