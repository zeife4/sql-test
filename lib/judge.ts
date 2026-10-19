import type { DiffItem, ErrorKind, QueryResult } from './types'

function valueEqual(actual: unknown, expected: unknown) {
  if (actual === null || expected === null) return actual === expected
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= Math.max(1e-6, 1e-6 * Math.abs(expected))
  }
  return String(actual).trim().toLocaleLowerCase() === String(expected).trim().toLocaleLowerCase()
}

function rowEqual(actual: unknown[], expected: unknown[]) {
  return actual.length === expected.length && actual.every((value, index) => valueEqual(value, expected[index]))
}

function canonical(row: unknown[]) {
  return JSON.stringify(row.map((value) => {
    if (value === null) return ['null']
    if (typeof value === 'number') return ['number', Number(value.toPrecision(12))]
    return ['text', String(value).trim().toLocaleLowerCase()]
  }))
}

function sortedRows(rows: unknown[][]) {
  return [...rows].sort((a, b) => canonical(a).localeCompare(canonical(b)))
}

function firstValueDiffs(actualRows: unknown[][], expectedRows: unknown[][]): DiffItem[] {
  const diffs: DiffItem[] = []
  const length = Math.min(actualRows.length, expectedRows.length)
  for (let row = 0; row < length && diffs.length < 5; row += 1) {
    for (let column = 0; column < expectedRows[row].length && diffs.length < 5; column += 1) {
      if (!valueEqual(actualRows[row][column], expectedRows[row][column])) {
        diffs.push({ kind: 'value', row: row + 1, column: column + 1, expected: expectedRows[row][column], actual: actualRows[row][column] })
      }
    }
  }
  return diffs
}

export interface JudgeResult {
  passed: boolean
  errorKind?: ErrorKind
  message: string
  diffs?: DiffItem[]
}

export function judgeResults(actual: QueryResult, expected: QueryResult, ordered: boolean): JudgeResult {
  if (actual.columns.length !== expected.columns.length) {
    return {
      passed: false,
      errorKind: 'col_mismatch',
      message: `应返回 ${expected.columns.length} 列，你的结果是 ${actual.columns.length} 列。`,
    }
  }
  if (actual.rows.length !== expected.rows.length) {
    const actualKeys = new Set(actual.rows.map(canonical))
    const expectedKeys = new Set(expected.rows.map(canonical))
    const missing = expected.rows.filter((row) => !actualKeys.has(canonical(row))).slice(0, 5).map((values) => ({ kind: 'missing' as const, values }))
    const extra = actual.rows.filter((row) => !expectedKeys.has(canonical(row))).slice(0, Math.max(0, 5 - missing.length)).map((values) => ({ kind: 'extra' as const, values }))
    return {
      passed: false,
      errorKind: 'row_count_mismatch',
      message: `应返回 ${expected.rows.length} 行，你的结果是 ${actual.rows.length} 行。`,
      diffs: [...missing, ...extra],
    }
  }

  const actualUnordered = sortedRows(actual.rows)
  const expectedUnordered = sortedRows(expected.rows)
  const sameValues = actualUnordered.every((row, index) => rowEqual(row, expectedUnordered[index]))
  if (ordered) {
    const sameOrder = actual.rows.every((row, index) => rowEqual(row, expected.rows[index]))
    if (sameOrder) return { passed: true, message: `通过！${actual.rows.length} 行结果与参考结果完全一致。` }
    if (sameValues) {
      return {
        passed: false,
        errorKind: 'order_mismatch',
        message: '结果内容正确，但顺序不符合题目要求。请检查 ORDER BY。',
        diffs: [{ kind: 'order', row: 1, expected: expected.rows[0], actual: actual.rows[0] }],
      }
    }
    return { passed: false, errorKind: 'value_mismatch', message: '返回值或列顺序与预期不一致。', diffs: firstValueDiffs(actual.rows, expected.rows) }
  }
  if (sameValues) return { passed: true, message: `通过！${actual.rows.length} 行结果与参考结果一致。` }
  return { passed: false, errorKind: 'value_mismatch', message: '返回值或列顺序与预期不一致。', diffs: firstValueDiffs(actualUnordered, expectedUnordered) }
}
