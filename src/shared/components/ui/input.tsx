import * as React from "react";

import { cn } from "@/shared/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-black/20 px-3 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:border-ring/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
