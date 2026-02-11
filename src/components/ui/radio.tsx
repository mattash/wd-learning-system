import * as React from "react";

import { cn } from "@/lib/utils";

export type RadioProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "h-4 w-4 border border-input bg-background text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        ref={ref}
        type="radio"
        {...props}
      />
    );
  },
);
Radio.displayName = "Radio";
