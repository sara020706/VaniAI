import * as React from "react";

import { cn } from "@/lib/utils";

export type GlassCardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Glassmorphism surface — frosted translucent card used across dashboards.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-lg",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
