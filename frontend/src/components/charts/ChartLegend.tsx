import { cn } from "@/lib/utils";

export interface ChartLegendItem {
  name: string;
  color: string;
  /** Optional trailing detail, e.g. a count. */
  detail?: string;
}

export interface ChartLegendProps {
  items: ChartLegendItem[];
  className?: string;
}

/**
 * HTML legend rendered under a chart. Wrappers show it only when a chart
 * has ≥ 2 series — a single series is named by its title/tooltip.
 */
export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.name}
          {item.detail !== undefined && (
            <span className="font-medium tabular-nums text-foreground">
              {item.detail}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
