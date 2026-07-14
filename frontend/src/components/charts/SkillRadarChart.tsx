import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { ChartLegend } from "@/components/charts/ChartLegend";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";

export interface SkillRadarDatum {
  skill: string;
  value?: number;
  benchmark?: number;
  [key: string]: string | number | undefined;
}

export interface SkillRadarChartProps {
  data: SkillRadarDatum[];
  /**
   * Optional multi-series overlay (≤ 4 series, e.g. student comparison).
   * When omitted, renders `value` (+ `benchmark` when present).
   */
  series?: { key: string; name: string }[];
  height?: number;
}

/**
 * Radar over 0–100 skill axes: 2px strokes with 10% fills, hairline polar
 * grid, muted axis text, tooltip; legend appears for ≥ 2 series.
 */
export function SkillRadarChart({ data, series, height = 280 }: SkillRadarChartProps) {
  const colors = useChartColors();

  const hasBenchmark = data.some((datum) => datum.benchmark !== undefined);
  const resolvedSeries: { key: string; name: string }[] = (
    series && series.length > 0
      ? series
      : hasBenchmark
        ? [
            { key: "value", name: "Score" },
            { key: "benchmark", name: "Benchmark" },
          ]
        : [{ key: "value", name: "Score" }]
  ).slice(0, 4);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={colors.grid} strokeWidth={1} />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: colors.axisText, fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: colors.axisText, fontSize: 10 }}
            tickCount={5}
            axisLine={false}
            angle={90}
          />
          <Tooltip content={<ChartTooltip />} />
          {resolvedSeries.map((entry, index) => {
            const color = colors.categorical[index % colors.categorical.length];
            return (
              <Radar
                key={entry.key}
                dataKey={entry.key}
                name={entry.name}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.1}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
      {resolvedSeries.length >= 2 && (
        <ChartLegend
          items={resolvedSeries.map((entry, index) => ({
            name: entry.name,
            color: colors.categorical[index % colors.categorical.length],
          }))}
        />
      )}
    </div>
  );
}
