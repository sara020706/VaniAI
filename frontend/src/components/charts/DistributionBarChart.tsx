import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";
import type { DistributionBucket } from "@/types";

export interface DistributionBarChartProps {
  data: DistributionBucket[];
  /** 'seq' ramps the ordered buckets through the sequential palette; 'cat' uses the first categorical hue. */
  color?: "seq" | "cat";
  height?: number;
}

/**
 * Histogram over ordered buckets ("0-10" … "90-100"): thin bars
 * (maxBarSize 24) with 4px data-end radius, hairline horizontal grid,
 * tooltip; single series, so no legend.
 */
export function DistributionBarChart({
  data,
  color = "seq",
  height = 280,
}: DistributionBarChartProps) {
  const colors = useChartColors();
  const lastIndex = Math.max(1, data.length - 1);

  const fillFor = (index: number): string => {
    if (color === "cat") return colors.categorical[0];
    const rampIndex = Math.round(
      (index / lastIndex) * (colors.sequential.length - 1),
    );
    return colors.sequential[rampIndex];
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
          />
          <Bar dataKey="count" name="Students" maxBarSize={24} radius={[4, 4, 0, 0]}>
            {data.map((bucket, index) => (
              <Cell key={bucket.bucket} fill={fillFor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
