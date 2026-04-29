import * as React from "react";

import { cn } from "@/lib/utils";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "h-4 w-4 shrink-0 rounded-[3px] border-[1.5px] border-input bg-background accent-primary transition-colors checked:border-primary checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
          className,
        )}
        ref={ref}
        type="checkbox"
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";
