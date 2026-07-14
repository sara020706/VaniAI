import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartLegend } from "@/components/charts/ChartLegend";
import {
  ChartTooltip,
} from "@/components/charts/ChartTooltip";
import type {
  ChartDatum,
  ChartSeries,
} from "@/components/charts/TrendLineChart";
import { useChartColors } from "@/lib/chart-colors";

export interface ProgressAreaChartProps {
  data: ChartDatum[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
}

/**
 * Area chart for progress-over-time: 2px stroke, 10% fill opacity, dots with
 * a 2px surface ring, hairline horizontal grid, legend only for ≥ 2 series.
 */
export function ProgressAreaChart({
  data,
  xKey,
  series,
  height = 280,
}: ProgressAreaChartProps) {
  const colors = useChartColors();

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: colors.grid, strokeWidth: 1 }}
          />
          {series.map((entry, index) => {
            const color = colors.categorical[index % colors.categorical.length];
            return (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.1}
                dot={{ r: 4, fill: color, stroke: colors.surface, strokeWidth: 2 }}
                activeDot={{
                  r: 5,
                  fill: color,
                  stroke: colors.surface,
                  strokeWidth: 2,
                }}
                connectNulls
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
      {series.length >= 2 && (
        <ChartLegend
          items={series.map((entry, index) => ({
            name: entry.name,
            color: colors.categorical[index % colors.categorical.length],
          }))}
        />
      )}
    </div>
  );
}
