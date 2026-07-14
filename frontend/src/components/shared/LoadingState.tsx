import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Centered spinner for in-flight data views. */
export function LoadingState({
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
