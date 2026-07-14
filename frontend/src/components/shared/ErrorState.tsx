import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Inline failure panel with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="mt-1 text-sm font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
