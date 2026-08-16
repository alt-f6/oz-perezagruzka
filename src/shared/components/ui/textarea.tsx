import * as React from "react";

import { cn } from "@/shared/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-24 w-full rounded-md border border-input bg-black/20 px-3 py-2 text-sm text-foreground",
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
Textarea.displayName = "Textarea";

export { Textarea };
