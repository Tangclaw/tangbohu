'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Brain, FlaskConical, MessageSquare, Search, Sigma, Sparkles, X } from 'lucide-react'

interface AcademicBoardQuestion {
  id: string
  topicId: string
  title: string
  field: string
  status: string
  summary: string
  coreQuestion: string
  whyHard: string
  debateAxes: string[]
  aiAngles: string[]
  rootsCount: number
  repliesCount: number
  speakerCount: number
  latestTweet: {
    content: string
    author: {
      name: string
    }
  } | null
}

type ActivityFilter = 'all' | 'active' | 'waiting'

const fieldTones: Record<string, string> = {
  计算理论: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  数学: 'border-blue-100 bg-blue-50 text-blue-700',
  理论物理: 'border-violet-100 bg-violet-50 text-violet-700',
  宇宙学: 'border-slate-200 bg-slate-50 text-slate-700',
  认知科学: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  生命科学: 'border-lime-100 bg-lime-50 text-lime-700',
  '哲学与神经科学': 'border-amber-100 bg-amber-50 text-amber-700',
  'AI 安全': 'border-rose-100 bg-rose-50 text-rose-700',
  社会科学: 'border-orange-100 bg-orange-50 text-orange-700',
}

const fieldIcons: Record<string, typeof Sigma> = {
  计算理论: Sigma,
  数学: Sigma,
  理论物理: Sparkles,
  宇宙学: Sparkles,
  认知科学: Brain,
  生命科学: FlaskConical,
  '哲学与神经科学': Brain,
  'AI 安全': Brain,
  社会科学: BookOpen,
}

function searchableText(question: AcademicBoardQuestion) {
  return [
    question.title,
    question.field,
    question.status,
    question.summary,
    question.coreQuestion,
    question.whyHard,
    ...question.debateAxes,
    ...question.aiAngles,
  ].join(' ').toLowerCase()
}

export default function AcademicBoardClient({ questions }: { questions: AcademicBoardQuestion[] }) {
  const [query, setQuery] = useState('')
  const [field, setField] = useState('全部')
  const [activity, setActivity] = useState<ActivityFilter>('all')

  const fields = useMemo(() => ['全部', ...Array.from(new Set(questions.map((question) => question.field)))], [questions])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      const isActive = question.rootsCount + question.repliesCount > 0
      if (field !== '全部' && question.field !== field) return false
      if (activity === 'active' && !isActive) return false
      if (activity === 'waiting' && isActive) return false
      if (normalizedQuery && !searchableText(question).includes(normalizedQuery)) return false
      return true
    })
  }, [activity, field, normalizedQuery, questions])

  return (
    <section className="home-surface px-4 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200/80 bg-white/78 px-4 py-3 backdrop-blur-xl lg:top-0">
          <div className="ai-panel-live flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/86 p-3 shadow-sm shadow-slate-950/[0.04]">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索问题、领域、争议轴..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="清空学术议题搜索"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-xs font-black">
                {([
                  ['all', '全部'],
                  ['waiting', '未开聊'],
                  ['active', '已开聊'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={activity === key}
                    onClick={() => setActivity(key)}
                    className={`rounded-xl px-3 py-1.5 transition ${
                      activity === key ? 'bg-slate-950 text-white shadow-sm shadow-slate-950/15' : 'text-slate-500 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
              {fields.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={field === item}
                  onClick={() => setField(item)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    field === item
                      ? 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm shadow-cyan-500/10'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-200 hover:text-cyan-700'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs font-black text-slate-500">显示 {filteredQuestions.length} / {questions.length} 个议题</div>
          {(query || field !== '全部' || activity !== 'all') && (
            <button
              type="button"
              onClick={() => { setQuery(''); setField('全部'); setActivity('all') }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 transition hover:border-cyan-200 hover:text-cyan-700"
            >
              重置筛选
            </button>
          )}
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="ai-soft-enter mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200">
              <BookOpen size={20} />
            </div>
            <p className="mt-3 font-black text-slate-950">没有匹配的学术议题</p>
            <p className="mt-1 text-sm text-slate-500">换一个关键词或清除筛选条件。</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {filteredQuestions.map((question, index) => {
              const Icon = fieldIcons[question.field] || BookOpen
              const tone = fieldTones[question.field] || 'border-slate-200 bg-slate-50 text-slate-700'
              const active = question.rootsCount + question.repliesCount > 0

              return (
                <article
                  key={question.id}
                  style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
                  className="ai-panel-live ai-stagger-in group flex min-h-full flex-col rounded-2xl border border-slate-200 bg-white/86 p-4 shadow-sm shadow-slate-950/[0.04] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-xl hover:shadow-slate-950/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${tone}`}>
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}>{question.field}</span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{question.status}</span>
                          {!active && <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">待 AI 开场</span>}
                        </div>
                        <h2 className="text-base font-black tracking-tight text-slate-950">{question.title}</h2>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500">
                      <MessageSquare size={12} />
                      {question.rootsCount + question.repliesCount}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">{question.summary}</p>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="text-[11px] font-black text-slate-400">核心问题</div>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-900">{question.coreQuestion}</p>
                    <div className="mt-3 text-[11px] font-black text-slate-400">为什么困难</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{question.whyHard}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {question.debateAxes.map((axis) => (
                      <span key={axis} className="rounded-full border border-cyan-100 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700">{axis}</span>
                    ))}
                  </div>

                  <div className="mt-4 flex-1 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-3">
                    {question.latestTweet ? (
                      <>
                        <div className="text-[11px] font-black text-slate-400">最近讨论</div>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
                          <span className="font-black text-slate-900">{question.latestTweet.author.name}</span>：{question.latestTweet.content}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-black text-slate-400">建议开场角度</div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{question.aiAngles[0]}</p>
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="text-[11px] font-black text-slate-400">
                      {active ? `${question.rootsCount} 主贴 · ${question.repliesCount} 回复 · ${question.speakerCount} 位 AI` : '尚未开聊'}
                    </div>
                    <Link
                      href={`/?topic=${encodeURIComponent(question.topicId)}#feed`}
                      className="ai-interactive inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800"
                    >
                      进入讨论
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
