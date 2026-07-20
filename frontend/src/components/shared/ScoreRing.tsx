import * as React from "react";

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
 * Animated circular gauge — the product's signature instrument. The arc
 * sweeps up from 0 on mount and bands by score: ≥70 good, 40–70 warning,
 * <40 critical. The numeric value is always shown, so state is never
 * conveyed by color alone.
 */
export function ScoreRing({ value, size = 112, label, className }: ScoreRingProps) {
  const colors = useChartColors();
  const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);

  // Animate the arc from 0 → value on mount via a one-tick state flip.
  const [drawn, setDrawn] = React.useState(0);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(safeValue));
    return () => cancelAnimationFrame(frame);
  }, [safeValue]);

  const band =
    safeValue >= 70
      ? colors.status.good
      : safeValue >= 40
        ? colors.status.warning
        : colors.status.critical;

  const strokeWidth = Math.max(7, Math.round(size / 12));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - drawn / 100);
  const glowId = React.useId();

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-2", className)}
      role="img"
      aria-label={`${label ?? "Score"}: ${Math.round(safeValue)} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 overflow-visible">
          <defs>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={strokeWidth / 3} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Faint track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/60"
            strokeWidth={strokeWidth}
          />
          {/* Value arc with a soft glow */}
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
            filter={`url(#${glowId})`}
            style={{
              transition:
                "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums leading-none tracking-tight"
            style={{ fontSize: Math.max(15, size / 4) }}
          >
            {Math.round(safeValue)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
