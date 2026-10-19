import Link from 'next/link'
import { ArrowLeft, Braces, History, Settings } from 'lucide-react'

export function SimpleShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[var(--canvas)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl pr-3 font-bold hover:bg-[var(--panel)]">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--panel-strong)] dark:bg-[var(--accent)] dark:text-[#102018]"><Braces className="size-5" /></span>
            <span className="hidden sm:block">QueryDojo</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" />练习</Link>
            <Link href="/history" className="grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]" aria-label="做题记录"><History className="size-4" /></Link>
            <Link href="/settings" className="grid size-11 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]" aria-label="设置"><Settings className="size-4" /></Link>
          </nav>
        </header>
        <div className="mt-12 lg:mt-16">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  )
}
