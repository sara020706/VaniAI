import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";
import { RISK_LEVELS, RISK_LEVEL_ORDER } from "@/lib/constants";
import type { RiskDistribution, RiskLevel } from "@/types";

export interface RiskDonutChartProps {
  data: RiskDistribution;
  height?: number;
}

interface DonutSlice {
  level: RiskLevel;
  name: string;
  value: number;
}

/**
 * Risk distribution donut using reserved status colors
 * (low→good, medium→warning, high→critical), 2px surface gaps between
 * segments, center total, and an icon+label+count legend — risk is never
 * communicated by color alone.
 */
export function RiskDonutChart({ data, height = 280 }: RiskDonutChartProps) {
  const colors = useChartColors();

  const slices: DonutSlice[] = RISK_LEVEL_ORDER.map((level) => ({
    level,
    name: RISK_LEVELS[level].label,
    value: data[level],
  }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const plotted = slices.filter((slice) => slice.value > 0);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={plotted}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="85%"
              paddingAngle={plotted.length > 1 ? 2 : 0}
              stroke={colors.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {plotted.map((slice) => (
                <Cell key={slice.level} fill={colors.risk(slice.level)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums tracking-tight">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">students</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {slices.map((slice) => {
          const meta = RISK_LEVELS[slice.level];
          const Icon = meta.icon;
          return (
            <span key={slice.level} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: colors.risk(slice.level) }}
                aria-hidden="true"
              />
              <Icon className="h-3 w-3" aria-hidden="true" />
              {meta.label}
              <span className="font-medium tabular-nums text-foreground">
                {slice.value}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
