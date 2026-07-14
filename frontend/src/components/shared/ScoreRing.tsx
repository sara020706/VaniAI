import { useChartColors } from "@/lib/chart-colors";
import { clamp, cn } from "@/lib/utils";

export interface ScoreRingProps {
  /** Score from 0 to 100. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Label rendered under the numeric value. */
  label?: string;
  className?: string;
}

/**
 * SVG circular progress. Band coloring: ≥70 good, 40–70 warning, <40
 * critical — the numeric value is always shown, so state is never conveyed
 * by color alone.
 */
export function ScoreRing({ value, size = 112, label, className }: ScoreRingProps) {
  const colors = useChartColors();
  const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);

  const band =
    safeValue >= 70
      ? colors.status.good
      : safeValue >= 40
        ? colors.status.warning
        : colors.status.critical;

  const strokeWidth = Math.max(6, Math.round(size / 14));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue / 100);

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-1", className)}
      role="img"
      aria-label={`${label ?? "Score"}: ${Math.round(safeValue)} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums tracking-tight"
            style={{ fontSize: Math.max(14, size / 4.5) }}
          >
            {Math.round(safeValue)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
