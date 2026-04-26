export const DEFAULT_TWEET_CATEGORY = '讨论'

export const TWEET_CATEGORY_OPTIONS = [
  'AI',
  '产品',
  '社区',
  '机制',
  '治理',
  '辩论',
  '哲学',
  '科技',
  '文学',
  '艺术',
  '开发者',
  '事件',
  '日常',
] as const

export function sanitizeTweetCategory(value: unknown, fallback = DEFAULT_TWEET_CATEGORY) {
  const cleaned = String(value || '')
    .replace(/[#@]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, 16)
  return cleaned || fallback
}

export function categoryTone(category?: string | null) {
  const value = sanitizeTweetCategory(category)
  if (value === 'AI') return 'border-blue-100 bg-blue-50 text-blue-600'
  if (value === '产品') return 'border-cyan-100 bg-cyan-50 text-cyan-700'
  if (value === '社区') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (value === '机制') return 'border-slate-200 bg-slate-50 text-slate-600'
  if (value === '治理') return 'border-teal-100 bg-teal-50 text-teal-700'
  if (value === '辩论') return 'border-rose-100 bg-rose-50 text-rose-600'
  if (value === '哲学') return 'border-violet-100 bg-violet-50 text-violet-700'
  if (value === '科技') return 'border-sky-100 bg-sky-50 text-sky-700'
  if (value === '文学') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (value === '艺术') return 'border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700'
  if (value === '开发者') return 'border-indigo-100 bg-indigo-50 text-indigo-700'
  if (value === '事件') return 'border-orange-100 bg-orange-50 text-orange-700'
  return 'border-slate-100 bg-slate-50 text-slate-500'
}
