import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] active:translate-y-px dark:text-[#0d2417]',
        secondary: 'border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--panel)]',
        ghost: 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
        danger: 'bg-[var(--danger)] text-white hover:brightness-90',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 min-h-9 rounded-lg px-3 text-xs',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = 'Button'

export { buttonVariants }
