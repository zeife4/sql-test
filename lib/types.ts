export type Difficulty = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export type KnowledgePoint =
  | 'basic_select'
  | 'sort_limit'
  | 'aggregate'
  | 'group_having'
  | 'join'
  | 'subquery'
  | 'case_when'
  | 'date_func'
  | 'string_func'
  | 'null_handling'
  | 'window_fn'
  | 'cte'
  | 'topn_per_group'
  | 'gaps_islands'
  | 'pivot'
  | 'funnel_retention'

export interface SqlSchema {
  ddl: string[]
  seed: string[]
}

export interface Question {
  id: string
  title: string
  difficulty: Difficulty
  knowledgePoints: KnowledgePoint[]
  businessContext: string
  schema: SqlSchema
  question: string
  requirements: string[]
  hints: string[]
  referenceSql: string
  explanation: string
  traps: string[]
  ordered: boolean
  industry: string
  source: 'llm' | 'builtin'
}

export type ErrorKind =
  | 'syntax_error'
  | 'exec_error'
  | 'col_mismatch'
  | 'row_count_mismatch'
  | 'value_mismatch'
  | 'order_mismatch'
  | 'timeout'
  | 'forbidden_statement'

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  durationMs: number
  truncated?: boolean
}

export interface DiffItem {
  kind: 'missing' | 'extra' | 'value' | 'order'
  row?: number
  column?: number
  expected?: unknown
  actual?: unknown
  values?: unknown[]
}

export interface RunResponse {
  ok: boolean
  passed?: boolean
  status: 'run' | 'pass' | 'fail' | 'error'
  result?: QueryResult
  errorKind?: ErrorKind
  message: string
  diffs?: DiffItem[]
  referenceSql?: string
  explanation?: string
}

export interface AttemptRecord {
  id: string
  questionId: string
  sql: string
  status: 'pass' | 'fail' | 'error'
  errorKind?: ErrorKind
  durationMs?: number
  createdAt: number
  question: Pick<Question, 'title' | 'difficulty' | 'question' | 'knowledgePoints'>
}
