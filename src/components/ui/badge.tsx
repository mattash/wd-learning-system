import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full uppercase",
  {
    variants: {
      variant: {
        default: "bg-secondary text-muted-foreground",
        parish: "bg-tag-parish-bg text-tag-parish-text",
        diocese: "bg-tag-diocese-bg text-tag-diocese-text",
        role: "bg-brand-subtle text-primary rounded-sm normal-case tracking-normal",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-destructive-subtle text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
