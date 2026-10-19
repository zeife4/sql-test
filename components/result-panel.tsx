'use client'

import { AlertTriangle, CheckCircle2, Clock3, Database, XCircle } from 'lucide-react'
import type { RunResponse } from '@/lib/types'

function Cell({ value }: { value: unknown }) {
  if (value === null) return <span className="italic text-[var(--muted)]">NULL</span>
  return <>{String(value)}</>
}

export function ResultPanel({ response, loading }: { response: RunResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4 p-5" aria-live="polite">
        <div className="h-5 w-44 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-28 animate-pulse rounded-xl bg-[var(--line)]/70" />
      </div>
    )
  }
  if (!response) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-8 text-center text-[var(--muted)]">
        <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-4"><Database className="size-6" /></div>
        <div><p className="font-semibold text-[var(--ink)]">结果会出现在这里</p><p className="mt-1 text-sm">先运行看看结果，准备好后再提交判题。</p></div>
      </div>
    )
  }
  const passed = response.status === 'pass'
  const failed = response.status === 'fail' || response.status === 'error'
  return (
    <div className="min-h-full">
      <div className={`m-4 flex items-start gap-3 rounded-xl border p-4 ${passed ? 'border-[var(--success)]/30 bg-[var(--success-soft)]' : failed ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)]' : 'border-[var(--line)] bg-[var(--panel-strong)]'}`} role="status">
        {passed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--success)]" /> : failed ? <XCircle className="mt-0.5 size-5 shrink-0 text-[var(--danger)]" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />}
        <div className="min-w-0"><p className="font-semibold">{response.message}</p>{response.errorKind && <p className="mt-1 font-mono text-xs text-[var(--muted)]">{response.errorKind}</p>}</div>
      </div>
      {response.diffs?.length ? (
        <div className="mx-4 mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><AlertTriangle className="size-4 text-[var(--warm)]" />差异摘要</h3>
          <ul className="space-y-2 font-mono text-xs text-[var(--muted)]">
            {response.diffs.map((diff, index) => (
              <li key={index} className="rounded-lg bg-[var(--canvas)] px-3 py-2">
                {diff.kind === 'missing' && `缺少行：${JSON.stringify(diff.values)}`}
                {diff.kind === 'extra' && `多出行：${JSON.stringify(diff.values)}`}
                {diff.kind === 'value' && `第 ${diff.row} 行第 ${diff.column} 列：期望 ${JSON.stringify(diff.expected)}，实际 ${JSON.stringify(diff.actual)}`}
                {diff.kind === 'order' && '数据内容相同，但第一处顺序不同。'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {response.result ? (
        <div className="mx-4 mb-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
            <span>{response.result.rows.length} 行 × {response.result.columns.length} 列</span>
            <span className="flex items-center gap-1"><Clock3 className="size-3.5" />{response.result.durationMs} ms</span>
          </div>
          <div className="scrollbar-thin max-w-full overflow-x-auto">
            <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-20 bg-[var(--panel)]">
                <tr>{response.result.columns.map((column, index) => <th key={`${column}-${index}`} className={`${index === 0 ? 'sticky left-0 z-30 bg-[var(--panel)]' : ''} whitespace-nowrap border-b border-r border-[var(--line)] px-4 py-3 font-mono text-xs font-bold text-[var(--muted)]`}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {response.result.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-[var(--accent-soft)]/40">
                    {row.map((value, columnIndex) => <td key={columnIndex} className={`${columnIndex === 0 ? 'sticky left-0 z-10 bg-[var(--panel-strong)] font-medium' : ''} whitespace-nowrap border-b border-r border-[var(--line)] px-4 py-2.5 font-mono text-xs ${typeof value === 'number' ? 'text-right' : ''}`}><Cell value={value} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
