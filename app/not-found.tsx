import Link from 'next/link'
import { Braces } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] p-6 text-center">
      <div><Braces className="mx-auto size-10 text-[var(--accent)]" /><p className="mt-5 font-mono text-sm text-[var(--muted)]">404 · no rows returned</p><h1 className="mt-2 text-3xl font-black">这里没有这张表</h1><Link href="/" className={buttonVariants({ className: 'mt-7' })}>回到练习场</Link></div>
    </main>
  )
}
