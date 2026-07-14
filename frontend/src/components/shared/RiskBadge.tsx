import { RISK_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

export interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

/**
 * Risk indicator — icon + label + status color, never color alone.
 */
export function RiskBadge({ level, className }: RiskBadgeProps) {
  const meta = RISK_LEVELS[level];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.badgeClass,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
