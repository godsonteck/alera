import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[var(--space-2)] whitespace-nowrap rounded-[var(--radius-sm)] border border-transparent text-[length:var(--type-body)] font-semibold tracking-[0.01em] transition-all duration-[var(--motion-fast)] ease-[var(--easing-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-secondary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:border-[color:var(--text-disabled)] disabled:bg-[var(--surface-secondary)] disabled:text-[var(--text-disabled)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand-primary)] text-[color:var(--surface-elevated)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] active:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]',
        destructive: 'bg-[var(--state-danger)] text-[color:var(--surface-elevated)] hover:bg-[color:var(--state-danger)]/90 active:bg-[color:var(--state-critical)]',
        outline: 'border-[color:var(--border)] bg-[var(--surface-elevated)] text-[var(--text-high)] hover:bg-[var(--surface-secondary)] active:bg-[var(--surface-secondary)]',
        secondary: 'border-[color:var(--brand-primary)] bg-[var(--surface-elevated)] text-[var(--brand-primary)] hover:bg-[var(--surface-secondary)] active:bg-[var(--surface-secondary)]',
        ghost: 'bg-transparent text-[var(--text-interactive)] hover:bg-[var(--surface-secondary)] hover:text-[var(--brand-secondary)]',
        link: 'h-auto rounded-none border-0 bg-transparent p-0 text-[var(--text-interactive)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[calc(var(--space-7)+var(--space-2))] px-[var(--space-4)] py-[var(--space-2)]',
        sm: 'min-h-[calc(var(--space-6)+var(--space-1))] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--type-caption)]',
        lg: 'min-h-[calc(var(--space-7)+var(--space-4))] px-[var(--space-5)] py-[var(--space-3)]',
        icon: 'h-[calc(var(--space-6)+var(--space-1))] w-[calc(var(--space-6)+var(--space-1))] p-0',
      },
      state: {
        default: '',
        error: 'border-[color:var(--state-danger)] bg-[var(--surface-elevated)] text-[var(--state-danger)]',
        ai: 'border-dashed border-[color:var(--state-ai)] bg-[var(--surface-elevated)] text-[var(--state-ai)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default',
    },
  },
);
