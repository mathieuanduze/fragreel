import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ring))] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary))]/90 shadow-[0_4px_14px_rgba(255,107,53,0.25)]",
        secondary:
          "bg-[rgb(var(--color-secondary))] text-white hover:bg-[rgb(var(--color-secondary))]/90",
        destructive:
          "bg-[rgb(var(--color-destructive))] text-white hover:bg-[rgb(var(--color-destructive))]/90",
        outline:
          "border border-white/10 bg-transparent text-[rgb(var(--color-foreground))] hover:bg-white/5 hover:border-white/20",
        ghost:
          "text-[rgb(var(--color-foreground))]/70 hover:bg-white/5 hover:text-[rgb(var(--color-foreground))]",
        link:
          "text-[rgb(var(--color-primary))] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
