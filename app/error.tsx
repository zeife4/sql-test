'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] p-6 text-center">
      <div className="max-w-sm"><AlertTriangle className="mx-auto size-9 text-[var(--danger)]" /><h1 className="mt-5 text-2xl font-black">练习场暂时卡住了</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">你的草稿保存在浏览器中。可以安全重试，不会丢失当前 SQL。</p><Button className="mt-6" onClick={reset}>重新加载</Button></div>
    </main>
  )
}
