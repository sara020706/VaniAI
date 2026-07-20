import * as React from "react";

import { cn } from "@/lib/utils";

export type GlassCardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Frosted floating surface — used for chrome, menus, and hero overlays.
 * Leans on the shared `.glass-card` utility so light/dark stay in sync.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("glass-card", className)} {...props} />
  ),
);
GlassCard.displayName = "GlassCard";
