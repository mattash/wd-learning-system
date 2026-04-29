import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const fillVariants = cva(
  "h-full rounded-full transition-[width] duration-600 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-success",
        warning: "bg-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fillVariants> {
  value: number;
  max?: number;
}

export function ProgressBar({
  className,
  variant,
  value,
  max = 100,
  ...props
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <div
        className={cn(fillVariants({ variant }))}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
