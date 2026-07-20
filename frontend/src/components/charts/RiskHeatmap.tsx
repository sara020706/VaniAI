import { useMemo } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readableTextColor } from "@/lib/chart-colors";
import { DEPARTMENTS } from "@/lib/constants";

export interface RiskHeatmapDatum {
  department: string;
  batch: string;
  high_risk_count: number;
  student_count: number;
}

export interface RiskHeatmapProps {
  data: RiskHeatmapDatum[];
  height?: number;
}

/**
 * Teal sequential ramp (low → high share), light → deep. Local to the heatmap
 * so magnitude reads in the brand teal rather than the shared blue ramp.
 */
const TEAL_RAMP: readonly string[] = [
  "#e0f2ee",
  "#b7e2d8",
  "#84cbbc",
  "#4fae9c",
  "#2b8f7d",
  "#186f62",
  "#0c4f47",
];

function tealAt(share: number): string {
  const clamped = Math.min(1, Math.max(0, share));
  const index = Math.min(
    TEAL_RAMP.length - 1,
    Math.floor(clamped * TEAL_RAMP.length),
  );
  return TEAL_RAMP[index];
}

/**
 * Department × batch heatmap (CSS grid). Cell color maps the high-risk share
 * onto the sequential ramp; in-cell counts switch between white and ink by
 * background luminance; each populated cell carries a tooltip.
 */
export function RiskHeatmap({ data, height = 280 }: RiskHeatmapProps) {
  const { departments, batches, cellIndex } = useMemo(() => {
    const presentDepartments = new Set(data.map((cell) => cell.department));
    const orderedKnown = DEPARTMENTS.filter((department) =>
      presentDepartments.has(department),
    );
    const unknown = [...presentDepartments]
      .filter((department) => !(DEPARTMENTS as string[]).includes(department))
      .sort();
    const departmentList: string[] = [...orderedKnown, ...unknown];

    const batchList = [...new Set(data.map((cell) => cell.batch))].sort();

    const index = new Map<string, RiskHeatmapDatum>();
    for (const cell of data) {
      index.set(`${cell.department}::${cell.batch}`, cell);
    }
    return { departments: departmentList, batches: batchList, cellIndex: index };
  }, [data]);

  if (departments.length === 0 || batches.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No risk data available yet.
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full" style={{ minHeight: height }}>
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `minmax(3.5rem, auto) repeat(${batches.length}, minmax(2.5rem, 1fr))`,
          }}
          role="table"
          aria-label="High-risk students by department and batch"
        >
          {/* Header row */}
          <div aria-hidden="true" />
          {batches.map((batch) => (
            <div
              key={batch}
              className="pb-1 text-center text-xs font-medium text-muted-foreground"
            >
              {batch}
            </div>
          ))}

          {departments.map((department) => (
            <DepartmentRow
              key={department}
              department={department}
              batches={batches}
              cellIndex={cellIndex}
              sequentialAt={tealAt}
            />
          ))}
        </div>

        {/* Ramp legend — share of high-risk students */}
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>0%</span>
          <div className="flex overflow-hidden rounded-full ring-1 ring-border/60">
            {TEAL_RAMP.map((step) => (
              <span
                key={step}
                className="h-2.5 w-5"
                style={{ backgroundColor: step }}
                aria-hidden="true"
              />
            ))}
          </div>
          <span>100% high risk</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface DepartmentRowProps {
  department: string;
  batches: string[];
  cellIndex: Map<string, RiskHeatmapDatum>;
  sequentialAt: (share: number) => string;
}

function DepartmentRow({
  department,
  batches,
  cellIndex,
  sequentialAt,
}: DepartmentRowProps) {
  return (
    <>
      <div className="flex items-center pr-2 text-xs font-medium text-muted-foreground">
        {department}
      </div>
      {batches.map((batch) => {
        const cell = cellIndex.get(`${department}::${batch}`);
        if (!cell || cell.student_count === 0) {
          return (
            <div
              key={batch}
              className="flex h-10 items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground"
              aria-label={`${department} ${batch}: no students`}
            >
              —
            </div>
          );
        }
        const share = cell.high_risk_count / cell.student_count;
        const background = sequentialAt(share);
        const ink = readableTextColor(background);
        return (
          <Tooltip key={batch}>
            <TooltipTrigger asChild>
              <div
                className="flex h-10 cursor-default items-center justify-center rounded-lg text-xs font-semibold tabular-nums shadow-sm ring-1 ring-inset ring-black/5 transition-transform duration-200 hover:scale-[1.04] hover:shadow-md"
                style={{ backgroundColor: background, color: ink }}
                tabIndex={0}
              >
                {cell.high_risk_count}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">
                {department} · {batch}
              </p>
              <p className="text-muted-foreground">
                {cell.high_risk_count} of {cell.student_count} students high risk (
                {Math.round(share * 100)}%)
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
