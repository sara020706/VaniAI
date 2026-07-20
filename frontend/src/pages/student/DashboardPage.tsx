import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
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

const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ---------------------------------------------------------------------------
// Section eyebrow — small uppercase label above a bold title.
// ---------------------------------------------------------------------------

function SectionEyebrow({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h3 className="text-lg font-semibold leading-tight tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

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
    <div className="grid gap-5 sm:grid-cols-2">
      {READINESS_DIMENSIONS.map((dimension) => {
        const value = readiness[dimension.key];
        const band =
          value >= 70
            ? colors.status.good
            : value >= 40
              ? colors.status.warning
              : colors.status.critical;
        return (
          <div key={dimension.key} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{dimension.label}</span>
              <span className="text-lg font-bold tabular-nums">
                {formatScore(value)}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(value)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${dimension.label} readiness`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: band }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence meter — derived (not new data) from the spread of the top
// SHAP factor magnitudes: a wider, cleaner separation reads as higher
// model confidence. Presented as a qualitative band, never a raw number.
// ---------------------------------------------------------------------------

function ConfidenceMeter({ explanation }: { explanation: Prediction["explanation"] }) {
  const { pct, label } = useMemo(() => {
    const factors = [
      ...explanation.top_positive,
      ...explanation.top_negative,
    ];
    if (factors.length === 0) return { pct: 40, label: "Limited" };
    const total = factors.reduce(
      (sum, factor) => sum + Math.abs(factor.impact ?? 0),
      0,
    );
    const top = Math.max(
      ...factors.map((factor) => Math.abs(factor.impact ?? 0)),
      0,
    );
    // Concentration of signal in the leading factor → a bounded 0–100 read.
    const concentration = total > 0 ? top / total : 0;
    const value = Math.round(45 + concentration * 50);
    const clamped = Math.min(97, Math.max(35, value));
    const label =
      clamped >= 75 ? "High" : clamped >= 55 ? "Moderate" : "Emerging";
    return { pct: clamped, label };
  }, [explanation]);

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Model confidence
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Model confidence: ${label}`}
      >
        <motion.div
          className="gradient-primary h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        How strongly your leading factors point in one direction.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed factor contribution cards (top positive / negative)
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
  const max = Math.max(...factors.map((f) => Math.abs(f.impact ?? 0)), 0.0001);
  return (
    <div className="space-y-3">
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider",
          positive ? "text-success" : "text-destructive",
        )}
      >
        {positive ? (
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
        )}
        {title}
      </p>
      <ul className="space-y-2">
        {factors.map((factor) => {
          const magnitude = Math.abs(factor.impact ?? 0);
          const width = Math.round((magnitude / max) * 100);
          return (
            <li
              key={factor.feature}
              className="rounded-2xl border border-border/70 bg-card/60 p-3"
            >
              <p className="truncate text-sm font-medium">
                {factor.label || featureLabel(factor.feature)}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    positive ? "bg-success" : "bg-destructive",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          );
        })}
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
    <ul className="space-y-4">
      {sorted.map((gap) => {
        const priority = PRIORITY_META[gap.severity];
        const pct = gap.target > 0 ? Math.min(100, (gap.current / gap.target) * 100) : 0;
        return (
          <li key={gap.skill} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium capitalize">{gap.skill}</span>
              <Badge variant={priority.badgeVariant}>{priority.label}</Badge>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn("h-full rounded-full", priority.accentClass)}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
      className="relative space-y-4 pl-7"
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      <span
        className="absolute inset-y-2 left-[11px] w-px bg-gradient-to-b from-primary/40 via-border to-transparent"
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
                "absolute -left-7 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-background",
                priority.accentClass,
              )}
              aria-hidden="true"
            >
              <Icon className="h-3 w-3 text-white" aria-hidden="true" />
            </span>
            <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-shadow hover:shadow-[var(--shadow-md)]">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
                <Badge variant={priority.badgeVariant}>{priority.label}</Badge>
              </div>
              <p className="text-sm leading-relaxed">{rec.text}</p>
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
          <motion.div
            key={career.role}
            variants={listItem}
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="surface-card flex h-full flex-col gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold leading-tight">{career.role}</h4>
                <span className="shrink-0 text-lg font-bold tabular-nums">
                  {Math.round(career.match_score)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: band }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, Math.max(0, career.match_score))}%`,
                  }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              {career.reasons.length > 0 && (
                <ul className="mt-1 space-y-1.5">
                  {career.reasons.map((reason, index) => (
                    <li
                      key={index}
                      className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground"
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
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section shell (surface card + eyebrow header)
// ---------------------------------------------------------------------------

function Section({
  eyebrow,
  title,
  description,
  icon,
  children,
  className,
  ai = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  ai?: boolean;
}) {
  return (
    <motion.div variants={listItem}>
      <div className={cn(ai ? "gradient-border p-6" : "surface-card p-6", className)}>
        <SectionEyebrow
          eyebrow={eyebrow}
          title={title}
          description={description}
          icon={icon}
        />
        {children}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <Skeleton className="h-72 rounded-3xl" />
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

      {/* Hero — signature placement-probability gauge */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="gradient-border overflow-hidden"
      >
        <div className="hero-sheen relative rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
            <div className="relative shrink-0">
              {prediction && (
                <span
                  className="pulse-ring absolute inset-0 rounded-full"
                  aria-hidden="true"
                />
              )}
              <ScoreRing
                value={prediction ? prediction.placement_probability * 100 : 0}
                size={168}
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:justify-start">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                AI Placement Prediction
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {prediction ? (
                  <span className="gradient-text">
                    {formatPercent(prediction.placement_probability, 1)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                estimated probability of placement
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                {prediction ? (
                  <>
                    <RiskBadge level={prediction.risk_level} />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Readiness {formatScore(prediction.readiness.overall)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Run a prediction to see your score.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Supporting stat tiles */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={listContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={listItem}>
          <StatCard
            title="Overall Readiness"
            value={prediction ? formatScore(prediction.readiness.overall) : "—"}
            icon={Gauge}
            gradient
            description="Out of 100"
          />
        </motion.div>
        <motion.div variants={listItem}>
          <StatCard
            title="Resume Score"
            value={formatScore(professional.resume_score)}
            icon={FileText}
            description="From your latest resume analysis"
          />
        </motion.div>
        <motion.div variants={listItem}>
          <StatCard
            title="Interview Score"
            value={formatScore(professional.mock_interview_score)}
            icon={ClipboardCheck}
            description="Latest mock interview"
          />
        </motion.div>
      </motion.div>

      {/* No-prediction-yet CTA */}
      {predictionSettled && !hasPrediction && (
        <div className="surface-card p-6">
          <EmptyState
            icon={Sparkles}
            title="No prediction yet"
            description="Run your first placement prediction to unlock readiness insights, an explainable score breakdown, skill-gap analysis and a personalised action plan."
            action={runButton}
          />
        </div>
      )}

      {/* Prediction-driven content */}
      {hasPrediction && prediction && (
        <motion.div
          className="space-y-6"
          variants={listContainer}
          initial="hidden"
          animate="show"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              eyebrow="Diagnostics"
              title="Readiness Breakdown"
              description="Per-dimension career readiness (0–100)"
              icon={Gauge}
            >
              <ReadinessBreakdown readiness={prediction.readiness} />
            </Section>

            <Section
              eyebrow="Skill Profile"
              title="Current Skills"
              description="Your latest self-reported skill profile"
              icon={Radar}
            >
              <SkillRadarChart data={skillRadar} height={260} />
            </Section>
          </div>

          <Section
            eyebrow="Trend"
            title="Placement Probability & Readiness"
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
              eyebrow="Explainable AI"
              title="What's Driving Your Score"
              description="The factors your model weighed most, and which way they pushed"
              icon={Target}
              ai
            >
              {prediction.explanation.feature_importance.length > 0 ? (
                <div className="space-y-5">
                  <ConfidenceMeter explanation={prediction.explanation} />
                  <FeatureImportanceChart
                    data={[
                      ...prediction.explanation.top_positive,
                      ...prediction.explanation.top_negative,
                    ]}
                    signed
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FactorList
                      title="Lifting your score"
                      factors={prediction.explanation.top_positive}
                      positive
                    />
                    <FactorList
                      title="Holding it back"
                      factors={prediction.explanation.top_negative}
                      positive={false}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Target}
                  title="No explanation available"
                  description="The latest prediction did not return factor contributions."
                />
              )}
            </Section>

            <Section
              eyebrow="Focus Areas"
              title="Skill Gaps"
              description="Where you fall short of target and by how much"
              icon={Target}
            >
              <SkillGapList gaps={prediction.skill_gaps} />
            </Section>
          </div>

          {prediction.risk_reasons.length > 0 && (
            <Section
              eyebrow="Risk"
              title="Risk Signals"
              description="Key factors behind your current risk level"
              icon={Gauge}
            >
              <ul className="grid gap-3 sm:grid-cols-2">
                {prediction.risk_reasons.map((reason, index) => (
                  <li
                    key={index}
                    className="flex gap-2.5 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-sm leading-relaxed"
                  >
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            eyebrow="Action Plan"
            title="Recommended Next Steps"
            description="Prioritised steps to raise your placement readiness"
            icon={Lightbulb}
            ai
          >
            <RecommendationsTimeline recommendations={prediction.recommendations} />
          </Section>

          <Section
            eyebrow="Opportunities"
            title="Career Matches"
            description="Roles that fit your current profile"
            icon={Briefcase}
          >
            <CareerCards careers={prediction.career_recommendations} />
          </Section>
        </motion.div>
      )}
    </div>
  );
}
