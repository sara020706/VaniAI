import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

/**
 * Skeleton placeholder for in-flight data views — a shimmering approximation
 * of the content to come, never a spinner.
 */
export function LoadingState({
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {/* Header line */}
      <div className="flex items-center justify-between gap-4">
        <div className="shimmer h-7 w-48 rounded-xl" />
        <div className="shimmer h-9 w-28 rounded-xl" />
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card space-y-3 p-5">
            <div className="shimmer h-3 w-20 rounded-md" />
            <div className="shimmer h-8 w-24 rounded-lg" />
            <div className="shimmer h-3 w-16 rounded-md" />
          </div>
        ))}
      </div>
      {/* Body block */}
      <div className="surface-card space-y-3 p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="shimmer h-4 w-4 shrink-0 rounded-full" />
            <div className="shimmer h-4 flex-1 rounded-md" />
            <div className="shimmer h-4 w-16 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
