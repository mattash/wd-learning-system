import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-42 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
        secondary: "bg-card text-foreground border-[1.5px] border-border shadow-sm hover:border-primary hover:text-primary hover:bg-brand-subtle",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "h-auto p-0 text-primary underline-offset-4 hover:underline",
        destructive: "bg-destructive text-primary-foreground shadow-sm hover:opacity-90",
        "destructive-outline": "bg-transparent text-destructive border-[1.5px] border-destructive hover:bg-destructive-subtle",
        gold: "bg-gold text-primary-foreground hover:opacity-90",
      },
      size: {
        xs: "h-[26px] rounded-sm px-2.5 text-[11px]",
        sm: "h-8 rounded-md px-3.5 text-[13px]",
        default: "h-[38px] rounded-md px-4.5 text-sm",
        lg: "h-11 rounded-lg px-5.5 text-[15px]",
        xl: "h-[52px] rounded-lg px-7 text-base",
        icon: "h-9 w-9 rounded-md border border-border bg-transparent text-muted-foreground hover:border-primary hover:text-primary hover:bg-brand-subtle",
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
