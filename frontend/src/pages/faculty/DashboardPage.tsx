import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  RiskDonutChart,
  SkillRadarChart,
  type SkillRadarDatum,
} from "@/components/charts";
import {
  DataTable,
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  RiskBadge,
  StatCard,
  type DataTableColumn,
} from "@/components/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { facultyApi } from "@/lib/api";
import { BATCHES, DEPARTMENTS } from "@/lib/constants";
import { formatPercent, formatScore } from "@/lib/utils";
import type { Department, StudentListItem } from "@/types";

const ALL_VALUE = "__all__";

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
 * Faculty overview: department / batch filters drive the analytics query;
 * headline KPIs, a skill-average radar, a risk donut, and top-performer /
 * weak-student tables that deep-link into each student's detail view.
 */
export default function FacultyDashboardPage() {
  const navigate = useNavigate();
  const [department, setDepartment] = useState<string>(ALL_VALUE);
  const [batch, setBatch] = useState<string>(ALL_VALUE);

  const params = useMemo(
    () => ({
      department: department === ALL_VALUE ? undefined : (department as Department),
      batch: batch === ALL_VALUE ? undefined : batch,
    }),
    [department, batch],
  );

  const query = useQuery({
    queryKey: ["faculty", "analytics", params],
    queryFn: () => facultyApi.analytics(params),
  });

  const radarData: SkillRadarDatum[] = useMemo(() => {
    const averages = query.data?.skill_averages;
    if (!averages) return [];
    return [
      { skill: "Coding", value: averages.coding },
      { skill: "Aptitude", value: averages.aptitude },
      { skill: "Communication", value: averages.communication },
      { skill: "Technical", value: averages.technical },
      { skill: "Leadership", value: averages.leadership },
    ];
  }, [query.data]);

  const columns: DataTableColumn<StudentListItem>[] = [
    {
      key: "full_name",
      header: "Student",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.register_number}
          </p>
        </div>
      ),
    },
    { key: "department", header: "Dept" },
    {
      key: "cgpa",
      header: "CGPA",
      render: (row) => formatScore(row.cgpa, 2),
      className: "tabular-nums",
    },
    {
      key: "placement_probability",
      header: "Probability",
      render: (row) => formatPercent(row.placement_probability),
      className: "tabular-nums",
    },
    {
      key: "risk_level",
      header: "Risk",
      render: (row) => (row.risk_level ? <RiskBadge level={row.risk_level} /> : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Dashboard"
        description="Cohort readiness at a glance — filter by department and batch."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Department
              </Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger aria-label="Filter by department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Batch
              </Label>
              <Select value={batch} onValueChange={setBatch}>
                <SelectTrigger aria-label="Filter by batch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All batches</SelectItem>
                  {BATCHES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      {query.isLoading ? (
        <LoadingState label="Loading analytics…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <motion.div
          className="space-y-6"
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
                title="Students"
                value={query.data.student_count}
                icon={Users}
                description="In the current selection"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Average CGPA"
                value={formatScore(query.data.average_cgpa, 2)}
                icon={GraduationCap}
                description="Out of 10"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Avg Readiness"
                value={formatScore(query.data.average_readiness, 1)}
                icon={TrendingUp}
                gradient
                description="Overall readiness score"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="At Risk"
                value={query.data.at_risk_count}
                icon={AlertTriangle}
                description="High-risk students"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-2"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-1 text-sm font-semibold">Skill Averages</h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Cohort mean across the five tracked skills (0–100).
                </p>
                <SkillRadarChart data={radarData} />
              </GlassCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-1 text-sm font-semibold">Risk Distribution</h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  How many students sit in each risk band.
                </p>
                <RiskDonutChart data={query.data.risk_distribution} />
              </GlassCard>
            </motion.div>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-2"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Top Performers</h2>
                <DataTable
                  columns={columns}
                  data={query.data.top_performers}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => navigate(`/faculty/students/${row.id}`)}
                  emptyMessage="No performers to show yet"
                />
              </GlassCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold">
                  Students Needing Support
                </h2>
                <DataTable
                  columns={columns}
                  data={query.data.weak_students}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => navigate(`/faculty/students/${row.id}`)}
                  emptyMessage="No at-risk students in this selection"
                />
              </GlassCard>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
