import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  state?: 'default' | 'error';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state = 'default', ...props }, ref) => {
    const isError = state === 'error';

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[var(--surface-elevated)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-body)] text-[var(--text-high)] shadow-[var(--elev-1)] outline-none ring-offset-[var(--surface-base)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-high)] placeholder:text-[var(--text-low)] focus-visible:border-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-secondary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--surface-secondary)] disabled:text-[var(--text-disabled)]",
          isError && "border-[color:var(--state-danger)] text-[var(--state-danger)] focus-visible:ring-[color:var(--state-danger)]",
          className,
        )}
        ref={ref}
        aria-invalid={isError || undefined}
        data-state={state}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
