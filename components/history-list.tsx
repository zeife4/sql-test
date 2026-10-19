'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, LoaderCircle, Target } from 'lucide-react'
import { getAttempts } from '@/lib/client-history'
import type { AttemptRecord } from '@/lib/types'
import { Card } from './ui/card'

export function HistoryList() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getAttempts()
      .then(setAttempts)
      .catch(() => setAttempts([]))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const passed = attempts.filter((item) => item.status === 'pass').length
    const errors = attempts.reduce<Record<string, number>>((acc, item) => {
      if (item.errorKind) acc[item.errorKind] = (acc[item.errorKind] ?? 0) + 1
      return acc
    }, {})
    const topError = Object.entries(errors).sort((a, b) => b[1] - a[1])[0]
    return { passed, rate: attempts.length ? Math.round((passed / attempts.length) * 100) : 0, topError }
  }, [attempts])

  if (loading) return <div className="flex min-h-52 items-center justify-center text-[var(--muted)]"><LoaderCircle className="mr-2 size-5 animate-spin" />正在读取记录…</div>
  if (!attempts.length) return <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Target className="size-8 text-[var(--accent)]" /><h2 className="mt-4 font-black">还没有提交记录</h2><p className="mt-2 text-sm text-[var(--muted)]">回到练习页提交一次答案，这里会自动生成学习画像。</p></Card>

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs font-bold text-[var(--muted)]">累计提交</p><p className="mt-2 text-3xl font-black">{attempts.length}</p></Card>
        <Card className="p-5"><p className="text-xs font-bold text-[var(--muted)]">正确率</p><p className="mt-2 text-3xl font-black text-[var(--accent)]">{stats.rate}%</p></Card>
        <Card className="p-5"><p className="text-xs font-bold text-[var(--muted)]">最常见错误</p><p className="mt-2 truncate font-mono text-sm font-black">{stats.topError?.[0] ?? '暂无'}</p><p className="mt-1 text-xs text-[var(--muted)]">{stats.topError ? `${stats.topError[1]} 次` : '继续保持'}</p></Card>
      </div>
      {stats.topError && <div className="mt-4 rounded-xl border border-[var(--warm)]/30 bg-[var(--panel-strong)] px-4 py-3 text-sm"><AlertCircle className="mr-2 inline size-4 text-[var(--warm)]" />最近错误中 <strong>{stats.topError[1]} 次</strong>属于 <code className="font-mono">{stats.topError[0]}</code>，建议针对性复习后重做。</div>}
      <div className="mt-6 space-y-3">
        {attempts.map((attempt) => (
          <details key={attempt.id} className="group rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)]">
            <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden sm:px-5">
              <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${attempt.status === 'pass' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>{attempt.status === 'pass' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}</div>
              <div className="min-w-0"><p className="truncate font-bold">{attempt.question.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{attempt.question.difficulty} · {new Date(attempt.createdAt).toLocaleString('zh-CN')}</p></div>
              <div className="ml-auto hidden items-center gap-1 text-xs text-[var(--muted)] sm:flex"><Clock3 className="size-3.5" />{attempt.durationMs ?? '—'} ms</div>
              <ChevronDown className="size-4 text-[var(--muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--line)] p-4 sm:p-5">
              <p className="text-sm leading-6 text-[var(--muted)]">{attempt.question.question}</p>
              {attempt.errorKind && <p className="mt-3 text-xs font-semibold text-[var(--danger)]">错误分类：{attempt.errorKind}</p>}
              <pre className="scrollbar-thin mt-4 overflow-x-auto rounded-xl bg-[#152019] p-4 font-mono text-xs leading-6 text-[#dbe8dd]">{attempt.sql}</pre>
            </div>
          </details>
        ))}
      </div>
    </>
  )
}
