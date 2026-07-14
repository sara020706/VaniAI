import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import * as React from "react";

import { GlassCard } from "@/components/shared/GlassCard";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  description?: string;
  trend?: { value: number; positive: boolean };
  /** Render the value with the brand gradient. */
  gradient?: boolean;
  className?: string;
}

/**
 * Headline KPI tile — glass card with a big proportional-figure value,
 * an icon chip, and an optional delta indicator.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  gradient = false,
  className,
}: StatCardProps) {
  return (
    <GlassCard className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              "mt-1.5 text-3xl font-bold tracking-tight",
              gradient && "gradient-text",
            )}
          >
            {value}
          </div>
        </div>
        <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {(trend || description) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                trend.positive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
          {description && (
            <span className="truncate text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </GlassCard>
  );
}
