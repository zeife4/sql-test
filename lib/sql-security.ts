import type { ErrorKind } from './types'

export class SqlValidationError extends Error {
  kind: ErrorKind = 'forbidden_statement'
}

function stripComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ')
}

function maskStringLiterals(sql: string) {
  return sql.replace(/'(?:''|[^'])*'/g, "''").replace(/\"(?:\"\"|[^\"])*\"/g, '\"\"')
}

export function validateSql(input: string) {
  if (!input || !input.trim()) throw new SqlValidationError('请先写一条查询语句。')
  if (input.length > 50_000) throw new SqlValidationError('SQL 过长，请缩小查询。')
  if (input.includes('\0')) throw new SqlValidationError('SQL 中包含不允许的字符。')

  let sql = stripComments(input).trim()
  if (sql.endsWith(';')) sql = sql.slice(0, -1).trim()
  if (sql.includes(';')) throw new SqlValidationError('只允许执行一条 SQL 查询。')
  if (!/^(SELECT|WITH)\b/i.test(sql)) throw new SqlValidationError('只允许以 SELECT 或 WITH 开头的只读查询。')

  const scan = maskStringLiterals(sql)
  const forbidden = /\b(ATTACH|DETACH|PRAGMA|CREATE|ALTER|DROP|INSERT|REPLACE|UPDATE|DELETE|VACUUM|REINDEX|ANALYZE|LOAD_EXTENSION)\b/i.exec(scan)
  if (forbidden) throw new SqlValidationError(`检测到不允许的关键字：${forbidden[1].toUpperCase()}。`)
  return sql
}
