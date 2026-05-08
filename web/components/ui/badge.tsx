import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[rgb(var(--color-primary))] text-white",
        secondary:
          "border-[rgb(var(--color-secondary))]/30 bg-[rgb(var(--color-secondary))]/10 text-[rgb(var(--color-secondary))]",
        destructive:
          "border-[rgb(var(--color-destructive))]/30 bg-[rgb(var(--color-destructive))]/10 text-[rgb(var(--color-destructive))]",
        outline:
          "border-white/10 text-[rgb(var(--color-foreground))]/70",
        success:
          "border-[rgb(91,227,143)]/30 bg-[rgb(91,227,143)]/10 text-[rgb(91,227,143)]",
        warning:
          "border-[rgb(255,193,7)]/30 bg-[rgb(255,193,7)]/10 text-[rgb(255,193,7)]",
        subtle:
          "border-white/10 bg-white/5 text-[rgb(var(--color-foreground))]/65",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
