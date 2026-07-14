import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DepartmentComparisonChart,
  type DepartmentComparisonDatum,
} from "@/components/charts";
import {
  DataTable,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  type DataTableColumn,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyticsApi, reportApi } from "@/lib/api";
import { formatPercent, formatScore, getApiErrorMessage } from "@/lib/utils";
import type { Department, DepartmentAnalytics } from "@/types";

type MetricView = "readiness" | "academics" | "placement";

const METRIC_VIEWS: Record<
  MetricView,
  { label: string; metrics: { key: string; name: string }[] }
> = {
  readiness: {
    label: "Readiness & Probability",
    metrics: [
      { key: "average_readiness", name: "Avg Readiness" },
      { key: "average_probability", name: "Avg Probability %" },
    ],
  },
  academics: {
    label: "Academics",
    metrics: [{ key: "average_cgpa", name: "Avg CGPA (×10)" }],
  },
  placement: {
    label: "Placement Counts",
    metrics: [
      { key: "ready_count", name: "Placement Ready" },
      { key: "at_risk_count", name: "At Risk" },
    ],
  },
};

/**
 * Department analytics for placement officers: a metric-toggled comparison
 * chart, a full metrics table, and per-department PDF report downloads.
 */
export default function PlacementDepartmentsPage() {
  const [view, setView] = useState<MetricView>("readiness");

  const query = useQuery({
    queryKey: ["placement", "departments"],
    queryFn: () => analyticsApi.departments(),
  });

  const downloadReport = useMutation({
    mutationFn: (department: Department) =>
      reportApi.downloadDepartmentReport(department),
    onSuccess: () => toast.success("Report downloaded"),
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not download the report.")),
  });

  // Rescale into shared 0–100-ish axes per view so grouped bars stay legible:
  // probability (0–1) → percent, CGPA (0–10) → ×10.
  const chartData: DepartmentComparisonDatum[] = useMemo(
    () =>
      (query.data ?? []).map((item) => ({
        department: item.department,
        average_readiness: Number(item.average_readiness.toFixed(1)),
        average_probability: Number((item.average_probability * 100).toFixed(1)),
        average_cgpa: Number((item.average_cgpa * 10).toFixed(1)),
        ready_count: item.ready_count,
        at_risk_count: item.at_risk_count,
      })),
    [query.data],
  );

  const columns: DataTableColumn<DepartmentAnalytics>[] = [
    { key: "department", header: "Department" },
    {
      key: "student_count",
      header: "Students",
      className: "tabular-nums",
    },
    {
      key: "average_cgpa",
      header: "Avg CGPA",
      render: (row) => formatScore(row.average_cgpa, 2),
      className: "tabular-nums",
    },
    {
      key: "average_probability",
      header: "Avg Probability",
      render: (row) => formatPercent(row.average_probability),
      className: "tabular-nums",
    },
    {
      key: "average_readiness",
      header: "Avg Readiness",
      render: (row) => formatScore(row.average_readiness, 1),
      className: "tabular-nums",
    },
    {
      key: "ready_count",
      header: "Ready",
      className: "tabular-nums",
    },
    {
      key: "at_risk_count",
      header: "At Risk",
      className: "tabular-nums",
    },
    {
      key: "report",
      header: "Report",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadReport.mutate(row.department)}
          disabled={
            downloadReport.isPending &&
            downloadReport.variables === row.department
          }
        >
          <FileDown aria-hidden="true" />
          PDF
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Compare departments and download per-department placement reports."
      />

      {query.isLoading ? (
        <LoadingState label="Loading departments…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Department Comparison</h2>
                <p className="text-xs text-muted-foreground">
                  {METRIC_VIEWS[view].label}
                </p>
              </div>
              <Tabs
                value={view}
                onValueChange={(value) => setView(value as MetricView)}
              >
                <TabsList>
                  <TabsTrigger value="readiness">Readiness</TabsTrigger>
                  <TabsTrigger value="academics">Academics</TabsTrigger>
                  <TabsTrigger value="placement">Placement</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <DepartmentComparisonChart
              data={chartData}
              metrics={METRIC_VIEWS[view].metrics}
            />
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Department Metrics</h2>
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={query.data}
                rowKey={(row) => row.department}
                emptyMessage="No department data available"
              />
            </div>
          </GlassCard>
        </motion.div>
      ) : null}
    </div>
  );
}
