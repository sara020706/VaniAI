import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";
import type { DepartmentAnalytics } from "@/types";

/**
 * Accepts full `DepartmentAnalytics[]` rows or any subset that carries
 * `department` plus the plotted metric keys (e.g. the placement dashboard's
 * `department_comparison` items).
 */
export type DepartmentComparisonDatum = Pick<DepartmentAnalytics, "department"> &
  Partial<Omit<DepartmentAnalytics, "department">>;

export interface DepartmentComparisonChartProps {
  data: DepartmentComparisonDatum[];
  metrics: { key: string; name: string }[];
  height?: number;
}

/**
 * Grouped bars across departments: one categorical hue per metric (fixed
 * order), thin bars with rounded data-ends, legend when ≥ 2 metrics.
 */
export function DepartmentComparisonChart({
  data,
  metrics,
  height = 280,
}: DepartmentComparisonChartProps) {
  const colors = useChartColors();

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          barGap={2}
        >
          <defs>
            {metrics.map((metric, index) => {
              const color = colors.categorical[index % colors.categorical.length];
              return (
                <linearGradient
                  key={metric.key}
                  id={`dept-bar-${metric.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="department"
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
            cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
          />
          {metrics.map((metric) => (
            <Bar
              key={metric.key}
              dataKey={metric.key}
              name={metric.name}
              fill={`url(#dept-bar-${metric.key})`}
              maxBarSize={28}
              radius={[8, 8, 0, 0]}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {metrics.length >= 2 && (
        <ChartLegend
          items={metrics.map((metric, index) => ({
            name: metric.name,
            color: colors.categorical[index % colors.categorical.length],
          }))}
        />
      )}
    </div>
  );
}
