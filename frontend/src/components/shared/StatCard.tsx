import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

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
 * Premium metric tile — eyebrow label, a big proportional-figure value, a
 * soft-teal icon chip, and an optional delta. Elevates gently on hover.
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
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "surface-card group relative overflow-hidden p-5 transition-shadow hover:shadow-[var(--shadow-lg)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              "mt-2 text-3xl font-bold leading-none tracking-tight",
              gradient && "gradient-text",
            )}
          >
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {(trend || description) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                trend.positive
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
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
    </motion.div>
  );
}
