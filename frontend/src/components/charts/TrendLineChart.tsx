import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";

export type ChartDatum = Record<string, string | number | null | undefined>;

export interface ChartSeries {
  key: string;
  name: string;
}

export interface TrendLineChartProps {
  data: ChartDatum[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
}

/**
 * Multi-series line chart: 2px lines, r4 dots with a 2px surface ring,
 * hairline horizontal grid, muted axis text, shared tooltip, legend only
 * when there are ≥ 2 series.
 */
export function TrendLineChart({
  data,
  xKey,
  series,
  height = 280,
}: TrendLineChartProps) {
  const colors = useChartColors();

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: color,
                  stroke: colors.surface,
                  strokeWidth: 2,
                }}
                connectNulls
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            );
          })}
        </LineChart>
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
