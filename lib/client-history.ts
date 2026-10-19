import type { AttemptRecord } from './types'

const DB_NAME = 'querydojo-client'
const STORE_NAME = 'attempts'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开浏览器记录库。'))
  })
}

export async function saveAttempt(attempt: Omit<AttemptRecord, 'id' | 'createdAt'>) {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ ...attempt, id: crypto.randomUUID(), createdAt: Date.now() })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('保存记录失败。'))
    })
  } finally {
    db.close()
  }
}

export async function getAttempts(limit = 100): Promise<AttemptRecord[]> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => {
        const attempts = (request.result as AttemptRecord[])
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit)
        resolve(attempts)
      }
      request.onerror = () => reject(request.error ?? new Error('读取记录失败。'))
    })
  } finally {
    db.close()
  }
}
