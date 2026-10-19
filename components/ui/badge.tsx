import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--muted)]', className)}
      {...props}
    />
  )
}
