import { describe, expect, it } from 'vitest'
import { FALLBACK_QUESTIONS } from '@/lib/fallback'
import { judgeResults } from '@/lib/judge'
import { executeWithSqlJs } from '@/lib/sqljs-engine'
import { SqlValidationError, validateSql } from '@/lib/sql-security'

describe('SQL security', () => {
  it('accepts SELECT and one trailing semicolon', () => {
    expect(validateSql(' -- comment\n SELECT 1; ')).toBe('SELECT 1')
  })

  it('rejects stacked or mutating statements', () => {
    expect(() => validateSql('SELECT 1; DROP TABLE products;')).toThrow(SqlValidationError)
    expect(() => validateSql('WITH x AS (DELETE FROM products) SELECT 1')).toThrow(SqlValidationError)
    expect(() => validateSql('PRAGMA table_info(products)')).toThrow(SqlValidationError)
  })
})

describe('result judge', () => {
  const expected = { columns: ['a', 'b'], rows: [[1, 'Hello'], [2, null]], durationMs: 1 }
  it('ignores row order when the question does not require it', () => {
    const actual = { columns: ['x', 'y'], rows: [[2, null], [1.00000001, ' hello ']], durationMs: 1 }
    expect(judgeResults(actual, expected, false).passed).toBe(true)
  })
  it('reports order mismatches for ordered questions', () => {
    const actual = { columns: ['x', 'y'], rows: [[2, null], [1, 'Hello']], durationMs: 1 }
    expect(judgeResults(actual, expected, true).errorKind).toBe('order_mismatch')
  })
  it('reports column and row count mismatches first', () => {
    expect(judgeResults({ columns: ['a'], rows: [[1]], durationMs: 1 }, expected, true).errorKind).toBe('col_mismatch')
    expect(judgeResults({ columns: ['a', 'b'], rows: [[1, 'Hello']], durationMs: 1 }, expected, true).errorKind).toBe('row_count_mismatch')
  })
})

describe('built-in question bank', () => {
  const baseQuestions = FALLBACK_QUESTIONS.filter((question) => !/-v\d+$/.test(question.id))
  it('contains 50 questions across all five levels', () => {
    expect(FALLBACK_QUESTIONS).toHaveLength(50)
    expect(new Set(FALLBACK_QUESTIONS.map((question) => question.difficulty))).toEqual(new Set(['L1', 'L2', 'L3', 'L4', 'L5']))
  })

  for (const question of baseQuestions) {
    it(`executes the reference answer for ${question.id}`, async () => {
      const result = await executeWithSqlJs({ schema: question.schema, queries: [{ key: 'reference', sql: validateSql(question.referenceSql) }] })
      expect(result.reference.rows.length).toBeGreaterThan(0)
      expect(result.reference.rows.length).toBeLessThanOrEqual(1000)
    }, 5000)
  }
})
