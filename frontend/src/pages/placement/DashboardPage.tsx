import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Grid3x3,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import {
  DepartmentComparisonChart,
  type DepartmentComparisonDatum,
  DistributionBarChart,
  RiskDonutChart,
  RiskHeatmap,
} from "@/components/charts";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { cn } from "@/lib/utils";
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

/** Small uppercase eyebrow + bold title used above each analytics section. */
function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: typeof Users;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

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

  // Largest cohort-average score to normalise the strongest-skill meter widths.
  const topSkillMax = useMemo(
    () =>
      Math.max(1, ...(query.data?.top_skills ?? []).map((s) => s.average)),
    [query.data],
  );
  // Largest below-target count to normalise the weak-skill meter widths.
  const weakSkillMax = useMemo(
    () =>
      Math.max(
        1,
        ...(query.data?.common_weak_skills ?? []).map(
          (s) => s.students_below_target,
        ),
      ),
    [query.data],
  );

  return (
    <div className="space-y-8">
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
            <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
              <div className="surface-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
                <SectionHeading
                  eyebrow="Cohort"
                  title="Probability Distribution"
                  description="Students grouped by placement-probability band."
                  icon={Percent}
                />
                <DistributionBarChart
                  data={query.data.probability_distribution}
                />
              </div>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
              <div className="surface-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
                <SectionHeading
                  eyebrow="Risk"
                  title="Risk Distribution"
                  description="Share of students in each risk band."
                  icon={TrendingDown}
                />
                <RiskDonutChart data={query.data.risk_distribution} />
              </div>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
            <div className="surface-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
              <SectionHeading
                eyebrow="Departments"
                title="Department Comparison"
                description="Average readiness and probability (%) by department."
                icon={Grid3x3}
              />
              <DepartmentComparisonChart
                data={departmentData}
                metrics={[
                  { key: "average_readiness", name: "Avg Readiness" },
                  { key: "average_probability", name: "Avg Probability %" },
                ]}
              />
            </div>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-2"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <div className="gradient-border h-full p-6">
                <SectionHeading
                  eyebrow="AI Insight"
                  title="Strongest Skills (Cohort)"
                  icon={Sparkles}
                />
                {query.data.top_skills.length > 0 ? (
                  <ul className="space-y-3">
                    {query.data.top_skills.map((skill, index) => (
                      <li key={skill.skill} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate capitalize">
                              {skill.skill}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums text-electric">
                            {formatScore(skill.average, 1)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-cyan"
                            style={{
                              width: `${Math.max(
                                6,
                                (skill.average / topSkillMax) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No skill data yet"
                    description="Cohort skill strengths will surface here once assessments are in."
                    className="border-0 bg-transparent py-10"
                  />
                )}
              </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <div className="gradient-border h-full p-6">
                <SectionHeading
                  eyebrow="AI Insight"
                  title="Most Common Weak Skills"
                  icon={TrendingUp}
                />
                {query.data.common_weak_skills.length > 0 ? (
                  <ul className="space-y-3">
                    {query.data.common_weak_skills.map((skill, index) => (
                      <li key={skill.skill} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate capitalize">
                              {skill.skill}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {skill.students_below_target} below target
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={cn(
                              "h-full rounded-full bg-warning/70",
                            )}
                            style={{
                              width: `${Math.max(
                                6,
                                (skill.students_below_target / weakSkillMax) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={TrendingUp}
                    title="No weak-skill data yet"
                    description="Common skill gaps across the cohort will appear here."
                    className="border-0 bg-transparent py-10"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }}>
            <div className="surface-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
              <SectionHeading
                eyebrow="Concentration"
                title="Risk Heatmap — Department × Batch"
                description="Cell color and count show the number of high-risk students."
                icon={Grid3x3}
              />
              <RiskHeatmap data={query.data.risk_heatmap} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
