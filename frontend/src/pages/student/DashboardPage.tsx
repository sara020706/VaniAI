import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ClipboardCheck,
  FileText,
  Gauge,
  Lightbulb,
  Loader2,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import {
  FeatureImportanceChart,
  SkillRadarChart,
  TrendLineChart,
  type ChartDatum,
  type SkillRadarDatum,
} from "@/components/charts";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  PageHeader,
  RiskBadge,
  ScoreRing,
  StatCard,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { predictionApi } from "@/lib/api";
import { useChartColors } from "@/lib/chart-colors";
import { featureLabel } from "@/lib/constants";
import { cn, formatDateTime, formatPercent, formatScore, getApiErrorMessage } from "@/lib/utils";
import type {
  CareerRecommendation,
  ExplanationFactor,
  Prediction,
  PredictionHistoryItem,
  Readiness,
  Recommendation,
  SkillGap,
  Student,
} from "@/types";

import {
  categoryMeta,
  PRIORITY_META,
  PRIORITY_RANK,
} from "@/pages/student/recommendation-meta";
import {
  studentKeys,
  useLatestPrediction,
  useMe,
  usePredictionHistory,
} from "@/pages/student/use-student";

// ---------------------------------------------------------------------------
// Animation variants (framer stagger for card grids / timelines)
// ---------------------------------------------------------------------------

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const listItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

// ---------------------------------------------------------------------------
// Readiness breakdown
// ---------------------------------------------------------------------------

const READINESS_DIMENSIONS: { key: keyof Readiness; label: string }[] = [
  { key: "academic", label: "Academic" },
  { key: "technical", label: "Technical" },
  { key: "communication", label: "Communication" },
  { key: "industry", label: "Industry" },
];

function ReadinessBreakdown({ readiness }: { readiness: Readiness }) {
  const colors = useChartColors();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {READINESS_DIMENSIONS.map((dimension) => {
        const value = readiness[dimension.key];
        const band =
          value >= 70
            ? colors.status.good
            : value >= 40
              ? colors.status.warning
              : colors.status.critical;
        return (
          <div key={dimension.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{dimension.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatScore(value)}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(value)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${dimension.label} readiness`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, value))}%`,
                  backgroundColor: band,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed factor lists (top positive / negative)
// ---------------------------------------------------------------------------

function FactorList({
  title,
  factors,
  positive,
}: {
  title: string;
  factors: ExplanationFactor[];
  positive: boolean;
}) {
  if (factors.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        {positive ? (
          <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
        )}
        {title}
      </p>
      <ul className="space-y-1.5">
        {factors.map((factor) => (
          <li
            key={factor.feature}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-1.5 text-sm"
          >
            <span className="truncate">
              {factor.label || featureLabel(factor.feature)}
            </span>
            <span
              className={cn(
                "shrink-0 font-medium tabular-nums",
                positive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {(factor.impact ?? 0) >= 0 ? "+" : ""}
              {(factor.impact ?? 0).toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill gaps
// ---------------------------------------------------------------------------

function SkillGapList({ gaps }: { gaps: SkillGap[] }) {
  const sorted = useMemo(
    () => [...gaps].sort((a, b) => PRIORITY_RANK[a.severity] - PRIORITY_RANK[b.severity]),
    [gaps],
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No skill gaps detected"
        description="Every tracked skill meets or exceeds its target — keep it up!"
      />
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((gap) => {
        const priority = PRIORITY_META[gap.severity];
        const pct = gap.target > 0 ? Math.min(100, (gap.current / gap.target) * 100) : 0;
        return (
          <li key={gap.skill} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium capitalize">{gap.skill}</span>
              <Badge variant={priority.badgeVariant}>{priority.label}</Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", priority.accentClass)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Current {formatScore(gap.current)} · Target {formatScore(gap.target)} · Gap{" "}
              {formatScore(gap.gap)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Recommendations timeline (priority-badged, category icons, framer stagger)
// ---------------------------------------------------------------------------

function RecommendationsTimeline({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const sorted = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      ),
    [recommendations],
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No recommendations yet"
        description="Run a prediction to generate a personalised action plan."
      />
    );
  }

  return (
    <motion.ol
      className="relative space-y-4 pl-6"
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      <span
        className="absolute inset-y-1 left-[9px] w-px bg-border"
        aria-hidden="true"
      />
      {sorted.map((rec) => {
        const meta = categoryMeta(rec.category);
        const priority = PRIORITY_META[rec.priority];
        const Icon = meta.icon;
        return (
          <motion.li key={rec.id} variants={listItem} className="relative">
            <span
              className={cn(
                "absolute -left-6 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-background",
                priority.accentClass,
              )}
              aria-hidden="true"
            />
            <div className="rounded-xl border bg-card/50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {meta.label}
                </span>
                <Badge variant={priority.badgeVariant}>{priority.label}</Badge>
              </div>
              <p className="text-sm">{rec.text}</p>
            </div>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

// ---------------------------------------------------------------------------
// Career recommendation cards (match_score meters + reasons)
// ---------------------------------------------------------------------------

function CareerCards({ careers }: { careers: CareerRecommendation[] }) {
  const colors = useChartColors();

  if (careers.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No career matches yet"
        description="Career suggestions appear after your first prediction."
      />
    );
  }

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      {careers.map((career) => {
        const band =
          career.match_score >= 70
            ? colors.status.good
            : career.match_score >= 40
              ? colors.status.warning
              : colors.status.critical;
        return (
          <motion.div key={career.role} variants={listItem}>
            <GlassCard className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold leading-tight">{career.role}</h4>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {Math.round(career.match_score)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, career.match_score))}%`,
                    backgroundColor: band,
                  }}
                />
              </div>
              {career.reasons.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {career.reasons.map((reason, index) => (
                    <li
                      key={index}
                      className="flex gap-1.5 text-xs text-muted-foreground"
                    >
                      <Sparkles
                        className="mt-0.5 h-3 w-3 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("p-5", className)}>
      <div className="mb-4 flex items-center gap-2">
        <span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg text-white shadow">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Build the probability + readiness trend series from history. */
function buildTrendData(history: PredictionHistoryItem[]): ChartDatum[] {
  return [...history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((item) => ({
      date: formatDateTime(item.created_at),
      probability: Math.round(item.placement_probability * 100),
      readiness: Math.round(item.readiness_overall),
    }));
}

/** Build the current-skills radar from the student profile. */
function buildSkillRadar(student: Student): SkillRadarDatum[] {
  const skills = student.skills;
  return [
    { skill: "Coding", value: skills.coding_score ?? 0 },
    { skill: "Aptitude", value: skills.aptitude_score ?? 0 },
    { skill: "Communication", value: skills.communication_score ?? 0 },
    { skill: "Technical", value: skills.technical_skill_score ?? 0 },
    { skill: "Leadership", value: skills.leadership_score ?? 0 },
  ];
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const student = meQuery.data;
  const studentId = student?.id;

  const predictionQuery = useLatestPrediction(studentId);
  const historyQuery = usePredictionHistory(studentId);

  const predictMutation = useMutation({
    mutationFn: () => predictionApi.predict(studentId as number),
    onSuccess: (prediction: Prediction) => {
      queryClient.setQueryData(
        studentKeys.latestPrediction(prediction.student_id),
        prediction,
      );
      void queryClient.invalidateQueries({
        queryKey: studentKeys.latestPrediction(prediction.student_id),
      });
      void queryClient.invalidateQueries({
        queryKey: studentKeys.predictionHistory(prediction.student_id),
      });
      void queryClient.invalidateQueries({ queryKey: studentKeys.me });
      toast.success("Prediction complete — your dashboard is up to date.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not run the prediction."));
    },
  });

  const runPrediction = () => {
    if (studentId === undefined) return;
    predictMutation.mutate();
  };

  const runButton = (
    <Button
      variant="gradient"
      onClick={runPrediction}
      disabled={studentId === undefined || predictMutation.isPending}
    >
      {predictMutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles aria-hidden="true" />
      )}
      {predictMutation.isPending ? "Running…" : "Run Prediction"}
    </Button>
  );

  // Profile load failed entirely → hard error.
  if (meQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome${student ? `, ${student.full_name.split(" ")[0]}` : ""}`}
          description="Your placement readiness at a glance."
        />
        <ErrorState onRetry={() => void meQuery.refetch()} />
      </div>
    );
  }

  if (meQuery.isLoading || !student) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Welcome"
          description="Your placement readiness at a glance."
        />
        <DashboardSkeleton />
      </div>
    );
  }

  const prediction = predictionQuery.data;
  const history = historyQuery.data ?? [];
  const trendData = buildTrendData(history);
  const skillRadar = buildSkillRadar(student);

  const professional = student.professional;
  const hasPrediction = Boolean(prediction);
  const predictionSettled = !predictionQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${student.full_name.split(" ")[0]}`}
        description={`${student.register_number} · ${student.department} · Batch ${student.batch}`}
        actions={runButton}
      />

      {/* Hero StatCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="flex items-center gap-4 p-5">
          <ScoreRing
            value={prediction ? prediction.placement_probability * 100 : 0}
            size={92}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Placement Probability
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {prediction
                ? formatPercent(prediction.placement_probability, 1)
                : "—"}
            </p>
            {prediction && (
              <div className="mt-1.5">
                <RiskBadge level={prediction.risk_level} />
              </div>
            )}
          </div>
        </GlassCard>

        <StatCard
          title="Overall Readiness"
          value={prediction ? formatScore(prediction.readiness.overall) : "—"}
          icon={Gauge}
          gradient
          description="Out of 100"
        />
        <StatCard
          title="Resume Score"
          value={formatScore(professional.resume_score)}
          icon={FileText}
          description="From your latest resume analysis"
        />
        <StatCard
          title="Interview Score"
          value={formatScore(professional.mock_interview_score)}
          icon={ClipboardCheck}
          description="Latest mock interview"
        />
      </div>

      {/* No-prediction-yet CTA */}
      {predictionSettled && !hasPrediction && (
        <GlassCard className="p-8">
          <EmptyState
            icon={Sparkles}
            title="No prediction yet"
            description="Run your first placement prediction to unlock readiness insights, an explainable score breakdown, skill-gap analysis and a personalised action plan."
            action={runButton}
          />
        </GlassCard>
      )}

      {/* Prediction-driven content */}
      {hasPrediction && prediction && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Readiness Breakdown"
              description="Per-dimension career readiness (0–100)"
              icon={Gauge}
            >
              <ReadinessBreakdown readiness={prediction.readiness} />
            </Section>

            <Section
              title="Current Skills"
              description="Your latest self-reported skill profile"
              icon={Radar}
            >
              <SkillRadarChart data={skillRadar} height={260} />
            </Section>
          </div>

          <Section
            title="Placement Probability & Readiness Trend"
            description="How your scores have changed across predictions"
            icon={TrendingUp}
          >
            {trendData.length >= 2 ? (
              <TrendLineChart
                data={trendData}
                xKey="date"
                series={[
                  { key: "probability", name: "Probability (%)" },
                  { key: "readiness", name: "Readiness" },
                ]}
              />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="Not enough history yet"
                description="Run predictions over time to see your trend line build up."
              />
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="What's Driving Your Score"
              description="Signed SHAP contributions from your latest prediction"
              icon={Target}
            >
              {prediction.explanation.feature_importance.length > 0 ? (
                <>
                  <FeatureImportanceChart
                    data={[
                      ...prediction.explanation.top_positive,
                      ...prediction.explanation.top_negative,
                    ]}
                    signed
                  />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FactorList
                      title="Top positive factors"
                      factors={prediction.explanation.top_positive}
                      positive
                    />
                    <FactorList
                      title="Top negative factors"
                      factors={prediction.explanation.top_negative}
                      positive={false}
                    />
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Target}
                  title="No explanation available"
                  description="The latest prediction did not return factor contributions."
                />
              )}
            </Section>

            <Section
              title="Skill Gaps"
              description="Where you fall short of target and by how much"
              icon={Target}
            >
              <SkillGapList gaps={prediction.skill_gaps} />
            </Section>
          </div>

          {prediction.risk_reasons.length > 0 && (
            <Section
              title="Risk Signals"
              description="Key factors behind your current risk level"
              icon={Gauge}
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {prediction.risk_reasons.map((reason, index) => (
                  <li
                    key={index}
                    className="flex gap-2 rounded-lg border bg-card/50 px-3 py-2 text-sm"
                  >
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Recommended Actions"
            description="Prioritised steps to raise your placement readiness"
            icon={Lightbulb}
          >
            <RecommendationsTimeline recommendations={prediction.recommendations} />
          </Section>

          <Section
            title="Career Matches"
            description="Roles that fit your current profile"
            icon={Briefcase}
          >
            <CareerCards careers={prediction.career_recommendations} />
          </Section>
        </>
      )}
    </div>
  );
}
