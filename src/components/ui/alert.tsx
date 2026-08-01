import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-[var(--radius-md)] border p-[var(--space-4)] [&>svg~*]:pl-[calc(var(--space-4)+var(--space-3))] [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-[var(--space-4)] [&>svg]:top-[var(--space-4)]",
  {
    variants: {
      variant: {
        default: "border-[color:var(--border)] bg-[var(--surface-secondary)] text-[var(--text-high)] [&>svg]:text-[var(--text-medium)]",
        info: "border-[color:var(--state-info)] bg-[var(--surface-elevated)] text-[var(--text-high)] [&>svg]:text-[var(--state-info)]",
        success: "border-[color:var(--state-success)] bg-[var(--surface-elevated)] text-[var(--text-high)] [&>svg]:text-[var(--state-success)]",
        warning: "border-[color:var(--state-warning)] bg-[var(--surface-elevated)] text-[var(--text-high)] [&>svg]:text-[var(--state-warning)]",
        destructive: "border-[color:var(--state-danger)] bg-[var(--surface-elevated)] text-[var(--text-high)] [&>svg]:text-[var(--state-danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-[var(--space-2)] font-semibold leading-none tracking-[0.01em]", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-[length:var(--type-body)] text-[var(--text-medium)] [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
