import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-full)] border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-micro)] font-semibold uppercase tracking-[0.08em] transition-all duration-[var(--motion-fast)] ease-[var(--easing-standard)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-secondary)] focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--brand-primary)] text-[color:var(--surface-elevated)]',
        secondary: 'border-transparent bg-[var(--surface-secondary)] text-[var(--text-high)]',
        destructive: 'border-transparent bg-[var(--state-danger)] text-[color:var(--surface-elevated)]',
        outline: 'border-[color:var(--border)] bg-[var(--surface-elevated)] text-[var(--text-medium)]',
        success: 'border-transparent bg-[var(--state-success)] text-[color:var(--surface-elevated)]',
        warning: 'border-transparent bg-[var(--state-warning)] text-[color:var(--surface-elevated)]',
        critical: 'border-transparent bg-[var(--state-critical)] text-[color:var(--surface-elevated)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
