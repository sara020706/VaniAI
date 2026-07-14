import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Percent, TrendingDown, Users } from "lucide-react";
import { useMemo } from "react";

import {
  DepartmentComparisonChart,
  type DepartmentComparisonDatum,
  DistributionBarChart,
  RiskDonutChart,
  RiskHeatmap,
} from "@/components/charts";
import {
  ErrorState,
  GlassCard,
  LoadingState,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { placementApi } from "@/lib/api";
import { formatPercent, formatScore } from "@/lib/utils";

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
 * Placement-officer overview: headline placement KPIs, probability histogram,
 * department comparison, risk donut, top / weak skill lists, and a
 * department × batch risk heatmap.
 */
export default function PlacementDashboardPage() {
  const query = useQuery({
    queryKey: ["placement", "dashboard"],
    queryFn: () => placementApi.dashboard(),
  });

  // Probability is a 0–1 float; scale to a 0–100 percentage so it shares the
  // readiness axis on the grouped department chart.
  const departmentData: DepartmentComparisonDatum[] = useMemo(
    () =>
      (query.data?.department_comparison ?? []).map((item) => ({
        department: item.department,
        average_readiness: Number(item.average_readiness.toFixed(1)),
        average_probability: Number((item.average_probability * 100).toFixed(1)),
      })),
    [query.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Dashboard"
        description="Institution-wide placement readiness and risk overview."
      />

      {query.isLoading ? (
        <LoadingState label="Loading dashboard…" />
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
                title="Total Students"
                value={query.data.total_students}
                icon={Users}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Placement Ready"
                value={query.data.placement_ready_count}
                icon={CheckCircle2}
                description="Probability ≥ 70%"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="Avg Probability"
                value={formatPercent(query.data.average_probability)}
                icon={Percent}
                gradient
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard
                title="High Risk"
                value={query.data.risk_distribution.high}
                icon={TrendingDown}
                description="Students needing urgent support"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-2"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-1 text-sm font-semibold">
                  Probability Distribution
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Students grouped by placement-probability band.
                </p>
                <DistributionBarChart data={query.data.probability_distribution} />
              </GlassCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-1 text-sm font-semibold">Risk Distribution</h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Share of students in each risk band.
                </p>
                <RiskDonutChart data={query.data.risk_distribution} />
              </GlassCard>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard className="p-5">
              <h2 className="mb-1 text-sm font-semibold">
                Department Comparison
              </h2>
              <p className="mb-2 text-xs text-muted-foreground">
                Average readiness and probability (%) by department.
              </p>
              <DepartmentComparisonChart
                data={departmentData}
                metrics={[
                  { key: "average_readiness", name: "Avg Readiness" },
                  { key: "average_probability", name: "Avg Probability %" },
                ]}
              />
            </GlassCard>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-2"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold">
                  Strongest Skills (Cohort)
                </h2>
                {query.data.top_skills.length > 0 ? (
                  <ul className="space-y-2">
                    {query.data.top_skills.map((skill) => (
                      <li
                        key={skill.skill}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="capitalize">{skill.skill}</span>
                        <span className="font-medium tabular-nums">
                          {formatScore(skill.average, 1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No skill data available.
                  </p>
                )}
              </GlassCard>
            </motion.div>
            <motion.div variants={itemVariants}>
              <GlassCard className="p-5">
                <h2 className="mb-3 text-sm font-semibold">
                  Most Common Weak Skills
                </h2>
                {query.data.common_weak_skills.length > 0 ? (
                  <ul className="space-y-2">
                    {query.data.common_weak_skills.map((skill) => (
                      <li
                        key={skill.skill}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="capitalize">{skill.skill}</span>
                        <span className="font-medium tabular-nums text-muted-foreground">
                          {skill.students_below_target} students below target
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No weak-skill data available.
                  </p>
                )}
              </GlassCard>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard className="p-5">
              <h2 className="mb-1 text-sm font-semibold">
                Risk Heatmap — Department × Batch
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Cell color and count show the number of high-risk students.
              </p>
              <RiskHeatmap data={query.data.risk_heatmap} />
            </GlassCard>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
