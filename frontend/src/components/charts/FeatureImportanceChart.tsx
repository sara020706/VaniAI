import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { useChartColors } from "@/lib/chart-colors";
import { featureLabel } from "@/lib/constants";
import type { ExplanationFactor } from "@/types";

export interface FeatureImportanceChartProps {
  data: ExplanationFactor[];
  /**
   * Signed mode plots SHAP `impact` around a zero baseline (positive blue,
   * negative red); unsigned mode plots mean-|SHAP| `importance` magnitudes.
   */
  signed?: boolean;
  height?: number;
}

interface FactorRow {
  label: string;
  value: number;
}

/**
 * Horizontal bars for SHAP explanations: thin bars with rounded data-ends,
 * hairline vertical grid, muted axis text, tooltip; direction in signed mode
 * is encoded by position around the zero line as well as color.
 */
export function FeatureImportanceChart({
  data,
  signed = false,
  height,
}: FeatureImportanceChartProps) {
  const colors = useChartColors();

  const rows: FactorRow[] = data.map((factor) => ({
    label: factor.label || featureLabel(factor.feature),
    value: signed
      ? (factor.impact ?? 0)
      : (factor.importance ?? Math.abs(factor.impact ?? 0)),
  }));

  const chartHeight = height ?? Math.max(240, rows.length * 32 + 48);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid stroke={colors.grid} strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
            tickFormatter={(tick: number) =>
              Number.isInteger(tick) ? `${tick}` : tick.toFixed(2)
            }
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: colors.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(value) =>
                  typeof value === "number" ? value.toFixed(3) : `${value}`
                }
              />
            }
            cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
          />
          {signed && (
            <ReferenceLine x={0} stroke={colors.axisText} strokeWidth={1} />
          )}
          <Bar
            dataKey="value"
            name={signed ? "Impact" : "Importance"}
            maxBarSize={24}
            radius={[0, 4, 4, 0]}
          >
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={
                  signed
                    ? row.value >= 0
                      ? colors.positive
                      : colors.negative
                    : colors.categorical[0]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
