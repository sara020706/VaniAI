import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  SkillRadarChart,
  type SkillRadarDatum,
} from "@/components/charts";
import { useChartColors } from "@/lib/chart-colors";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  RiskBadge,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { facultyApi, studentApi } from "@/lib/api";
import { cn, formatPercent, formatScore } from "@/lib/utils";
import type { StudentCompareItem, StudentListItem } from "@/types";

const MIN_SELECTION = 2;
const MAX_SELECTION = 4;

/** Debounce a rapidly-changing value (e.g. a search box). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface CompareRow {
  label: string;
  /** Extractor returning the numeric metric for a student (higher = better). */
  get: (student: StudentCompareItem) => number | null;
  format: (value: number | null) => string;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "CGPA",
    get: (s) => s.cgpa,
    format: (v) => formatScore(v, 2),
  },
  {
    label: "Placement Probability",
    get: (s) => s.placement_probability,
    format: (v) => formatPercent(v),
  },
  {
    label: "Overall Readiness",
    get: (s) => s.readiness.overall,
    format: (v) => formatScore(v, 1),
  },
  {
    label: "Coding",
    get: (s) => s.skills.coding_score,
    format: (v) => formatScore(v, 1),
  },
  {
    label: "Aptitude",
    get: (s) => s.skills.aptitude_score,
    format: (v) => formatScore(v, 1),
  },
  {
    label: "Communication",
    get: (s) => s.skills.communication_score,
    format: (v) => formatScore(v, 1),
  },
  {
    label: "Technical",
    get: (s) => s.skills.technical_skill_score,
    format: (v) => formatScore(v, 1),
  },
  {
    label: "Leadership",
    get: (s) => s.skills.leadership_score,
    format: (v) => formatScore(v, 1),
  },
];

/**
 * Side-by-side comparison of 2–4 students: a searchable picker, an overlaid
 * skill radar (one series per student), and a metric table that highlights
 * the best value in each row.
 */
export default function FacultyComparePage() {
  const colors = useChartColors();
  const [searchInput, setSearchInput] = useState<string>("");
  const [selected, setSelected] = useState<StudentListItem[]>([]);

  const search = useDebouncedValue(searchInput, 350);

  const searchQuery = useQuery({
    queryKey: ["faculty", "compare-search", search],
    queryFn: () =>
      studentApi.list({
        page: 1,
        page_size: 8,
        search: search.trim() ? search.trim() : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const selectedIds = useMemo(() => selected.map((s) => s.id), [selected]);

  const compareQuery = useQuery({
    queryKey: ["faculty", "compare", selectedIds],
    queryFn: () => facultyApi.compare(selectedIds),
    enabled: selectedIds.length >= MIN_SELECTION,
  });

  function toggle(student: StudentListItem) {
    setSelected((current) => {
      const exists = current.some((s) => s.id === student.id);
      if (exists) return current.filter((s) => s.id !== student.id);
      if (current.length >= MAX_SELECTION) return current;
      return [...current, student];
    });
  }

  const compared = compareQuery.data?.students ?? [];

  const radarData: SkillRadarDatum[] = useMemo(() => {
    if (compared.length < MIN_SELECTION) return [];
    const axes: { skill: string; get: (s: StudentCompareItem) => number }[] = [
      { skill: "Coding", get: (s) => s.skills.coding_score ?? 0 },
      { skill: "Aptitude", get: (s) => s.skills.aptitude_score ?? 0 },
      { skill: "Communication", get: (s) => s.skills.communication_score ?? 0 },
      { skill: "Technical", get: (s) => s.skills.technical_skill_score ?? 0 },
      { skill: "Leadership", get: (s) => s.skills.leadership_score ?? 0 },
    ];
    return axes.map((axis) => {
      const row: SkillRadarDatum = { skill: axis.skill };
      compared.forEach((student) => {
        row[`s${student.id}`] = axis.get(student);
      });
      return row;
    });
  }, [compared]);

  const radarSeries = useMemo(
    () =>
      compared.slice(0, MAX_SELECTION).map((student) => ({
        key: `s${student.id}`,
        name: student.full_name,
      })),
    [compared],
  );

  /** Index of the student holding the max value for a row (null if tie/none). */
  function bestIndex(row: CompareRow): number | null {
    let best = -Infinity;
    let bestIdx: number | null = null;
    let tie = false;
    compared.forEach((student, index) => {
      const value = row.get(student);
      if (value === null || value === undefined) return;
      if (value > best) {
        best = value;
        bestIdx = index;
        tie = false;
      } else if (value === best) {
        tie = true;
      }
    });
    return tie ? null : bestIdx;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare Students"
        description={`Select ${MIN_SELECTION}–${MAX_SELECTION} students to compare their skills and readiness side by side.`}
      />

      <GlassCard className="p-5">
        <Label
          htmlFor="compare-search"
          className="mb-1 block text-xs text-muted-foreground"
        >
          Find students
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="compare-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or register number"
            className="pl-9"
          />
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => toggle(student)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 py-1 pl-3 pr-2 text-sm transition-colors hover:bg-accent"
                aria-label={`Remove ${student.full_name}`}
              >
                {student.full_name}
                <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {searchQuery.isLoading ? (
            <LoadingState label="Searching…" />
          ) : searchQuery.isError ? (
            <ErrorState onRetry={() => void searchQuery.refetch()} />
          ) : (searchQuery.data?.items.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No students match your search.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {searchQuery.data?.items.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                const atLimit = selected.length >= MAX_SELECTION;
                const disabled = !isSelected && atLimit;
                return (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => toggle(student)}
                      disabled={disabled}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                        isSelected ? "bg-accent/60" : "hover:bg-accent/40",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {student.full_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {student.register_number} · {student.department} ·{" "}
                          {student.batch}
                        </span>
                      </span>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </GlassCard>

      {selected.length < MIN_SELECTION ? (
        <GlassCard className="p-5">
          <EmptyState
            icon={Users}
            title="Pick at least two students"
            description="Select students above to see an overlaid skill radar and a side-by-side comparison table."
          />
        </GlassCard>
      ) : compareQuery.isLoading ? (
        <LoadingState label="Building comparison…" />
      ) : compareQuery.isError ? (
        <ErrorState onRetry={() => void compareQuery.refetch()} />
      ) : compared.length >= MIN_SELECTION ? (
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Skill Overlay</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Each series is one student across the five tracked skills (0–100).
            </p>
            <SkillRadarChart data={radarData} series={radarSeries} height={320} />
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Metric
                    </th>
                    {compared.map((student, index) => (
                      <th
                        key={student.id}
                        className="px-4 py-3 text-left font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-[3px]"
                            style={{
                              backgroundColor:
                                colors.categorical[
                                  index % colors.categorical.length
                                ],
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate">
                              {student.full_name}
                            </span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {student.register_number}
                            </span>
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-3 font-medium text-muted-foreground">
                      Risk
                    </td>
                    {compared.map((student) => (
                      <td key={student.id} className="px-4 py-3">
                        {student.risk_level ? (
                          <RiskBadge level={student.risk_level} />
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                  {COMPARE_ROWS.map((row) => {
                    const best = bestIndex(row);
                    return (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium text-muted-foreground">
                          {row.label}
                        </td>
                        {compared.map((student, index) => (
                          <td
                            key={student.id}
                            className={cn(
                              "px-4 py-3 tabular-nums",
                              best === index &&
                                "font-semibold text-primary",
                            )}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {row.format(row.get(student))}
                              {best === index && (
                                <Badge variant="success" className="px-1.5 py-0">
                                  Best
                                </Badge>
                              )}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      ) : null}
    </div>
  );
}
