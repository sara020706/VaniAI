import { LineChart, Radar, TrendingUp, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";

import {
  ProgressAreaChart,
  TrendLineChart,
  type ChartDatum,
} from "@/components/charts";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";

import {
  usePredictionHistory,
  useMe,
  useStudentProgress,
} from "@/pages/student/use-student";

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Section({
  eyebrow,
  title,
  description,
  icon: Icon,
  premium = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  /** Wrap in the teal "AI" gradient ring — reserved for prediction/insight. */
  premium?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.section variants={itemVariants} whileHover={{ y: -2 }}>
      <div
        className={cn(
          "surface-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)] sm:p-7",
          premium && "gradient-border",
        )}
      >
        <div className="mb-5 flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
              premium
                ? "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                : "border-primary/15 bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="text-lg font-bold leading-tight tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </motion.section>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Not enough data yet"
      description={label}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const meQuery = useMe();
  const studentId = meQuery.data?.id;

  const progressQuery = useStudentProgress(studentId);
  const historyQuery = usePredictionHistory(studentId);

  const academicData: ChartDatum[] = useMemo(
    () =>
      (progressQuery.data?.academic_history ?? [])
        .map((point) => ({
          date: formatDate(point.recorded_at),
          cgpa: Number((point.cgpa * 10).toFixed(1)),
          attendance: Number(point.attendance_percentage.toFixed(1)),
        })),
    [progressQuery.data],
  );

  const skillData: ChartDatum[] = useMemo(
    () =>
      (progressQuery.data?.skill_history ?? []).map((point) => ({
        date: formatDate(point.recorded_at),
        coding_score: Number(point.coding_score.toFixed(1)),
        aptitude_score: Number(point.aptitude_score.toFixed(1)),
        communication_score: Number(point.communication_score.toFixed(1)),
        technical_skill_score: Number(point.technical_skill_score.toFixed(1)),
        leadership_score: Number(point.leadership_score.toFixed(1)),
      })),
    [progressQuery.data],
  );

  const predictionData: ChartDatum[] = useMemo(
    () =>
      [...(historyQuery.data ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((item) => ({
          date: formatDate(item.created_at),
          probability: Math.round(item.placement_probability * 100),
          readiness: Math.round(item.readiness_overall),
        })),
    [historyQuery.data],
  );

  const isError = meQuery.isError || progressQuery.isError || historyQuery.isError;
  const isLoading =
    meQuery.isLoading ||
    !studentId ||
    progressQuery.isLoading ||
    historyQuery.isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Progress"
        description="Track how your academics, skills and placement readiness have evolved over time."
      />

      {isError ? (
        <ErrorState
          onRetry={() => {
            void meQuery.refetch();
            void progressQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : (
        <motion.div
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Section
            eyebrow="Academics"
            title="Academic History"
            description="CGPA (scaled to 100) and attendance across recorded snapshots."
            icon={TrendingUp}
          >
            {academicData.length >= 2 ? (
              <ProgressAreaChart
                data={academicData}
                xKey="date"
                series={[
                  { key: "cgpa", name: "CGPA ×10" },
                  { key: "attendance", name: "Attendance %" },
                ]}
              />
            ) : (
              <ChartEmpty label="Academic snapshots will appear here as your records are updated over time." />
            )}
          </Section>

          <Section
            eyebrow="Skills"
            title="Skill History"
            description="Your skill scores across recorded snapshots."
            icon={Radar}
          >
            {skillData.length >= 2 ? (
              <TrendLineChart
                data={skillData}
                xKey="date"
                series={[
                  { key: "coding_score", name: "Coding" },
                  { key: "aptitude_score", name: "Aptitude" },
                  { key: "communication_score", name: "Communication" },
                  { key: "technical_skill_score", name: "Technical" },
                  { key: "leadership_score", name: "Leadership" },
                ]}
                height={320}
              />
            ) : (
              <ChartEmpty label="Skill snapshots will appear here as your records are updated over time." />
            )}
          </Section>

          <Section
            eyebrow="Prediction"
            title="Prediction History"
            description="Placement probability and overall readiness across predictions."
            icon={LineChart}
            premium
          >
            {predictionData.length >= 2 ? (
              <TrendLineChart
                data={predictionData}
                xKey="date"
                series={[
                  { key: "probability", name: "Probability (%)" },
                  { key: "readiness", name: "Readiness" },
                ]}
              />
            ) : (
              <ChartEmpty label="Run predictions over time from your dashboard to build this trend." />
            )}
          </Section>
        </motion.div>
      )}
    </div>
  );
}
