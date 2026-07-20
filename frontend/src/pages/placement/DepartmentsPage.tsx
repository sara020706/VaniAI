import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  FileDown,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
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
  StatCard,
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
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

  // Cohort-level headline figures derived in-component (no extra API calls).
  const summary = useMemo(() => {
    const rows = query.data ?? [];
    if (rows.length === 0) {
      return {
        departments: 0,
        students: 0,
        avgReadiness: 0,
        atRisk: 0,
      };
    }
    const students = rows.reduce((sum, row) => sum + row.student_count, 0);
    const atRisk = rows.reduce((sum, row) => sum + row.at_risk_count, 0);
    const weightedReadiness = rows.reduce(
      (sum, row) => sum + row.average_readiness * row.student_count,
      0,
    );
    return {
      departments: rows.length,
      students,
      avgReadiness: students > 0 ? weightedReadiness / students : 0,
      atRisk,
    };
  }, [query.data]);

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
          className="rounded-xl"
          aria-label={`Download PDF report for ${row.department}`}
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
    <div className="space-y-8">
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
          className="space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <StatCard
                title="Departments"
                value={summary.departments}
                icon={Building2}
                description="Under comparison"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Total Students"
                value={summary.students}
                icon={Users}
                description="Across all departments"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Avg Readiness"
                value={formatScore(summary.avgReadiness, 1)}
                icon={TrendingUp}
                gradient
                description="Enrollment-weighted mean"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="At Risk"
                value={summary.atRisk}
                icon={ShieldAlert}
                description="Students needing support"
              />
            </motion.div>
          </motion.div>

          <motion.section className="space-y-4" variants={containerVariants}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Comparative analytics
              </p>
              <h2 className="text-lg font-bold tracking-tight">
                How departments stack up
              </h2>
            </div>
            <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
              <GlassCard className="gradient-border p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Department Comparison
                    </h3>
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
            </motion.div>
          </motion.section>

          <motion.section className="space-y-4" variants={containerVariants}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Full breakdown
              </p>
              <h2 className="text-lg font-bold tracking-tight">
                Department Metrics
              </h2>
            </div>
            <motion.div variants={itemVariants}>
              <GlassCard className="p-6">
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
          </motion.section>
        </motion.div>
      ) : null}
    </div>
  );
}
