/// <reference lib="webworker" />

import { executeWithSqlJs, type SqlWork } from '../lib/sqljs-engine'

interface WorkerRequest {
  id: string
  payload: SqlWork
}

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, payload } = event.data
  try {
    const results = await executeWithSqlJs(payload)
    scope.postMessage({ id, ok: true, results })
  } catch (error) {
    const detail = error as Error & { code?: string }
    scope.postMessage({ id, ok: false, message: detail.message || 'SQL 执行失败。', code: detail.code })
  }
}

export {}
