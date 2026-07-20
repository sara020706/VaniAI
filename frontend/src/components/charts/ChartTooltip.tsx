import * as React from "react";

/**
 * Shared tooltip card for every Recharts wrapper. Pass as
 * `<Tooltip content={<ChartTooltip />} />` — Recharts injects
 * `active` / `label` / `payload` at render time.
 *
 * Text wears text tokens (never the series color); a colored swatch beside
 * each row carries series identity.
 */

export interface ChartTooltipPayloadItem {
  name?: string | number;
  value?: string | number | Array<string | number>;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayloadItem[];
  /** Format a row value, e.g. percentages or fixed decimals. */
  valueFormatter?: (value: number | string, name: string) => string;
  /** Format the tooltip title. */
  labelFormatter?: (label: string | number) => string;
}

function defaultValueFormat(value: number | string): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return value;
}

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;

  const title =
    label !== undefined && label !== null && `${label}`.length > 0
      ? labelFormatter
        ? labelFormatter(label)
        : `${label}`
      : null;

  return (
    <div className="glass-card z-50 min-w-[8rem] rounded-2xl px-3.5 py-2.5 text-xs shadow-lg">
      {title !== null && (
        <p className="mb-2 font-semibold tracking-tight text-foreground">
          {title}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {payload.map((item, index) => {
          const rawValue = Array.isArray(item.value)
            ? item.value.join(" – ")
            : item.value;
          if (rawValue === undefined) return null;
          const name = `${item.name ?? item.dataKey ?? ""}`;
          return (
            <div
              key={`${name}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: item.color ?? "currentColor" }}
                  aria-hidden="true"
                />
                {name}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {valueFormatter
                  ? valueFormatter(rawValue, name)
                  : defaultValueFormat(rawValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
