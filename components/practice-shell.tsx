'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Braces, Check, ChevronRight, CircleHelp, Clock3, Code2, Database,
  History, Keyboard, LoaderCircle, Moon, Play, RotateCcw, Send, Settings,
  Sparkles, Square, Sun, Target, WandSparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { executeQueriesInBrowser, SqlTimeoutError } from '@/lib/browser-sql'
import { DIFFICULTIES, DIFFICULTY_ALLOWED, KNOWLEDGE_POINTS, knowledgeLabel } from '@/lib/catalog'
import { saveAttempt } from '@/lib/client-history'
import { pickFallbackQuestion } from '@/lib/fallback'
import { judgeResults } from '@/lib/judge'
import { parseSchema } from '@/lib/sql-schema'
import { SqlValidationError, validateSql } from '@/lib/sql-security'
import type { Difficulty, ErrorKind, KnowledgePoint, Question, RunResponse } from '@/lib/types'
import type { SqlEditorHandle } from './sql-editor'
import { ResultPanel } from './result-panel'

const DynamicSqlEditor = dynamic(() => import('./sql-editor').then((module) => module.SqlEditor), {
  ssr: false,
  loading: () => <div className="m-4 h-[calc(100%-2rem)] animate-pulse rounded-xl bg-[var(--line)]/60" aria-label="正在加载编辑器" />,
})

const SESSION_KEY = 'querydojo-session-v1'
const SETTINGS_KEY = 'querydojo-settings-v1'

function starterSql(question: Question) {
  const table = parseSchema(question.schema.ddl)[0]?.name ?? 'table_name'
  return `SELECT\n  *\nFROM ${table}`
}

function executionErrorKind(message: string): ErrorKind {
  return /syntax error|incomplete input|near .*syntax/i.test(message) ? 'syntax_error' : 'exec_error'
}

function normalizeAiQuestion(value: unknown): Question | null {
  if (!value || typeof value !== 'object') return null
  const question = value as Partial<Question>
  if (
    typeof question.title !== 'string' || typeof question.businessContext !== 'string'
    || typeof question.question !== 'string' || typeof question.referenceSql !== 'string'
    || !question.schema || !Array.isArray(question.schema.ddl) || !Array.isArray(question.schema.seed)
    || !Array.isArray(question.knowledgePoints) || !Array.isArray(question.requirements)
    || !Array.isArray(question.hints) || !Array.isArray(question.traps)
    || !question.difficulty || !DIFFICULTY_ALLOWED[question.difficulty]
  ) return null
  return {
    ...question,
    id: question.id || `ai-${crypto.randomUUID()}`,
    explanation: question.explanation || '参考 SQL 展示了一个可行的解题路径。',
    ordered: typeof question.ordered === 'boolean'
      ? question.ordered
      : /(排序|升序|降序|从高到低|从低到高|前\s*\d+|Top\s*\d+)/i.test(question.question),
    industry: question.industry || 'AI 生成',
    source: 'llm',
  } as Question
}

function IconLogo() {
  return (
    <span className="grid size-10 place-items-center rounded-[14px] bg-[var(--ink)] text-[var(--panel-strong)] shadow-sm dark:bg-[var(--accent)] dark:text-[#102018]">
      <Braces className="size-5" strokeWidth={2.4} />
    </span>
  )
}

function SchemaTree({ question, onInsert }: { question: Question; onInsert: (value: string) => void }) {
  const tables = useMemo(() => parseSchema(question.schema.ddl), [question.schema.ddl])
  return (
    <div className="space-y-2">
      {tables.map((table) => (
        <details key={table.name} className="group rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-bold marker:hidden">
            <ChevronRight className="size-4 text-[var(--muted)] transition-transform group-open:rotate-90" />
            <Database className="size-4 text-[var(--accent)]" />
            <button type="button" className="min-h-9 rounded-lg px-1 text-left hover:text-[var(--accent)]" onClick={(event) => { event.preventDefault(); onInsert(table.name) }}>{table.name}</button>
            <span className="ml-auto text-[10px] font-medium text-[var(--muted)]">{table.columns.length} 列</span>
          </summary>
          <div className="border-t border-[var(--line)] px-2 py-2">
            {table.columns.map((column) => (
              <button key={column.name} type="button" title={`${column.type}${column.nullable ? ' · 可为空' : ''}`} onClick={() => onInsert(column.name)} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left font-mono text-xs hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
                <span className="truncate">{column.name}</span>
                <span className="ml-auto pl-3 text-[10px] text-[var(--muted)]">{column.type}</span>
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

function QuestionPanel({
  question,
  response,
  onInsert,
  difficulty,
  setDifficulty,
  knowledgePoints,
  toggleKnowledge,
  onLoadQuestion,
  generating,
  notice,
}: {
  question: Question
  response: RunResponse | null
  onInsert: (value: string) => void
  difficulty: Difficulty
  setDifficulty: (value: Difficulty) => void
  knowledgePoints: KnowledgePoint[]
  toggleKnowledge: (value: KnowledgePoint) => void
  onLoadQuestion: () => void
  generating: boolean
  notice: string | null
}) {
  return (
    <section className="question-panel scrollbar-thin">
      <div className="mobile-filter border-b border-[var(--line)] p-4">
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2">
          {DIFFICULTIES.map((item) => <button key={item.id} type="button" onClick={() => setDifficulty(item.id)} className={`min-h-10 shrink-0 rounded-xl border px-4 text-sm font-bold ${difficulty === item.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--panel-strong)]'}`}>{item.id} · {item.name}</button>)}
        </div>
        <div className="scrollbar-thin mt-2 flex gap-2 overflow-x-auto">
          {KNOWLEDGE_POINTS.filter((item) => DIFFICULTY_ALLOWED[difficulty].includes(item.id)).map((item) => <button key={item.id} type="button" onClick={() => toggleKnowledge(item.id)} className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold ${knowledgePoints.includes(item.id) ? 'bg-[var(--ink)] text-[var(--panel-strong)] dark:bg-[var(--accent)] dark:text-[#102018]' : 'bg-[var(--canvas)] text-[var(--muted)]'}`}>{item.label}</button>)}
        </div>
        <button type="button" onClick={onLoadQuestion} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-white dark:text-[#102018]">
          {generating ? <><Square className="size-3.5 fill-current" />取消出题</> : <><WandSparkles className="size-4" />换一题</>}
        </button>
        {notice && <p className="mt-2 text-center text-xs text-[var(--muted)]">{notice}</p>}
      </div>
      <div className="p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <Badge className="border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]">{question.difficulty}</Badge>
          <Badge>{question.industry}</Badge>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"><Sparkles className="size-3" />{question.source === 'llm' ? 'AI 新题' : '内置题'}</span>
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight lg:text-[28px]">{question.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">{question.knowledgePoints.map((point) => <span key={point} className="rounded-full bg-[var(--canvas)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">{knowledgeLabel(point)}</span>)}</div>

        <div className="mt-7 space-y-7">
          <section>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">业务背景</p>
            <p className="text-[15px] leading-7 text-[var(--muted)]">{question.businessContext}</p>
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/35 p-4">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]"><Target className="size-4" />你的任务</p>
            <p className="text-[15px] font-semibold leading-7">{question.question}</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              {question.requirements.map((requirement) => <li key={requirement} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />{requirement}</li>)}
            </ul>
          </section>
          <section>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">数据结构 · 点击可插入</p>
            <SchemaTree question={question} onInsert={onInsert} />
          </section>
          <details className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-4">
            <summary className="min-h-8 cursor-pointer font-semibold">需要一点提示？</summary>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">{question.hints.map((hint, index) => <li key={hint}>{index + 1}. {hint}</li>)}</ol>
          </details>
          {response?.referenceSql ? (
            <section className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] p-4">
              <p className="mb-3 text-sm font-bold text-[var(--danger)]">参考答案</p>
              <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6">{response.referenceSql}</pre>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function PracticeShell({ initialQuestion }: { initialQuestion: Question }) {
  const [question, setQuestion] = useState(initialQuestion)
  const [difficulty, setDifficultyState] = useState<Difficulty>(initialQuestion.difficulty)
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>(initialQuestion.knowledgePoints)
  const [sql, setSql] = useState(() => starterSql(initialQuestion))
  const [response, setResponse] = useState<RunResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [questionWidth, setQuestionWidth] = useState(400)
  const [editorRatio, setEditorRatio] = useState(55)
  const [fontSize, setFontSize] = useState(14)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const editorRef = useRef<SqlEditorHandle>(null)
  const generateController = useRef<AbortController | null>(null)

  const applyTheme = useCallback((theme: string) => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { apiKey?: string; aiEndpoint?: string; theme?: string; fontSize?: number }
    if (settings.apiKey) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ aiEndpoint: settings.aiEndpoint, theme: settings.theme, fontSize: settings.fontSize }))
    }
    setFontSize(settings.fontSize ?? 14)
    applyTheme(settings.theme ?? 'system')
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { question?: Question; sql?: string; difficulty?: Difficulty; knowledgePoints?: KnowledgePoint[]; questionWidth?: number; editorRatio?: number } | null
    if (saved?.question?.id && saved.question.referenceSql) {
      setQuestion(saved.question)
      setSql(saved.sql ?? starterSql(saved.question))
      setDifficultyState(saved.difficulty ?? saved.question.difficulty)
      setKnowledgePoints(saved.knowledgePoints ?? saved.question.knowledgePoints)
      setQuestionWidth(saved.questionWidth ?? 400)
      setEditorRatio(saved.editorRatio ?? 55)
    }
  }, [applyTheme])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ question, sql, difficulty, knowledgePoints, questionWidth, editorRatio }))
    }, 120)
    return () => clearTimeout(timer)
  }, [question, sql, difficulty, knowledgePoints, questionWidth, editorRatio])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?') return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target?.tagName ?? '') || target?.closest('.cm-editor')) return
      event.preventDefault()
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setDifficulty = (value: Difficulty) => {
    setDifficultyState(value)
    setKnowledgePoints((current) => current.filter((point) => DIFFICULTY_ALLOWED[value].includes(point)).slice(0, 3))
  }
  const toggleKnowledge = (value: KnowledgePoint) => {
    setKnowledgePoints((current) => current.includes(value) ? current.filter((point) => point !== value) : [...current, value].slice(-3))
  }

  const insertIntoEditor = (value: string) => editorRef.current?.insertText(`${value} `)

  const loadQuestion = async () => {
    if (generating) {
      generateController.current?.abort()
      setGenerating(false)
      setNotice('已取消出题。')
      return
    }
    const controller = new AbortController()
    generateController.current = controller
    setGenerating(true)
    setNotice('正在准备新题…')
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { aiEndpoint?: string }
      let nextQuestion: Question
      let message: string
      if (settings.aiEndpoint?.trim()) {
        const request = await fetch(settings.aiEndpoint.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty, knowledgePoints }),
          signal: controller.signal,
        })
        const payload = await request.json() as { question?: unknown; message?: string }
        const generated = normalizeAiQuestion(payload.question)
        if (!request.ok || !generated) throw new Error(payload.message ?? 'AI 接口没有返回有效题目。')
        const referenceSql = validateSql(generated.referenceSql)
        const checked = await executeQueriesInBrowser({ schema: generated.schema, queries: [{ key: 'reference', sql: referenceSql }] })
        if (!checked.reference.rows.length || checked.reference.rows.length > 1000) throw new Error('AI 题目的参考结果不合格。')
        nextQuestion = generated
        message = payload.message ?? 'AI 新题已通过本地执行校验。'
      } else {
        nextQuestion = pickFallbackQuestion(difficulty, knowledgePoints, question.id)
        message = '已从内置题库换题；可在设置中接入阿里云 AI 接口。'
      }
      setQuestion(nextQuestion)
      setSql(starterSql(nextQuestion))
      setResponse(null)
      setNotice(message)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const fallback = pickFallbackQuestion(difficulty, knowledgePoints, question.id)
        setQuestion(fallback)
        setSql(starterSql(fallback))
        setResponse(null)
        setNotice(`AI 出题暂不可用，已切换到内置题库。${error instanceof Error ? ` ${error.message}` : ''}`)
      }
    } finally {
      setGenerating(false)
      generateController.current = null
    }
  }

  const runQuery = useCallback(async (mode: 'run' | 'submit') => {
    if (running) return
    setRunning(true)
    let normalizedSql = sql
    try {
      normalizedSql = validateSql(sql)
      const queries = [{ key: 'user', sql: normalizedSql }]
      if (mode === 'submit') queries.push({ key: 'reference', sql: validateSql(question.referenceSql) })
      const results = await executeQueriesInBrowser({ schema: question.schema, queries })
      if (mode === 'run') {
        setResponse({ ok: true, status: 'run', result: results.user, message: `运行成功，返回 ${results.user.rows.length} 行。` })
        return
      }
      const judged = judgeResults(results.user, results.reference, question.ordered)
      const payload: RunResponse = {
        ok: true,
        passed: judged.passed,
        status: judged.passed ? 'pass' : 'fail',
        result: results.user,
        errorKind: judged.errorKind,
        message: judged.message,
        diffs: judged.diffs,
        referenceSql: judged.passed ? undefined : question.referenceSql,
        explanation: judged.passed ? question.explanation : undefined,
      }
      setResponse(payload)
      await saveAttempt({
        questionId: question.id,
        sql: normalizedSql,
        status: judged.passed ? 'pass' : 'fail',
        errorKind: judged.errorKind,
        durationMs: results.user.durationMs,
        question: {
          title: question.title,
          difficulty: question.difficulty,
          question: question.question,
          knowledgePoints: question.knowledgePoints,
        },
      }).catch(() => undefined)
    } catch (error) {
      const timedOut = error instanceof SqlTimeoutError
      const validationError = error instanceof SqlValidationError
      const message = error instanceof Error ? error.message.replace(/^Error:\s*/i, '') : 'SQL 执行失败。'
      const errorKind: ErrorKind = timedOut ? 'timeout' : validationError ? 'forbidden_statement' : executionErrorKind(message)
      setResponse({ ok: false, status: 'error', errorKind, message })
      if (mode === 'submit') {
        await saveAttempt({
          questionId: question.id,
          sql: normalizedSql,
          status: 'error',
          errorKind,
          question: {
            title: question.title,
            difficulty: question.difficulty,
            question: question.question,
            knowledgePoints: question.knowledgePoints,
          },
        }).catch(() => undefined)
      }
    } finally {
      setRunning(false)
    }
  }, [question, running, sql])

  const startColumnResize = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startWidth = questionWidth
    const move = (moveEvent: PointerEvent) => setQuestionWidth(Math.min(640, Math.max(320, startWidth + moveEvent.clientX - startX)))
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const startRowResize = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const workspace = (event.currentTarget.parentElement?.getBoundingClientRect().height ?? 600) - 58
    const move = (moveEvent: PointerEvent) => {
      const rect = event.currentTarget.parentElement?.getBoundingClientRect()
      if (!rect) return
      setEditorRatio(Math.min(75, Math.max(30, ((moveEvent.clientY - rect.top - 58) / workspace) * 100)))
    }
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const appStyle = { '--question-width': `${questionWidth}px`, '--editor-height': `${editorRatio}%` } as CSSProperties

  return (
    <main className="practice-app" style={appStyle}>
      <header className="mobile-header">
        <Link href="/" className="flex items-center gap-3"><IconLogo /><span><strong className="block text-sm">QueryDojo</strong><span className="block text-[10px] text-[var(--muted)]">SQL 练习场</span></span></Link>
        <div className="flex gap-1"><Link href="/history" className="grid size-11 place-items-center rounded-xl" aria-label="做题记录"><History className="size-5" /></Link><Link href="/settings" className="grid size-11 place-items-center rounded-xl" aria-label="设置"><Settings className="size-5" /></Link></div>
      </header>

      <aside className="desktop-nav scrollbar-thin">
        <Link href="/" className="flex items-center gap-3 px-1"><IconLogo /><span><strong className="block text-[15px] tracking-tight">QueryDojo</strong><span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">SQL practice lab</span></span></Link>
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
          <p className="px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">今日节奏</p>
          <div className="mt-3 flex items-end gap-2"><span className="text-3xl font-black">01</span><span className="pb-1 text-xs text-[var(--muted)]">题进行中</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full w-1/3 rounded-full bg-[var(--accent)]" /></div>
        </div>
        <nav className="mt-7" aria-label="难度选择">
          <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">难度</p>
          <div className="space-y-1">
            {DIFFICULTIES.map((item) => (
              <button key={item.id} type="button" onClick={() => setDifficulty(item.id)} className={`flex min-h-12 w-full items-center rounded-xl px-3 text-left transition-colors ${difficulty === item.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--panel-strong)]'}`}>
                <span className="w-8 font-mono text-xs font-black">{item.id}</span><span><strong className="block text-sm">{item.name}</strong><span className="block text-[10px] text-[var(--muted)]">{item.subtitle}</span></span><span className="ml-auto text-[10px] text-[var(--muted)]">10</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">知识点 · 最多 3 项</p>
          <div className="flex flex-wrap gap-2">
            {KNOWLEDGE_POINTS.map((item) => {
              const available = DIFFICULTY_ALLOWED[difficulty].includes(item.id)
              const selected = knowledgePoints.includes(item.id)
              return <button key={item.id} type="button" disabled={!available} onClick={() => toggleKnowledge(item.id)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${selected ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--panel-strong)] dark:border-[var(--accent)] dark:bg-[var(--accent)] dark:text-[#102018]' : 'border-[var(--line)] bg-[var(--panel-strong)] text-[var(--muted)] hover:border-[var(--line-strong)]'}`}>{item.label}</button>
            })}
          </div>
        </div>
        <nav className="mt-5 space-y-1 border-t border-[var(--line)] pt-4">
          <Link href="/history" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"><History className="size-4" />做题记录</Link>
          <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"><Settings className="size-4" />设置</Link>
          <Link href="/about" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"><CircleHelp className="size-4" />使用说明</Link>
        </nav>
      </aside>

      <QuestionPanel question={question} response={response} onInsert={insertIntoEditor} difficulty={difficulty} setDifficulty={setDifficulty} knowledgePoints={knowledgePoints} toggleKnowledge={toggleKnowledge} onLoadQuestion={loadQuestion} generating={generating} notice={notice} />

      <div className="column-resizer" role="separator" aria-label="调整题目面板宽度" aria-orientation="vertical" tabIndex={0} onPointerDown={startColumnResize} onDoubleClick={() => setQuestionWidth(400)} />

      <section className="workspace-panel">
        <div className="desktop-toolbar">
          <div className="min-w-0"><p className="truncate text-sm font-black">{question.title}</p><p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{question.difficulty} · {question.knowledgePoints.map(knowledgeLabel).join(' / ')}</p></div>
          <div className="ml-auto flex items-center gap-2">
            {notice && <span className="hidden max-w-56 truncate text-xs text-[var(--muted)] xl:block">{notice}</span>}
            <Button variant="secondary" size="sm" onClick={loadQuestion}>{generating ? <><Square className="size-3.5 fill-current" />取消</> : <><WandSparkles className="size-3.5" />换一题</>}</Button>
            <Button variant="secondary" size="sm" onClick={() => runQuery('run')} disabled={running}><Play className="size-3.5" />运行</Button>
            <Button size="sm" onClick={() => runQuery('submit')} disabled={running}>{running ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}提交</Button>
            <button type="button" onClick={() => setShortcutsOpen(true)} className="ml-1 grid size-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--canvas)]" aria-label="快捷键"><Keyboard className="size-4" /></button>
          </div>
        </div>
        <div className="editor-region paper-grid">
          <DynamicSqlEditor ref={editorRef} value={sql} onChange={setSql} ddl={question.schema.ddl} fontSize={fontSize} onRun={() => runQuery('run')} onSubmit={() => runQuery('submit')} />
        </div>
        <div className="row-resizer" role="separator" aria-label="调整编辑器和结果区高度" aria-orientation="horizontal" tabIndex={0} onPointerDown={startRowResize} onDoubleClick={() => setEditorRatio(55)} />
        <div className="result-region scrollbar-thin"><ResultPanel response={response} loading={running} /></div>
      </section>

      <div className="mobile-actions">
        <Button variant="secondary" className="flex-1" onClick={() => runQuery('run')} disabled={running}><Play className="size-4" />运行</Button>
        <Button className="flex-[1.35]" onClick={() => runQuery('submit')} disabled={running}>{running ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}提交答案</Button>
        <button type="button" onClick={() => setSql(starterSql(question))} className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)]" aria-label="重置 SQL"><RotateCcw className="size-4" /></button>
      </div>

      {generating && <div className="generating-overlay"><div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-5 py-4 shadow-[var(--shadow)]"><div className="space-y-1.5"><span className="block h-2 w-9 animate-pulse rounded-full bg-[var(--accent)]/50" /><span className="block h-2 w-6 animate-pulse rounded-full bg-[var(--accent)]/30" /><span className="block h-2 w-11 animate-pulse rounded-full bg-[var(--accent)]/20" /></div><span><strong className="block text-sm">正在为你出题…</strong><span className="text-xs text-[var(--muted)]">设计数据、生成题目、执行校验</span></span></div></div>}

      {shortcutsOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onPointerDown={(event) => { if (event.currentTarget === event.target) setShortcutsOpen(false) }}>
          <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-6 shadow-[var(--shadow)]">
            <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Keyboard className="size-5" /></div><div><h2 id="shortcut-title" className="font-black">键盘快捷键</h2><p className="text-xs text-[var(--muted)]">少碰鼠标，多写查询。</p></div></div>
            <dl className="mt-6 space-y-3 text-sm">{[['运行查询','Ctrl / ⌘ + Enter'],['提交判题','Ctrl / ⌘ + Shift + Enter'],['主动补全','Ctrl / ⌘ + Space'],['确认补全','Tab / Enter'],['关闭补全','Esc'],['打开此面板','?']].map(([label,key]) => <div key={label} className="flex items-center justify-between"><dt className="text-[var(--muted)]">{label}</dt><dd className="rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2.5 py-1 font-mono text-xs">{key}</dd></div>)}</dl>
            <Button className="mt-7 w-full" onClick={() => setShortcutsOpen(false)}>知道了</Button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .practice-app { width: min(100%, 1600px); height: 100dvh; margin: 0 auto; display: grid; grid-template-columns: 240px var(--question-width) 8px minmax(0, 1fr); grid-template-areas: "nav question divider workspace"; overflow: hidden; border-inline: 1px solid var(--line); background: var(--panel); }
        .desktop-nav { grid-area: nav; display: flex; min-height: 0; flex-direction: column; overflow: hidden; border-right: 1px solid var(--line); padding: 20px 16px; background: var(--canvas); }
        .question-panel { grid-area: question; min-height: 0; overflow-y: auto; background: var(--panel); }
        .column-resizer { grid-area: divider; cursor: col-resize; background: var(--line); transition: background .15s; }
        .column-resizer:hover, .column-resizer:focus-visible, .row-resizer:hover, .row-resizer:focus-visible { background: var(--accent); }
        .workspace-panel { grid-area: workspace; min-width: 0; min-height: 0; display: grid; grid-template-rows: 58px minmax(180px, var(--editor-height)) 8px minmax(160px, 1fr); overflow: hidden; background: var(--panel-strong); }
        .desktop-toolbar { display: flex; min-width: 0; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); padding: 8px 14px 8px 18px; }
        .editor-region { min-height: 0; overflow: hidden; }
        .row-resizer { cursor: row-resize; background: var(--line); transition: background .15s; }
        .result-region { min-height: 0; overflow: auto; border-top: 0; background: var(--panel); }
        .mobile-header, .mobile-filter, .mobile-actions { display: none; }
        .generating-overlay { position: fixed; top: 72px; right: 24px; z-index: 70; pointer-events: none; }
        @media (max-width: 1023px) {
          body { padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
          .practice-app { display: block; width: 100%; height: auto; min-height: 100dvh; overflow: visible; border: 0; background: var(--canvas); }
          .desktop-nav, .desktop-toolbar, .column-resizer, .row-resizer { display: none; }
          .mobile-header { position: sticky; top: 0; z-index: 40; display: flex; height: 68px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding: 0 16px; background: color-mix(in srgb, var(--canvas) 92%, transparent); backdrop-filter: blur(16px); }
          .mobile-filter { display: block; }
          .question-panel { overflow: visible; border-bottom: 1px solid var(--line); }
          .workspace-panel { display: block; overflow: visible; background: var(--panel-strong); }
          .editor-region { height: min(40vh, 340px); min-height: 190px; border-bottom: 1px solid var(--line); }
          .result-region { min-height: 260px; overflow: visible; padding-bottom: 18px; }
          .mobile-actions { position: fixed; right: 0; bottom: 0; left: 0; z-index: 50; display: flex; gap: 8px; border-top: 1px solid var(--line); padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--panel) 94%, transparent); backdrop-filter: blur(16px); }
          .generating-overlay { top: auto; right: 16px; bottom: calc(88px + env(safe-area-inset-bottom)); left: 16px; }
          .generating-overlay > div { width: 100%; }
        }
      `}</style>
    </main>
  )
}
