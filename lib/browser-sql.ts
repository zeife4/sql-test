import type { QueryResult } from './types'
import type { SqlWork } from './sqljs-engine'

interface WorkerReply {
  id: string
  ok: boolean
  results?: Record<string, QueryResult>
  message?: string
  code?: string
}

export class SqlTimeoutError extends Error {}

export class SqlExecutionError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
  }
}

export function executeQueriesInBrowser(payload: SqlWork, timeoutMs = 3000): Promise<Record<string, QueryResult>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/sql-worker.ts', import.meta.url), { type: 'module', name: 'querydojo-sql' })
    const id = crypto.randomUUID()
    let settled = false
    const finish = () => {
      settled = true
      clearTimeout(timer)
      worker.terminate()
    }
    const timer = window.setTimeout(() => {
      if (settled) return
      finish()
      reject(new SqlTimeoutError('查询运行超过 3 秒，已安全中止。请检查连接条件或递归范围。'))
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (settled || event.data.id !== id) return
      finish()
      if (!event.data.ok || !event.data.results) {
        reject(new SqlExecutionError(event.data.message ?? 'SQL 执行失败。', event.data.code))
        return
      }
      resolve(event.data.results)
    }
    worker.onerror = (event) => {
      if (settled) return
      finish()
      reject(new SqlExecutionError(event.message || 'SQL 工作线程启动失败。'))
    }
    worker.postMessage({ id, payload })
  })
}
