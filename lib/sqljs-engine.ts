import initSqlJs from 'sql.js/dist/sql-wasm-inline.js'
import type { QueryResult, SqlSchema } from './types'

export interface SqlQuery {
  key: string
  sql: string
}

export interface SqlWork {
  schema: SqlSchema
  queries: SqlQuery[]
}

function safeValue(value: initSqlJs.SqlValue): unknown {
  if (!(value instanceof Uint8Array)) return value
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function execute(db: initSqlJs.Database, sql: string): QueryResult {
  const started = performance.now()
  const statement = db.prepare(sql)
  try {
    const columns = statement.getColumnNames()
    if (!columns.length) {
      const error = new Error('只允许返回结果集的只读查询。') as Error & { code?: string }
      error.code = 'NOT_READER'
      throw error
    }
    const rows: unknown[][] = []
    while (statement.step()) {
      if (rows.length >= 5000) {
        const error = new Error('结果集超过 5000 行，请检查连接条件或缩小范围。') as Error & { code?: string }
        error.code = 'TOO_LARGE'
        throw error
      }
      rows.push(statement.get().map(safeValue))
    }
    return { columns, rows, durationMs: Math.round(performance.now() - started) }
  } finally {
    statement.free()
  }
}

export async function executeWithSqlJs(payload: SqlWork): Promise<Record<string, QueryResult>> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  try {
    db.run('PRAGMA foreign_keys = ON')
    for (const ddl of payload.schema.ddl) db.run(ddl)
    for (const seed of payload.schema.seed) db.run(seed)
    db.run('PRAGMA query_only = ON')
    return Object.fromEntries(payload.queries.map((query) => [query.key, execute(db, query.sql)]))
  } finally {
    db.close()
  }
}
